import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, safeStorage, shell, IpcMainInvokeEvent } from 'electron';
import * as fs from 'node:fs/promises';
import * as syncFs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Agent, AgentConfig, AgentEvent, Attachment, ChatMessage, ModelTarget, ToolCallInfo } from './agent/agent';
import { isPreApproved, isValidRule } from './agent/rules';
import { createPullRequest, createRepo, defaultBranch, githubUser, pollDeviceFlow, startDeviceFlow } from './github';
import { googleSignIn } from './google';
import { gitCommitAll, gitInit, gitPull, gitPush, gitSetRemote, gitStatus, gitSwitch, parseGithubRemote } from './git';
import { Workspace } from './agent/workspace';
import { ChangeTracker } from './agent/changes';
import { runShell } from './agent/shell';
import { parseHttpUrl } from './agent/web';
import { createSkill, deleteSkill, importSkill, loadSkills, seedDefaultSkills, Skill, SkillDir } from './agent/skills';
import {
  activeProvider,
  addAllowRule,
  addRecentFolder,
  clearAccount,
  removeAllowRule,
  setAccount,
  setOauthConfig,
  applyGeneral,
  deleteProvider,
  fetchModelList,
  loadSettings,
  PRESETS,
  publicSettings,
  removeRecentFolder,
  saveSettings,
  setActive,
  setProviderModels,
  isToolSupportedModel,
  StoredSettings,
  upsertProvider,
} from './settings';
import { ChatStore, newChatId } from './chats';

// ---------- state ----------

let win: BrowserWindow | null = null;
let settingsFile = '';
let settings: StoredSettings;
let chatStore: ChatStore;
let globalSkillsDir = '';

interface Project {
  workspace: Workspace;
  tracker: ChangeTracker;
}

type Decision = 'once' | 'always' | 'deny';

/** One conversation. Several can run at the same time, in the same project or in different ones. */
interface Session {
  id: string;
  folder: string;
  agent: Agent;
  running: AbortController | null;
  pending: Map<string, { call: ToolCallInfo; resolve: (d: Decision) => void }>;
}

const projects = new Map<string, Project>();
const sessions = new Map<string, Session>();
const skillCache = new Map<string, Skill[]>();
let activeFolder: string | null = null;
let activeChat = newChatId();

let terminal: AbortController | null = null;
let accountFlow: AbortController | null = null;

// ---------- helpers ----------

function encodeKey(plain: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return 'enc:' + safeStorage.encryptString(plain).toString('base64');
    } catch (err) {
      console.warn('[safeStorage] Encryption failed, falling back to plain base64:', err);
    }
  }
  return 'plain:' + Buffer.from(plain, 'utf8').toString('base64');
}

