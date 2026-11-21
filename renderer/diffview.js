'use strict';
/*
 * Before / after comparison, like the review view in an editor.
 *   lines: [{ t: 'eq' | 'add' | 'del' | 'gap', x, a, b, n }]
 *   - "unified": one column, removed lines in red above added lines in green
 *   - "split":   old version on the left, new version on the right, changes side by side
 * Unchanged stretches are folded into a clickable "N unchanged lines" row unless opts.full is set.
 */
(function () {
  const CONTEXT = 3;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /** Fold long unchanged stretches. Gap rows coming from the server stay as they are. */
  function fold(lines, expanded, full) {
    if (full) return lines.map((line) => ({ line }));
    const keep = new Array(lines.length).fill(false);
    lines.forEach((l, i) => {
      if (l.t === 'eq') return;
      for (let j = Math.max(0, i - CONTEXT); j <= Math.min(lines.length - 1, i + CONTEXT); j++) keep[j] = true;
    });
    const rows = [];
    let i = 0;
    while (i < lines.length) {
      if (keep[i] || lines[i].t === 'gap') {
        rows.push({ line: lines[i] });
        i++;
        continue;
      }
      const start = i;
      while (i < lines.length && !keep[i] && lines[i].t !== 'gap') i++;
      if (expanded.has(start)) {
        for (let k = start; k < i; k++) rows.push({ line: lines[k] });
      } else {
        rows.push({ gap: i - start, start });
      }
    }
    return rows;
  }

  function gapRow(cols, count, start, onExpand) {
    const tr = el('tr', 'gap');
    const td = el('td');
    td.colSpan = cols;
    if (start !== undefined && onExpand) {
      const b = el('button', 'gapbtn', `${count} unchanged line${count === 1 ? '' : 's'} — show`);
      b.type = 'button';
      b.addEventListener('click', () => onExpand(start));
      td.appendChild(b);
    } else {
      td.appendChild(el('span', 'gaptext', `${count} unchanged line${count === 1 ? '' : 's'}`));
    }
    tr.appendChild(td);
    return tr;
  }

  function unifiedTable(rows, onExpand) {
    const table = el('table', 'diff unified');
    const tb = el('tbody');
    for (const r of rows) {
      if (r.gap !== undefined) {
        tb.appendChild(gapRow(4, r.gap, r.start, onExpand));
        continue;
      }
      const l = r.line;
      if (l.t === 'gap') {
        tb.appendChild(gapRow(4, l.n));
        continue;
      }
      const tr = el('tr', l.t);
      tr.appendChild(el('td', 'ln', l.a !== undefined ? String(l.a) : ''));
      tr.appendChild(el('td', 'ln', l.b !== undefined ? String(l.b) : ''));
      tr.appendChild(el('td', 'sign', l.t === 'add' ? '+' : l.t === 'del' ? '−' : ''));
      tr.appendChild(el('td', 'code', l.x));
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    return table;
  }

  function splitTable(rows, onExpand) {
    const table = el('table', 'diff split');
    const tb = el('tbody');
    let dels = [];
    let adds = [];
    const flush = () => {
      const n = Math.max(dels.length, adds.length);
      for (let k = 0; k < n; k++) {
        const d = dels[k];
        const a = adds[k];
        const tr = el('tr');
        tr.appendChild(el('td', 'ln' + (d ? ' del' : ' blank'), d ? String(d.a) : ''));
        tr.appendChild(el('td', 'code' + (d ? ' del' : ' blank'), d ? d.x : ''));
        tr.appendChild(el('td', 'ln' + (a ? ' add' : ' blank'), a ? String(a.b) : ''));
        tr.appendChild(el('td', 'code' + (a ? ' add' : ' blank'), a ? a.x : ''));
        tb.appendChild(tr);
      }
      dels = [];
      adds = [];
    };
    for (const r of rows) {
      if (r.gap !== undefined) {
        flush();
        tb.appendChild(gapRow(4, r.gap, r.start, onExpand));
        continue;
      }
      const l = r.line;
      if (l.t === 'gap') {
        flush();
        tb.appendChild(gapRow(4, l.n));
      } else if (l.t === 'del') {
        dels.push(l);
      } else if (l.t === 'add') {
        adds.push(l);
      } else {
        flush();
        const tr = el('tr');
        tr.appendChild(el('td', 'ln', String(l.a)));
        tr.appendChild(el('td', 'code', l.x));
        tr.appendChild(el('td', 'ln', String(l.b)));
        tr.appendChild(el('td', 'code', l.x));
        tb.appendChild(tr);
      }
    }
    flush();
    table.appendChild(tb);
    return table;
  }

  /** opts: { mode: 'unified' | 'split', full: boolean } */
  function render(container, lines, opts) {
    const o = opts || {};
    const expanded = new Set();
    const draw = () => {
      container.textContent = '';
      const rows = fold(lines, expanded, !!o.full);
      const onExpand = (start) => {
        expanded.add(start);
        draw();
      };
      const wrap = el('div', 'diff-wrap');
      wrap.appendChild(o.mode === 'split' ? splitTable(rows, onExpand) : unifiedTable(rows, onExpand));
      container.appendChild(wrap);
    };
    draw();
  }

  window.DiffView = { render };
})();
