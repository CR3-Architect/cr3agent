import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Workspace } from '../agent/workspace';
import { findTool, applyEdit } from '../agent/tools';
import { Agent, AgentConfig, AgentEvent, ToolCallInfo, buildUserMessage, sanitizeHistory, coalesceUserMessages, ChatMessage } from '../agent/agent';
import { htmlToText, fetchUrlText, parseHttpUrl } from '../agent/web';
import { compactDiff, diffText } from '../agent/diff';
import { createSkill, loadSkills } from '../agent/skills';
import {
  DEFAULT_SETTINGS,
  upsertProvider,
  deleteProvider,
  setActive,
  setProviderModels,
  applyGeneral,
  addRecentFolder,
  removeRecentFolder,
  migrate,
  publicSettings,
  fetchModelList,
  activeProvider,
  StoredSettings,
} from '../settings';
import { ChatStore, newChatId, titleFrom, stripImages, isChatId } from '../chats';

async function tmpDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function serve(handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }) };
}

const enc = (s: string) => `enc:${s}`;

// ---------- web ----------

test('web: html is turned into readable text', () => {
  const html = `<html><head><title>Docs &amp; Guide</title><style>.a{color:red}</style></head>
    <body><nav>menu</nav><h1>Hello</h1><p>First   paragraph with <b>bold</b> &lt;tag&gt; &#169; &#x41;.</p>
    <script>alert(1)</script><ul><li>one</li><li>two</li></ul><pre>code  here</pre><!-- hidden --></body></html>`;
  const t = htmlToText(html);
  assert.ok(t.startsWith('Docs & Guide'));
  assert.ok(t.includes('Hello'));
  assert.ok(t.includes('First paragraph with bold <tag> © A.'));
  assert.ok(t.includes('- one') && t.includes('- two'));
  assert.ok(!t.includes('alert') && !t.includes('color:red') && !t.includes('hidden'));
  assert.ok(!/\n{3,}/.test(t));
});

test('web: fetch_url reads pages, handles errors, and refuses non-text and bad links', async () => {
  const srv = await serve((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<title>T</title><p>Hello world</p>');
    } else if (req.url === '/json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"a":1}');
    } else if (req.url === '/img') {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(Buffer.from([1, 2, 3]));
    } else if (req.url === '/big') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('x'.repeat(100_000));
    } else {
      res.writeHead(404);
      res.end('nope');
    }
  });
  try {
    assert.equal(await fetchUrlText(`${srv.url}/page`), 'T\n\nHello world');
    assert.equal(await fetchUrlText(`${srv.url}/json`), '{"a":1}');
    assert.match(await fetchUrlText(`${srv.url}/big`), /truncated to the first 30000/);
    await assert.rejects(fetchUrlText(`${srv.url}/img`), /image\/png, not text/);
    await assert.rejects(fetchUrlText(`${srv.url}/missing`), /HTTP 404/);
    await assert.rejects(fetchUrlText('not a url'), /not a valid URL/);
    await assert.rejects(fetchUrlText('file:///etc/passwd'), /Only http/);
    await assert.rejects(fetchUrlText('http://127.0.0.1:1/'), /Could not fetch/);
    assert.throws(() => parseHttpUrl('ftp://x.com'), /Only http/);

    const ac = new AbortController();
    ac.abort();
    await assert.rejects(fetchUrlText(`${srv.url}/page`, ac.signal));
  } finally {
    await srv.close();
  }
});

// ---------- tools: preview, edit, use_skill ----------

