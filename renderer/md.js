'use strict';
/*
 * A small, safe Markdown renderer. It builds DOM nodes with textContent only, never innerHTML,
 * because the text comes from a language model and must never be able to inject markup.
 */
(function () {
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
  function stripAnsi(s) {
    return String(s).replace(ANSI, '');
  }

  // ---------- inline ----------

  const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s][^*\n]*?\*)|((?:^|(?<=[\s(]))_[^_\s][^_\n]*?_(?=$|[\s).,;:!?]))/g;

  function inline(parent, text) {
    let last = 0;
    // A fresh regex per call: the nested calls below (bold / italic) must not reset this loop's position.
    const re = new RegExp(INLINE.source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      const tok = m[0];
      if (m[1]) {
        parent.appendChild(el('code', '', tok.slice(1, -1)));
      } else if (m[2]) {
        const b = el('strong');
        inline(b, tok.slice(2, -2));
        parent.appendChild(b);
      } else if (m[3]) {
        const close = tok.indexOf('](');
        const label = tok.slice(1, close);
        const url = tok.slice(close + 2, -1);
        const a = el('span', 'link', label);
        a.title = url;
        parent.appendChild(a);
      } else {
        const i = el('em');
        inline(i, tok.slice(1, -1));
        parent.appendChild(i);
      }
      last = m.index + tok.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function inlineWithBreaks(parent, text) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) parent.appendChild(el('br'));
      inline(parent, line);
    });
  }

  // ---------- blocks ----------

  const RE_FENCE = /^\s{0,3}```\s*([\w+#.-]*)\s*$/;
  const RE_HEADING = /^(#{1,4})\s+(.*)$/;
  const RE_HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
  const RE_LIST = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
  const RE_QUOTE = /^\s{0,3}>\s?(.*)$/;
  const RE_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function codeBlock(lang, code) {
    const box = el('div', 'codeblock');
    const head = el('div', 'codehead');
    head.appendChild(el('span', 'codelang', lang || 'code'));
    const copy = el('button', 'codecopy', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      const done = () => {
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy'), 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => {});
      else done();
    });
    head.appendChild(copy);
    box.appendChild(head);
    const pre = el('pre');
    pre.appendChild(el('code', '', code));
    box.appendChild(pre);
    return box;
  }

  function splitRow(line) {
    let t = line.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    return t.split('|').map((c) => c.trim());
  }

  function list(lines) {
    // lines: array of raw list lines (may include indented continuation items)
    const first = RE_LIST.exec(lines[0]);
    const baseIndent = first ? first[1].length : 0;
    const ordered = first ? /\d/.test(first[2]) : false;
    const root = el(ordered ? 'ol' : 'ul');
    let item = null;
    let nested = [];
    const flushNested = () => {
      if (item && nested.length > 0) item.appendChild(list(nested));
      nested = [];
    };
    for (const line of lines) {
      const m = RE_LIST.exec(line);
      if (m && m[1].length <= baseIndent) {
        flushNested();
        item = el('li');
        inlineWithBreaks(item, m[3]);
        root.appendChild(item);
      } else if (m) {
        nested.push(line);
      } else if (item) {
        // continuation text of the current item
        item.appendChild(el('br'));
        inline(item, line.trim());
      }
    }
    flushNested();
    return root;
  }

  function render(container, text) {
    container.textContent = '';
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    let i = 0;
    let para = [];
    const flushPara = () => {
      if (para.length === 0) return;
      const p = el('p');
      inlineWithBreaks(p, para.join('\n'));
      container.appendChild(p);
      para = [];
    };

    while (i < lines.length) {
      const line = lines[i];

      const fence = RE_FENCE.exec(line);
      if (fence) {
        flushPara();
        const code = [];
        i++;
        while (i < lines.length && !/^\s{0,3}```\s*$/.test(lines[i])) code.push(lines[i++]);
        i++; // closing fence (or end of text while streaming)
        container.appendChild(codeBlock(fence[1], code.join('\n')));
        continue;
      }
      if (line.trim() === '') {
        flushPara();
        i++;
        continue;
      }
      const h = RE_HEADING.exec(line);
      if (h) {
        flushPara();
        const level = Math.min(4, h[1].length) + 1; // h2..h5: the page title is the only h1
        const node = el('h' + level);
        inline(node, h[2]);
        container.appendChild(node);
        i++;
        continue;
      }
      if (RE_HR.test(line)) {
        flushPara();
        container.appendChild(el('hr'));
        i++;
        continue;
      }
      if (RE_QUOTE.test(line)) {
        flushPara();
        const q = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) q.push(RE_QUOTE.exec(lines[i++])[1]);
        const bq = el('blockquote');
        render(bq, q.join('\n'));
        container.appendChild(bq);
        continue;
      }
      if (RE_LIST.test(line)) {
        flushPara();
        const items = [];
        while (i < lines.length && lines[i].trim() !== '' && (RE_LIST.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) items.push(lines[i++]);
        container.appendChild(list(items));
        continue;
      }
      if (line.includes('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        flushPara();
        const head = splitRow(line);
        i += 2;
        const table = el('table', 'mdtable');
        const thead = el('thead');
        const hr = el('tr');
        head.forEach((c) => {
          const th = el('th');
          inline(th, c);
          hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = el('tbody');
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
          const tr = el('tr');
          splitRow(lines[i++]).forEach((c) => {
            const td = el('td');
            inline(td, c);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        const wrap = el('div', 'tablewrap');
        wrap.appendChild(table);
        container.appendChild(wrap);
        continue;
      }
      para.push(line);
      i++;
    }
    flushPara();
  }

  window.Md = { render, stripAnsi };
})();
