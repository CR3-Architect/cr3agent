import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Workspace } from './workspace';
import { IGNORED_DIRS, looksBinary, walkFiles } from './fsutil';
import { runShell } from './shell';
import { CompactRow, compactDiff, diffText } from './diff';
import { Skill } from './skills';
import { fetchUrlText } from './web';

/** read: only looks. edit: changes files. command: runs programs. network: talks to the internet. */
export type ToolKind = 'read' | 'edit' | 'command' | 'network';
export type Args = Record<string, unknown>;

export interface ToolContext {
  ws: Workspace;
  signal?: AbortSignal;
  skills?: () => Skill[];
  /** Live output from long-running tools (commands). */
  onOutput?: (chunk: string) => void;
}

export interface Preview {
  path: string;
  status: 'added' | 'modified';
  added: number;
  removed: number;
  rows: CompactRow[];
  truncated: boolean;
}

export interface Tool {
  name: string;
  kind: ToolKind;
  description: string;
  parameters: Record<string, unknown>;
  summarize(args: Args): string;
  run(args: Args, ctx: ToolContext): Promise<string>;
  /** What this call would change, shown to the user before they approve it. */
  preview?(args: Args, ctx: ToolContext): Promise<Preview | null>;
}

const MAX_FILE_CHARS = 60_000;
const MAX_FILE_BYTES = 5_000_000;
const MAX_LIST = 500;
const MAX_MATCHES = 100;
const MAX_SEARCH_FILE_BYTES = 1_000_000;
const MAX_COMMAND_OUTPUT = 30_000;
const DEFAULT_TIMEOUT_S = 60;
const MAX_TIMEOUT_S = 600;

// ---------- argument helpers ----------

function reqString(args: Args, key: string): string {
  const v = args[key];
  if (typeof v !== 'string') {
    throw new Error(`Missing or invalid argument "${key}" (expected a string).`);
  }
  return v;
}

function optString(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

function optInt(args: Args, key: string): number | undefined {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return parseInt(v, 10);
  return undefined;
}

function optBool(args: Args, key: string): boolean {
  const v = args[key];
  return v === true || v === 'true';
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const i = text.indexOf(needle, from);
    if (i === -1) return count;
    count++;
    from = i + needle.length;
  }
}

/** Shared by edit_file and its preview, so what you approve is exactly what gets written. */
export function applyEdit(text: string, oldS: string, newS: string, replaceAll: boolean): { updated: string; count: number } {
  if (oldS === '') throw new Error('old_string must not be empty. To create a file use write_file.');
  if (oldS === newS) throw new Error('old_string and new_string are identical; nothing to change.');
  const count = countOccurrences(text, oldS);
  if (count === 0) {
    throw new Error('old_string was not found. It must match the file exactly, including whitespace. Read the file again and retry.');
  }
  if (count > 1 && !replaceAll) {
    throw new Error(`old_string appears ${count} times. Add more surrounding context to make it unique, or set replace_all to true.`);
  }
  const updated = replaceAll ? text.split(oldS).join(newS) : text.replace(oldS, () => newS);
  return { updated, count: replaceAll ? count : 1 };
}

function shrinkOutput(text: string): string {
  if (text.length <= MAX_COMMAND_OUTPUT) return text;
  const head = text.slice(0, 10_000);
  const tail = text.slice(-20_000);
  const omitted = text.length - head.length - tail.length;
  return `${head}\n[... ${omitted} characters omitted ...]\n${tail}`;
}

function makePreview(rel: string, before: string | null, after: string): Preview {
  const d = diffText(before ?? '', after);
  const c = compactDiff(d.lines);
  return { path: rel, status: before === null ? 'added' : 'modified', added: d.added, removed: d.removed, rows: c.rows, truncated: c.truncated };
}

async function readTextIfExists(full: string): Promise<string | null> {
  try {
    const st = await fs.stat(full);
    if (!st.isFile() || st.size > MAX_FILE_BYTES) return null;
    const buf = await fs.readFile(full);
    return looksBinary(buf) ? null : buf.toString('utf8');
  } catch {
    return null;
  }
}

// ---------- tools ----------

