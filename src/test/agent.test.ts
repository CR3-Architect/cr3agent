import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Workspace, PathEscapeError } from '../agent/workspace';
import { findTool } from '../agent/tools';
import { Agent, AgentConfig, AgentEvent, ToolCallInfo } from '../agent/agent';

// ---------- helpers ----------

async function tmpDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return fs.realpath(dir);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

type Script = (body: any) => { sse?: unknown[]; json?: unknown; status?: number; text?: string };

async function startMock(scripts: Script[]) {
  const requests: any[] = [];
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const body = JSON.parse(data);
      requests.push(body);
      const script = scripts[Math.min(requests.length - 1, scripts.length - 1)]!;
      const out = script(body);
      if (out.status && out.status !== 200) {
        res.writeHead(out.status, { 'content-type': 'text/plain' });
        res.end(out.text ?? '');
        return;
      }
      if (out.json) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(out.json));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const chunk of out.sse ?? []) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

const textReply = (t: string) => ({
  sse: [{ choices: [{ delta: { role: 'assistant', content: t.slice(0, 3) } }] }, { choices: [{ delta: { content: t.slice(3) } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }] }],
});

/** A tool call whose arguments arrive split across several chunks, like real servers do. */
const toolReply = (id: string, name: string, argsJson: string, lead = '') => {
  const mid = Math.floor(argsJson.length / 2);
  return {
    sse: [
      ...(lead ? [{ choices: [{ delta: { role: 'assistant', content: lead } }] }] : []),
      { choices: [{ delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: '' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: argsJson.slice(0, mid) } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: argsJson.slice(mid) } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ],
  };
};

function baseConfig(url: string, over: Partial<AgentConfig> = {}): AgentConfig {
  return { baseUrl: url, model: 'test-model', maxSteps: 10, maxContextChars: 60_000, approvalMode: 'ask', ...over };
}

function recorder(allow = true) {
  const events: AgentEvent[] = [];
  const approvals: ToolCallInfo[] = [];
  return {
    events,
    approvals,
    hooks: {
      onEvent: (e: AgentEvent) => events.push(e),
      approve: async (c: ToolCallInfo) => {
        approvals.push(c);
        return allow;
      },
    },
  };
}

/** Every assistant tool call must be answered by a tool message, or real servers reject the history. */
function assertValidHistory(messages: any[]) {
  messages.forEach((m, i) => {
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) {
        const answered = messages.slice(i + 1).some((x) => x.role === 'tool' && x.tool_call_id === tc.id);
        assert.ok(answered, `tool call ${tc.id} has no tool message`);
      }
    }
    if (m.role === 'tool') {
      const before = messages.slice(0, i).some((x) => x.role === 'assistant' && x.tool_calls?.some((tc: any) => tc.id === m.tool_call_id));
      assert.ok(before, `tool message ${m.tool_call_id} has no matching assistant tool call`);
    }
  });
}

// ---------- sandbox ----------

