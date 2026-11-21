import { contextBridge, ipcRenderer } from 'electron';

const call = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

function subscribe(channel: string, cb: (payload: unknown) => void): () => void {
  const handler = (_e: unknown, payload: unknown) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('api', {
  // app + settings
  state: () => call('state:get'),
  setGeneral: (u: unknown) => call('settings:general', u),
  saveProvider: (p: unknown) => call('providers:save', p),
  deleteProvider: (id: string) => call('providers:delete', id),
  activateProvider: (id: string, model?: string) => call('providers:activate', id, model),
  fetchModels: (id: string) => call('providers:fetchModels', id),

  // folders and chats
  pickFolder: () => call('folder:pick'),
  openFolder: (p: string) => call('folder:open', p),
  forgetFolder: (p: string) => call('folder:forget', p),
  listChats: (folder?: string) => call('chats:list', folder),
  openChat: (id: string) => call('chats:open', id),
  deleteChat: (id: string) => call('chats:delete', id),
  renameChat: (id: string, title: string) => call('chats:rename', id, title),
  revealFolder: (folder?: string) => call('folder:reveal', folder),
  newChat: () => call('chats:new'),

  // agent
  send: (text: string, attachments: unknown[]) => call('agent:send', text, attachments),
  stop: (chat?: string) => call('agent:stop', chat),
  /** decision: 'once' | 'always' | 'deny' */
  approve: (id: string, decision: string | boolean) => call('agent:approve', id, decision),
  removeRule: (rule: string) => call('rules:remove', rule),

  // history of projects
  history: () => call('history:list'),

  // git & GitHub
  gitStatus: () => call('git:status'),
  gitInit: () => call('git:init'),
  gitCommit: (msg: string) => call('git:commit', msg),
  gitPush: () => call('git:push'),
  gitPull: () => call('git:pull'),
  gitSwitch: (name: string, create: boolean) => call('git:switch', name, create),
  gitCreateRepo: (input: unknown) => call('git:createRepo', input),
  gitPullRequest: (input: unknown) => call('git:pullRequest', input),
  openWeb: (url: string) => call('web:open', url),

  // accounts
  accountConfig: (input: unknown) => call('account:config', input),
  githubStart: () => call('account:githubStart'),
  githubToken: (t: string) => call('account:githubToken', t),
  googleStart: () => call('account:googleStart'),
  accountCancel: () => call('account:cancel'),
  accountDisconnect: (kind: string) => call('account:disconnect', kind),

  // changes (before / after)
  listChanges: () => call('changes:list'),
  diff: (p: string) => call('changes:diff', p),
  revert: (p: string) => call('changes:revert', p),
  accept: (p: string) => call('changes:accept', p),
  acceptAll: () => call('changes:acceptAll'),
  revertAll: () => call('changes:revertAll'),
  reveal: (p: string) => call('files:reveal', p),

  // terminal
  runTerminal: (cmd: string) => call('terminal:run', cmd),
  stopTerminal: () => call('terminal:stop'),

  // skills
  listSkills: () => call('skills:list'),
  createSkill: (s: unknown) => call('skills:create', s),
  importSkill: () => call('skills:import'),
  deleteSkill: (dir: string) => call('skills:delete', dir),
  openSkillsFolder: () => call('skills:openFolder'),

  // events from the main process
  onEvent: (cb: (e: unknown) => void) => subscribe('agent:event', cb),
  onTerminal: (cb: (e: unknown) => void) => subscribe('terminal:event', cb),
  onCommand: (cb: (cmd: unknown) => void) => subscribe('app:command', cb),
  onChanged: (cb: (e: unknown) => void) => subscribe('app:changed', cb),
  onAccount: (cb: (e: unknown) => void) => subscribe('account:event', cb),
});
