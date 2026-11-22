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

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightCodeBlock(code, lang) {
    const l = String(lang || '').toLowerCase();
    const isBash = /bash|sh|zsh|shell/i.test(l);

    if (isBash) {
      const re = /(#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(https?:\/\/[^\s]+)|(\b(?:git|cd|npm|npx|node|brew|curl|wget|yarn|pnpm|echo|cat|ls|mkdir|cp|mv|rm|chmod|chown|sudo|export|source|pip|python|python3|cargo|docker|make|find|grep|sed|awk|tar|zip|unzip|touch)\b)|(-{1,2}[a-zA-Z0-9_-]+)/g;
      let lastIndex = 0;
      let html = '';
      let m;
      while ((m = re.exec(code)) !== null) {
        if (m.index > lastIndex) html += escapeHtml(code.slice(lastIndex, m.index));
        const [full, cmt, str, url, cmd, flag] = m;
        const esc = escapeHtml(full);
        if (cmt) html += `<span class="syn-cmt">${esc}</span>`;
        else if (str) html += `<span class="syn-str">${esc}</span>`;
        else if (url) html += `<span class="syn-url">${esc}</span>`;
        else if (cmd) html += `<span class="syn-cmd">${esc}</span>`;
        else if (flag) html += `<span class="syn-flag">${esc}</span>`;
        else html += esc;
        lastIndex = re.lastIndex;
      }
      if (lastIndex < code.length) html += escapeHtml(code.slice(lastIndex));
      return html;
    }

    const re = /(\/\/[^\n]*|#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b(?:const|let|var|function|class|import|export|from|as|return|if|else|for|while|do|switch|case|default|break|continue|new|this|super|async|await|try|catch|finally|throw|typeof|instanceof|void|interface|type|enum|implements|extends|public|private|protected|readonly|static|get|set|def|lambda|elif|pass|in|is|not|and|or|yield|with|assert|fn|pub|mut|struct|impl|trait|select|insert|update|delete)\b)|(\b(?:true|false|null|undefined|None|True|False|NaN|Infinity)\b)|(\b(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b)|(\b[A-Z][a-zA-Z0-9_$]*\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())/g;
    let lastIndex = 0;
    let html = '';
    let m;
    while ((m = re.exec(code)) !== null) {
      if (m.index > lastIndex) html += escapeHtml(code.slice(lastIndex, m.index));
      const [full, cmt, str, kwd, lit, num, typ, fn] = m;
      const esc = escapeHtml(full);
      if (cmt) html += `<span class="syn-cmt">${esc}</span>`;
      else if (str) html += `<span class="syn-str">${esc}</span>`;
      else if (kwd) html += `<span class="syn-kwd">${esc}</span>`;
      else if (lit) html += `<span class="syn-lit">${esc}</span>`;
      else if (num) html += `<span class="syn-num">${esc}</span>`;
      else if (typ) html += `<span class="syn-typ">${esc}</span>`;
      else if (fn) html += `<span class="syn-fn">${esc}</span>`;
      else html += esc;
      lastIndex = re.lastIndex;
    }
    if (lastIndex < code.length) html += escapeHtml(code.slice(lastIndex));
    return html;
  }

  function codeBlock(lang, code) {
    const box = el('div', 'codeblock');
    const head = el('div', 'codehead');
    head.appendChild(el('span', 'codelang', lang || 'code'));

    const actions = el('div', 'code-actions');

    const mention = el('button', 'codemention', '@');
    mention.type = 'button';
    mention.title = 'Mention / insert code block in chat (@[code_block])';
    mention.addEventListener('click', () => {
      const input = document.getElementById('input');
      if (input) {
        const snippet = `\`\`\`${lang || ''}\n${code}\n\`\`\`\n`;
        const val = input.value;
        input.value = val ? val + '\n' + snippet : snippet;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        if (window.toast) window.toast('Inserted code block into composer');
      }
    });
    actions.appendChild(mention);

    const copy = el('button', 'codecopy');
    copy.type = 'button';
    copy.title = 'Copy code';
    copy.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    copy.addEventListener('click', () => {
      const done = () => {
        copy.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        if (window.toast) window.toast('Copied code to clipboard');
        setTimeout(() => {
          copy.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => {});
      else done();
    });
    actions.appendChild(copy);

    head.appendChild(actions);
    box.appendChild(head);

    const pre = el('pre');
    const codeEl = el('code');
    codeEl.innerHTML = highlightCodeBlock(code, lang);
    pre.appendChild(codeEl);
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
