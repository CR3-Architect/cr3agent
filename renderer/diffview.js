'use strict';
/*
 * Before / after comparison, like the review view in an editor.
 *   lines: [{ t: 'eq' | 'add' | 'del' | 'gap', x, a, b, n }]
 *   - "unified": one column, removed lines in red above added lines in green
 *   - "split":   old version on the left (50%), new version on the right (50%), changes side by side
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

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Fast, vivid syntax highlighting for code lines across TS, JS, Python, JSON, HTML, CSS, Go, Rust, Bash
   */
  function highlightLine(rawCode) {
    if (!rawCode) return '&nbsp;';
    let lastIndex = 0;
    let html = '';
    // Order matters: comments and strings first so inner keywords/symbols are protected
    const re = /(\/\/[^\n]*|#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b(?:const|let|var|function|class|import|export|from|as|return|if|else|for|while|do|switch|case|default|break|continue|new|this|super|async|await|try|catch|finally|throw|typeof|instanceof|void|interface|type|enum|implements|extends|public|private|protected|readonly|static|get|set|def|lambda|elif|pass|in|is|not|and|or|yield|with|assert|fn|pub|mut|struct|impl|trait|select|insert|update|delete)\b)|(\b(?:true|false|null|undefined|None|True|False|NaN|Infinity)\b)|(\b(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b)|(\b[A-Z][a-zA-Z0-9_$]*\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())/g;

    let match;
    while ((match = re.exec(rawCode)) !== null) {
      if (match.index > lastIndex) {
        html += escapeHtml(rawCode.slice(lastIndex, match.index));
      }
      const [full, cmt, str, kwd, lit, num, typ, fn] = match;
      const escaped = escapeHtml(full);
      if (cmt) html += `<span class="syn-cmt">${escaped}</span>`;
      else if (str) html += `<span class="syn-str">${escaped}</span>`;
      else if (kwd) html += `<span class="syn-kwd">${escaped}</span>`;
      else if (lit) html += `<span class="syn-lit">${escaped}</span>`;
      else if (num) html += `<span class="syn-num">${escaped}</span>`;
      else if (typ) html += `<span class="syn-typ">${escaped}</span>`;
      else if (fn) html += `<span class="syn-fn">${escaped}</span>`;
      else html += escaped;
      lastIndex = re.lastIndex;
    }
    if (lastIndex < rawCode.length) {
      html += escapeHtml(rawCode.slice(lastIndex));
    }
    return html;
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
      
      const tdCode = el('td', 'code');
      const inner = el('div', 'code-inner');
      inner.innerHTML = highlightLine(l.x);
      tdCode.appendChild(inner);
      tr.appendChild(tdCode);

      tb.appendChild(tr);
    }
    table.appendChild(tb);
    return table;
  }

  function makeSplitCodeCell(lineObj, typeCls) {
    const td = el('td', 'code' + (typeCls ? ' ' + typeCls : ''));
    const inner = el('div', 'code-inner');
    if (lineObj && lineObj.x !== undefined) {
      inner.innerHTML = highlightLine(lineObj.x);
    } else {
      inner.innerHTML = '&nbsp;';
    }
    td.appendChild(inner);
    return td;
  }

  function splitTable(rows, onExpand) {
    const table = el('table', 'diff split');

    // Locked column groups: 46px line numbers + exactly 50% split in middle
    const cg = document.createElement('colgroup');
    cg.innerHTML = '<col class="col-ln"><col class="col-code"><col class="col-ln"><col class="col-code">';
    table.appendChild(cg);

    // Side-by-side header row
    const thead = el('thead', 'diff-split-head');
    const headTr = el('tr');
    const thLeft = el('th', 'split-head-cell left');
    thLeft.colSpan = 2;
    thLeft.textContent = 'Original (Baseline)';
    const thRight = el('th', 'split-head-cell right');
    thRight.colSpan = 2;
    thRight.textContent = 'Modified (Current)';
    headTr.appendChild(thLeft);
    headTr.appendChild(thRight);
    thead.appendChild(headTr);
    table.appendChild(thead);

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
        tr.appendChild(makeSplitCodeCell(d, d ? 'del' : 'blank'));
        tr.appendChild(el('td', 'ln' + (a ? ' add' : ' blank'), a ? String(a.b) : ''));
        tr.appendChild(makeSplitCodeCell(a, a ? 'add' : 'blank'));
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
        tr.appendChild(makeSplitCodeCell(l, ''));
        tr.appendChild(el('td', 'ln', String(l.b)));
        tr.appendChild(makeSplitCodeCell(l, ''));
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
      const wrap = el('div', 'diff-wrap' + (o.mode === 'split' ? ' is-split' : ' is-unified'));
      wrap.appendChild(o.mode === 'split' ? splitTable(rows, onExpand) : unifiedTable(rows, onExpand));
      container.appendChild(wrap);
    };
    draw();
  }

  window.DiffView = { render };
})();
