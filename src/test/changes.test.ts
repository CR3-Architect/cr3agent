import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { diffText, diffLines, splitLines } from '../agent/diff';
import { ChangeTracker } from '../agent/changes';
import { Workspace } from '../agent/workspace';
import { shellEnv, shellInvocation, runShell } from '../agent/shell';
import {
  parseFrontmatter,
  loadSkills,
  createSkill,
  importSkill,
  deleteSkill,
  seedDefaultSkills,
  buildSkillsPrompt,
  isValidSkillName,
  slugify,
} from '../agent/skills';

async function tmpDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

// ---------- diff ----------

/** Rebuild both sides from a diff: the strongest correctness check there is. */
function rebuild(lines: ReturnType<typeof diffLines>) {
  return {
    a: lines.filter((l) => l.t !== 'add').map((l) => l.x),
    b: lines.filter((l) => l.t !== 'del').map((l) => l.x),
  };
}

test('diff: basic cases', () => {
  const same = diffText('a\nb\n', 'a\nb\n');
  assert.equal(same.added + same.removed, 0);
  assert.ok(same.lines.every((l) => l.t === 'eq'));

  const one = diffText('a\nb\nc\n', 'a\nB\nc\n');
  assert.deepEqual(one.lines.map((l) => `${l.t}:${l.x}`), ['eq:a', 'del:b', 'add:B', 'eq:c']);
  assert.equal(one.added, 1);
  assert.equal(one.removed, 1);
  assert.deepEqual(one.lines.map((l) => [l.a, l.b]), [[1, 1], [2, undefined], [undefined, 2], [3, 3]]);

  const created = diffText('', 'x\ny\n');
  assert.equal(created.added, 2);
  assert.equal(created.removed, 0);
  const emptied = diffText('x\ny\n', '');
  assert.equal(emptied.removed, 2);
  assert.equal(diffText('', '').lines.length, 0);

  // only the final newline differs: no changed lines, but flagged
  const eol = diffText('a\nb', 'a\nb\n');
  assert.equal(eol.added + eol.removed, 0);
  assert.equal(eol.eolOnly, true);
  assert.deepEqual(splitLines('a\n\nb\n'), ['a', '', 'b']);
});

test('diff: random edits always reconstruct both sides exactly', () => {
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const words = ['alpha', 'beta', 'gamma', 'delta', 'eps', '', '}', '{', 'return x;'];
  for (let round = 0; round < 300; round++) {
    const a = Array.from({ length: Math.floor(rnd() * 40) }, () => words[Math.floor(rnd() * words.length)]!);
    const b = a.slice();
    const edits = Math.floor(rnd() * 8);
    for (let e = 0; e < edits; e++) {
      const pos = Math.floor(rnd() * (b.length + 1));
      const kind = rnd();
      if (kind < 0.4) b.splice(pos, 0, words[Math.floor(rnd() * words.length)]!);
      else if (kind < 0.8) b.splice(pos, 1);
      else b[pos] = words[Math.floor(rnd() * words.length)]!;
    }
    const lines = diffLines(a, b);
    const r = rebuild(lines);
    assert.deepEqual(r.a, a, `round ${round}: old side`);
    assert.deepEqual(r.b, b, `round ${round}: new side`);
    // line numbers count up by one on their own side
    let ai = 0;
    let bi = 0;
    for (const l of lines) {
      if (l.t !== 'add') assert.equal(l.a, ++ai);
      if (l.t !== 'del') assert.equal(l.b, ++bi);
    }
  }
});

test('diff: minimal for a single inserted line in a big file, and fast for a full rewrite', () => {
  const a = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
  const b = a.slice();
  b.splice(2500, 0, 'inserted');
  const d = diffLines(a, b);
  assert.equal(d.filter((l) => l.t === 'add').length, 1);
  assert.equal(d.filter((l) => l.t === 'del').length, 0);

  const t0 = Date.now();
  const x = Array.from({ length: 4000 }, (_, i) => `old ${i}`);
  const y = Array.from({ length: 4000 }, (_, i) => `new ${i}`);
  const full = diffLines(x, y);
  assert.ok(Date.now() - t0 < 5000, 'full rewrite must not hang');
  const r = rebuild(full);
  assert.deepEqual(r.a, x);
  assert.deepEqual(r.b, y);
});

