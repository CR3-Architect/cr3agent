import { spawn } from 'node:child_process';
import { shellEnv } from './agent/shell';

export interface GitResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface GitOptions {
  /** GitHub token. Sent only to github.com, through the environment (never on the command line, never saved in .git/config). */
  token?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const MAX_OUT = 2_000_000;

function redact(text: string, token?: string): string {
  let out = text.replace(/(https?:\/\/)[^/@\s]+@/g, '$1');
  if (token) out = out.split(token).join('***');
  return out;
}

/** Run git with an argument list (no shell, so nothing in an argument can be interpreted as a command). */
export function git(cwd: string, args: string[], opts: GitOptions = {}): Promise<GitResult> {
  return new Promise((resolve) => {
    const env = shellEnv();
    env['GIT_TERMINAL_PROMPT'] = '0';
    env['GCM_INTERACTIVE'] = 'never';
    if (opts.token) {
      env['GIT_CONFIG_COUNT'] = '1';
      env['GIT_CONFIG_KEY_0'] = 'http.https://github.com/.extraheader';
      env['GIT_CONFIG_VALUE_0'] = 'AUTHORIZATION: basic ' + Buffer.from(`x-access-token:${opts.token}`).toString('base64');
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn('git', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const done = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      resolve({ code, stdout: redact(stdout, opts.token), stderr: redact(stderr, opts.token) });
    };
    const timer = setTimeout(() => {
      stderr += '\n[git took too long and was stopped]';
      child.kill('SIGKILL');
    }, opts.timeoutMs ?? 120_000);
    const onAbort = () => child.kill('SIGKILL');
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (c: Buffer) => {
      if (stdout.length < MAX_OUT) stdout += c.toString('utf8');
    });
    child.stderr.on('data', (c: Buffer) => {
      if (stderr.length < MAX_OUT) stderr += c.toString('utf8');
    });
    child.on('error', (e) => {
      stderr += (e as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'git was not found. Install it with "xcode-select --install" or "brew install git".'
        : e.message;
      done(null);
    });
    child.on('close', (code) => done(code));
  });
}

export interface GitFile {
  path: string;
  /** Two letters from git status: index and working tree, e.g. " M", "??", "A ". */
  code: string;
  label: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict';
}

export interface GitStatus {
  isRepo: boolean;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  files: GitFile[];
  remote: string | null;
  commits: { hash: string; subject: string; author: string; when: string }[];
  branches: string[];
}

function labelFor(code: string): GitFile['label'] {
  if (code === '??') return 'untracked';
  if (/U/.test(code) || code === 'AA' || code === 'DD') return 'conflict';
  if (code.includes('R')) return 'renamed';
  if (code.includes('D')) return 'deleted';
  if (code.includes('A')) return 'added';
  return 'modified';
}

/** Parse `git status --porcelain=v1 -b`. */
export function parseStatus(text: string): Pick<GitStatus, 'branch' | 'upstream' | 'ahead' | 'behind' | 'files'> {
  const out = { branch: '', upstream: null as string | null, ahead: 0, behind: 0, files: [] as GitFile[] };
  for (const line of text.split('\n')) {
    if (line === '') continue;
    if (line.startsWith('## ')) {
      let rest = line.slice(3);
      const info = /\s\[(.*)\]$/.exec(rest);
      if (info) {
        rest = rest.slice(0, info.index);
        const a = /ahead (\d+)/.exec(info[1]!);
        const b = /behind (\d+)/.exec(info[1]!);
        if (a) out.ahead = Number(a[1]);
        if (b) out.behind = Number(b[1]);
      }
      const noCommits = /^No commits yet on (.+)$/.exec(rest) ?? /^Initial commit on (.+)$/.exec(rest);
      if (noCommits) {
        out.branch = noCommits[1]!;
      } else if (rest.startsWith('HEAD (no branch)')) {
        out.branch = 'HEAD (detached)';
      } else {
        const [local, remote] = rest.split('...');
        out.branch = local ?? '';
        out.upstream = remote ?? null;
      }
      continue;
    }
    const code = line.slice(0, 2);
    let p = line.slice(3);
    if (code.includes('R') && p.includes(' -> ')) p = p.split(' -> ')[1]!;
    if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1).replace(/\\"/g, '"');
    out.files.push({ path: p, code, label: labelFor(code) });
  }
  return out;
}

export async function gitStatus(cwd: string): Promise<GitStatus> {
  const empty: GitStatus = { isRepo: false, branch: '', upstream: null, ahead: 0, behind: 0, files: [], remote: null, commits: [], branches: [] };
  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (inside.code === null) throw new Error(inside.stderr.trim() || 'Could not run git.');
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') return empty;
  const [st, remote, log, br] = await Promise.all([
    git(cwd, ['status', '--porcelain=v1', '-b', '-unormal']),
    git(cwd, ['remote', 'get-url', 'origin']),
    git(cwd, ['log', '-n', '12', '--pretty=format:%h%x1f%s%x1f%an%x1f%ar']),
    git(cwd, ['branch', '--format=%(refname:short)']),
  ]);
  const parsed = parseStatus(st.stdout);
  return {
    isRepo: true,
    ...parsed,
    remote: remote.code === 0 ? remote.stdout.trim().replace(/^(https?:\/\/)[^/@]+@/, '$1') : null,
    commits: log.code === 0 && log.stdout.trim() !== ''
      ? log.stdout.split('\n').map((l) => {
          const [hash, subject, author, when] = l.split('\x1f');
          return { hash: hash ?? '', subject: subject ?? '', author: author ?? '', when: when ?? '' };
        })
      : [],
    branches: br.code === 0 ? br.stdout.split('\n').map((b) => b.trim()).filter(Boolean) : [],
  };
}

export function validBranchName(name: unknown): name is string {
  return typeof name === 'string' && /^[A-Za-z0-9][\w./-]{0,80}$/.test(name) && !name.includes('..') && !name.endsWith('/') && !name.endsWith('.lock') && !name.includes('//');
}

function fail(r: GitResult, fallback: string): never {
  const msg = (r.stderr.trim() || r.stdout.trim() || fallback).slice(0, 1500);
  throw new Error(msg);
}

function identityHint(msg: string): string {
  return /tell me who you are|user\.email|user\.name|empty ident/i.test(msg)
    ? msg + '\n\nSet your name once in Terminal:\n  git config --global user.name "Your Name"\n  git config --global user.email "you@example.com"'
    : msg;
}

export async function gitInit(cwd: string): Promise<string> {
  const r = await git(cwd, ['init', '-b', 'main']);
  if (r.code !== 0) {
    // older git has no -b
    const r2 = await git(cwd, ['init']);
    if (r2.code !== 0) fail(r2, 'git init failed');
  }
  return 'Created a new repository.';
}

export async function gitCommitAll(cwd: string, message: unknown): Promise<string> {
  if (typeof message !== 'string' || message.trim() === '') throw new Error('Write a commit message first.');
  const add = await git(cwd, ['add', '-A']);
  if (add.code !== 0) fail(add, 'git add failed');
  const r = await git(cwd, ['commit', '-m', message.trim().slice(0, 2000)]);
  if (r.code !== 0) {
    const m = r.stdout + r.stderr;
    if (/nothing to commit|no changes added/i.test(m)) throw new Error('Nothing to commit: there are no changes.');
    throw new Error(identityHint((r.stderr.trim() || r.stdout.trim() || 'git commit failed').slice(0, 1500)));
  }
  return r.stdout.trim().split('\n')[0] ?? 'Committed.';
}

export async function gitPush(cwd: string, token?: string): Promise<string> {
  const r = await git(cwd, ['push', '-u', 'origin', 'HEAD'], { token, timeoutMs: 180_000 });
  if (r.code !== 0) {
    const m = r.stderr.trim() || r.stdout.trim() || 'git push failed';
    throw new Error(/could not read Username|Authentication failed|terminal prompts disabled|403|401/i.test(m) ? m.slice(0, 800) + '\n\nSign in to GitHub in Settings → Accounts so the app can push for you.' : m.slice(0, 1500));
  }
  return (r.stderr.trim() || r.stdout.trim() || 'Pushed.').split('\n').slice(-3).join('\n');
}

export async function gitPull(cwd: string, token?: string): Promise<string> {
  const r = await git(cwd, ['pull', '--ff-only'], { token, timeoutMs: 180_000 });
  if (r.code !== 0) fail(r, 'git pull failed');
  return r.stdout.trim().split('\n').slice(-3).join('\n') || 'Up to date.';
}

export async function gitSwitch(cwd: string, name: unknown, create: boolean): Promise<string> {
  if (!validBranchName(name)) throw new Error('That is not a valid branch name (use letters, digits, - _ . /).');
  const r = await git(cwd, create ? ['switch', '-c', name] : ['switch', name]);
  if (r.code !== 0) fail(r, 'git switch failed');
  return create ? `Created and switched to ${name}.` : `Switched to ${name}.`;
}

export async function gitSetRemote(cwd: string, url: string): Promise<void> {
  const has = await git(cwd, ['remote', 'get-url', 'origin']);
  const r = await git(cwd, has.code === 0 ? ['remote', 'set-url', 'origin', url] : ['remote', 'add', 'origin', url]);
  if (r.code !== 0) fail(r, 'Could not set the remote.');
}

/** "https://github.com/owner/repo.git" or "git@github.com:owner/repo.git" → { owner, repo }. */
export function parseGithubRemote(url: string | null): { owner: string; repo: string } | null {
  if (!url) return null;
  const m = /^(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? { owner: m[1]!, repo: m[2]! } : null;
}
