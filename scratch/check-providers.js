// Temporary diagnostic: checks decryption and endpoint status without printing keys.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const file = path.join(os.homedir(), 'Library', 'Application Support', 'cr3-agentic-ai', 'settings.json');
const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
let password;
try {
  password = execFileSync('security', ['find-generic-password', '-s', 'cr3-agentic-ai Safe Storage', '-w'], { encoding: 'utf8' }).trim();
} catch (e) {
  console.log('keychain read failed:', e.message);
  process.exit(1);
}
function decrypt(stored) {
  if (!stored || !stored.startsWith('enc:')) return undefined;
  const payload = Buffer.from(stored.slice(4), 'base64').subarray(3);
  const key = crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  try {
    const d = crypto.createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
    return Buffer.concat([d.update(payload), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
(async () => {
  const seen = new Set();
  for (const p of settings.providers) {
    if (!p.apiKey || seen.has(p.apiKey)) continue;
    seen.add(p.apiKey);
    const key = decrypt(p.apiKey);
    console.log(`${p.name}: decrypt=${key === undefined ? 'no key' : key === null ? 'FAILED' : `ok (${key.length} chars)`}`);
    if (!key) continue;
    try {
      const res = await fetch(`${p.baseUrl.replace(/\/+$/, '')}/models`, { headers: { Authorization: `Bearer ${key}` } });
      const body = await res.text();
      let detail = body.slice(0, 200);
      try { const j = JSON.parse(body); detail = j?.error?.message ?? j?.detail ?? (Array.isArray(j?.data) ? `${j.data.length} models` : detail); } catch {}
      console.log(`  /models -> ${res.status}: ${detail}`);
      if (res.ok && p.id === settings.activeProviderId) {
        const chat = await fetch(`${p.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: 'Reply with OK' }], max_tokens: 20 }),
        });
        const text = await chat.text();
        let out = text.slice(0, 300);
        try { const j = JSON.parse(text); out = j?.error?.message ?? j?.choices?.[0]?.message?.content ?? out; } catch {}
        console.log(`  chat ${p.model} -> ${chat.status}: ${out}`);
      }
    } catch (e) {
      console.log(`  -> unreachable: ${e.message}`);
    }
  }
})();
