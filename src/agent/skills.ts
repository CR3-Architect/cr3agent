import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IGNORED_DIRS, walkFiles } from './fsutil';

export interface Skill {
  name: string;
  description: string;
  /** Folder that holds SKILL.md and any helper files. */
  dir: string;
  source: 'global' | 'project';
  /** SKILL.md without the frontmatter. */
  body: string;
}

export interface SkillDir {
  dir: string;
  source: 'global' | 'project';
}

const MAX_SKILL_MD_BYTES = 200_000;
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isValidSkillName(name: string): boolean {
  return NAME_RE.test(name);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

/** Minimal frontmatter reader: "key: value", quoted values, and indented continuation / block scalars. */
export function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(normalized);
  if (!m) return { meta: {}, body: normalized };
  const meta: Record<string, string> = {};
  let key: string | null = null;
  let block: 'fold' | 'literal' | null = null;
  const parts: string[] = [];
  const flush = () => {
    if (key !== null && block) meta[key] = block === 'fold' ? parts.join(' ').trim() : parts.join('\n').trim();
    block = null;
    parts.length = 0;
  };
  for (const line of (m[1] ?? '').split('\n')) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv && !/^\s/.test(line)) {
      flush();
      key = kv[1]!;
      const val = kv[2] ?? '';
      if (/^[>|][+-]?$/.test(val.trim())) {
        block = val.trim().startsWith('>') ? 'fold' : 'literal';
      } else {
        meta[key] = unquote(val);
      }
    } else if (key !== null && /^\s+\S/.test(line)) {
      if (block) parts.push(line.trim());
      else meta[key] = ((meta[key] ?? '') + ' ' + line.trim()).trim();
    }
  }
  flush();
  return { meta, body: normalized.slice(m[0].length).replace(/^\n+/, '') };
}

