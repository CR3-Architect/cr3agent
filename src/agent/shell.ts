import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

export interface ShellOptions {
  cwd: string;
  /** 0 or undefined = no timeout. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Called with each chunk of stdout/stderr as it arrives. */
  onData?: (chunk: string) => void;
}

export interface ShellResult {
  code: number | null;
  output: string;
  timedOut: boolean;
  cancelled: boolean;
}

const MAX_COLLECTED_OUTPUT = 2_000_000;
const MAC_EXTRA_PATHS = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin'];

/**
 * A Mac app launched from Finder does not inherit the PATH from your terminal, so tools
 * installed with Homebrew (git, node, ripgrep...) would not be found. Add the usual locations.
 */
export function shellEnv(platform: string = process.platform, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  if (platform === 'darwin') {
    const parts = (env['PATH'] ?? '').split(':').filter(Boolean);
    for (const p of MAC_EXTRA_PATHS) if (!parts.includes(p)) parts.push(p);
    env['PATH'] = parts.join(':');
  }
  return env;
}

/** On macOS run through a login shell so ~/.zprofile (Homebrew setup, etc.) is loaded. */
export function shellInvocation(
  command: string,
  platform: string = process.platform,
  userShell: string | null | undefined = process.env['SHELL'],
  shellExists: (p: string) => boolean = (p) => fs.existsSync(p),
): { file: string; args: string[] } | null {
  if (platform !== 'darwin') return null; // use Node's default shell handling
  const file = userShell && userShell.startsWith('/') && shellExists(userShell) ? userShell : '/bin/zsh';
  return { file, args: ['-l', '-c', command] };
}

export function runShell(command: string, opts: ShellOptions): Promise<ShellResult> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const inv = shellInvocation(command);
    const spawnOpts = {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
      env: shellEnv(),
      detached: !isWin,
      windowsHide: true,
    };
    const child = inv ? spawn(inv.file, inv.args, spawnOpts) : spawn(command, { ...spawnOpts, shell: true });

    let output = '';
    let dropped = false;
    let timedOut = false;
    let cancelled = false;
    let settled = false;

    const collect = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      opts.onData?.(text);
      if (output.length >= MAX_COLLECTED_OUTPUT) {
        dropped = true;
        return;
      }
      output += text;
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);

    const killTree = () => {
      try {
        if (!isWin && child.pid) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    };

    const timer =
      opts.timeoutMs && opts.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            killTree();
          }, opts.timeoutMs)
        : null;

    const onAbort = () => {
      cancelled = true;
      killTree();
    };
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      if (dropped) output += '\n[output limit reached; the rest was discarded]';
      resolve({ code, output, timedOut, cancelled });
    };

    child.on('error', (err) => {
      const msg = `\n[failed to start: ${err.message}]`;
      output += msg;
      opts.onData?.(msg);
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}