// ---------- change tracker ----------

test('changes: shows added, modified and deleted files with line counts, and reverts them', async () => {
  const root = await tmpDir('fa-chg-');
  try {
    await fs.mkdir(path.join(root, 'src'));
    await fs.mkdir(path.join(root, 'node_modules/pkg'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/a.ts'), 'one\ntwo\nthree\n');
    await fs.writeFile(path.join(root, 'src/b.ts'), 'keep\nme\n');
    await fs.writeFile(path.join(root, 'src/gone.ts'), 'x\ny\n');
    await fs.writeFile(path.join(root, 'node_modules/pkg/i.js'), 'ignored');
    await fs.writeFile(path.join(root, 'logo.png'), Buffer.from([0, 1, 2, 3]));

    const ws = new Workspace(root);
    const tr = new ChangeTracker(ws);
    const snap = await tr.snapshot();
    assert.equal(snap.tracked, 3);
    assert.equal(snap.skipped, 1, 'binary file is skipped, node_modules is not even scanned');
    assert.deepEqual(await tr.changes(), []);

    await fs.writeFile(path.join(root, 'src/a.ts'), 'one\nTWO\nthree\nfour\n');
    await fs.rm(path.join(root, 'src/gone.ts'));
    await fs.writeFile(path.join(root, 'src/new.ts'), 'n1\nn2\nn3\n');
    await fs.writeFile(path.join(root, 'logo.png'), Buffer.from([9, 9, 0]));
    await fs.writeFile(path.join(root, 'node_modules/pkg/i.js'), 'changed but ignored');

    const ch = await tr.changes();
    assert.deepEqual(
      ch.map((c) => [c.path, c.status, c.added, c.removed]),
      [
        ['src/a.ts', 'modified', 2, 1],
        ['src/gone.ts', 'deleted', 0, 2],
        ['src/new.ts', 'added', 3, 0],
      ],
    );

    const d = await tr.fileDiff('src/a.ts');
    assert.equal(d.status, 'modified');
    assert.deepEqual(d.lines.map((l) => `${l.t}:${l.x}`), ['eq:one', 'del:two', 'add:TWO', 'eq:three', 'add:four']);
    assert.equal((await tr.fileDiff('src/b.ts')).status, 'unchanged');
    assert.equal((await tr.fileDiff('src/gone.ts')).status, 'deleted');
    assert.equal((await tr.fileDiff('src/new.ts')).status, 'added');

    // revert everything
    await tr.revert('src/a.ts');
    await tr.revert('src/gone.ts');
    await tr.revert('src/new.ts');
    assert.equal(await fs.readFile(path.join(root, 'src/a.ts'), 'utf8'), 'one\ntwo\nthree\n');
    assert.equal(await fs.readFile(path.join(root, 'src/gone.ts'), 'utf8'), 'x\ny\n');
    await assert.rejects(fs.access(path.join(root, 'src/new.ts')));
    assert.deepEqual(await tr.changes(), []);
    await assert.rejects(tr.revert('logo.png'), /not tracked/);
    await assert.rejects(tr.revert('../outside.txt'), /outside the project folder/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('changes: accepting one file or all moves the baseline', async () => {
  const root = await tmpDir('fa-acc-');
  try {
    await fs.writeFile(path.join(root, 'a.txt'), '1\n');
    await fs.writeFile(path.join(root, 'b.txt'), '1\n');
    const tr = new ChangeTracker(new Workspace(root));
    await tr.snapshot();
    await fs.writeFile(path.join(root, 'a.txt'), '2\n');
    await fs.writeFile(path.join(root, 'b.txt'), '2\n');
    assert.equal((await tr.changes()).length, 2);

    await tr.accept('a.txt');
    assert.deepEqual((await tr.changes()).map((c) => c.path), ['b.txt']);
    await tr.revert('a.txt'); // reverting an accepted file keeps the accepted content
    assert.equal(await fs.readFile(path.join(root, 'a.txt'), 'utf8'), '2\n');

    await tr.acceptAll();
    assert.deepEqual(await tr.changes(), []);

    // delete then accept: file leaves the baseline
    await fs.rm(path.join(root, 'b.txt'));
    assert.equal((await tr.changes())[0]!.status, 'deleted');
    await tr.accept('b.txt');
    assert.deepEqual(await tr.changes(), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('changes: a rewrite with identical content is not reported (mtime changes only)', async () => {
  const root = await tmpDir('fa-same-');
  try {
    await fs.writeFile(path.join(root, 'a.txt'), 'same\n');
    const tr = new ChangeTracker(new Workspace(root));
    await tr.snapshot();
    await new Promise((r) => setTimeout(r, 20));
    await fs.writeFile(path.join(root, 'a.txt'), 'same\n');
    assert.deepEqual(await tr.changes(), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------- shell ----------

test('shell: Mac gets a login shell and Homebrew paths; other platforms are untouched', () => {
  const env = shellEnv('darwin', { PATH: '/usr/bin:/bin' });
  assert.equal(env['PATH'], '/usr/bin:/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin');
  assert.equal(shellEnv('darwin', { PATH: '/opt/homebrew/bin:/usr/bin' })['PATH']!.split(':').filter((p) => p === '/opt/homebrew/bin').length, 1);
  assert.equal(shellEnv('darwin', {})['PATH']!.startsWith('/opt/homebrew/bin'), true);
  assert.equal(shellEnv('linux', { PATH: '/usr/bin' })['PATH'], '/usr/bin');

  assert.deepEqual(shellInvocation('ls', 'darwin', '/bin/zsh', () => true), { file: '/bin/zsh', args: ['-l', '-c', 'ls'] });
  assert.equal(shellInvocation('ls', 'darwin', '/does/not/exist', () => false)!.file, '/bin/zsh');
  assert.equal(shellInvocation('ls', 'darwin', null, () => true)!.file, '/bin/zsh', 'no $SHELL falls back to zsh');
  assert.equal(shellInvocation('ls', 'darwin', 'zsh', () => true)!.file, '/bin/zsh', 'relative shell paths are ignored');
  assert.equal(shellInvocation('ls', 'linux'), null);
});

test('shell: streams output as it arrives and can be cancelled', async () => {
  const root = await tmpDir('fa-sh-');
  try {
    const chunks: string[] = [];
    const r = await runShell('echo first; sleep 0.2; echo second', { cwd: root, onData: (c) => chunks.push(c) });
    assert.equal(r.code, 0);
    assert.ok(chunks.join('').includes('first') && chunks.join('').includes('second'));
    assert.ok(chunks.length >= 1);

    const ac = new AbortController();
    setTimeout(() => ac.abort(), 200);
    const t0 = Date.now();
    const c = await runShell('sleep 30', { cwd: root, signal: ac.signal });
    assert.equal(c.cancelled, true);
    assert.ok(Date.now() - t0 < 4000);

    const none = await runShell('echo ok', { cwd: root, timeoutMs: 0 });
    assert.equal(none.timedOut, false);
    assert.equal(none.code, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------- skills ----------

test('skills: frontmatter parsing handles quotes, folded text and missing frontmatter', () => {
  assert.deepEqual(parseFrontmatter('---\nname: a\ndescription: "Use: when X"\n---\n\nbody\n'), {
    meta: { name: 'a', description: 'Use: when X' },
    body: 'body\n',
  });
  const folded = parseFrontmatter('---\nname: f\ndescription: >\n  first line\n  second line\n---\nB');
  assert.equal(folded.meta['description'], 'first line second line');
  assert.equal(parseFrontmatter('---\r\nname: crlf\r\n---\r\nhello').meta['name'], 'crlf');
  assert.equal(parseFrontmatter('no frontmatter here').body, 'no frontmatter here');
  assert.equal(parseFrontmatter("---\nname: 'it''s'\n---\n").meta['name'], "it's");
  assert.equal(parseFrontmatter('---\nname: x\ndescription: one\n  two\n---\n').meta['description'], 'one two');
});

test('skills: create, load, override, import and delete', async () => {
  const base = await tmpDir('fa-skills-');
  try {
    const globalDir = path.join(base, 'global');
    const projectDir = path.join(base, 'project');

    await createSkill(globalDir, { name: 'api-style', description: 'Rules: how we write APIs', instructions: 'Use REST.\nReturn JSON.' });
    await assert.rejects(createSkill(globalDir, { name: 'api-style', description: 'd', instructions: 'i' }), /already exists/);
    await assert.rejects(createSkill(globalDir, { name: '../evil', description: 'd', instructions: 'i' }), /Skill name/);
    await assert.rejects(createSkill(globalDir, { name: 'Bad Name', description: 'd', instructions: 'i' }), /Skill name/);
    await assert.rejects(createSkill(globalDir, { name: 'ok', description: '', instructions: 'i' }), /description/);
    await assert.rejects(createSkill(globalDir, { name: 'ok', description: 'd', instructions: '  ' }), /instructions/);

    // project skill with the same name overrides the global one
    await fs.mkdir(path.join(projectDir, 'api-style'), { recursive: true });
    await fs.writeFile(path.join(projectDir, 'api-style/SKILL.md'), '---\nname: api-style\ndescription: project version\n---\nUse GraphQL.\n');
    await fs.mkdir(path.join(projectDir, 'not-a-skill'), { recursive: true });
    await fs.writeFile(path.join(projectDir, 'not-a-skill/readme.md'), 'x');

    const skills = await loadSkills([
      { dir: globalDir, source: 'global' },
      { dir: projectDir, source: 'project' },
      { dir: path.join(base, 'missing'), source: 'project' },
    ]);
    assert.equal(skills.length, 1);
    assert.equal(skills[0]!.source, 'project');
    assert.equal(skills[0]!.body.trim(), 'Use GraphQL.');
    assert.match(buildSkillsPrompt(skills), /- api-style: project version/);
    assert.equal(buildSkillsPrompt([]), '');

    // description round trip for a value that needs quoting
    const globalOnly = await loadSkills([{ dir: globalDir, source: 'global' }]);
    assert.equal(globalOnly[0]!.description, 'Rules: how we write APIs');

    // import a folder
    const src = path.join(base, 'My Cool Skill');
    await fs.mkdir(path.join(src, 'scripts'), { recursive: true });
    await fs.writeFile(path.join(src, 'SKILL.md'), '---\nname: cool\ndescription: cool one\n---\nDo cool things.');
    await fs.writeFile(path.join(src, 'scripts/run.sh'), 'echo hi');
    const dest = await importSkill(globalDir, src);
    assert.equal(path.basename(dest), 'my-cool-skill');
    assert.equal(await fs.readFile(path.join(dest, 'scripts/run.sh'), 'utf8'), 'echo hi');
    await assert.rejects(importSkill(globalDir, src), /already exists/);
    await assert.rejects(importSkill(globalDir, path.join(base, 'project/not-a-skill')), /no SKILL\.md/);

    // delete: only inside the skills folder
    await assert.rejects(deleteSkill(globalDir, projectDir), /Only skills in your skills folder/);
    await assert.rejects(deleteSkill(globalDir, path.join(globalDir, 'my-cool-skill', 'scripts')), /Only skills/);
    await deleteSkill(globalDir, dest);
    await assert.rejects(fs.access(dest));
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});

test('skills: defaults are seeded once and never overwrite what the user has', async () => {
  const base = await tmpDir('fa-seed-');
  try {
    const dir = path.join(base, 'skills');
    await seedDefaultSkills(dir);
    const first = await loadSkills([{ dir, source: 'global' }]);
    assert.ok(first.length >= 2);
    await deleteSkill(dir, path.join(dir, 'code-review'));
    await seedDefaultSkills(dir); // folder exists, so nothing is re-created
    const second = await loadSkills([{ dir, source: 'global' }]);
    assert.equal(second.length, first.length - 1);
    assert.ok(isValidSkillName('a-b_c9') && !isValidSkillName('-a') && !isValidSkillName('A'));
    assert.equal(slugify('  My Cool Skill! '), 'my-cool-skill');
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});
