const MAX_DOWNLOAD_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 30_000;
const FETCH_TIMEOUT_MS = 20_000;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Turn an HTML page into readable plain text (good enough for docs and articles). */
export function htmlToText(html: string): string {
  let t = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, '');
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(t)?.[1]?.trim();
  t = t
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<\/?(p|div|section|article|header|footer|main|nav|ul|ol|table|tr|h[1-6]|pre|blockquote|form)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<[^>]+>/g, '');
  t = decodeEntities(t)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return title ? `${decodeEntities(title)}\n\n${t}` : t;
}

export function parseHttpUrl(input: string): URL {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new Error('That is not a valid URL. Include the full address, for example https://example.com/page');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http:// and https:// links can be fetched.');
  return u;
}

export async function fetchUrlText(input: string, signal?: AbortSignal): Promise<string> {
  const url = parseHttpUrl(input);
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, {
      signal: combined,
      redirect: 'follow',
      headers: { 'User-Agent': 'FolderAgent/0.2', Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' },
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (timeout.aborted) throw new Error(`Timed out after ${FETCH_TIMEOUT_MS / 1000}s fetching ${url.href}`);
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    throw new Error(`Could not fetch ${url.href} (${cause?.code ?? cause?.message ?? (err as Error).message}).`);
  }
  if (!res.ok) throw new Error(`The server answered HTTP ${res.status} ${res.statusText} for ${url.href}`);

  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  const textual = type === '' || /^text\//.test(type) || /(json|xml|javascript|yaml|markdown)/.test(type);
  if (!textual) throw new Error(`This link is ${type.split(';')[0]}, not text, so it cannot be read.`);

  const reader = res.body?.getReader();
  if (!reader) return '[empty response]';
  const chunks: Uint8Array[] = [];
  let size = 0;
  let capped = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    chunks.push(value);
    if (size > MAX_DOWNLOAD_BYTES) {
      capped = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  let text = /html/.test(type) || /^\s*<(!doctype|html)/i.test(raw) ? htmlToText(raw) : raw.trim();
  let note = capped ? '\n[download stopped at 1.5 MB]' : '';
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    note += `\n[truncated to the first ${MAX_TEXT_CHARS} characters]`;
  }
  return (text === '' ? '[the page has no readable text]' : text) + note;
}