async function readSkill(dir: string, source: Skill['source']): Promise<Skill | null> {
  let raw: string;
  try {
    const file = path.join(dir, 'SKILL.md');
    const st = await fs.stat(file);
    if (!st.isFile() || st.size > MAX_SKILL_MD_BYTES) return null;
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  const { meta, body } = parseFrontmatter(raw);
  const folder = path.basename(dir);
  const name = (meta['name'] ?? '').trim() || folder;
  const firstLine = body.split('\n').find((l) => l.trim() !== '' && !l.startsWith('#')) ?? '';
  const description = (meta['description'] ?? '').trim() || firstLine.trim().slice(0, 200) || '(no description)';
  return { name, description, dir, source, body };
}

/** Load skills from several folders. Later folders win on name clashes (project overrides global). */
export async function loadSkills(dirs: SkillDir[]): Promise<Skill[]> {
  const byName = new Map<string, Skill>();
  for (const { dir, source } of dirs) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      let isDir = e.isDirectory();
      if (e.isSymbolicLink()) isDir = await fs.stat(full).then((s) => s.isDirectory()).catch(() => false);
      if (!isDir) continue;
      const skill = await readSkill(full, source);
      if (skill) byName.set(skill.name.toLowerCase(), skill);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildSkillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  return [
    '',
    'Skills available (specialised instructions you can load on demand with the use_skill tool). When a task matches a skill\'s description, call use_skill with its name first and follow what it says:',
    ...skills.map((s) => `- ${s.name}: ${s.description}`),
  ].join('\n');
}

function quoteIfNeeded(v: string): string {
  return /^[>|'"[{&*!%@`#-]/.test(v) || v.includes(': ') ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : v;
}

export async function createSkill(
  globalDir: string,
  input: { name: string; description: string; instructions: string },
): Promise<string> {
  const name = input.name.trim();
  if (!isValidSkillName(name)) {
    throw new Error('Skill name must be 1-64 characters: lowercase letters, digits, "-" or "_", starting with a letter or digit.');
  }
  const description = input.description.replace(/\s+/g, ' ').trim();
  if (description === '') throw new Error('Add a short description so the agent knows when to use this skill.');
  if (description.length > 400) throw new Error('Description is too long (max 400 characters).');
  const instructions = input.instructions.trim();
  if (instructions === '') throw new Error('Add the instructions the agent should follow.');
  if (instructions.length > MAX_SKILL_MD_BYTES) throw new Error('Instructions are too long.');

  const dir = path.join(globalDir, name);
  await fs.mkdir(globalDir, { recursive: true });
  try {
    await fs.mkdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`A skill named "${name}" already exists.`);
    throw err;
  }
  const text = `---\nname: ${name}\ndescription: ${quoteIfNeeded(description)}\n---\n\n${instructions}\n`;
  await fs.writeFile(path.join(dir, 'SKILL.md'), text, 'utf8');
  return dir;
}

async function folderSize(dir: string): Promise<number> {
  let total = 0;
  for await (const f of walkFiles(dir)) {
    total += (await fs.stat(f).catch(() => ({ size: 0 }))).size;
    if (total > MAX_IMPORT_BYTES) break;
  }
  return total;
}

/** Copy a folder that contains SKILL.md into the global skills folder. */
export async function importSkill(globalDir: string, srcDir: string): Promise<string> {
  const skill = await readSkill(srcDir, 'global');
  if (!skill) throw new Error('That folder has no SKILL.md, so it is not a skill.');
  if ((await folderSize(srcDir)) > MAX_IMPORT_BYTES) throw new Error('That skill folder is larger than 20 MB.');
  const name = slugify(path.basename(srcDir)) || slugify(skill.name);
  if (!isValidSkillName(name)) throw new Error('Could not derive a valid skill name from the folder name.');
  const dest = path.join(globalDir, name);
  await fs.mkdir(globalDir, { recursive: true });
  try {
    await fs.access(dest);
    throw new Error(`A skill named "${name}" already exists.`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  await fs.cp(srcDir, dest, {
    recursive: true,
    dereference: false,
    filter: (src) => !IGNORED_DIRS.has(path.basename(src)),
  });
  return dest;
}

export async function deleteSkill(globalDir: string, dir: string): Promise<void> {
  const root = path.resolve(globalDir);
  const target = path.resolve(dir);
  if (path.dirname(target) !== root) throw new Error('Only skills in your skills folder can be deleted.');
  await fs.rm(target, { recursive: true, force: true });
}

const DEFAULT_SKILLS: { name: string; description: string; body: string }[] = [
  {
    name: 'code-review',
    description: 'Review code changes for bugs, security problems and readability. Use when the user asks for a review.',
    body: `# Code review

1. Find what changed: run \`git status\` and \`git diff\` (or read the files the user names).
2. For each changed file, check in this order:
   - Correctness: logic errors, off-by-one, null/undefined handling, error paths.
   - Security: unvalidated input, injection, secrets in code, unsafe file or shell use.
   - Readability: unclear names, duplicated code, missing tests.
3. Report findings grouped by severity (must fix / should fix / nice to have), each with the file and line.
4. Do not edit files unless the user asks you to apply the fixes.
`,
  },
  {
    name: 'git-commit-message',
    description: 'Write a clear commit message from the current changes. Use when the user asks for a commit message.',
    body: `# Commit message

1. Run \`git diff --staged\` (if nothing is staged, use \`git diff\`).
2. Write a subject line of at most 72 characters in the imperative mood ("Add login validation").
3. If the change needs explanation, add a blank line and a short body that says why, not what.
4. Show the message to the user. Only run \`git commit\` if they ask you to.
`,
  },
];

/** On first run, create the global skills folder with a couple of examples. */
export async function seedDefaultSkills(globalDir: string): Promise<void> {
  try {
    await fs.access(globalDir);
    return; // already exists: never touch what the user has
  } catch {
    /* create below */
  }
  await fs.mkdir(globalDir, { recursive: true });
  for (const s of DEFAULT_SKILLS) {
    const dir = path.join(globalDir, s.name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), `---\nname: ${s.name}\ndescription: ${s.description}\n---\n\n${s.body}`, 'utf8');
  }
}