test('tools: edit and write previews show exactly what will change and match the real result', async () => {
  const root = await tmpDir('fa-prev-');
  try {
    const ws = new Workspace(root);
    const ctx = { ws };
    await fs.writeFile(path.join(root, 'a.ts'), 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\n');

    const edit = findTool('edit_file')!;
    const p = (await edit.preview!({ path: 'a.ts', old_string: 'l5', new_string: 'FIVE\nextra' }, ctx))!;
    assert.equal(p.path, 'a.ts');
    assert.equal(p.status, 'modified');
    assert.equal(p.added, 2);
    assert.equal(p.removed, 1);
    assert.ok(p.rows.some((r) => r.t === 'gap'), 'unchanged stretches are collapsed');
    assert.equal(p.rows.filter((r) => r.t === 'add').length, 2);
    assert.equal(await fs.readFile(path.join(root, 'a.ts'), 'utf8'), 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\n', 'preview must not write');

    // a preview that cannot be computed is simply absent, never an error
    assert.equal(await edit.preview!({ path: 'a.ts', old_string: 'nope', new_string: 'x' }, ctx), null);
    assert.equal(await edit.preview!({ path: 'missing.ts', old_string: 'a', new_string: 'b' }, ctx), null);
    assert.equal(await edit.preview!({ path: '../x', old_string: 'a', new_string: 'b' }, ctx), null);

    const write = findTool('write_file')!;
    const created = (await write.preview!({ path: 'new/b.ts', content: 'x\ny\n' }, ctx))!;
    assert.equal(created.status, 'added');
    assert.equal(created.added, 2);
    const over = (await write.preview!({ path: 'a.ts', content: 'l1\nCHANGED\n' }, ctx))!;
    assert.equal(over.status, 'modified');
    assert.equal(over.added, 1);
    assert.equal(over.removed, 9);
    await fs.writeFile(path.join(root, 'bin.dat'), Buffer.from([0, 1]));
    assert.equal(await write.preview!({ path: 'bin.dat', content: 'x' }, ctx), null);

    // the preview and the real edit use the same logic
    const real = await edit.run({ path: 'a.ts', old_string: 'l5', new_string: 'FIVE\nextra' }, ctx);
    assert.match(real, /1 replacement/);
    assert.equal(applyEdit('a b a', 'a', 'X', true).updated, 'X b X');
    assert.throws(() => applyEdit('a', 'a', 'a', false), /identical/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('diff: compactDiff keeps context and caps the size', () => {
  const a = Array.from({ length: 100 }, (_, i) => `l${i}`).join('\n');
  const b = a.replace('l50', 'CHANGED');
  const d = diffText(a, b);
  const c = compactDiff(d.lines, 2);
  assert.deepEqual(c.rows.map((r) => (r.t === 'gap' ? `gap${r.n}` : r.t)), ['gap48', 'eq', 'eq', 'del', 'add', 'eq', 'eq', 'gap47']);
  assert.equal(c.truncated, false);
  const many = diffText('', Array.from({ length: 1000 }, (_, i) => `n${i}`).join('\n'));
  const capped = compactDiff(many.lines, 2, 50);
  assert.equal(capped.rows.length, 50);
  assert.equal(capped.truncated, true);
});

test('tools: use_skill loads instructions, helper files, and stays inside the skill folder', async () => {
  const base = await tmpDir('fa-useskill-');
  try {
    const dir = path.join(base, 'skills');
    await createSkill(dir, { name: 'deploy', description: 'How to deploy', instructions: 'Run ./scripts/deploy.sh then check logs.' });
    await fs.mkdir(path.join(dir, 'deploy/scripts'));
    await fs.writeFile(path.join(dir, 'deploy/scripts/deploy.sh'), 'echo deploying');
    await fs.writeFile(path.join(base, 'secret.txt'), 'top secret');
    const skills = await loadSkills([{ dir, source: 'global' }]);
    const ws = new Workspace(base);
    const ctx = { ws, skills: () => skills };
    const use = findTool('use_skill')!;

    const out = await use.run({ name: 'Deploy' }, ctx);
    assert.ok(out.includes('# Skill: deploy') && out.includes('Run ./scripts/deploy.sh') && out.includes('scripts/deploy.sh'));
    assert.equal(await use.run({ name: 'deploy', file: 'scripts/deploy.sh' }, ctx), 'echo deploying');
    await assert.rejects(use.run({ name: 'deploy', file: '../../secret.txt' }, ctx), /outside the project folder/);
    await assert.rejects(use.run({ name: 'nope' }, ctx), /No skill named "nope"\. Available: deploy/);
    await assert.rejects(use.run({ name: 'x' }, { ws }), /No skills are installed/);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});

// ---------- agent: attachments, previews, live output ----------

function mockServer(scripts: ((body: any) => unknown[])[]) {
  const requests: any[] = [];
  return serve((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const body = JSON.parse(data);
      requests.push(body);
      const chunks = scripts[Math.min(requests.length - 1, scripts.length - 1)]!(body);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });
  }).then((s) => ({ ...s, requests }));
}

const say = (t: string) => [{ choices: [{ delta: { content: t } }] }];
const call = (id: string, name: string, args: object) => [
  { choices: [{ delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] },
];

function cfg(url: string, over: Partial<AgentConfig> = {}): AgentConfig {
  return { baseUrl: url + '/v1', model: 'm', maxSteps: 8, maxContextChars: 60_000, approvalMode: 'ask', ...over };
}

function rec(allow = true) {
  const events: AgentEvent[] = [];
  const approvals: ToolCallInfo[] = [];
  return {
    events,
    approvals,
    hooks: { onEvent: (e: AgentEvent) => events.push(e), approve: async (c: ToolCallInfo) => (approvals.push(c), allow) },
  };
}

test('agent: the approval request carries a diff preview, and live command output is streamed', async () => {
  const root = await tmpDir('fa-live-');
  const mock = await mockServer([
    () => call('e1', 'edit_file', { path: 'a.txt', old_string: 'two', new_string: 'TWO' }),
    () => call('c1', 'run_command', { command: 'echo one; sleep 0.2; echo two' }),
    () => say('done'),
  ]);
  try {
    await fs.writeFile(path.join(root, 'a.txt'), 'one\ntwo\nthree\n');
    const r = rec(true);
    await new Agent(cfg(mock.url), new Workspace(root)).run('go', r.hooks, new AbortController().signal);

    const editCall = r.events.find((e) => e.type === 'tool_call' && e.name === 'edit_file') as any;
    assert.equal(editCall.awaitingApproval, true);
    assert.equal(editCall.preview.added, 1);
    assert.equal(editCall.preview.removed, 1);
    assert.equal(r.approvals[0]!.preview!.path, 'a.txt');

    const out = r.events.filter((e) => e.type === 'tool_output').map((e) => (e as any).chunk).join('');
    assert.ok(out.includes('one') && out.includes('two'));
    assert.ok(r.events.some((e) => e.type === 'tool_output' && (e as any).id === 'c1'));
    const cmdCall = r.events.find((e) => e.type === 'tool_call' && e.name === 'run_command') as any;
    assert.equal(cmdCall.preview, undefined);
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: network tool follows the approval modes; read tools never ask', async () => {
  const root = await tmpDir('fa-net-');
  try {
    const cases: [AgentConfig['approvalMode'], boolean][] = [['ask', true], ['edits', true], ['auto', false]];
    for (const [mode, asks] of cases) {
      const mock = await mockServer([() => call('f1', 'fetch_url', { url: 'http://127.0.0.1:1/x' }), () => say('ok')]);
      try {
        const r = rec(false);
        await new Agent(cfg(mock.url, { approvalMode: mode }), new Workspace(root)).run('go', r.hooks, new AbortController().signal);
        assert.equal(r.approvals.length > 0, asks, mode);
      } finally {
        await mock.close();
      }
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: skills are listed in the prompt and use_skill is offered only when skills exist', async () => {
  const root = await tmpDir('fa-skp-');
  const base = await tmpDir('fa-skp-s-');
  const mock = await mockServer([() => say('hi')]);
  try {
    await createSkill(base, { name: 'api-style', description: 'How we write APIs', instructions: 'Use REST.' });
    const skills = await loadSkills([{ dir: base, source: 'global' }]);

    await new Agent(cfg(mock.url), new Workspace(root), { getSkills: () => skills }).run('x', rec().hooks, new AbortController().signal);
    const withSkills = mock.requests[0];
    assert.ok(withSkills.messages[0].content.includes('- api-style: How we write APIs'));
    assert.ok(withSkills.tools.some((t: any) => t.function.name === 'use_skill'));

    await new Agent(cfg(mock.url), new Workspace(root)).run('x', rec().hooks, new AbortController().signal);
    const without = mock.requests[1];
    assert.ok(!without.messages[0].content.includes('Skills available'));
    assert.ok(!without.tools.some((t: any) => t.function.name === 'use_skill'));
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(base, { recursive: true, force: true });
  }
});

test('agent: attachments become images, inlined files and links in the user message', async () => {
  const msg = buildUserMessage('look at these', [
    { kind: 'image', name: 'shot.png', dataUrl: 'data:image/png;base64,AAAA' },
    { kind: 'file', name: 'notes.md', text: '# Notes\nhello' },
    { kind: 'link', url: 'https://example.com/doc' },
  ]);
  assert.equal(msg.role, 'user');
  assert.ok(Array.isArray(msg.content));
  const parts = msg.content as any[];
  assert.equal(parts[0].type, 'text');
  assert.ok(parts[0].text.includes('look at these'));
  assert.ok(parts[0].text.includes('<attached_file name="notes.md">\n# Notes\nhello\n</attached_file>'));
  assert.ok(parts[0].text.includes('- https://example.com/doc'));
  assert.deepEqual(parts[1], { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } });

  const plain = buildUserMessage('hi', []);
  assert.equal(plain.content, 'hi');
  const onlyImage = buildUserMessage('', [{ kind: 'image', name: 'a', dataUrl: 'data:image/png;base64,AA' }]);
  assert.equal((onlyImage.content as any[])[0].text, '(see attached image)');
});

test('agent: sends attachments to the server, and old images count against the context budget', async () => {
  const root = await tmpDir('fa-att-');
  const mock = await mockServer([() => say('ok')]);
  try {
    const agent = new Agent(cfg(mock.url, { maxContextChars: 8000 }), new Workspace(root));
    const big = 'data:image/png;base64,' + 'A'.repeat(50);
    await agent.run('first', rec().hooks, new AbortController().signal, [{ kind: 'image', name: 'a.png', dataUrl: big }]);
    const sent = mock.requests[0].messages.find((m: any) => m.role === 'user');
    assert.ok(Array.isArray(sent.content));
    assert.equal(sent.content[1].image_url.url, big);
    for (let i = 0; i < 4; i++) {
      await agent.run('again ' + i, rec().hooks, new AbortController().signal, [{ kind: 'image', name: 'b.png', dataUrl: big }]);
    }
    const users = mock.requests.at(-1).messages.filter((m: any) => m.role === 'user');
    assert.ok(users.length < 5, 'images are expensive, so old turns are dropped sooner');
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: a saved conversation can be restored, and broken histories are repaired', async () => {
  const root = await tmpDir('fa-restore-');
  const mock = await mockServer([() => say('first answer'), () => say('second answer')]);
  try {
    const a1 = new Agent(cfg(mock.url), new Workspace(root));
    await a1.run('question one', rec().hooks, new AbortController().signal);
    const saved = a1.getMessages();
    assert.equal(saved[0]!.role, 'user');
    assert.ok(!saved.some((m) => m.role === 'system'));

    const a2 = new Agent(cfg(mock.url), new Workspace(root));
    a2.loadMessages(saved);
    await a2.run('question two', rec().hooks, new AbortController().signal);
    const sent = mock.requests[1].messages;
    assert.deepEqual(sent.map((m: any) => m.role), ['system', 'user', 'assistant', 'user']);

    const broken: ChatMessage[] = [
      { role: 'assistant', content: 'orphan at the start' },
      { role: 'tool', tool_call_id: 'zzz', content: 'orphan result' },
      { role: 'user', content: 'hello' },
      { role: 'user', content: 'how are you' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'list_dir', arguments: '{}' } }] },
    ];
    const fixed = sanitizeHistory(broken);
    assert.deepEqual(fixed.map((m) => m.role), ['user', 'assistant', 'tool']);
    assert.equal(fixed[0]!.content, 'hello\n\nhow are you', 'consecutive user messages are coalesced');
    assert.match(String(fixed[2]!.content), /interrupted/);
    assert.equal(fixed[2]!.tool_call_id, 't1');

    // direct test of coalesceUserMessages
    const coalesced = coalesceUserMessages([
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
      { role: 'user', content: 'third' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'fourth' },
    ]);
    assert.deepEqual(coalesced.map((m) => m.role), ['user', 'assistant', 'user']);
    assert.equal(coalesced[0]!.content, 'first\n\nsecond\n\nthird');
    assert.equal(coalesced[2]!.content, 'fourth');
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------- settings: providers ----------

test('settings: add, update, switch and delete providers; keys never reach the window', () => {
  let s: StoredSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const added = upsertProvider(s, { name: ' OpenRouter ', baseUrl: 'https://openrouter.ai/api/v1/', model: ' qwen/x ', apiKey: ' sk-1 ' }, enc);
  s = added.settings;
  const p = s.providers.find((x) => x.id === added.id)!;
  assert.equal(p.name, 'OpenRouter');
  assert.equal(p.baseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(p.model, 'qwen/x');
  assert.equal(p.apiKey, 'enc:sk-1');
  assert.equal(s.activeProviderId, 'default', 'adding does not switch automatically');

  const pub = publicSettings(s);
  assert.ok(!JSON.stringify(pub).includes('sk-1') && !JSON.stringify(pub).includes('enc:'));
  assert.equal(pub.providers.find((x) => x.id === added.id)!.hasApiKey, true);

  const pubWithDecryptionFailure = publicSettings(s, (k) => k !== 'enc:sk-1');
  assert.equal(pubWithDecryptionFailure.providers.find((x) => x.id === added.id)!.hasApiKey, false);
  assert.equal(pubWithDecryptionFailure.providers.find((x) => x.id === added.id)!.keyDecryptionFailed, true);

  // update: key kept when not mentioned, replaced, then removed
  s = upsertProvider(s, { id: added.id, name: 'OR', baseUrl: p.baseUrl }, enc).settings;
  assert.equal(s.providers.find((x) => x.id === added.id)!.apiKey, 'enc:sk-1');
  s = upsertProvider(s, { id: added.id, apiKey: 'sk-2' }, enc).settings;
  assert.equal(s.providers.find((x) => x.id === added.id)!.apiKey, 'enc:sk-2');
  s = upsertProvider(s, { id: added.id, apiKey: '' }, enc).settings;
  assert.equal(s.providers.find((x) => x.id === added.id)!.apiKey, undefined);

  // changing the URL clears the cached model list
  s = setProviderModels(s, added.id, ['b', 'a', 'a', '']);
  assert.deepEqual(s.providers.find((x) => x.id === added.id)!.models, ['a', 'b']);
  s = upsertProvider(s, { id: added.id, baseUrl: 'https://other.example/v1' }, enc).settings;
  assert.deepEqual(s.providers.find((x) => x.id === added.id)!.models, []);

  s = setActive(s, added.id, 'qwen/y');
  assert.equal(activeProvider(s).id, added.id);
  assert.equal(activeProvider(s).model, 'qwen/y');
  assert.throws(() => setActive(s, 'nope'), /no longer exists/);
  assert.throws(() => setActive(s, added.id, '  '), /Model name/);

  s = deleteProvider(s, added.id);
  assert.equal(s.activeProviderId, 'default', 'deleting the active one falls back');
  assert.throws(() => deleteProvider(s, 'default'), /at least one/);
  assert.throws(() => deleteProvider(s, 'zzz'), /no longer exists/);

  // validation
  assert.throws(() => upsertProvider(s, { name: '', baseUrl: 'http://x.com' }, enc), /name/);
  assert.throws(() => upsertProvider(s, { name: 'x', baseUrl: 'not a url' }, enc), /valid URL/);
  assert.throws(() => upsertProvider(s, { name: 'x', baseUrl: 'file:///etc' }, enc), /http/);
  assert.throws(() => upsertProvider(s, { id: 'ghost', name: 'x', baseUrl: 'http://x.com' }, enc), /no longer exists/);
  assert.throws(() => upsertProvider(s, { name: 'x'.repeat(41), baseUrl: 'http://x.com' }, enc), /too long/);

  // the original object is never mutated
  const before = JSON.stringify(s);
  upsertProvider(s, { name: 'y', baseUrl: 'http://y.com' }, enc);
  assert.equal(JSON.stringify(s), before);
});

test('settings: general options and recent folders', () => {
  let s: StoredSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  s = applyGeneral(s, { approvalMode: 'edits', maxSteps: '500' });
  assert.equal(s.approvalMode, 'edits');
  assert.equal(s.maxSteps, 300);
  assert.equal(applyGeneral(s, { maxSteps: 0 }).maxSteps, 1);
  assert.throws(() => applyGeneral(s, { approvalMode: 'yolo' }), /approval mode/);
  assert.throws(() => applyGeneral(s, { maxSteps: 'abc' }), /number/);

  s = applyGeneral(s, { persona: 'science', onboarded: true });
  assert.equal(s.persona, 'science');
  assert.equal(s.onboarded, true);

  for (let i = 0; i < 70; i++) s = addRecentFolder(s, `/p/${i}`);
  s = addRecentFolder(s, '/p/68');
  s = addRecentFolder(s, '/p/3');
  assert.equal(s.recentFolders.length, 60);
  assert.equal(s.recentFolders[0], '/p/3');
  assert.equal(s.recentFolders.filter((f) => f === '/p/3').length, 1);
  assert.ok(!removeRecentFolder(s, '/p/3').recentFolders.includes('/p/3'));
});

test('settings: the first version of the file is migrated, bad files fall back to defaults', () => {
  const v1 = migrate({ baseUrl: 'https://openrouter.ai/api/v1', model: 'm1', apiKey: 'enc:abc', approvalMode: 'edits', maxSteps: 40 });
  assert.equal(v1.version, 2);
  assert.equal(v1.providers.length, 1);
  assert.equal(v1.providers[0]!.apiKey, 'enc:abc');
  assert.equal(v1.providers[0]!.model, 'm1');
  assert.equal(v1.approvalMode, 'edits');
  assert.equal(v1.maxSteps, 40);

  assert.deepEqual(migrate(null), DEFAULT_SETTINGS);
  assert.deepEqual(migrate('garbage'), DEFAULT_SETTINGS);
  assert.deepEqual(migrate({ version: 2, providers: [] }), DEFAULT_SETTINGS);

  const v2 = migrate({ version: 2, providers: [{ id: 'a', name: 'A', baseUrl: 'http://x', model: 'm' }, { nope: 1 }], activeProviderId: 'missing', approvalMode: 'bogus' });
  assert.equal(v2.providers.length, 1);
  assert.equal(v2.activeProviderId, 'a', 'unknown active id falls back to the first provider');
  assert.equal(v2.approvalMode, 'ask');
});

test('settings: fetching the model list works with OpenAI, Ollama and error responses', async () => {
  let seenAuth: string | undefined;
  const srv = await serve((req, res) => {
    seenAuth = req.headers['authorization'];
    if (req.url === '/openai/models') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'm-b' }, { id: 'm-a' }] }));
    } else if (req.url === '/ollama/models') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'qwen:7b' }] }));
    } else if (req.url === '/empty/models') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"data":[]}');
    } else if (req.url === '/bad/models') {
      res.writeHead(401);
      res.end();
    } else if (req.url === '/html/models') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html>hi</html>');
    } else {
      res.writeHead(500);
      res.end();
    }
  });
  try {
    assert.deepEqual(await fetchModelList(`${srv.url}/openai`, 'sk-key'), ['m-b', 'm-a']);
    assert.equal(seenAuth, 'Bearer sk-key');
    assert.deepEqual(await fetchModelList(`${srv.url}/ollama/`, undefined), ['qwen:7b']);
    assert.equal(seenAuth, undefined);
    await assert.rejects(fetchModelList(`${srv.url}/empty`, undefined), /no models/);
    await assert.rejects(fetchModelList(`${srv.url}/bad`, 'x'), /rejected the API key/);
    await assert.rejects(fetchModelList(`${srv.url}/html`, undefined), /expected format/);
    await assert.rejects(fetchModelList(`${srv.url}/other`, undefined), /HTTP 500/);
    await assert.rejects(fetchModelList('http://127.0.0.1:1/v1', undefined), /Could not reach/);
  } finally {
    await srv.close();
  }
});