const listDir: Tool = {
  name: 'list_dir',
  kind: 'read',
  description:
    'List files and folders. Paths are relative to the project folder. Folders end with "/". Use recursive to see up to 3 levels deep.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Folder to list. Default: the project folder ".".' },
      recursive: { type: 'boolean', description: 'List nested folders too (max 3 levels).' },
    },
  },
  summarize: (a) => `List ${optString(a, 'path') || '.'}${optBool(a, 'recursive') ? ' (recursive)' : ''}`,
  async run(args, { ws }) {
    const base = await ws.resolve(optString(args, 'path'));
    const st = await fs.stat(base);
    if (!st.isDirectory()) throw new Error('That path is a file, not a folder. Use read_file.');
    const recursive = optBool(args, 'recursive');
    const lines: string[] = [];
    let truncated = false;

    const walk = async (dir: string, depth: number): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        if (lines.length >= MAX_LIST) {
          truncated = true;
          return;
        }
        const full = path.join(dir, e.name);
        const rel = path.relative(base, full).split(path.sep).join('/');
        if (e.isSymbolicLink()) {
          lines.push(`${rel}@`);
        } else if (e.isDirectory()) {
          const skip = IGNORED_DIRS.has(e.name);
          lines.push(`${rel}/${skip ? ' (skipped)' : ''}`);
          if (recursive && !skip && depth < 3) await walk(full, depth + 1);
        } else {
          lines.push(rel);
        }
      }
    };
    await walk(base, 1);
    if (lines.length === 0) return '[empty folder]';
    return lines.join('\n') + (truncated ? `\n[truncated at ${MAX_LIST} entries]` : '');
  },
};

const readFile: Tool = {
  name: 'read_file',
  kind: 'read',
  description:
    'Read a text file. Optionally pass start_line and end_line (1-based, inclusive) to read just part of a large file.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the project folder.' },
      start_line: { type: 'integer' },
      end_line: { type: 'integer' },
    },
    required: ['path'],
  },
  summarize: (a) => `Read ${optString(a, 'path') ?? '?'}`,
  async run(args, { ws }) {
    const full = await ws.resolve(reqString(args, 'path'));
    const st = await fs.stat(full);
    if (st.isDirectory()) throw new Error('That path is a folder. Use list_dir.');
    if (st.size > MAX_FILE_BYTES) {
      throw new Error('File is larger than 5 MB. Use search, or run a command to inspect it.');
    }
    const buf = await fs.readFile(full);
    if (looksBinary(buf)) throw new Error('This looks like a binary file, so it cannot be read as text.');
    let text = buf.toString('utf8');

    const start = optInt(args, 'start_line');
    const end = optInt(args, 'end_line');
    let header = '';
    if (start !== undefined || end !== undefined) {
      const lines = text.split('\n');
      const s = Math.max(1, start ?? 1);
      const e = Math.min(lines.length, end ?? lines.length);
      if (s > lines.length) throw new Error(`start_line ${s} is past the end of the file (${lines.length} lines).`);
      text = lines.slice(s - 1, Math.max(s, e)).join('\n');
      header = `[lines ${s}-${Math.max(s, e)} of ${lines.length}]\n`;
    }
    if (text.length > MAX_FILE_CHARS) {
      text =
        text.slice(0, MAX_FILE_CHARS) +
        `\n[truncated: showing the first ${MAX_FILE_CHARS} characters; use start_line/end_line to read more]`;
    }
    return text === '' ? '[empty file]' : header + text;
  },
};

const writeFile: Tool = {
  name: 'write_file',
  kind: 'edit',
  description:
    'Create a new file, or completely replace an existing one, with the given content. Parent folders are created automatically. For small changes to an existing file, prefer edit_file.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the project folder.' },
      content: { type: 'string', description: 'The full file content.' },
    },
    required: ['path', 'content'],
  },
  summarize: (a) => {
    const c = optString(a, 'content') ?? '';
    return `Write ${optString(a, 'path') ?? '?'} (${c.length} characters)`;
  },
  async preview(args, { ws }) {
    const full = await ws.resolve(reqString(args, 'path'));
    const content = reqString(args, 'content');
    let before: string | null = null;
    try {
      const st = await fs.stat(full);
      if (st.isDirectory()) return null;
      before = await readTextIfExists(full);
      if (before === null) return null; // exists but is binary or huge: no line preview
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return null;
    }
    return makePreview(await ws.rel(full), before, content);
  },
  async run(args, { ws }) {
    const full = await ws.resolve(reqString(args, 'path'));
    const content = reqString(args, 'content');
    let existed = false;
    try {
      const st = await fs.stat(full);
      if (st.isDirectory()) throw new Error('That path is a folder, not a file.');
      existed = true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    return `${existed ? 'Overwrote' : 'Created'} ${await ws.rel(full)} (${content.length} characters).`;
  },
};

