export interface DiffLine {
  /** eq = unchanged, add = only in the new version, del = only in the old version */
  t: 'eq' | 'add' | 'del';
  x: string;
  /** 1-based line number in the old version (eq, del) */
  a?: number;
  /** 1-based line number in the new version (eq, add) */
  b?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
  /** The text differs but every line is the same (only line endings / final newline changed). */
  eolOnly: boolean;
}

const MAX_EDIT_DISTANCE = 2000;

export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

type RawOp = { t: 'eq' | 'add' | 'del'; x: string };

/** Myers' O(ND) shortest edit script. Falls back to "replace everything" for huge rewrites. */
function myers(a: string[], b: string[]): RawOp[] {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map((x) => ({ t: 'add' as const, x }));
  if (m === 0) return a.map((x) => ({ t: 'del' as const, x }));

  const maxD = Math.min(n + m, MAX_EDIT_DISTANCE);
  const offset = maxD + 1;
  const v = new Int32Array(2 * maxD + 3);
  const trace: Int32Array[] = [];
  let dEnd = -1;

  outer: for (let d = 0; d <= maxD; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0))) {
        x = v[offset + k + 1] ?? 0;
      } else {
        x = (v[offset + k - 1] ?? 0) + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        dEnd = d;
        break outer;
      }
    }
  }

  if (dEnd === -1) {
    return [...a.map((x) => ({ t: 'del' as const, x })), ...b.map((x) => ({ t: 'add' as const, x }))];
  }

  const ops: RawOp[] = [];
  let x = n;
  let y = m;
  for (let d = dEnd; d > 0; d--) {
    const vd = trace[d]!;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && (vd[offset + k - 1] ?? 0) < (vd[offset + k + 1] ?? 0))) prevK = k + 1;
    else prevK = k - 1;
    const prevX = vd[offset + prevK] ?? 0;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ t: 'eq', x: a[x - 1]! });
      x--;
      y--;
    }
    if (x === prevX) {
      ops.push({ t: 'add', x: b[y - 1]! });
      y--;
    } else {
      ops.push({ t: 'del', x: a[x - 1]! });
      x--;
    }
  }
  while (x > 0 && y > 0) {
    ops.push({ t: 'eq', x: a[x - 1]! });
    x--;
    y--;
  }
  ops.reverse();
  return groupChanges(ops);
}

/** Within each run of changes, list deletions first, then additions (easier to read and to pair up side by side). */
function groupChanges(ops: RawOp[]): RawOp[] {
  const out: RawOp[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i]!.t === 'eq') {
      out.push(ops[i]!);
      i++;
      continue;
    }
    const dels: RawOp[] = [];
    const adds: RawOp[] = [];
    while (i < ops.length && ops[i]!.t !== 'eq') {
      (ops[i]!.t === 'del' ? dels : adds).push(ops[i]!);
      i++;
    }
    out.push(...dels, ...adds);
  }
  return out;
}

export function diffLines(a: string[], b: string[]): DiffLine[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const mid = myers(a.slice(start, endA), b.slice(start, endB));

  const out: DiffLine[] = [];
  let ai = 1;
  let bi = 1;
  for (let i = 0; i < start; i++) out.push({ t: 'eq', x: a[i]!, a: ai++, b: bi++ });
  for (const op of mid) {
    if (op.t === 'eq') out.push({ t: 'eq', x: op.x, a: ai++, b: bi++ });
    else if (op.t === 'del') out.push({ t: 'del', x: op.x, a: ai++ });
    else out.push({ t: 'add', x: op.x, b: bi++ });
  }
  for (let i = endA; i < a.length; i++) out.push({ t: 'eq', x: a[i]!, a: ai++, b: bi++ });
  return out;
}

export function diffText(before: string, after: string): DiffResult {
  const lines = diffLines(splitLines(before), splitLines(after));
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.t === 'add') added++;
    else if (l.t === 'del') removed++;
  }
  return { lines, added, removed, eolOnly: added === 0 && removed === 0 && before !== after };
}

export type CompactRow = DiffLine | { t: 'gap'; n: number };

/**
 * Keep only changed lines plus `context` unchanged lines around them; the rest become "gap" rows.
 * Used for the preview shown in approval cards. Output is capped at `maxRows` rows.
 */
export function compactDiff(
  lines: DiffLine[],
  context = 3,
  maxRows = 300,
): { rows: CompactRow[]; truncated: boolean } {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.t === 'eq') return;
    for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) keep[j] = true;
  });
  const rows: CompactRow[] = [];
  let gap = 0;
  let truncated = false;
  for (let i = 0; i < lines.length; i++) {
    if (!keep[i]) {
      gap++;
      continue;
    }
    if (gap > 0) {
      rows.push({ t: 'gap', n: gap });
      gap = 0;
    }
    if (rows.length >= maxRows) {
      truncated = true;
      break;
    }
    rows.push(lines[i]!);
  }
  if (!truncated && gap > 0) rows.push({ t: 'gap', n: gap });
  return { rows, truncated };
}