function decodeKey(stored: string | undefined): string | undefined {
  if (!stored) return undefined;
  try {
    if (stored.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'));
    if (stored.startsWith('plain:')) return Buffer.from(stored.slice(6), 'base64').toString('utf8');
  } catch (err) {
    console.error('[Key Decryption Error]:', err);
    /* unreadable key: treat as none */
  }
  return undefined;
}

function target(p: { baseUrl: string; apiKey?: string; model: string }): ModelTarget {
  return { baseUrl: p.baseUrl, apiKey: decodeKey(p.apiKey), model: p.model };
}

function agentConfig(): AgentConfig {
  const p = activeProvider(settings);
  const mainTarget = target(p);

  // Intra-provider fallback targets: stay strictly within this provider's models.
  // When a user selects a provider (e.g. NVIDIA), it works around that provider's models
  // and will not shift to Groq, OpenAI, or other providers.
  const alternateTargets: ModelTarget[] = (p.models ?? [])
    .filter((m) => m && m !== p.model && isToolSupportedModel(m))
    .map((m) => ({ baseUrl: p.baseUrl, apiKey: mainTarget.apiKey, model: m }));

  return {
    ...mainTarget,
    maxSteps: settings.maxSteps,
    maxContextChars: settings.maxContextChars,
    approvalMode: settings.approvalMode,
    fallbacks: settings.autoFallback ? alternateTargets : [],
    persona: settings.persona ?? 'software',
  };
}

function persistSettings(next: StoredSettings): void {
  settings = next;
  saveSettings(settingsFile, settings);
  for (const s of sessions.values()) s.agent.updateConfig(agentConfig());
}

function send(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function emitAgent(s: Session, event: AgentEvent | { type: string; [k: string]: unknown }): void {
  send('agent:event', { ...event, chat: s.id });
}

function runningChats(): string[] {
  return [...sessions.values()].filter((s) => s.running).map((s) => s.id);
}

function announceRunning(): void {
  send('app:changed', { what: 'running', chats: runningChats() });
}

function stopSession(s: Session): void {
  s.running?.abort();
  for (const p of s.pending.values()) p.resolve('deny');
  s.pending.clear();
}

function stopAll(): void {
  for (const s of sessions.values()) stopSession(s);
}

function skillDirs(folder: string | null): SkillDir[] {
  const dirs: SkillDir[] = [
    { dir: globalSkillsDir, source: 'global' },
    { dir: path.join(os.homedir(), '.claude', 'skills'), source: 'global' },
  ];
  if (folder) {
    dirs.push({ dir: path.join(folder, '.agent', 'skills'), source: 'project' });
    dirs.push({ dir: path.join(folder, '.claude', 'skills'), source: 'project' });
  }
  return dirs;
}

async function refreshSkills(folder: string | null = activeFolder): Promise<Skill[]> {
  const list = await loadSkills(skillDirs(folder));
  if (folder) skillCache.set(folder, list);
  return list;
}

function publicSkills() {
  const list = (activeFolder ? skillCache.get(activeFolder) : undefined) ?? [];
  return list.map((s) => ({
    name: s.name,
    description: s.description,
    source: s.source,
    dir: s.dir,
    deletable: path.dirname(s.dir) === path.resolve(globalSkillsDir),
  }));
}

function activeProject(): Project | null {
  return activeFolder ? projects.get(activeFolder) ?? null : null;
}

function needProject(): Project {
  const p = activeProject();
  if (!p) throw new Error('Open a project folder first.');
  return p;
}

function needTracker(): ChangeTracker {
  return needProject().tracker;
}

/** The conversation for a chat id, created on first use. */
function sessionFor(id: string, folder: string): Session {
  const existing = sessions.get(id);
  if (existing) return existing;
  const project = projects.get(folder);
  if (!project) throw new Error('Open a project folder first.');
  const s: Session = {
    id,
    folder,
    agent: new Agent(agentConfig(), project.workspace, { getSkills: () => skillCache.get(folder) ?? [] }),
    running: null,
    pending: new Map(),
  };
  sessions.set(id, s);
  return s;
}

function activeSession(): Session {
  return sessionFor(activeChat, needProject().workspace.root);
}

function appState() {
  return {
    settings: publicSettings(settings, (k) => Boolean(decodeKey(k))),
    presets: PRESETS,
    folder: activeFolder,
    chatId: activeChat,
    runningChats: runningChats(),
    platform: process.platform,
    skillsDir: globalSkillsDir,
  };
}

async function openFolderPath(folder: string): Promise<void> {
  const st = await fs.stat(folder).catch(() => null);
  if (!st || !st.isDirectory()) {
    persistSettings(removeRecentFolder(settings, folder));
    throw new Error('That folder no longer exists.');
  }
  let project = projects.get(folder);
  if (!project) {
    const workspace = new Workspace(folder);
    const tracker = new ChangeTracker(workspace);
    await tracker.snapshot();
    project = { workspace, tracker };
    projects.set(workspace.root, project);
  }
  const root = project.workspace.root;
  // Chats that are still running in the project we are leaving keep running.
  activeFolder = root;
  activeChat = newChatId();
  await refreshSkills(root);
  persistSettings(addRecentFolder(settings, root));
}

async function saveChat(s: Session): Promise<void> {
  await chatStore.save({ id: s.id, folder: s.folder, messages: s.agent.getMessages() }).catch(() => undefined);
  send('app:changed', { what: 'chats' });
}

function githubToken(): string | undefined {
  return decodeKey(settings.accounts.github?.token);
}

function openWeb(url: string): void {
  if (!/^https:\/\//.test(url)) throw new Error('Refusing to open a non-https address.');
  void shell.openExternal(url);
}

const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function cleanAttachments(input: unknown): Attachment[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new Error('Attachments are invalid.');
  if (input.length > 12) throw new Error('Attach at most 12 items per message.');
  const out: Attachment[] = [];
  for (const a of input as Record<string, unknown>[]) {
    if (a?.['kind'] === 'image') {
      const url = a['dataUrl'];
      if (typeof url !== 'string' || url.length > 8_000_000 || !IMAGE_RE.test(url)) throw new Error('One of the images is not a supported picture (PNG, JPEG, WebP or GIF, up to about 6 MB).');
      out.push({ kind: 'image', name: String(a['name'] ?? 'image').slice(0, 200), dataUrl: url });
    } else if (a?.['kind'] === 'file') {
      if (typeof a['text'] !== 'string') throw new Error('One of the files could not be read as text.');
      out.push({ kind: 'file', name: String(a['name'] ?? 'file').slice(0, 200), text: a['text'].slice(0, 200_000) });
    } else if (a?.['kind'] === 'link') {
      out.push({ kind: 'link', url: parseHttpUrl(String(a['url'] ?? '')).href });
    } else {
      throw new Error('Unknown attachment type.');
    }
  }
  return out;
}

// ---------- IPC ----------

type Handler = (...args: any[]) => unknown | Promise<unknown>;

/** Every handler answers {ok:true,...} or {ok:false,error}, and only our own page may call them. */
function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (e: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!e.senderFrame?.url.startsWith('file://')) return { ok: false, error: 'Blocked request.' };
    try {
      const result = await fn(...args);
      return { ok: true, ...(result && typeof result === 'object' ? (result as object) : {}) };
    } catch (err) {
      return { ok: false, error: (err as Error).message ?? String(err) };
    }
  });
}