test('workspace: allows paths inside, blocks everything that escapes', async () => {
  const root = await tmpDir('fa-root-');
  const outside = await tmpDir('fa-out-');
  try {
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src', 'a.ts'), 'x');
    await fs.writeFile(path.join(root, '..foo'), 'y');
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
    await fs.symlink(outside, path.join(root, 'link'));
    await fs.symlink(path.join(outside, 'missing.txt'), path.join(root, 'dangle'));

    const ws = new Workspace(root);
    const real = await fs.realpath(root);

    assert.equal(await ws.resolve('src/a.ts'), path.join(real, 'src', 'a.ts'));
    assert.equal(await ws.resolve(''), real);
    assert.equal(await ws.resolve('.'), real);
    assert.equal(await ws.resolve('new/deep/file.txt'), path.join(real, 'new', 'deep', 'file.txt'));
    assert.equal(await ws.resolve('..foo'), path.join(real, '..foo'));
    assert.equal(await ws.resolve(path.join(real, 'src', 'a.ts')), path.join(real, 'src', 'a.ts'));

    await assert.rejects(ws.resolve('../x'), PathEscapeError);
    await assert.rejects(ws.resolve('src/../../x'), PathEscapeError);
    await assert.rejects(ws.resolve(path.join(outside, 'secret.txt')), PathEscapeError);
    await assert.rejects(ws.resolve('/etc/passwd'), PathEscapeError);
    await assert.rejects(ws.resolve('link'), PathEscapeError);
    await assert.rejects(ws.resolve('link/secret.txt'), PathEscapeError);
    await assert.rejects(ws.resolve('link/new.txt'), PathEscapeError);
    await assert.rejects(ws.resolve('dangle'), PathEscapeError);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

// ---------- tools ----------

test('tools: write, read, edit, list, search', async () => {
  const root = await tmpDir('fa-tools-');
  try {
    const ws = new Workspace(root);
    const run = (name: string, args: Record<string, unknown>) => findTool(name)!.run(args, { ws });

    assert.match(await run('write_file', { path: 'src/app.ts', content: 'const a = 1;\nconst b = 2;\nconst c = 3;\n' }), /Created src\/app\.ts/);
    assert.match(await run('write_file', { path: 'src/app.ts', content: 'const a = 1;\nconst b = 2;\nconst c = 3;\n' }), /Overwrote/);
    assert.equal(await run('read_file', { path: 'src/app.ts' }), 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
    assert.equal(await run('read_file', { path: 'src/app.ts', start_line: 2, end_line: 2 }), '[lines 2-2 of 4]\nconst b = 2;');
    await fs.writeFile(path.join(root, 'empty.txt'), '');
    assert.equal(await run('read_file', { path: 'empty.txt' }), '[empty file]');

    // edit: unique, missing, ambiguous, replace_all, and "$" in the replacement stays literal
    assert.match(await run('edit_file', { path: 'src/app.ts', old_string: 'const b = 2;', new_string: 'const b = "$&";' }), /1 replacement/);
    assert.ok((await fs.readFile(path.join(root, 'src/app.ts'), 'utf8')).includes('const b = "$&";'));
    await assert.rejects(run('edit_file', { path: 'src/app.ts', old_string: 'nope', new_string: 'x' }), /not found/);
    await assert.rejects(run('edit_file', { path: 'src/app.ts', old_string: 'const', new_string: 'let' }), /appears 3 times/);
    assert.match(await run('edit_file', { path: 'src/app.ts', old_string: 'const', new_string: 'let', replace_all: true }), /3 replacements/);
    await assert.rejects(run('edit_file', { path: 'src/app.ts', old_string: '', new_string: 'x' }), /must not be empty/);

    // list
    await fs.mkdir(path.join(root, 'node_modules/pkg'), { recursive: true });
    await fs.writeFile(path.join(root, 'node_modules/pkg/index.js'), 'const hidden = 1;');
    const flat = await run('list_dir', {});
    assert.ok(flat.includes('src/') && flat.includes('empty.txt') && flat.includes('node_modules/ (skipped)'));
    const deep = await run('list_dir', { recursive: true });
    assert.ok(deep.includes('src/app.ts'));
    assert.ok(!deep.includes('index.js'));

    // search
    assert.match(await run('search', { pattern: 'let c' }), /src\/app\.ts:3: let c = 3;/);
    assert.equal(await run('search', { pattern: 'hidden' }), 'No matches.');
    assert.equal(await run('search', { pattern: 'let', include: 'py' }), 'No matches.');
    assert.match(await run('search', { pattern: 'LET B', case_insensitive: true }), /app\.ts:2/);
    await assert.rejects(run('search', { pattern: '(' }), /Invalid regular expression/);

    // binary files are refused
    await fs.writeFile(path.join(root, 'bin.dat'), Buffer.from([1, 2, 0, 3]));
    await assert.rejects(run('read_file', { path: 'bin.dat' }), /binary/);
    // bad arguments give readable errors
    await assert.rejects(run('read_file', {}), /Missing or invalid argument "path"/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('tools: file tools cannot write outside the folder', async () => {
  const root = await tmpDir('fa-esc-');
  const outside = await tmpDir('fa-esc-out-');
  try {
    const ws = new Workspace(root);
    const run = (name: string, args: Record<string, unknown>) => findTool(name)!.run(args, { ws });
    await assert.rejects(run('write_file', { path: '../evil.txt', content: 'x' }), PathEscapeError);
    await assert.rejects(run('write_file', { path: path.join(outside, 'evil.txt'), content: 'x' }), PathEscapeError);
    await fs.symlink(outside, path.join(root, 'link'));
    await assert.rejects(run('write_file', { path: 'link/evil.txt', content: 'x' }), PathEscapeError);
    assert.equal(await exists(path.join(outside, 'evil.txt')), false);
    assert.equal(await exists(path.join(root, '..', 'evil.txt')), false);
    await assert.rejects(run('list_dir', { path: '..' }), PathEscapeError);
    await assert.rejects(run('search', { pattern: 'x', path: '/' }), PathEscapeError);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('tools: run_command reports output, exit codes, cwd and timeouts', async () => {
  const root = await tmpDir('fa-cmd-');
  try {
    const ws = new Workspace(root);
    const run = (args: Record<string, unknown>) => findTool('run_command')!.run(args, { ws });

    const ok = await run({ command: 'echo hello && echo oops 1>&2' });
    assert.ok(ok.startsWith('[exit code 0]') && ok.includes('hello') && ok.includes('oops'));
    assert.ok((await run({ command: 'exit 3' })).startsWith('[exit code 3]'));
    assert.ok((await run({ command: 'true' })).includes('(no output)'));
    const real = await fs.realpath(root);
    assert.ok((await run({ command: 'pwd' })).includes(real));
    const t0 = Date.now();
    const timedOut = await run({ command: 'sleep 20', timeout_seconds: 1 });
    assert.ok(timedOut.includes('timed out after 1s'));
    assert.ok(Date.now() - t0 < 5000, 'timeout should kill the process promptly');
    // stdin is closed, so interactive commands do not hang
    assert.ok((await run({ command: 'cat' })).startsWith('[exit code 0]'));
    // large output is shortened
    const big = await run({ command: 'head -c 200000 /dev/zero | tr "\\0" "a"' });
    assert.ok(big.length < 35_000 && big.includes('characters omitted'));
    await assert.rejects(run({ command: '   ' }), /must not be empty/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------- agent loop ----------

test('agent: streams text, runs a tool after approval, and feeds the result back', async () => {
  const root = await tmpDir('fa-agent-');
  const mock = await startMock([
    () => toolReply('call_a', 'write_file', JSON.stringify({ path: 'hello.txt', content: 'hi there' }), 'Creating it. '),
    () => textReply('All done.'),
  ]);
  try {
    const agent = new Agent(baseConfig(mock.url), new Workspace(root));
    const rec = recorder(true);
    await agent.run('make hello.txt', rec.hooks, new AbortController().signal);

    assert.equal(await fs.readFile(path.join(root, 'hello.txt'), 'utf8'), 'hi there');
    assert.equal(rec.approvals.length, 1);
    assert.equal(rec.approvals[0]!.name, 'write_file');

    const text = rec.events.filter((e) => e.type === 'text').map((e) => (e as any).delta).join('');
    assert.equal(text, 'Creating it. All done.');
    const call = rec.events.find((e) => e.type === 'tool_call') as any;
    assert.equal(call.awaitingApproval, true);
    assert.deepEqual(call.args, { path: 'hello.txt', content: 'hi there' });
    const result = rec.events.find((e) => e.type === 'tool_result') as any;
    assert.equal(result.ok, true);

    assert.equal(mock.requests.length, 2);
    const second = mock.requests[1].messages;
    assert.equal(second[0].role, 'system');
    assert.ok(second[0].content.includes(await fs.realpath(root)));
    assertValidHistory(second);
    assert.equal(second.at(-1).role, 'tool');
    assert.match(second.at(-1).content, /Created hello\.txt/);
    assert.ok(mock.requests[0].tools.some((t: any) => t.function.name === 'edit_file'));
    assert.equal(mock.requests[0].stream, true);
    assert.equal(mock.requests[0].model, 'test-model');
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: a denied action is not executed and the model is told', async () => {
  const root = await tmpDir('fa-deny-');
  const mock = await startMock([
    () => toolReply('call_d', 'write_file', JSON.stringify({ path: 'no.txt', content: 'x' })),
    () => textReply('Okay, I will not.'),
  ]);
  try {
    const agent = new Agent(baseConfig(mock.url), new Workspace(root));
    const rec = recorder(false);
    await agent.run('write no.txt', rec.hooks, new AbortController().signal);
    assert.equal(await exists(path.join(root, 'no.txt')), false);
    const result = rec.events.find((e) => e.type === 'tool_result') as any;
    assert.equal(result.ok, false);
    assert.match(mock.requests[1].messages.at(-1).content, /^Error: The user denied/);
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: approval modes decide what needs asking', async () => {
  const root = await tmpDir('fa-modes-');
  try {
    await fs.writeFile(path.join(root, 'a.txt'), 'a');
    const scenarios: { mode: AgentConfig['approvalMode']; tool: string; args: object; asks: boolean }[] = [
      { mode: 'ask', tool: 'list_dir', args: {}, asks: false },
      { mode: 'ask', tool: 'write_file', args: { path: 'b.txt', content: 'b' }, asks: true },
      { mode: 'ask', tool: 'run_command', args: { command: 'echo hi' }, asks: true },
      { mode: 'edits', tool: 'write_file', args: { path: 'c.txt', content: 'c' }, asks: false },
      { mode: 'edits', tool: 'run_command', args: { command: 'echo hi' }, asks: true },
      { mode: 'auto', tool: 'run_command', args: { command: 'echo hi' }, asks: false },
    ];
    for (const s of scenarios) {
      const mock = await startMock([() => toolReply('c1', s.tool, JSON.stringify(s.args)), () => textReply('ok')]);
      try {
        const agent = new Agent(baseConfig(mock.url, { approvalMode: s.mode }), new Workspace(root));
        const rec = recorder(true);
        await agent.run('go', rec.hooks, new AbortController().signal);
        assert.equal(rec.approvals.length > 0, s.asks, `${s.mode}/${s.tool}`);
      } finally {
        await mock.close();
      }
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: bad arguments and unknown tools become errors the model can recover from', async () => {
  const root = await tmpDir('fa-bad-');
  const mock = await startMock([
    () => toolReply('c1', 'read_file', '{"path": '),
    () => toolReply('c2', 'delete_everything', '{}'),
    () => toolReply('c3', 'read_file', JSON.stringify({ path: 'missing.txt' })),
    () => textReply('gave up'),
  ]);
  try {
    const agent = new Agent(baseConfig(mock.url), new Workspace(root));
    const rec = recorder();
    await agent.run('go', rec.hooks, new AbortController().signal);
    const results = rec.events.filter((e) => e.type === 'tool_result') as any[];
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.ok === false));
    assert.match(results[0].output, /not valid JSON/);
    assert.match(results[1].output, /Unknown tool/);
    assert.match(results[2].output, /ENOENT|no such file/i);
    assertValidHistory(mock.requests[3].messages);
    assert.equal(rec.approvals.length, 0);
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: pauses with a notice when it reaches the step limit', async () => {
  const root = await tmpDir('fa-steps-');
  const mock = await startMock([() => toolReply('loop', 'list_dir', '{}')]);
  try {
    const agent = new Agent(baseConfig(mock.url, { maxSteps: 3 }), new Workspace(root));
    const rec = recorder();
    await agent.run('loop forever', rec.hooks, new AbortController().signal);
    assert.equal(mock.requests.length, 3);
    const notice = rec.events.find((e) => e.type === 'notice') as any;
    assert.match(notice.message, /Paused after 3 steps/);
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: stopping mid-command aborts quickly and leaves a valid history', async () => {
  const root = await tmpDir('fa-abort-');
  const mock = await startMock([
    () => toolReply('slow', 'run_command', JSON.stringify({ command: 'sleep 30' })),
    () => textReply('back again'),
  ]);
  try {
    const agent = new Agent(baseConfig(mock.url, { approvalMode: 'auto' }), new Workspace(root));
    const controller = new AbortController();
    const t0 = Date.now();
    const pending = agent.run('wait', recorder().hooks, controller.signal);
    setTimeout(() => controller.abort(), 400);
    await assert.rejects(pending, (err: Error) => err.name === 'AbortError');
    assert.ok(Date.now() - t0 < 5000);

    // the next turn must produce a history a real server would accept
    await agent.run('hello again', recorder().hooks, new AbortController().signal);
    assertValidHistory(mock.requests.at(-1).messages);
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: stopping while waiting for approval does not run the tool', async () => {
  const root = await tmpDir('fa-abort2-');
  const mock = await startMock([() => toolReply('w', 'write_file', JSON.stringify({ path: 'x.txt', content: 'x' }))]);
  try {
    const agent = new Agent(baseConfig(mock.url), new Workspace(root));
    const controller = new AbortController();
    const hooks = {
      onEvent: () => {},
      approve: () => {
        setTimeout(() => controller.abort(), 50);
        return new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 100));
      },
    };
    await assert.rejects(agent.run('go', hooks, controller.signal), (err: Error) => err.name === 'AbortError');
    assert.equal(await exists(path.join(root, 'x.txt')), false);
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: understands servers that answer without streaming', async () => {
  const root = await tmpDir('fa-json-');
  const mock = await startMock([
    () => ({
      json: {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'on it',
              tool_calls: [{ id: 'j1', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ path: 'j.txt', content: 'j' }) } }],
            },
          },
        ],
      },
    }),
    () => textReply('finished'),
  ]);
  try {
    const agent = new Agent(baseConfig(mock.url, { approvalMode: 'auto' }), new Workspace(root));
    await agent.run('go', recorder().hooks, new AbortController().signal);
    assert.equal(await fs.readFile(path.join(root, 'j.txt'), 'utf8'), 'j');
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: tool calls without an index or id (some local servers) still work', async () => {
  const root = await tmpDir('fa-noidx-');
  const mock = await startMock([
    () => ({
      sse: [
        { choices: [{ delta: { tool_calls: [{ function: { name: 'list_dir', arguments: '{}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      ],
    }),
    () => textReply('listed'),
  ]);
  try {
    const agent = new Agent(baseConfig(mock.url), new Workspace(root));
    const rec = recorder();
    await agent.run('go', rec.hooks, new AbortController().signal);
    assert.equal(rec.events.filter((e) => e.type === 'tool_result').length, 1);
    assertValidHistory(mock.requests[1].messages);
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: server problems produce clear errors', async () => {
  const root = await tmpDir('fa-err-');
  try {
    const ws = new Workspace(root);
    const signal = new AbortController().signal;

    const notFound = await startMock([() => ({ status: 404, text: 'model not found' })]);
    await assert.rejects(new Agent(baseConfig(notFound.url), ws).run('x', recorder().hooks, signal), /HTTP 404.*model name/s);
    await notFound.close();

    const noTools = await startMock([() => ({ status: 400, text: '{"error":"registry.ollama.ai/x does not support tools"}' })]);
    await assert.rejects(new Agent(baseConfig(noTools.url), ws).run('x', recorder().hooks, signal), /may not support tool calling/);
    await noTools.close();

    const unauthorized = await startMock([() => ({ status: 401, text: 'bad key' })]);
    await assert.rejects(new Agent(baseConfig(unauthorized.url), ws).run('x', recorder().hooks, signal), /API key/);
    await unauthorized.close();

    await assert.rejects(new Agent(baseConfig('http://127.0.0.1:1/v1'), ws).run('x', recorder().hooks, signal), /Could not reach the model server/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: sends the API key as a bearer token', async () => {
  const root = await tmpDir('fa-key-');
  let auth: string | undefined;
  const server = http.createServer((req, res) => {
    auth = req.headers['authorization'];
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'hi' } }] })}\n\ndata: [DONE]\n\n`);
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/`;
    await new Agent(baseConfig(url, { apiKey: 'sk-test' }), new Workspace(root)).run('x', recorder().hooks, new AbortController().signal);
    assert.equal(auth, 'Bearer sk-test');
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('agent: old turns are dropped to stay within the context budget', async () => {
  const root = await tmpDir('fa-ctx-');
  const mock = await startMock([() => textReply('ok')]);
  try {
    const agent = new Agent(baseConfig(mock.url, { maxContextChars: 2500 }), new Workspace(root));
    for (let i = 1; i <= 8; i++) {
      await agent.run(`question ${i} ` + 'x'.repeat(400), recorder().hooks, new AbortController().signal);
    }
    const last = mock.requests.at(-1).messages;
    assert.equal(last[0].role, 'system');
    const users = last.filter((m: any) => m.role === 'user');
    assert.ok(users.length < 8, 'old turns should have been dropped');
    assert.ok(users.at(-1).content.startsWith('question 8'));
    assertValidHistory(last);
  } finally {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
