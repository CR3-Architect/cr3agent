const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const file = path.join(os.homedir(), 'Library', 'Application Support', 'cr3-agentic-ai', 'settings.json');
const s = JSON.parse(fs.readFileSync(file, 'utf8'));
const p = s.providers.find((x) => x.id === s.activeProviderId) || s.providers[0];
const pw = execFileSync('security', ['find-generic-password', '-s', 'cr3-agentic-ai Safe Storage', '-w'], { encoding: 'utf8' }).trim();
const key = (() => {
  const payload = Buffer.from(p.apiKey.slice(4), 'base64').subarray(3);
  const d = crypto.createDecipheriv('aes-128-cbc', crypto.pbkdf2Sync(pw, 'saltysalt', 1003, 16, 'sha1'), Buffer.alloc(16, ' '));
  return Buffer.concat([d.update(payload), d.final()]).toString('utf8');
})();
const base = p.baseUrl.replace(/\/+$/, '');
const models = (p.models || []).filter((m) => /nvidia/i.test(m));
console.log('provider', p.name, 'nvidia models', models.length);
async function call(model, tools) {
  const body = { model, messages: [{ role: 'user', content: 'Reply with exactly OK' }], max_tokens: 8, stream: false };
  if (tools) body.tools = [{ type: 'function', function: { name: 'get_time', description: 'Get the time', parameters: { type: 'object', properties: {}, required: [] } } }];
  const t = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
    const text = await res.text();
    let out = text.slice(0, 200);
    try { const j = JSON.parse(text); out = j?.error?.message ?? j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.message?.reasoning_content ?? out; } catch {}
    console.log(`${model} tools=${!!tools} -> ${res.status} ${Date.now()-t}ms: ${String(out).replace(/\s+/g,' ').slice(0,180)}`);
  } catch (e) { console.log(`${model} tools=${!!tools} -> ERR ${Date.now()-t}ms: ${e.message}`); }
}
(async () => {
  for (const m of models.slice(0, 2)) { await call(m, false); await call(m, true); }
})();
