import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.venv',
  'venv',
  'target',
  '.gradle',
  '.dart_tool',
  'Pods',
]);

const IGNORED_FILES = new Set(['.DS_Store']);

export function looksBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8000).includes(0);
}

/** Recursively yield files under dir. Never follows symlinks; skips heavy/generated folders. */
export async function* walkFiles(dir: string, signal?: AbortSignal): AsyncGenerator<string> {
  if (signal?.aborted) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (signal?.aborted) return;
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (IGNORED_DIRS.has(e.name)) continue;
      yield* walkFiles(full, signal);
    } else if (e.isFile()) {
      if (IGNORED_FILES.has(e.name)) continue;
      yield full;
    }
  }
}