/** What the window needs to pick up a chat that is still working: its open questions and unfinished tool calls. */
function liveInfo(s: Session) {
  if (!s.running) return { running: false, pending: [], unfinished: [] as string[] };
  const messages: ChatMessage[] = s.agent.getMessages();
  const answered = new Set(messages.filter((m) => m.role === 'tool').map((m) => m.tool_call_id));
  const unfinished: string[] = [];
  for (const m of messages) for (const tc of m.tool_calls ?? []) if (!answered.has(tc.id)) unfinished.push(tc.id);
  const pending = [...s.pending.values()].map(({ call }) => ({
    type: 'tool_call', id: call.id, name: call.name, summary: call.summary, args: call.args, awaitingApproval: true, preview: call.preview, always: call.always, chat: s.id,
  }));
  return { running: true, pending, unfinished };
}

function registerIpc(): void {
  handle('state:get', () => appState());

  // ----- settings & providers -----
  handle('settings:general', (u) => {
    persistSettings(applyGeneral(settings, u ?? {}));
    return appState();
  });
  handle('providers:save', (input) => {
    const r = upsertProvider(settings, input ?? {}, encodeKey);
    persistSettings(r.settings);
    return { id: r.id, ...appState() };
  });
  handle('providers:delete', (id: string) => {
    persistSettings(deleteProvider(settings, id));
    return appState();
  });
  handle('providers:activate', (id: string, model?: string) => {
    persistSettings(setActive(settings, id, model));
    return appState();
  });
  handle('providers:fetchModels', async (id: string) => {
    const p = settings.providers.find((x) => x.id === id);
    if (!p) throw new Error('That provider no longer exists.');
    const key = decodeKey(p.apiKey);
    if (p.apiKey && !key) {
      throw new Error(`The saved API key for provider "${p.name}" could not be decrypted. Please re-enter your API key in Settings → Providers & Models.`);
    }
    const models = await fetchModelList(p.baseUrl, key);
    persistSettings(setProviderModels(settings, id, models));
    return appState();
  });

  // ----- folders & chats -----
  handle('folder:pick', async () => {
    if (!win) throw new Error('No window.');
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose the project folder the agent may work in',
      buttonLabel: 'Open',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true, ...appState() };
    await openFolderPath(r.filePaths[0]);
    return appState();
  });
  handle('folder:open', async (p: string) => {
    if (typeof p !== 'string') throw new Error('Invalid folder.');
    await openFolderPath(p);
    return appState();
  });
  handle('folder:forget', (p: string) => {
    persistSettings(removeRecentFolder(settings, String(p)));
    return appState();
  });
  handle('chats:list', async (targetFolder?: string) => {
    const all = await chatStore.list();
    const chats = targetFolder
      ? all.filter(c => c.folder === targetFolder)
      : (activeFolder ? all.filter(c => c.folder === activeFolder) : all);
    return {
      chats,
      allChats: all,
      runningChats: runningChats(),
    };
  });
  handle('chats:new', () => {
    needProject();
    activeChat = newChatId(); // chats that are still working keep working in the background
    return appState();
  });
  handle('chats:open', async (id: string) => {
    const chat = await chatStore.load(id);
    if (!chat) throw new Error('That chat could not be found.');
    if (!activeFolder || activeFolder !== chat.folder) {
      await openFolderPath(chat.folder);
    }
    const project = needProject();
    const live = sessions.get(id);
    if (live && live.folder === project.workspace.root) {
      activeChat = id;
      const msgs = live.agent.getMessages();
      if (msgs.length === 0 && chat.messages.length > 0) {
        live.agent.loadMessages(chat.messages);
      }
      return { messages: live.agent.getMessages(), live: liveInfo(live), ...appState() };
    }
    await refreshSkills();
    const s = sessionFor(chat.id, chat.folder);
    s.agent.loadMessages(chat.messages);
    activeChat = chat.id;
    return { messages: s.agent.getMessages(), live: liveInfo(s), ...appState() };
  });
  handle('chats:delete', async (id: string) => {
    const s = sessions.get(id);
    if (s) {
      stopSession(s);
      sessions.delete(id);
    }
    await chatStore.delete(id);
    if (id === activeChat) activeChat = newChatId();
    announceRunning();
    return appState();
  });
  handle('chats:rename', async (id: string, title: string) => {
    if (typeof id !== 'string' || typeof title !== 'string') throw new Error('Invalid arguments.');
    const meta = await chatStore.rename(id, title);
    send('app:changed', { what: 'chats' });
    return { meta, ...appState() };
  });
  handle('folder:reveal', async (folder?: unknown) => {
    const p = typeof folder === 'string' && folder ? folder : needProject().workspace.root;
    shell.showItemInFolder(p);
    return {};
  });

  // ----- agent -----
  handle('agent:stop', (id?: unknown) => {
    const s = sessions.get(typeof id === 'string' ? id : activeChat);
    if (s) stopSession(s);
    return {};
  });
  handle('agent:approve', (id: unknown, decision: unknown) => {
    if (typeof id !== 'string') return { handled: false };
    // older callers sent true / false
    const d: Decision = decision === true ? 'once' : decision === 'once' || decision === 'always' ? decision : 'deny';
    for (const s of sessions.values()) {
      const p = s.pending.get(id);
      if (!p) continue;
      s.pending.delete(id);
      if (d === 'always') {
        const rule = p.call.always?.rule;
        if (rule && isValidRule(rule)) persistSettings(addAllowRule(settings, s.folder, rule));
      }
      p.resolve(d);
      return { handled: true, settings: publicSettings(settings) };
    }
    return { handled: false };
  });
  handle('rules:remove', (rule: unknown) => {
    const folder = needProject().workspace.root;
    if (typeof rule !== 'string') throw new Error('Invalid rule.');
    persistSettings(removeAllowRule(settings, folder, rule));
    return appState();
  });
  handle('agent:send', async (text: unknown, attachments: unknown) => {
    const message = typeof text === 'string' ? text.trim() : '';
    const files = cleanAttachments(attachments);
    if (message === '' && files.length === 0) throw new Error('Message is empty.');
    const s = activeSession();
    if (s.running) throw new Error('This chat is still working on the previous message.');
    const p = activeProvider(settings);
    if (p.model.trim() === '') throw new Error('Choose a model first (Settings → Providers & Models).');
    if (p.apiKey && !decodeKey(p.apiKey)) {
      throw new Error(`The saved API key for provider "${p.name}" could not be decrypted. Please re-enter your API key in Settings → Providers & Models.`);
    }

    const controller = new AbortController();
    s.running = controller;
    announceRunning();
    s.agent.updateConfig(agentConfig());
    await refreshSkills(s.folder);
    try {
      const run = s.agent.run(
        message,
        {
          onEvent: (ev) => {
            emitAgent(s, ev);
            if (ev.type === 'tool_result') void saveChat(s);
          },
          approve: (call) =>
            new Promise<boolean>((resolve) => {
              s.pending.set(call.id, { call, resolve: (d) => resolve(d !== 'deny') });
            }),
          preApproved: (name, args) => isPreApproved(settings.allowRules[s.folder] ?? [], name, args),
          onModelSwitched: (newTarget) => {
            // Stay on whichever saved provider/model actually worked. Match the key too,
            // because two providers can share a base URL with different keys.
            const match = settings.providers.find(
              (p) => p.baseUrl === newTarget.baseUrl && decodeKey(p.apiKey) === newTarget.apiKey,
            );
            if (!match) return;
            if (settings.activeProviderId === match.id && match.model === newTarget.model) return;
            persistSettings(setActive(settings, match.id, newTarget.model));
            send('app:changed', { what: 'settings' });
          },
        },
        controller.signal,
        files,
      );
      run.catch(() => undefined); // handled below; this only stops a second report while we save
      await saveChat(s); // the user's message is already in the history
      await run;
      emitAgent(s, { type: 'done' });
    } catch (err) {
      if (controller.signal.aborted || (err as Error).name === 'AbortError') emitAgent(s, { type: 'stopped' });
      else emitAgent(s, { type: 'error', message: (err as Error).message ?? String(err) });
    } finally {
      s.pending.clear();
      s.running = null;
      announceRunning();
      await saveChat(s);
      send('app:changed', { what: 'files' });
    }
    return {};
  });

  // ----- changes -----
  handle('changes:list', async () => ({ changes: await needTracker().changes() }));
  handle('changes:diff', async (p: string) => ({ diff: await needTracker().fileDiff(String(p)) }));
  handle('changes:revert', async (p: string) => {
    await needTracker().revert(String(p));
    return { changes: await needTracker().changes() };
  });
  handle('changes:accept', async (p: string) => {
    await needTracker().accept(String(p));
    return { changes: await needTracker().changes() };
  });
  handle('changes:acceptAll', async () => {
    await needTracker().acceptAll();
    return { changes: await needTracker().changes() };
  });
  handle('changes:revertAll', async () => {
    const t = needTracker();
    for (const c of await t.changes()) {
      if (c.binary) continue;
      await t.revert(c.path).catch(() => undefined);
    }
    return { changes: await t.changes() };
  });
  handle('files:reveal', async (p: string) => {
    shell.showItemInFolder(await needProject().workspace.resolve(String(p)));
    return {};
  });

  // ----- terminal (commands you type yourself; not an interactive shell) -----
  handle('terminal:run', async (cmd: unknown) => {
    const { workspace } = needProject();
    if (typeof cmd !== 'string' || cmd.trim() === '') throw new Error('Type a command first.');
    if (terminal) throw new Error('A command is already running. Stop it first.');
    const controller = new AbortController();
    terminal = controller;
    const cwd = await workspace.resolve('.');
    runShell(cmd, { cwd, signal: controller.signal, onData: (chunk) => send('terminal:event', { type: 'data', chunk }) })
      .then((r) => send('terminal:event', { type: 'exit', code: r.code, cancelled: r.cancelled }))
      .catch((err) => send('terminal:event', { type: 'exit', code: null, error: String(err) }))
      .finally(() => {
        terminal = null;
        send('app:changed', { what: 'files' });
      });
    return {};
  });
  handle('terminal:stop', () => {
    terminal?.abort();
    return {};
  });

  // ----- skills -----
  handle('skills:list', async () => {
    await refreshSkills();
    return { skills: publicSkills(), skillsDir: globalSkillsDir };
  });
  handle('skills:create', async (input: any) => {
    await createSkill(globalSkillsDir, {
      name: String(input?.name ?? ''),
      description: String(input?.description ?? ''),
      instructions: String(input?.instructions ?? ''),
    });
    await refreshSkills();
    return { skills: publicSkills() };
  });
  handle('skills:import', async () => {
    if (!win) throw new Error('No window.');
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose a skill folder (it must contain SKILL.md)',
      buttonLabel: 'Import skill',
      properties: ['openDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true, skills: publicSkills() };
    await importSkill(globalSkillsDir, r.filePaths[0]);
    await refreshSkills();
    return { skills: publicSkills() };
  });
  handle('skills:delete', async (dir: string) => {
    await deleteSkill(globalSkillsDir, String(dir));
    await refreshSkills();
    return { skills: publicSkills() };
  });
  handle('skills:openFolder', async () => {
    await fs.mkdir(globalSkillsDir, { recursive: true });
    const err = await shell.openPath(globalSkillsDir);
    if (err) throw new Error(err);
    return {};
  });

  // ----- project history -----
  handle('history:list', async () => {
    const all = await chatStore.list();
    const byFolder = new Map<string, typeof all>();
    for (const c of all) byFolder.set(c.folder, [...(byFolder.get(c.folder) ?? []), c]);
    const rows = [];
    for (const folder of settings.recentFolders) {
      const meta = settings.projectMeta[folder];
      const chats = byFolder.get(folder) ?? [];
      const exists = await fs.stat(folder).then((st) => st.isDirectory()).catch(() => false);
      rows.push({
        folder,
        name: path.basename(folder) || folder,
        lastOpened: meta?.lastOpened ?? 0,
        opens: meta?.opens ?? 0,
        exists,
        chatCount: chats.length,
        lastChat: chats[0]?.title ?? '',
        lastChatAt: chats[0]?.updatedAt ?? 0,
        running: [...sessions.values()].filter((x) => x.folder === folder && x.running).length,
      });
    }
    rows.sort((a, b) => b.lastOpened - a.lastOpened);
    return { projects: rows };
  });

  // ----- git & GitHub -----
  const repoDir = () => needProject().workspace.root;
  const afterGit = () => send('app:changed', { what: 'files' });
  handle('git:status', async () => ({ git: await gitStatus(repoDir()), signedIn: !!githubToken(), github: settings.accounts.github?.login ?? null }));
  handle('git:init', async () => {
    const message = await gitInit(repoDir());
    afterGit();
    return { message };
  });
  handle('git:commit', async (msg: unknown) => {
    const message = await gitCommitAll(repoDir(), msg);
    afterGit();
    return { message };
  });
  handle('git:push', async () => ({ message: await gitPush(repoDir(), githubToken()) }));
  handle('git:pull', async () => {
    const message = await gitPull(repoDir(), githubToken());
    afterGit();
    return { message };
  });
  handle('git:switch', async (name: unknown, create: unknown) => {
    const message = await gitSwitch(repoDir(), name, create === true);
    afterGit();
    return { message };
  });
  handle('git:setRemote', async (url: unknown) => {
    if (typeof url !== 'string' || !url.trim()) throw new Error('Enter a valid repository URL.');
    await gitSetRemote(repoDir(), url.trim());
    afterGit();
    return { message: 'Connected repository remote.' };
  });
  handle('git:createRepo', async (input: any) => {
    const token = githubToken();
    if (!token) throw new Error('Sign in to GitHub first (Settings → Accounts).');
    const repo = await createRepo(token, { name: String(input?.name ?? ''), description: String(input?.description ?? ''), isPrivate: input?.private !== false });
    await gitSetRemote(repoDir(), repo.cloneUrl);
    return { message: `Created ${repo.fullName} and connected it as "origin".`, url: repo.htmlUrl };
  });
  handle('git:pullRequest', async (input: any) => {
    const token = githubToken();
    if (!token) throw new Error('Sign in to GitHub first (Settings → Accounts).');
    const status = await gitStatus(repoDir());
    const gh = parseGithubRemote(status.remote);
    if (!gh) throw new Error('This project has no GitHub remote yet.');
    const base = typeof input?.base === 'string' && input.base.trim() !== '' ? input.base.trim() : await defaultBranch(token, gh.owner, gh.repo);
    if (status.branch === base) throw new Error(`You are on ${base}. Create a new branch first, commit your changes there, then open the pull request.`);
    await gitPush(repoDir(), token);
    const pr = await createPullRequest(token, { ...gh, title: String(input?.title ?? ''), body: String(input?.body ?? ''), head: status.branch, base });
    openWeb(pr.url);
    return { message: `Opened pull request #${pr.number}.`, url: pr.url };
  });
  handle('web:open', (url: unknown) => {
    if (typeof url !== 'string') throw new Error('Invalid address.');
    openWeb(url);
    return {};
  });

  // ----- accounts -----
  handle('account:config', (input: any) => {
    persistSettings(setOauthConfig(settings, input ?? {}, encodeKey));
    return appState();
  });
  handle('account:githubStart', async () => {
    accountFlow?.abort();
    const code = await startDeviceFlow(settings.oauth.githubClientId);
    const controller = new AbortController();
    accountFlow = controller;
    openWeb(code.verificationUri);
    void (async () => {
      try {
        const token = await pollDeviceFlow(settings.oauth.githubClientId, code, controller.signal);
        const user = await githubUser(token);
        persistSettings(setAccount(settings, 'github', { login: user.login, name: user.name, email: user.email, token: encodeKey(token), connectedAt: Date.now() }));
        send('account:event', { kind: 'github', status: 'connected', state: appState() });
      } catch (err) {
        send('account:event', { kind: 'github', status: 'error', message: (err as Error).message });
      }
    })();
    return { userCode: code.userCode, verificationUri: code.verificationUri };
  });
  handle('account:githubToken', async (token: unknown) => {
    if (typeof token !== 'string' || token.trim() === '') throw new Error('Paste a GitHub personal access token.');
    const t = token.trim();
    const user = await githubUser(t);
    persistSettings(setAccount(settings, 'github', { login: user.login, name: user.name, email: user.email, token: encodeKey(t), connectedAt: Date.now() }));
    return appState();
  });
  handle('account:googleStart', async () => {
    if (!settings.oauth.googleClientId.trim()) throw new Error('Add your Google OAuth Client ID first (Settings → Accounts → Google setup).');
    accountFlow?.abort();
    const controller = new AbortController();
    accountFlow = controller;
    void (async () => {
      try {
        const profile = await googleSignIn({
          clientId: settings.oauth.googleClientId,
          clientSecret: decodeKey(settings.oauth.googleClientSecret),
          openUrl: (u) => openWeb(u),
          signal: controller.signal,
        });
        persistSettings(setAccount(settings, 'google', { login: profile.email, name: profile.name, email: profile.email, connectedAt: Date.now() }));
        send('account:event', { kind: 'google', status: 'connected', state: appState() });
      } catch (err) {
        send('account:event', { kind: 'google', status: 'error', message: (err as Error).message });
      }
    })();
    return {};
  });
  handle('account:cancel', () => {
    accountFlow?.abort();
    accountFlow = null;
    return {};
  });
  handle('account:disconnect', (kind: unknown) => {
    if (kind !== 'github' && kind !== 'google') throw new Error('Unknown account.');
    persistSettings(clearAccount(settings, kind));
    return appState();
  });
}

