import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { ApprovalMode } from './agent/agent';

export interface StoredProvider {
  id: string;
  name: string;
  baseUrl: string;
  /** "enc:<base64>" (OS keychain) or "plain:<base64>" when no keychain is available. */
  apiKey?: string;
  /** The model used with this provider. */
  model: string;
  /** Models fetched from the provider's /models endpoint (for the picker). */
  models: string[];
}

/** A signed-in account. Only GitHub keeps a token (needed to push and open pull requests). */
export interface StoredAccount {
  login: string;
  name?: string;
  email?: string;
  /** "enc:<base64>" like provider keys (GitHub only). */
  token?: string;
  connectedAt: number;
}

export interface StoredOauth {
  githubClientId: string;
  googleClientId: string;
  /** Google "desktop app" clients come with a secret that is not really secret; still stored encrypted. */
  googleClientSecret?: string;
}

export interface ProjectMeta {
  lastOpened: number;
  opens: number;
}

export interface StoredSettings {
  version: 2;
  providers: StoredProvider[];
  activeProviderId: string;
  approvalMode: ApprovalMode;
  maxSteps: number;
  maxContextChars: number;
  recentFolders: string[];
  /** When one model is rate-limited, out of credit or down, try the other providers' models in list order. */
  autoFallback: boolean;
  /** "Always allow" rules per project folder (see agent/rules.ts). */
  allowRules: Record<string, string[]>;
  projectMeta: Record<string, ProjectMeta>;
  oauth: StoredOauth;
  accounts: { github?: StoredAccount; google?: StoredAccount };
}

export interface ProviderPreset {
  name: string;
  baseUrl: string;
  needsKey: boolean;
  /** Only an example: model names change often. Use "Fetch models" to see what the provider offers. */
  exampleModel: string;
  /** Has a free plan or free models. Free plans have rate limits and they change; check the provider. */
  free?: boolean;
  /** Where to create a key. */
  keyUrl?: string;
  note?: string;
}

