import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Workspace } from './workspace';
import { looksBinary, walkFiles } from './fsutil';
import { diffText, DiffLine, splitLines } from './diff';

const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 4000;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

interface BaseFile {
  buf: Buffer;
  size: number;
  mtimeMs: number;
}

export type ChangeStatus = 'added' | 'modified' | 'deleted';

export interface ChangeEntry {
  path: string;
  status: ChangeStatus;
  added: number;
  removed: number;
  /** Too large or not text, so no line diff is available. */
  binary: boolean;
}

export interface FileDiff {
  path: string;
  status: ChangeStatus | 'unchanged';
  lines: DiffLine[];
  added: number;
  removed: number;
  eolOnly: boolean;
  binary: boolean;
}

/**
 * Remembers what the project looked like at a baseline (when the folder was opened or the last
 * "keep all"), so it can show exactly which files and lines changed since, and put files back.
 * Only small text files are tracked; everything else is left alone.
 */
export class ChangeTracker {
  private baseline = new Map<string, BaseFile>();
  private untracked = new Set<string>();

  constructor(private readonly ws: Workspace) {}

  async snapshot(signal?: AbortSignal): Promise<{ tracked: number; skipped: number }> {
    const root = await this.ws.resolve('.');
    const baseline = new Map<string, BaseFile>();
    const untracked = new Set<string>();
    let total = 0;
    for await (const file of walkFiles(root, signal)) {
      const rel = await this.ws.rel(file);
      try {
        const st = await fs.stat(file);
        if (st.size > MAX_FILE_BYTES || baseline.size >= MAX_FILES || total + st.size > MAX_TOTAL_BYTES) {
          untracked.add(rel);
          continue;
        }
        const buf = await fs.readFile(file);
        if (looksBinary(buf)) {
          untracked.add(rel);
          continue;
        }
        baseline.set(rel, { buf, size: st.size, mtimeMs: st.mtimeMs });
        total += st.size;
      } catch {
        untracked.add(rel);
      }
    }
    this.baseline = baseline;
    this.untracked = untracked;
    return { tracked: baseline.size, skipped: untracked.size };
  }

  private async scan(): Promise<Map<string, { full: string; size: number; mtimeMs: number }>> {
    const root = await this.ws.resolve('.');
    const current = new Map<string, { full: string; size: number; mtimeMs: number }>();
    for await (const full of walkFiles(root)) {
      try {
        const st = await fs.stat(full);
        current.set(await this.ws.rel(full), { full, size: st.size, mtimeMs: st.mtimeMs });
      } catch {
        /* vanished while scanning */
      }
    }
    return current;
  }

  async changes(): Promise<ChangeEntry[]> {
    const current = await this.scan();
    const out: ChangeEntry[] = [];

    for (const [rel, cur] of current) {
      if (this.untracked.has(rel)) continue;
      const base = this.baseline.get(rel);

      if (!base) {
        let added = 0;
        let binary = cur.size > MAX_FILE_BYTES;
        if (!binary) {
          const buf = await fs.readFile(cur.full).catch(() => null);
          if (!buf || looksBinary(buf)) binary = true;
          else added = splitLines(buf.toString('utf8')).length;
        }
        out.push({ path: rel, status: 'added', added, removed: 0, binary });
        continue;
      }

      if (base.size === cur.size && base.mtimeMs === cur.mtimeMs) continue;
      const buf = await fs.readFile(cur.full).catch(() => null);
      if (!buf || buf.equals(base.buf)) continue;
      if (looksBinary(buf)) {
        out.push({ path: rel, status: 'modified', added: 0, removed: 0, binary: true });
        continue;
      }
      const d = diffText(base.buf.toString('utf8'), buf.toString('utf8'));
      out.push({ path: rel, status: 'modified', added: d.added, removed: d.removed, binary: false });
    }

    for (const [rel, base] of this.baseline) {
      if (!current.has(rel)) {
        out.push({ path: rel, status: 'deleted', added: 0, removed: splitLines(base.buf.toString('utf8')).length, binary: false });
      }
    }

    out.sort((x, y) => x.path.localeCompare(y.path));
    return out;
  }

  async fileDiff(rel: string): Promise<FileDiff> {
    const full = await this.ws.resolve(rel);
    const relative = await this.ws.rel(full);
    if (this.untracked.has(relative)) {
      return { path: relative, status: 'unchanged', lines: [], added: 0, removed: 0, eolOnly: false, binary: true };
    }
    const base = this.baseline.get(relative);
    const curBuf = await fs.readFile(full).catch(() => null);

    if (curBuf && (looksBinary(curBuf) || curBuf.length > MAX_FILE_BYTES)) {
      return { path: relative, status: base ? 'modified' : 'added', lines: [], added: 0, removed: 0, eolOnly: false, binary: true };
    }
    const before = base ? base.buf.toString('utf8') : '';
    const after = curBuf ? curBuf.toString('utf8') : '';
    const d = diffText(before, after);

    let status: FileDiff['status'];
    if (!base && curBuf) status = 'added';
    else if (base && !curBuf) status = 'deleted';
    else if (base && curBuf && base.buf.equals(curBuf)) status = 'unchanged';
    else status = 'modified';
    return { path: relative, status, lines: d.lines, added: d.added, removed: d.removed, eolOnly: d.eolOnly, binary: false };
  }

  /** Put a file back the way it was at the baseline (or delete it if it did not exist then). */
  async revert(rel: string): Promise<void> {
    const full = await this.ws.resolve(rel);
    const relative = await this.ws.rel(full);
    if (this.untracked.has(relative)) throw new Error('This file is too large or not text, so it was not tracked and cannot be reverted here.');
    const base = this.baseline.get(relative);
    if (base) {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, base.buf);
    } else {
      await fs.rm(full, { force: true });
    }
  }

  /** Accept the current state of one file as the new baseline. */
  async accept(rel: string): Promise<void> {
    const full = await this.ws.resolve(rel);
    const relative = await this.ws.rel(full);
    const st = await fs.stat(full).catch(() => null);
    if (!st) {
      this.baseline.delete(relative);
      return;
    }
    const buf = await fs.readFile(full);
    if (st.size > MAX_FILE_BYTES || looksBinary(buf)) {
      this.baseline.delete(relative);
      this.untracked.add(relative);
      return;
    }
    this.untracked.delete(relative);
    this.baseline.set(relative, { buf, size: st.size, mtimeMs: st.mtimeMs });
  }

  async acceptAll(): Promise<void> {
    await this.snapshot();
  }
}