// ---------- menu (a Mac app needs an Edit menu for copy and paste to work) ----------

function command(name: string): void {
  send('app:command', name);
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => command('open-folder') },
        { label: 'New Chat', accelerator: 'CmdOrCtrl+N', click: () => command('new-chat') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => command('settings') },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: () => command('toggle-sidebar') },
        { label: 'Toggle Changes Panel', accelerator: 'CmdOrCtrl+Alt+B', click: () => command('toggle-changes') },
        { label: 'Toggle Terminal', accelerator: 'Ctrl+`', click: () => command('toggle-terminal') },
        { label: 'Focus Message Box', accelerator: 'CmdOrCtrl+L', click: () => command('focus-input') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ type: 'separator' as const }, { role: 'toggleDevTools' as const }]),
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- window ----------

function createWindow(): void {
  const localIcon = path.join(__dirname, '..', 'build', 'icon.png');
  const packagedIcon = path.join(process.resourcesPath || '', 'build', 'icon.png');
  let finalIcon = localIcon;
  try {
    if (app.isPackaged && syncFs.existsSync(packagedIcon)) finalIcon = packagedIcon;
    else if (syncFs.existsSync(localIcon)) finalIcon = localIcon;
  } catch {}

  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'CR3-Agentic AI',
    icon: finalIcon,
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 16, y: 16 },
    } : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#262624' : '#faf9f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.platform === 'darwin' && app.dock) {
    try {
      const img = nativeImage.createFromPath(finalIcon);
      if (!img.isEmpty()) {
        app.dock.setIcon(img);
      }
    } catch {}
  }

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.on('focus', () => send('app:changed', { what: 'files' }));
  win.on('closed', () => {
    stopAll();
    terminal?.abort();
    accountFlow?.abort();
    win = null;
  });
}

app.whenReady().then(async () => {
  const data = app.getPath('userData');
  settingsFile = path.join(data, 'settings.json');
  globalSkillsDir = path.join(data, 'skills');
  settings = loadSettings(settingsFile);
  chatStore = new ChatStore(path.join(data, 'chats'));
  await seedDefaultSkills(globalSkillsDir).catch(() => undefined);

  // Auto-restore project and conversation history from previous sessions
  if (Array.isArray(settings.recentFolders) && settings.recentFolders.length > 0) {
    for (const folder of settings.recentFolders) {
      try {
        const st = await fs.stat(folder);
        if (st.isDirectory()) {
          await openFolderPath(folder);
          const all = await chatStore.list();
          const folderChats = all.filter((c) => c.folder === folder);
          if (folderChats.length > 0 && folderChats[0]) {
            folderChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            activeChat = folderChats[0].id;
          }
          break;
        }
      } catch {}
    }
  }

  // nothing in the window needs camera, location, notifications and the like
  const { session } = await import('electron');
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  registerIpc();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