export const PRESETS: ProviderPreset[] = [
  { name: 'Ollama (this Mac)', baseUrl: 'http://localhost:11434/v1', needsKey: false, exampleModel: 'qwen2.5-coder:7b', free: true, note: 'Runs on your Mac. No key, no limits except your hardware.' },
  { name: 'LM Studio (this Mac)', baseUrl: 'http://localhost:1234/v1', needsKey: false, exampleModel: '', free: true, note: 'Runs on your Mac. Start its local server first.' },
  { name: 'OpenCode Zen', baseUrl: 'https://opencode.ai/zen/v1', needsKey: true, exampleModel: '', free: true, keyUrl: 'https://opencode.ai/auth', note: 'Has several free models (names ending in -free). Needs an account key.' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', needsKey: true, exampleModel: '', free: true, keyUrl: 'https://openrouter.ai/keys', note: 'Many models marked :free. Free use has daily request limits.' },
  { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', needsKey: true, exampleModel: 'gemini-2.5-flash', free: true, keyUrl: 'https://aistudio.google.com/apikey', note: 'Free tier with rate limits. Good for long files.' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', needsKey: true, exampleModel: 'llama-3.3-70b-versatile', free: true, keyUrl: 'https://console.groq.com/keys', note: 'Free tier, ultra-fast, supports full tool calling.' },
  { name: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', needsKey: true, exampleModel: 'llama-3.3-70b', free: true, keyUrl: 'https://cloud.cerebras.ai', note: 'Free tier with daily token limits.' },
  { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', needsKey: true, exampleModel: 'codestral-latest', free: true, keyUrl: 'https://console.mistral.ai/api-keys', note: 'Free experiment tier (read their data terms).' },
  { name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', needsKey: true, exampleModel: '', free: true, keyUrl: 'https://build.nvidia.com', note: 'Free developer credits and rate-limited free endpoints.' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', needsKey: true, exampleModel: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys' },
  { name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', needsKey: true, exampleModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', keyUrl: 'https://api.together.ai/settings/api-keys' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', needsKey: true, exampleModel: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', note: 'Very cheap, not free.' },
  { name: 'Custom (OpenAI-compatible)', baseUrl: 'http://localhost:8000/v1', needsKey: false, exampleModel: '', note: 'Any server that speaks the OpenAI chat API (vLLM, llama.cpp, your own).' },
];

export const DEFAULT_SETTINGS: StoredSettings = {
  version: 2,
  providers: [
    { id: 'default', name: 'Ollama (this Mac)', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5-coder:3b', models: [] },
  ],
  activeProviderId: 'default',
  approvalMode: 'ask',
  maxSteps: 25,
  maxContextChars: 60_000,
  recentFolders: [],
  autoFallback: true,
  allowRules: {},
  projectMeta: {},
  oauth: { githubClientId: '', googleClientId: '' },
  accounts: {},
};

const MODES: ApprovalMode[] = ['ask', 'edits', 'auto'];
const MAX_RECENT = 60;
const MAX_MODELS = 400;

export type EncodeKey = (plain: string) => string;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function normalizeUrl(input: unknown): string {
  if (typeof input !== 'string') throw new Error('Base URL must be text.');
  const url = input.trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Base URL is not a valid URL (example: http://localhost:11434/v1).');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Base URL must start with http:// or https://');
  return url;
}

export interface ProviderInput {
  id?: unknown;
  name?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  /** undefined = keep the stored key, "" = remove it, anything else = replace it. */
  apiKey?: unknown;
}

/** Add a provider (no id) or update one (with id). Returns the new settings and the provider's id. */
export function upsertProvider(current: StoredSettings, input: ProviderInput, encodeKey: EncodeKey): { settings: StoredSettings; id: string } {
  const next = clone(current);
  const existing = typeof input.id === 'string' ? next.providers.find((p) => p.id === input.id) : undefined;
  if (typeof input.id === 'string' && !existing) throw new Error('That provider no longer exists.');

  const name = input.name === undefined ? existing?.name : typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new Error('Give the provider a name.');
  if (name.length > 40) throw new Error('Provider name is too long (max 40 characters).');
  const baseUrl = input.baseUrl === undefined && existing ? existing.baseUrl : normalizeUrl(input.baseUrl);
  if (input.model !== undefined && typeof input.model !== 'string') throw new Error('Model name must be text.');
  const model = input.model === undefined ? existing?.model ?? '' : (input.model as string).trim();

  let apiKey = existing?.apiKey;
  if (input.apiKey !== undefined) {
    if (typeof input.apiKey !== 'string') throw new Error('API key must be text.');
    const k = input.apiKey.trim();
    apiKey = k === '' ? undefined : encodeKey(k);
  }

  if (existing) {
    existing.name = name;
    existing.baseUrl = baseUrl;
    existing.model = model;
    if (apiKey === undefined) delete existing.apiKey;
    else existing.apiKey = apiKey;
    if (baseUrl !== current.providers.find((p) => p.id === existing.id)?.baseUrl) existing.models = [];
    return { settings: next, id: existing.id };
  }
  const id = 'p_' + crypto.randomBytes(5).toString('hex');
  const provider: StoredProvider = { id, name, baseUrl, model, models: [] };
  if (apiKey !== undefined) provider.apiKey = apiKey;
  next.providers.push(provider);
  if (!next.providers.some((p) => p.id === next.activeProviderId)) next.activeProviderId = id;
  return { settings: next, id };
}

export function deleteProvider(current: StoredSettings, id: string): StoredSettings {
  if (!current.providers.some((p) => p.id === id)) throw new Error('That provider no longer exists.');
  if (current.providers.length <= 1) throw new Error('Keep at least one provider.');
  const next = clone(current);
  next.providers = next.providers.filter((p) => p.id !== id);
  if (next.activeProviderId === id) next.activeProviderId = next.providers[0]!.id;
  return next;
}

export function setActive(current: StoredSettings, id: string, model?: unknown): StoredSettings {
  const next = clone(current);
  const p = next.providers.find((x) => x.id === id);
  if (!p) throw new Error('That provider no longer exists.');
  next.activeProviderId = id;
  if (model !== undefined) {
    if (typeof model !== 'string' || model.trim() === '') throw new Error('Model name is required.');
    p.model = model.trim();
  }
  return next;
}

/** Models that do not support OpenAI-style tool calling or are non-chat (audio, guard, embeddings, tts, etc.). */
export function isToolSupportedModel(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  return !/(?:^|\/)(?:allam|whisper|prompt-guard|guard|embedding|embed|moderation|tts|audio|dall-e|rerank|realtime)/i.test(name);
}

/** Sort models prioritizing capable coding and tool-calling models. */
export function sortModelsWithPriority(models: string[]): string[] {
  function score(m: string): number {
    const lower = m.toLowerCase();
    if (lower === 'llama-3.3-70b-versatile') return 0;
    if (lower === 'llama-3.1-8b-instant') return 1;
    if (lower.includes('qwen2.5-coder') || lower.includes('qwen3.8') || lower.includes('qwen/qwen3.8')) return 2;
    if (lower.includes('deepseek-coder') || lower.includes('deepseek-chat')) return 3;
    if (lower.includes('gpt-4o')) return 4;
    if (lower.includes('llama-3.3') || lower.includes('llama-3.1')) return 5;
    if (lower.includes('codestral')) return 6;
    if (lower.includes('gpt-oss-120b')) return 7;
    if (lower.includes('gpt-oss')) return 8;
    if (lower.includes('coder') || lower.includes('code')) return 9;
    return 20;
  }
  return [...models].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });
}

export function setProviderModels(current: StoredSettings, id: string, models: string[]): StoredSettings {
  const next = clone(current);
  const p = next.providers.find((x) => x.id === id);
  if (!p) throw new Error('That provider no longer exists.');

  const valid = models.filter((m) => typeof m === 'string' && m.trim() !== '');
  const filtered = valid.filter((m) => isToolSupportedModel(m));
  const candidateList = filtered.length > 0 ? filtered : valid;

  // For Groq endpoints, ensure flagship tool-calling models are available
  if (/api\.groq\.com/i.test(p.baseUrl)) {
    for (const gm of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
      if (!candidateList.includes(gm)) candidateList.push(gm);
    }
  }

  p.models = sortModelsWithPriority([...new Set(candidateList)]).slice(0, MAX_MODELS);
  if ((!p.model || !isToolSupportedModel(p.model)) && p.models[0]) {
    p.model = p.models[0];
  }
  return next;
}

export interface GeneralUpdate {
  approvalMode?: unknown;
  maxSteps?: unknown;
  maxContextChars?: unknown;
  autoFallback?: unknown;
}

export function applyGeneral(current: StoredSettings, update: GeneralUpdate): StoredSettings {
  const next = clone(current);
  if (update.approvalMode !== undefined) {
    if (!MODES.includes(update.approvalMode as ApprovalMode)) throw new Error('Unknown approval mode.');
    next.approvalMode = update.approvalMode as ApprovalMode;
  }
  if (update.maxSteps !== undefined) {
    const n = Number(update.maxSteps);
    if (!Number.isFinite(n)) throw new Error('Max steps must be a number.');
    next.maxSteps = Math.min(300, Math.max(1, Math.trunc(n)));
  }
  if (update.maxContextChars !== undefined) {
    const n = Number(update.maxContextChars);
    if (!Number.isFinite(n)) throw new Error('Context size must be a number.');
    next.maxContextChars = Math.min(2_000_000, Math.max(8_000, Math.trunc(n)));
  }
  if (update.autoFallback !== undefined) next.autoFallback = update.autoFallback === true;
  return next;
}

export function addRecentFolder(current: StoredSettings, folder: string, now: number = Date.now()): StoredSettings {
  const next = clone(current);
  next.recentFolders = [folder, ...next.recentFolders.filter((f) => f !== folder)].slice(0, MAX_RECENT);
  const meta = next.projectMeta[folder];
  next.projectMeta[folder] = { lastOpened: now, opens: (meta?.opens ?? 0) + 1 };
  for (const f of Object.keys(next.projectMeta)) if (!next.recentFolders.includes(f)) delete next.projectMeta[f];
  return next;
}

export function removeRecentFolder(current: StoredSettings, folder: string): StoredSettings {
  const next = clone(current);
  next.recentFolders = next.recentFolders.filter((f) => f !== folder);
  delete next.projectMeta[folder];
  return next;
}

export function addAllowRule(current: StoredSettings, folder: string, rule: string): StoredSettings {
  const next = clone(current);
  const list = next.allowRules[folder] ?? [];
  if (!list.includes(rule)) list.push(rule);
  next.allowRules[folder] = list.slice(-50);
  return next;
}

export function removeAllowRule(current: StoredSettings, folder: string, rule: string): StoredSettings {
  const next = clone(current);
  const list = (next.allowRules[folder] ?? []).filter((r) => r !== rule);
  if (list.length === 0) delete next.allowRules[folder];
  else next.allowRules[folder] = list;
  return next;
}

export function setOauthConfig(current: StoredSettings, input: { githubClientId?: unknown; googleClientId?: unknown; googleClientSecret?: unknown }, encodeKey: EncodeKey): StoredSettings {
  const next = clone(current);
  const id = (v: unknown, label: string): string => {
    if (typeof v !== 'string') throw new Error(`${label} must be text.`);
    const t = v.trim();
    if (t.length > 300 || /\s/.test(t)) throw new Error(`${label} looks wrong.`);
    return t;
  };
  if (input.githubClientId !== undefined) next.oauth.githubClientId = id(input.githubClientId, 'GitHub client ID');
  if (input.googleClientId !== undefined) next.oauth.googleClientId = id(input.googleClientId, 'Google client ID');
  if (input.googleClientSecret !== undefined) {
    const t = id(input.googleClientSecret, 'Google client secret');
    if (t === '') delete next.oauth.googleClientSecret;
    else next.oauth.googleClientSecret = encodeKey(t);
  }
  return next;
}

export function setAccount(current: StoredSettings, kind: 'github' | 'google', account: StoredAccount): StoredSettings {
  const next = clone(current);
  next.accounts[kind] = account;
  return next;
}

export function clearAccount(current: StoredSettings, kind: 'github' | 'google'): StoredSettings {
  const next = clone(current);
  delete next.accounts[kind];
  return next;
}

/** The other providers' chosen models, in list order: what to try when the active model fails. */
export function fallbackProviders(s: StoredSettings): StoredProvider[] {
  if (!s.autoFallback) return [];
  return s.providers.filter((p) => p.id !== s.activeProviderId && p.model.trim() !== '' && isToolSupportedModel(p.model));
}

export function activeProvider(s: StoredSettings): StoredProvider {
  return s.providers.find((p) => p.id === s.activeProviderId) ?? s.providers[0]!;
}

/** What the window may see: never the keys themselves. */
export function publicSettings(s: StoredSettings) {
  return {
    providers: s.providers.map((p) => ({ id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model, models: p.models, hasApiKey: !!p.apiKey })),
    activeProviderId: activeProvider(s).id,
    approvalMode: s.approvalMode,
    maxSteps: s.maxSteps,
    maxContextChars: s.maxContextChars,
    autoFallback: s.autoFallback,
    recentFolders: s.recentFolders,
    projectMeta: s.projectMeta,
    allowRules: s.allowRules,
    oauth: { githubClientId: s.oauth.githubClientId, googleClientId: s.oauth.googleClientId, hasGoogleSecret: !!s.oauth.googleClientSecret },
    accounts: {
      github: s.accounts.github ? { login: s.accounts.github.login, name: s.accounts.github.name, connectedAt: s.accounts.github.connectedAt, hasToken: !!s.accounts.github.token } : undefined,
      google: s.accounts.google ? { login: s.accounts.google.login, name: s.accounts.google.name, email: s.accounts.google.email, connectedAt: s.accounts.google.connectedAt } : undefined,
    },
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function cleanRules(v: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!isObj(v)) return out;
  for (const [folder, list] of Object.entries(v)) {
    if (Array.isArray(list)) out[folder] = list.filter((r): r is string => typeof r === 'string').slice(0, 50);
  }
  return out;
}

function cleanMeta(v: unknown): Record<string, ProjectMeta> {
  const out: Record<string, ProjectMeta> = {};
  if (!isObj(v)) return out;
  for (const [folder, m] of Object.entries(v)) {
    if (isObj(m) && typeof m['lastOpened'] === 'number') out[folder] = { lastOpened: m['lastOpened'], opens: typeof m['opens'] === 'number' ? m['opens'] : 1 };
  }
  return out;
}

function cleanOauth(v: unknown): StoredOauth {
  const out: StoredOauth = { githubClientId: '', googleClientId: '' };
  if (!isObj(v)) return out;
  if (typeof v['githubClientId'] === 'string') out.githubClientId = v['githubClientId'];
  if (typeof v['googleClientId'] === 'string') out.googleClientId = v['googleClientId'];
  if (typeof v['googleClientSecret'] === 'string' && v['googleClientSecret']) out.googleClientSecret = v['googleClientSecret'];
  return out;
}

function cleanAccounts(v: unknown): StoredSettings['accounts'] {
  const out: StoredSettings['accounts'] = {};
  if (!isObj(v)) return out;
  for (const kind of ['github', 'google'] as const) {
    const a = v[kind];
    if (isObj(a) && typeof a['login'] === 'string') {
      const acc: StoredAccount = { login: a['login'], connectedAt: typeof a['connectedAt'] === 'number' ? a['connectedAt'] : Date.now() };
      if (typeof a['name'] === 'string') acc.name = a['name'];
      if (typeof a['email'] === 'string') acc.email = a['email'];
      if (kind === 'github' && typeof a['token'] === 'string' && a['token']) acc.token = a['token'];
      out[kind] = acc;
    }
  }
  return out;
}

/** Understands the first version of the settings file (one server, one key). */
export function migrate(raw: unknown): StoredSettings {
  const base = clone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;

  if (r['version'] === 2 && Array.isArray(r['providers']) && r['providers'].length > 0) {
    const providers: StoredProvider[] = [];
    for (const p of r['providers'] as Record<string, unknown>[]) {
      if (!p || typeof p['id'] !== 'string' || typeof p['baseUrl'] !== 'string') continue;
      const prov: StoredProvider = {
        id: p['id'],
        name: typeof p['name'] === 'string' && p['name'] ? p['name'] : 'Provider',
        baseUrl: p['baseUrl'],
        model: typeof p['model'] === 'string' ? p['model'] : '',
        models: Array.isArray(p['models']) ? (p['models'] as unknown[]).filter((m): m is string => typeof m === 'string') : [],
      };
      if (typeof p['apiKey'] === 'string' && p['apiKey']) prov.apiKey = p['apiKey'];
      providers.push(prov);
    }
    if (providers.length > 0) {
      const active = typeof r['activeProviderId'] === 'string' && providers.some((p) => p.id === r['activeProviderId']) ? (r['activeProviderId'] as string) : providers[0]!.id;
      return {
        ...base,
        providers,
        activeProviderId: active,
        approvalMode: MODES.includes(r['approvalMode'] as ApprovalMode) ? (r['approvalMode'] as ApprovalMode) : base.approvalMode,
        maxSteps: typeof r['maxSteps'] === 'number' ? Math.min(300, Math.max(1, Math.trunc(r['maxSteps']))) : base.maxSteps,
        maxContextChars: typeof r['maxContextChars'] === 'number' ? r['maxContextChars'] : base.maxContextChars,
        recentFolders: Array.isArray(r['recentFolders']) ? (r['recentFolders'] as unknown[]).filter((f): f is string => typeof f === 'string').slice(0, MAX_RECENT) : [],
        autoFallback: typeof r['autoFallback'] === 'boolean' ? r['autoFallback'] : base.autoFallback,
        allowRules: cleanRules(r['allowRules']),
        projectMeta: cleanMeta(r['projectMeta']),
        oauth: cleanOauth(r['oauth']),
        accounts: cleanAccounts(r['accounts']),
      };
    }
  }

  // version 1: { baseUrl, model, apiKey, approvalMode, maxSteps }
  if (typeof r['baseUrl'] === 'string') {
    const prov: StoredProvider = {
      id: 'default',
      name: 'My server',
      baseUrl: r['baseUrl'],
      model: typeof r['model'] === 'string' ? r['model'] : base.providers[0]!.model,
      models: [],
    };
    if (typeof r['apiKey'] === 'string' && r['apiKey']) prov.apiKey = r['apiKey'];
    base.providers = [prov];
    base.activeProviderId = 'default';
  }
  if (MODES.includes(r['approvalMode'] as ApprovalMode)) base.approvalMode = r['approvalMode'] as ApprovalMode;
  if (typeof r['maxSteps'] === 'number') base.maxSteps = Math.min(300, Math.max(1, Math.trunc(r['maxSteps'])));
  return base;
}

export function loadSettings(file: string): StoredSettings {
  try {
    return migrate(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(file: string, settings: StoredSettings): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** Ask a provider which models it offers (OpenAI-style GET /models). */
export async function fetchModelList(baseUrl: string, apiKey: string | undefined, signal?: AbortSignal): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/models`;
  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const timeout = AbortSignal.timeout(12_000);
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (err) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    if (timeout.aborted) throw new Error('The server did not answer in 12 seconds.');
    throw new Error(`Could not reach ${baseUrl} (${cause?.code ?? cause?.message ?? (err as Error).message}). Is the server running?`);
  }
  if (res.status === 401 || res.status === 403) throw new Error('The server rejected the API key.');
  if (!res.ok) throw new Error(`The server answered HTTP ${res.status} for ${url}.`);
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error('The server did not return a model list in the expected format.');
  }
  const list: unknown[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : Array.isArray(json) ? json : [];
  const ids = list
    .map((m) => (typeof m === 'string' ? m : typeof (m as any)?.id === 'string' ? (m as any).id : typeof (m as any)?.name === 'string' ? (m as any).name : ''))
    .filter(Boolean);
  if (ids.length === 0) throw new Error('The server answered, but listed no models.');

  const filtered = ids.filter((m) => isToolSupportedModel(m));
  const candidateList = filtered.length > 0 ? filtered : ids;

  if (/api\.groq\.com/i.test(baseUrl)) {
    for (const gm of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
      if (!candidateList.includes(gm)) candidateList.push(gm);
    }
  }

  return [...new Set(candidateList)];
}