// ---------- saved chats ----------

test('chats: save, list, load, delete; images are not kept; ids cannot escape the folder', async () => {
  const dir = await tmpDir('fa-chats-');
  try {
    const store = new ChatStore(path.join(dir, 'chats'));
    const id1 = newChatId();
    const id2 = newChatId();
    assert.ok(isChatId(id1) && !isChatId('../../etc/passwd') && !isChatId('c_xyz'));

    assert.equal(await store.save({ id: id1, folder: '/p/a', messages: [] }), null, 'empty chats are not saved');

    const messages: ChatMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Fix the login bug\n\n<attached_file name="a">secret</attached_file>' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,HUGE' } }] },
      { role: 'assistant', content: 'Done.' },
    ];
    const meta = (await store.save({ id: id1, folder: '/p/a', messages }))!;
    assert.equal(meta.title, 'Fix the login bug');
    await new Promise((r) => setTimeout(r, 5));
    await store.save({ id: id2, folder: '/p/b', messages: [{ role: 'user', content: 'x'.repeat(100) }] });

    const loaded = (await store.load(id1))!;
    assert.ok(!JSON.stringify(loaded).includes('HUGE'));
    assert.ok(JSON.stringify(loaded).includes('image attached earlier'));
    assert.equal(loaded.messages.length, 2);

    const all = await store.list();
    assert.deepEqual(all.map((c) => c.id), [id2, id1], 'newest first');
    assert.equal(all[0]!.title.length, 58);
    assert.deepEqual((await store.list('/p/a')).map((c) => c.id), [id1]);
    assert.deepEqual(await store.list('/nowhere'), []);

    await assert.rejects(store.delete('../../x'), /Invalid chat id/);
    assert.equal(await store.load('../../x' as string), null);
    await store.delete(id1);
    assert.equal(await store.load(id1), null);
    await fs.writeFile(path.join(dir, 'chats', `${id2}.json`), '{not json');
    assert.equal(await store.load(id2), null, 'a corrupt file is ignored, not fatal');
    assert.deepEqual(await store.list(), []);

    assert.equal(titleFrom([]), 'New chat');
    assert.equal(stripImages([{ role: 'user', content: 'plain' }])[0]!.content, 'plain');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