const editFile: Tool = {
  name: 'edit_file',
  kind: 'edit',
  description:
    'Edit an existing file by replacing exact text. old_string must match the file exactly (including whitespace and indentation) and appear only once, unless replace_all is true. Include a few surrounding lines to make it unique.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the project folder.' },
      old_string: { type: 'string', description: 'Exact text to find.' },
      new_string: { type: 'string', description: 'Text to replace it with.' },
      replace_all: { type: 'boolean', description: 'Replace every occurrence instead of requiring exactly one.' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  summarize: (a) => `Edit ${optString(a, 'path') ?? '?'}`,
  async preview(args, { ws }) {
    try {
      const full = await ws.resolve(reqString(args, 'path'));
      const before = await readTextIfExists(full);
      if (before === null) return null;
      const { updated } = applyEdit(before, reqString(args, 'old_string'), reqString(args, 'new_string'), optBool(args, 'replace_all'));
      return makePreview(await ws.rel(full), before, updated);
    } catch {
      return null; // the real run reports the problem to the model
    }
  },
  async run(args, { ws }) {
    const full = await ws.resolve(reqString(args, 'path'));
    const st = await fs.stat(full);
    if (st.isDirectory()) throw new Error('That path is a folder, not a file.');
    const text = await fs.readFile(full, 'utf8');
    const { updated, count } = applyEdit(text, reqString(args, 'old_string'), reqString(args, 'new_string'), optBool(args, 'replace_all'));
    await fs.writeFile(full, updated, 'utf8');
    return `Edited ${await ws.rel(full)} (${count} replacement${count === 1 ? '' : 's'}).`;
  },
};

const search: Tool = {
  name: 'search',
  kind: 'read',
  description:
    'Search file contents with a regular expression. Returns "path:line: text" for each match. Skips node_modules, .git, build output and binary files.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'JavaScript regular expression.' },
      path: { type: 'string', description: 'Folder or file to search. Default: the project folder.' },
      include: { type: 'string', description: 'Only search these extensions, comma-separated, e.g. "ts,tsx".' },
      case_insensitive: { type: 'boolean' },
    },
    required: ['pattern'],
  },
  summarize: (a) => `Search for /${optString(a, 'pattern') ?? ''}/`,
  async run(args, { ws, signal }) {
    const pattern = reqString(args, 'pattern');
    let re: RegExp;
    try {
      re = new RegExp(pattern, optBool(args, 'case_insensitive') ? 'i' : '');
    } catch (err) {
      throw new Error(`Invalid regular expression: ${(err as Error).message}`);
    }
    const base = await ws.resolve(optString(args, 'path'));
    const exts = (optString(args, 'include') ?? '')
      .split(',')
      .map((e) => e.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean);

    const st = await fs.stat(base);
    const files = st.isDirectory() ? walkFiles(base, signal) : (async function* () { yield base; })();

    const matches: string[] = [];
    let truncated = false;
    outer: for await (const file of files) {
      if (signal?.aborted) break;
      if (exts.length > 0 && !exts.includes(path.extname(file).slice(1).toLowerCase())) continue;
      let buf: Buffer;
      try {
        const fst = await fs.stat(file);
        if (fst.size > MAX_SEARCH_FILE_BYTES) continue;
        buf = await fs.readFile(file);
      } catch {
        continue;
      }
      if (looksBinary(buf)) continue;
      const rel = await ws.rel(file);
      const lines = buf.toString('utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (re.test(line)) {
          matches.push(`${rel}:${i + 1}: ${clip(line.trim(), 200)}`);
          if (matches.length >= MAX_MATCHES) {
            truncated = true;
            break outer;
          }
        }
      }
    }
    if (matches.length === 0) return 'No matches.';
    return matches.join('\n') + (truncated ? `\n[stopped after ${MAX_MATCHES} matches]` : '');
  },
};

