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

  // ---------- safe media & links ----------

  function safeImageUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) return '';
    if (/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(url)) return url;
    try {
      const u = new URL(url);
      return u.protocol === 'https:' ? u.href : '';
    } catch {
      return '';
    }
  }

  let lightbox = null;

  function ensureLightbox() {
    if (lightbox) return lightbox;
    const dialog = el('dialog', 'img-lightbox');
    const close = el('button', 'img-lightbox-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close image');
    const inner = el('div', 'img-lightbox-inner');
    const img = el('img');
    const caption = el('div', 'img-lightbox-caption');
    inner.appendChild(img);
    inner.appendChild(caption);
    dialog.appendChild(close);
    dialog.appendChild(inner);
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    lightbox = { dialog, img, caption };
    return lightbox;
  }

  function openImage(raw, alt) {
    const src = safeImageUrl(raw);
    if (!src) return;
    const lb = ensureLightbox();
    lb.img.src = src;
    lb.img.alt = alt || 'Image';
    lb.caption.textContent = alt || '';
    lb.caption.hidden = !alt;
    lb.img.hidden = false;
    if (!lb.dialog.open) lb.dialog.showModal();
  }

  function imageNode(raw, alt, opts) {
    const url = safeImageUrl(raw);
    if (!url) {
      const fallback = el('span', 'md-image-broken');
      fallback.appendChild(el('span', 'md-image-broken-title', alt || 'Image'));
      const detail = String(raw || '').startsWith('data:') ? 'This image could not be decoded.' : String(raw || '');
      if (detail) fallback.appendChild(el('span', 'md-image-broken-url', detail));
      return fallback;
    }
    if (opts.streaming) return el('span', 'md-image-pending', alt ? `Image · ${alt}` : 'Image');
    const wrap = el('span', 'md-image');
    const img = el('img');
    img.src = url;
    img.alt = alt || 'Image';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    wrap.title = alt ? `Open ${alt}` : 'Open image';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    const open = () => openImage(url, alt);
    wrap.addEventListener('click', open);
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    img.addEventListener('error', () => {
      wrap.classList.add('broken');
      wrap.textContent = '';
      wrap.removeAttribute('role');
      wrap.tabIndex = -1;
      wrap.appendChild(el('span', 'md-image-broken-title', alt || 'Image unavailable'));
      wrap.appendChild(el('span', 'md-image-broken-url', 'The image could not be loaded.'));
    });
    wrap.appendChild(img);
    return wrap;
  }

  function linkNode(label, raw) {
    const url = String(raw || '').trim();
    if (/^https:\/\//i.test(url)) {
      const a = el('a', 'link', label);
      a.href = url;
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      a.title = url;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.api && window.api.openWeb) {
          window.api.openWeb(url).catch(() => {});
        }
      });
      return a;
    }
    const s = el('span', 'link filelink', label);
    s.title = url;
    return s;
  }

  // ---------- inline ----------

  const INLINE = /(!\[[^\]\n]*\]\([^)\s]+\))|(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))|(<https?:\/\/[^>\s]+>)|(\*[^*\s][^*\n]*?\*)|((?:^|(?<=[\s(]))_[^_\s][^_\n]*?_(?=$|[\s).,;:!?]))/g;

  function inline(parent, text, opts = {}) {
    let last = 0;
    // A fresh regex per call: the nested calls below (bold / italic) must not reset this loop's position.
    const re = new RegExp(INLINE.source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      const tok = m[0];
      if (m[1]) {
        const close = tok.indexOf('](');
        const alt = tok.slice(2, close);
        const url = tok.slice(close + 2, -1);
        parent.appendChild(imageNode(url, alt, opts));
      } else if (m[2]) {
        parent.appendChild(el('code', '', tok.slice(1, -1)));
      } else if (m[3]) {
        const b = el('strong');
        inline(b, tok.slice(2, -2), opts);
        parent.appendChild(b);
      } else if (m[4]) {
        const s = el('s');
        inline(s, tok.slice(2, -2), opts);
        parent.appendChild(s);
      } else if (m[5]) {
        const close = tok.indexOf('](');
        const label = tok.slice(1, close);
        const url = tok.slice(close + 2, -1);
        parent.appendChild(linkNode(label, url));
      } else if (m[6]) {
        const url = tok.slice(1, -1);
        parent.appendChild(linkNode(url, url));
      } else if (m[7]) {
        const i = el('em');
        inline(i, tok.slice(1, -1), opts);
        parent.appendChild(i);
      } else {
        const i = el('em');
        inline(i, tok.slice(1, -1), opts);
        parent.appendChild(i);
      }
      last = m.index + tok.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function inlineWithBreaks(parent, text, opts = {}) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) parent.appendChild(el('br'));
      inline(parent, line, opts);
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
        const curCode = box._codeText !== undefined ? box._codeText : code;
        const curLang = box._lang !== undefined ? box._lang : (lang || '');
        const snippet = `\`\`\`${curLang}\n${curCode}\n\`\`\`\n`;
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
      const curCode = box._codeText !== undefined ? box._codeText : code;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(curCode).then(done, () => {});
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

    box._codeEl = codeEl;
    box._codeText = code;
    box._lang = lang;
    return box;
  }

  function splitRow(line) {
    let t = line.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    return t.split('|').map((c) => c.trim());
  }

  function list(lines, opts) {
    // lines: array of raw list lines (may include indented continuation items)
    const first = RE_LIST.exec(lines[0]);
    const baseIndent = first ? first[1].length : 0;
    const ordered = first ? /\d/.test(first[2]) : false;
    const root = el(ordered ? 'ol' : 'ul');
    let item = null;
    let nested = [];
    const flushNested = () => {
      if (item && nested.length > 0) item.appendChild(list(nested, opts));
      nested = [];
    };
    for (const line of lines) {
      const m = RE_LIST.exec(line);
      if (m && m[1].length <= baseIndent) {
        flushNested();
        item = el('li');
        inlineWithBreaks(item, m[3], opts);
        root.appendChild(item);
      } else if (m) {
        nested.push(line);
      } else if (item) {
        // continuation text of the current item
        item.appendChild(el('br'));
        inline(item, line.trim(), opts);
      }
    }
    flushNested();
    return root;
  }

  function buildBlock(b, opts) {
    if (b.type === 'code') {
      return codeBlock(b.lang, b.code);
    }
    if (b.type === 'heading') {
      const node = el('h' + b.level);
      inline(node, b.text, opts);
      return node;
    }
    if (b.type === 'hr') {
      return el('hr');
    }
    if (b.type === 'quote') {
      const bq = el('blockquote');
      render(bq, b.raw, opts);
      return bq;
    }
    if (b.type === 'list') {
      return list(b.items, opts);
    }
    if (b.type === 'table') {
      const head = splitRow(b.head);
      const table = el('table', 'mdtable');
      const thead = el('thead');
      const hr = el('tr');
      head.forEach((c) => {
        const th = el('th');
        inline(th, c, opts);
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = el('tbody');
      b.rows.forEach((line) => {
        const tr = el('tr');
        splitRow(line).forEach((c) => {
          const td = el('td');
          inline(td, c, opts);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      const wrap = el('div', 'tablewrap');
      wrap.appendChild(table);
      return wrap;
    }
    const p = el('p');
    inlineWithBreaks(p, b.raw, opts);
    return p;
  }

  function parseBlocks(text) {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let i = 0;
    let para = [];
    const flushPara = (closed) => {
      if (para.length === 0) return;
      blocks.push({ type: 'p', raw: para.join('\n'), closed: !!closed });
      para = [];
    };

    while (i < lines.length) {
      const line = lines[i];

      const fence = RE_FENCE.exec(line);
      if (fence) {
        flushPara(true);
        const code = [];
        const lang = fence[1];
        i++;
        while (i < lines.length && !/^\s{0,3}```\s*$/.test(lines[i])) code.push(lines[i++]);
        const closed = i < lines.length && /^\s{0,3}```\s*$/.test(lines[i]);
        if (closed) i++;
        blocks.push({
          type: 'code',
          lang,
          code: code.join('\n'),
          raw: '```' + lang + '\n' + code.join('\n') + (closed ? '\n```' : ''),
          closed,
        });
        continue;
      }
      if (line.trim() === '') {
        flushPara(true);
        i++;
        continue;
      }
      const h = RE_HEADING.exec(line);
      if (h) {
        flushPara(true);
        const level = Math.min(4, h[1].length) + 1;
        blocks.push({ type: 'heading', level, text: h[2], raw: line, closed: true });
        i++;
        continue;
      }
      if (RE_HR.test(line)) {
        flushPara(true);
        blocks.push({ type: 'hr', raw: line, closed: true });
        i++;
        continue;
      }
      if (RE_QUOTE.test(line)) {
        flushPara(true);
        const q = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) q.push(RE_QUOTE.exec(lines[i++])[1]);
        const closed = i < lines.length;
        blocks.push({ type: 'quote', raw: q.join('\n'), closed });
        continue;
      }
      if (RE_LIST.test(line)) {
        flushPara(true);
        const items = [];
        while (i < lines.length && lines[i].trim() !== '' && (RE_LIST.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) items.push(lines[i++]);
        const closed = i < lines.length;
        blocks.push({ type: 'list', items, raw: items.join('\n'), closed });
        continue;
      }
      if (line.includes('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        flushPara(true);
        const head = line;
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
          rows.push(lines[i++]);
        }
        const closed = i < lines.length;
        blocks.push({ type: 'table', head, rows, raw: head + '\n---\n' + rows.join('\n'), closed });
        continue;
      }
      para.push(line);
      i++;
    }
    flushPara(false);
    return blocks;
  }

  function render(container, text, opts = {}) {
    const isStreaming = !!opts.streaming;
    const newBlocks = parseBlocks(text);

    // If container has not been initialized with blocks, or was cleared externally:
    if (!container._blocks || container.children.length !== container._blocks.length) {
      container.textContent = '';
      container._blocks = [];
      for (const b of newBlocks) {
        const dom = buildBlock(b, opts);
        b.dom = dom;
        container.appendChild(dom);
        container._blocks.push(b);
      }
      return;
    }

    const oldBlocks = container._blocks;

    // Find prefix of identical, closed blocks that do not need any updates
    let common = 0;
    while (
      common < oldBlocks.length &&
      common < newBlocks.length &&
      oldBlocks[common].closed &&
      oldBlocks[common].raw === newBlocks[common].raw
    ) {
      newBlocks[common].dom = oldBlocks[common].dom;
      common++;
    }

    // Update or replace remaining blocks
    let i = common;
    while (i < newBlocks.length) {
      const nb = newBlocks[i];
      const ob = oldBlocks[i];

      if (ob && ob.type === nb.type && ob.dom) {
        // Fast path for in-progress paragraph
        if (nb.type === 'p') {
          ob.dom.textContent = '';
          inlineWithBreaks(ob.dom, nb.raw, opts);
          nb.dom = ob.dom;
        } else if (nb.type === 'code' && ob.dom._codeEl) {
          // Fast path for in-progress codeblock
          ob.dom._codeEl.innerHTML = highlightCodeBlock(nb.code, nb.lang);
          ob.dom._codeText = nb.code;
          ob.dom._lang = nb.lang;
          nb.dom = ob.dom;
        } else if (ob.raw === nb.raw && (!isStreaming || ob.closed === nb.closed)) {
          nb.dom = ob.dom;
        } else {
          // Replace changed block
          const dom = buildBlock(nb, opts);
          nb.dom = dom;
          container.replaceChild(dom, ob.dom);
        }
      } else if (ob && ob.dom) {
        // Type changed, replace node
        const dom = buildBlock(nb, opts);
        nb.dom = dom;
        container.replaceChild(dom, ob.dom);
      } else {
        // New block added to tail
        const dom = buildBlock(nb, opts);
        nb.dom = dom;
        container.appendChild(dom);
      }
      i++;
    }

    // Remove any trailing blocks that are no longer present
    while (container.children.length > newBlocks.length) {
      container.lastElementChild.remove();
    }

    container._blocks = newBlocks;
  }

  window.Md = { render, stripAnsi, openImage };
})();