const runCommand: Tool = {
  name: 'run_command',
  kind: 'command',
  description:
    'Run a shell command with the project folder as the working directory and return its output and exit code. Use it for tests, builds, git, installing packages or CLI tools (npm, pip, brew), and running scripts. Commands cannot read from stdin, so use non-interactive flags (for example "npm install --yes", "brew install -q"). Default timeout 60 seconds (max 600).',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to run.' },
      timeout_seconds: { type: 'integer', description: 'Optional timeout, 1-600. Default 60. Use a larger value for installs and builds.' },
    },
    required: ['command'],
  },
  summarize: (a) => `Run: ${clip(optString(a, 'command') ?? '?', 200)}`,
  async run(args, { ws, signal, onOutput }) {
    const command = reqString(args, 'command');
    if (command.trim() === '') throw new Error('command must not be empty.');
    const t = optInt(args, 'timeout_seconds') ?? DEFAULT_TIMEOUT_S;
    const timeoutS = Math.min(MAX_TIMEOUT_S, Math.max(1, t));
    const cwd = await ws.resolve('.');
    const r = await runShell(command, { cwd, timeoutMs: timeoutS * 1000, signal, onData: onOutput });
    const body = shrinkOutput(r.output.trimEnd());
    let status: string;
    if (r.cancelled) status = 'cancelled';
    else if (r.timedOut) status = `timed out after ${timeoutS}s and was killed`;
    else status = `exit code ${r.code ?? 'unknown'}`;
    return `[${status}]\n${body === '' ? '(no output)' : body}`;
  },
};

const fetchUrl: Tool = {
  name: 'fetch_url',
  kind: 'network',
  description:
    'Download a web page or text file from an http(s) link and return it as readable text. Use it for documentation, articles, GitHub raw files or JSON APIs the user points you to.',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string', description: 'Full http:// or https:// address.' } },
    required: ['url'],
  },
  summarize: (a) => `Fetch ${clip(optString(a, 'url') ?? '?', 160)}`,
  async run(args, { signal }) {
    return fetchUrlText(reqString(args, 'url'), signal);
  },
};

const useSkill: Tool = {
  name: 'use_skill',
  kind: 'read',
  description:
    'Load a skill: specialised instructions for a kind of task. Call it by name when the task matches a skill in the "Skills available" list. Pass "file" to read a helper file that belongs to the skill.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill name from the list.' },
      file: { type: 'string', description: 'Optional helper file inside the skill folder, relative path.' },
    },
    required: ['name'],
  },
  summarize: (a) => `Use skill ${optString(a, 'name') ?? '?'}${optString(a, 'file') ? ` (${optString(a, 'file')})` : ''}`,
  async run(args, { skills }) {
    const name = reqString(args, 'name').trim().toLowerCase();
    const all = skills?.() ?? [];
    const skill = all.find((s) => s.name.toLowerCase() === name);
    if (!skill) {
      const names = all.map((s) => s.name).join(', ');
      throw new Error(`No skill named "${reqString(args, 'name')}".${names ? ` Available: ${names}.` : ' No skills are installed.'}`);
    }
    const file = optString(args, 'file');
    if (file) {
      const sws = new Workspace(skill.dir);
      const full = await sws.resolve(file);
      const buf = await fs.readFile(full);
      if (looksBinary(buf)) throw new Error('That helper file is binary, so it cannot be read as text.');
      const text = buf.toString('utf8');
      return text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) + '\n[truncated]' : text;
    }
    const helpers: string[] = [];
    for await (const f of walkFiles(skill.dir)) {
      const rel = path.relative(skill.dir, f).split(path.sep).join('/');
      if (rel !== 'SKILL.md') helpers.push(rel);
      if (helpers.length >= 50) break;
    }
    const lines = [`# Skill: ${skill.name}`, `Skill folder: ${skill.dir}`];
    if (helpers.length > 0) {
      lines.push(`Helper files (read with use_skill and "file", or run by absolute path with run_command): ${helpers.join(', ')}`);
    }
    lines.push('', skill.body.trim());
    return lines.join('\n');
  },
};

export const TOOLS: Tool[] = [listDir, readFile, search, writeFile, editFile, runCommand, fetchUrl, useSkill];

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}

export function openAiToolSchemas(skillsAvailable = true) {
  return TOOLS.filter((t) => skillsAvailable || t.name !== 'use_skill').map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
