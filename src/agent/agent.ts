import { Workspace } from './workspace';
import { Args, findTool, openAiToolSchemas, Preview, Tool } from './tools';
import { buildSkillsPrompt, Skill } from './skills';
import { RuleOffer, suggestRule } from './rules';

export type ApprovalMode = 'ask' | 'edits' | 'auto';

/** One model the agent can talk to. */
export interface ModelTarget {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface AgentConfig {
  /** OpenAI-compatible base URL, e.g. http://localhost:11434/v1 */
  baseUrl: string;
  apiKey?: string;
  model: string;
  maxSteps: number;
  /** Rough budget for conversation history; oldest turns are dropped past this. */
  maxContextChars: number;
  approvalMode: ApprovalMode;
  temperature?: number;
  /** Tried in order when the main model is rate-limited, out of credit or unreachable. */
  fallbacks?: ModelTarget[];
  persona?: 'software' | 'agent' | 'science' | 'devops' | 'general';
}

export type Attachment =
  | { kind: 'image'; name: string; dataUrl: string }
  | { kind: 'file'; name: string; text: string }
  | { kind: 'link'; url: string };

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Args;
  summary: string;
  preview?: Preview;
  /** What "Always allow" would mean for this call (null: never automatic). */
  always?: RuleOffer | null;
}

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; summary: string; args: Args; awaitingApproval: boolean; preview?: Preview; always?: RuleOffer | null }
  | { type: 'tool_output'; id: string; chunk: string }
  | { type: 'tool_result'; id: string; ok: boolean; output: string }
  | { type: 'notice'; message: string };

export interface AgentHooks {
  onEvent(event: AgentEvent): void;
  /** Resolve true to allow the action, false to deny it. */
  approve(call: ToolCallInfo): Promise<boolean>;
  /** True when a saved "always allow" rule already covers this call. */
  preApproved?(name: string, args: Args): boolean;
  /** Fired when an auto-fallback switches the active model successfully. */
  onModelSwitched?(target: ModelTarget): void;
}

interface ToolCallMessage {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: ToolCallMessage[];
  tool_call_id?: string;
  createdAt?: number;
  duration?: number;
}

interface Turn {
  content: string;
  toolCalls: { id: string; name: string; args: string }[];
  /** finish_reason from the server ("length" means the reply hit the model's output limit). */
  finish?: string;
}

/** A failed model request, with enough detail to decide whether another model should be tried. */
export class ModelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly network = false,
    readonly retryAfterMs?: number,
    readonly body = '',
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

export function isRetriable(err: unknown): boolean {
  if (!(err instanceof ModelError)) return false;
  if (err.network) return true;
  const s = err.status;
  if (s === undefined) return false;
  if (s === 413 || s === 429 || s === 408 || s === 402 || s === 401 || s === 403 || s === 404 || s >= 500) return true;
  return s === 400 && /tool|image|vision|context|too long|too large|tokens/i.test(err.body);
}

/** The server rejected the request because the prompt/context was too big. */
function isContextTooLarge(err: unknown): err is ModelError {
  if (!(err instanceof ModelError)) return false;
  if (err.status === 413) return true;
  return (err.status === 400 || err.status === 422) && /context length|maximum context|too many tokens|request too large|reduce your message size|tokens per minute|tpm/i.test(err.body);
}

export const AUTO_CONTINUE = 'Continue exactly where you stopped.';
const MAX_AUTO_CONTINUES = 8;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export interface AgentOptions {
  getSkills?: () => Skill[];
}

const MAX_TOOL_RESULT_CHARS = 20_000;
const IMAGE_COST_CHARS = 3_000; // images count against the history budget as if they were this much text
const MAX_FILE_ATTACHMENT_CHARS = 200_000;

function buildSystemPrompt(root: string, skills: Skill[], persona: string = 'software'): string {
  const personaHints: Record<string, string> = {
    science: 'Primary Focus (Science & Research): Apply empirical scientific rigor, data analysis, reproducible scripts, mathematical precision, and clear research explanations.',
    agent: 'Primary Focus (AI Agent Building & LLMs): Design resilient agentic workflows, prompt patterns, tool schemas, state persistence, multi-agent coordination, and eval loops.',
    software: 'Primary Focus (Software & Web Engineering): Write clean, modular, tested software architectures with robust unit tests, edge-case coverage, and clean Git commits.',
    devops: 'Primary Focus (DevOps & Cloud Systems): Prioritize containerization, reliable CI/CD pipelines, secure shell scripting, configuration management, and infrastructure stability.',
    general: 'Primary Focus (General Purpose Assistant): Be a versatile, proactive assistant for document creation, task automation, coding, and problem-solving.',
  };
  const focus = personaHints[persona] ?? personaHints.software;
  return [
    "You are CR3-Agentic AI, an autonomous agent working inside a project folder on the user's computer.",
    `Project folder: ${root}`,
    `Platform: ${process.platform}`,
    focus,
    '',
    'You can list, read, search, create and edit files in this folder, run shell commands in it, and fetch web pages, using the provided tools. File paths are relative to the project folder, and the file tools cannot reach anything outside it.',
    '',
    'Guidelines:',
    '- Look before you change anything: list the folder, search, and read the relevant files first.',
    '- Make small, targeted changes with edit_file. Use write_file only for new files or complete rewrites.',
    '- After changing code, verify it when you can (run the tests, the build, or the program) and fix problems you find.',
    '- To install a tool or package, use run_command with non-interactive flags. Say what you are installing and why.',
    '- Do not run destructive commands (deleting many files, force pushes, and similar) unless the user explicitly asked for it.',
    '- If the user denies a tool call, do not repeat it. Ask what they would prefer instead.',
    '- The user may attach images, files and links. Attached file contents appear in their message. For links, use fetch_url when you need the page.',
    '- Be concise. When you finish, say what you changed and anything the user should double-check.',
    buildSkillsPrompt(skills),
  ].join('\n');
}

function describeError(err: unknown): string {
  const e = err as { message?: string; cause?: { code?: string; message?: string } };
  return e?.cause?.code ?? e?.cause?.message ?? e?.message ?? String(err);
}

function needsApproval(tool: Tool, mode: ApprovalMode): boolean {
  if (mode === 'auto') return false;
  if (mode === 'edits') return tool.kind === 'command' || tool.kind === 'network';
  return tool.kind !== 'read';
}

export function buildUserMessage(text: string, attachments: Attachment[]): ChatMessage {
  let body = text;
  const files = attachments.filter((a): a is Extract<Attachment, { kind: 'file' }> => a.kind === 'file');
  for (const f of files) {
    const t = f.text.length > MAX_FILE_ATTACHMENT_CHARS ? f.text.slice(0, MAX_FILE_ATTACHMENT_CHARS) + '\n[truncated]' : f.text;
    body += `\n\n<attached_file name=${JSON.stringify(f.name)}>\n${t}\n</attached_file>`;
  }
  const links = attachments.filter((a): a is Extract<Attachment, { kind: 'link' }> => a.kind === 'link');
  if (links.length > 0) {
    body += `\n\nLinks the user attached (use fetch_url to read them):\n${links.map((l) => `- ${l.url}`).join('\n')}`;
  }
  const images = attachments.filter((a): a is Extract<Attachment, { kind: 'image' }> => a.kind === 'image');
  if (images.length === 0) return { role: 'user', content: body };
  const parts: ContentPart[] = [{ type: 'text', text: body === '' ? '(see attached image)' : body }];
  for (const img of images) parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  return { role: 'user', content: parts };
}

function contentSize(c: ChatMessage['content']): number {
  if (c === null) return 0;
  if (typeof c === 'string') return c.length;
  return c.reduce((n, p) => n + (p.type === 'text' ? p.text.length : IMAGE_COST_CHARS), 0);
}

export class Agent {
  private messages: ChatMessage[];
  readonly workspace: Workspace;
  private cfg: AgentConfig;
  private getSkills: () => Skill[];
  private targetStart = 0;
  private cutOff = false;
  /** A smaller context budget learned from a provider/size error during this run. */
  private contextCharLimit?: number;

  constructor(cfg: AgentConfig, workspace: Workspace, opts: AgentOptions = {}) {
    this.cfg = cfg;
    this.workspace = workspace;
    this.getSkills = opts.getSkills ?? (() => []);
    this.messages = [{ role: 'system', content: buildSystemPrompt(workspace.root, this.getSkills(), this.cfg.persona) }];
  }

  updateConfig(cfg: AgentConfig): void {
    this.cfg = cfg;
    // The target list may have changed (for example after auto-switching provider).
    this.targetStart = 0;
    this.contextCharLimit = undefined;
  }

  /** The conversation without the system prompt (used to save a chat). */
  getMessages(): ChatMessage[] {
    return JSON.parse(JSON.stringify(this.messages.slice(1))) as ChatMessage[];
  }

  /** Restore a saved conversation. Only keeps a history a server would accept. */
  loadMessages(messages: ChatMessage[]): void {
    const clean = sanitizeHistory(messages);
    this.messages = [this.messages[0]!, ...clean];
  }

  /** Run one user request to completion (possibly many model/tool steps). */
  async run(userText: string, hooks: AgentHooks, signal: AbortSignal, attachments: Attachment[] = []): Promise<void> {
    const skills = this.getSkills();
    this.messages[0] = { role: 'system', content: buildSystemPrompt(this.workspace.root, skills, this.cfg.persona) };
    const userMsg = buildUserMessage(userText, attachments);
    userMsg.createdAt = Date.now();
    const lastMsg = this.messages[this.messages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      const merged = coalesceUserMessages([lastMsg, userMsg]);
      this.messages[this.messages.length - 1] = merged[0]!;
    } else {
      this.messages.push(userMsg);
    }
    const hasImages = attachments.some((a) => a.kind === 'image');
    this.targetStart = 0;
    let continues = 0;
    const turnStart = Date.now();

    try {
      for (let step = 0; step < this.cfg.maxSteps; step++) {
        if (signal.aborted) throw abortError();
        this.trimHistory();

        const turn = await this.callWithFallback(hooks, signal, skills.length > 0, hasImages);

        const assistant: ChatMessage = {
          role: 'assistant',
          content: turn.content === '' ? null : turn.content,
          createdAt: Date.now(),
          duration: Math.max(0.5, (Date.now() - turnStart) / 1000),
        };
        if (turn.toolCalls.length > 0) {
          assistant.tool_calls = turn.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.args.trim() !== '' && validJson(tc.args) ? tc.args : '{}' },
          }));
        }
        this.messages.push(assistant);

        if (turn.toolCalls.length === 0) {
          // The model hit its output limit in the middle of an answer: ask it to carry on.
          if (turn.finish === 'length' && continues < MAX_AUTO_CONTINUES) {
            continues++;
            hooks.onEvent({ type: 'notice', message: 'The reply reached the model’s output limit. Continuing…' });
            this.messages.push({ role: 'user', content: AUTO_CONTINUE });
            continue;
          }
          return;
        }
        if (turn.finish === 'length' && turn.toolCalls.some((tc) => !validJson(tc.args))) {
          hooks.onEvent({ type: 'notice', message: 'The model ran out of output space in the middle of a tool call. It will retry with smaller pieces.' });
          this.cutOff = true;
        }

        for (const tc of turn.toolCalls) {
          const result = signal.aborted ? 'Cancelled by the user.' : await this.executeTool(tc, hooks, signal);
          this.messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
        this.cutOff = false;
        if (signal.aborted) throw abortError();
      }

      hooks.onEvent({
        type: 'notice',
        message: `Paused after ${this.cfg.maxSteps} steps. Send a message such as "continue" to keep going.`,
      });
    } catch (err) {
      if (!signal.aborted && (err as Error).name !== 'AbortError') {
        const errMsg = (err as Error).message ?? String(err);
        this.messages.push({
          role: 'assistant',
          content: `⚠️ ${errMsg}`,
        });
      }
      throw err;
    }
  }

  // ---------- tool execution ----------

  private async executeTool(
    tc: { id: string; name: string; args: string },
    hooks: AgentHooks,
    signal: AbortSignal,
  ): Promise<string> {
    const tool = findTool(tc.name);
    const ctx = {
      ws: this.workspace,
      signal,
      skills: this.getSkills,
      onOutput: (chunk: string) => hooks.onEvent({ type: 'tool_output', id: tc.id, chunk }),
    };

    let args: Args = {};
    let parseError: string | null = null;
    if (tc.args.trim() !== '') {
      try {
        const parsed: unknown = JSON.parse(tc.args);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Args;
        else parseError = 'Tool arguments must be a JSON object.';
      } catch {
        parseError = this.cutOff
          ? 'Your reply was cut off before the tool arguments were complete (output limit). Call the tool again with a much smaller piece: split big files into several smaller ones or use edit_file for parts.'
          : 'Tool arguments were not valid JSON. Call the tool again with valid JSON arguments.';
      }
    }

    const summary = tool && !parseError ? tool.summarize(args) : tc.name;
    const ask = !!tool && !parseError && needsApproval(tool, this.cfg.approvalMode) && !hooks.preApproved?.(tc.name, args);
    const always = ask ? suggestRule(tc.name, args) : null;

    let preview: Preview | undefined;
    if (ask && tool?.preview) {
      try {
        preview = (await tool.preview(args, ctx)) ?? undefined;
      } catch {
        /* a missing preview must never block the call */
      }
    }
    hooks.onEvent({ type: 'tool_call', id: tc.id, name: tc.name, summary, args, awaitingApproval: ask, preview, always });

    const finish = (ok: boolean, output: string): string => {
      const out = output.length > MAX_TOOL_RESULT_CHARS ? output.slice(0, MAX_TOOL_RESULT_CHARS) + '\n[truncated]' : output;
      hooks.onEvent({ type: 'tool_result', id: tc.id, ok, output: out });
      return ok ? out : `Error: ${out}`;
    };

    if (!tool) {
      return finish(false, `Unknown tool "${tc.name}". Available tools: list_dir, read_file, search, write_file, edit_file, run_command, fetch_url, use_skill.`);
    }
    if (parseError) return finish(false, parseError);

    if (ask) {
      const allowed = await hooks.approve({ id: tc.id, name: tc.name, args, summary, preview, always });
      if (!allowed) return finish(false, 'The user denied this action. Do not retry it; ask what they would like instead.');
    }
    if (signal.aborted) return finish(false, 'Cancelled by the user.');

    try {
      const out = await tool.run(args, ctx);
      return finish(true, out);
    } catch (err) {
      return finish(false, (err as Error).message ?? String(err));
    }
  }

  // ---------- model call (OpenAI-compatible, streaming) ----------

  /** Ask the main model; when it is rate-limited, out of credit or down, move on to the next one. */
  private async callWithFallback(hooks: AgentHooks, signal: AbortSignal, withSkills: boolean, hasImages: boolean): Promise<Turn> {
    const targets: ModelTarget[] = [
      { baseUrl: this.cfg.baseUrl, apiKey: this.cfg.apiKey, model: this.cfg.model },
      ...(this.cfg.fallbacks ?? []),
    ];
    let emitted = false;
    const wrapped: AgentHooks = {
      ...hooks,
      onEvent: (e) => {
        if (e.type === 'text') emitted = true;
        hooks.onEvent(e);
      },
    };
    const failures: { target: ModelTarget; error: unknown }[] = [];
    // A rejected key fails every model on that provider, so do not keep asking.
    const deadKeys = new Set<string>();
    const targetKey = (t: ModelTarget) => `${t.baseUrl.replace(/\/+$/, '')}\u0000${t.apiKey ?? ''}`;
    let i = Math.min(this.targetStart, targets.length - 1);
    let payloadRetries = 0;

    while (i < targets.length) {
      const t = targets[i]!;
      if (deadKeys.has(targetKey(t))) {
        i++;
        continue;
      }
      try {
        let turn: Turn;
        try {
          turn = await this.callModel(t, wrapped, signal, withSkills, hasImages);
        } catch (e) {
          // a short rate limit is worth one patient retry before giving up on this model
          if (e instanceof ModelError && e.status === 429 && !emitted && !signal.aborted && (e.retryAfterMs ?? 2000) <= 8000) {
            await sleep(e.retryAfterMs ?? 2000, signal);
            turn = await this.callModel(t, wrapped, signal, withSkills, hasImages);
          } else {
            throw e;
          }
        }
        this.targetStart = i;
        if (i > 0 && hooks.onModelSwitched) {
          hooks.onModelSwitched(t);
        }
        return turn;
      } catch (e) {
        if (signal.aborted) throw e;

        // The request itself is too large (context window, or a provider's
        // tokens-per-minute limit). Drop old context and try the same model again.
        if (isContextTooLarge(e) && !emitted && payloadRetries < 3 && this.shrinkForTokenLimit(e)) {
          payloadRetries++;
          hooks.onEvent({
            type: 'notice',
            message: 'The request was larger than this model’s token limit. Dropping older context and retrying…',
          });
          continue;
        }

        failures.push({ target: t, error: e });
        const status = e instanceof ModelError ? e.status : undefined;
        if (status === 401 || status === 403) deadKeys.add(targetKey(t));
        if (!isRetriable(e) || emitted) throw e;

        let j = i + 1;
        while (j < targets.length && deadKeys.has(targetKey(targets[j]!))) j++;
        if (j >= targets.length) throw this.allModelsFailed(failures, e);

        const next = targets[j]!;
        const why = status ? `HTTP ${status}` : 'not reachable';
        const message = status === 401 || status === 403
          ? `${t.baseUrl} rejected its API key (${why}). Skipping the other models on that key and switching to ${next.model}. Update the key in Settings if this keeps happening.`
          : `${t.model} did not answer (${why}). Switching to ${next.model}.`;
        hooks.onEvent({ type: 'notice', message });
        i = j;
        payloadRetries = 0;
      }
    }
    throw this.allModelsFailed(failures, failures[failures.length - 1]?.error);
  }

  /** When everything fails, keep the individual reasons visible instead of only the last one. */
  private allModelsFailed(failures: { target: ModelTarget; error: unknown }[], last: unknown): Error {
    if (failures.length <= 1) return last instanceof Error ? last : new Error(String(last));
    const lines = failures.map(({ target, error }) => {
      const e = error instanceof ModelError ? error : undefined;
      const why = e?.status ? `HTTP ${e.status}` : 'not reachable';
      let hint = '';
      if (e?.status === 401 || e?.status === 403) hint = ' — check this provider’s API key in Settings';
      else if (e?.status === 402) hint = ' — out of credits (HTTP 402); add balance or use a free model (e.g. :free)';
      else if (e?.status === 404) hint = ' — this model is not available to your account; fetch the model list again';
      return `• ${target.model} (${target.baseUrl}): ${why}${hint}`;
    });
    const lastError = last instanceof ModelError ? last : undefined;
    const tail = lastError ? `\n\nLast error: ${lastError.message}` : '';
    return new ModelError(`No model could answer. Tried:\n${lines.join('\n')}${tail}`, lastError?.status, false, undefined, lastError?.body);
  }

  private async callModel(target: ModelTarget, hooks: AgentHooks, signal: AbortSignal, withSkills: boolean, hasImages: boolean): Promise<Turn> {
    const url = `${target.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (target.apiKey) headers['Authorization'] = `Bearer ${target.apiKey}`;

    const body: Record<string, unknown> = {
      model: target.model,
      messages: coalesceUserMessages(this.messages),
      tools: openAiToolSchemas(withSkills),
      stream: true,
    };
    if (this.cfg.temperature !== undefined) body['temperature'] = this.cfg.temperature;

    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new ModelError(
        `Could not reach the model server at ${target.baseUrl} (${describeError(err)}). Is it running? For Ollama, start it with "ollama serve".`,
        undefined,
        true,
      );
    }

    if (!res.ok) {
      const text = (await res.text().catch(() => '')).slice(0, 600);
      let hint = '';
      if (res.status === 400 && /image|vision|multimodal/i.test(text)) {
        hint = ' This model may not support images. Remove the image or choose a vision model.';
      } else if (res.status === 400 && /tool/i.test(text)) {
        hint = ' This model may not support tool calling; try a model that does (for example a Qwen2.5-Coder or Qwen3 build).';
      } else if (res.status === 400 && hasImages) {
        hint = ' If you attached an image, this model may not support images.';
      } else if (res.status === 401 || res.status === 403) {
        hint = ' Check the API key for this provider in Settings.';
      } else if (res.status === 402) {
        hint = ' Your account is out of credits (HTTP 402 Payment Required). Add credits or choose a free model (e.g. models ending in :free on OpenRouter).';
      } else if (res.status === 404) {
        hint = ' Check the model name and base URL in Settings.';
      } else if (res.status === 413) {
        hint = ' The request is larger than this model’s token limit. The agent will drop older context and retry; if it persists, shorten attachments or choose a model with a larger limit.';
      } else if (res.status === 429) {
        hint = ' The provider is rate-limiting you. Wait a moment or check your plan and credits.';
      }
      const ra = Number(res.headers.get('retry-after'));
      throw new ModelError(`Model server returned HTTP ${res.status}: ${text}${hint}`, res.status, false, Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined, text);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return this.parseWholeResponse(await res.json(), hooks);
    }
    return this.parseStream(res, hooks, signal);
  }

  private parseWholeResponse(json: unknown, hooks: AgentHooks): Turn {
    const msg = (json as { choices?: { message?: Record<string, unknown> }[] })?.choices?.[0]?.message ?? {};
    const content = typeof msg['content'] === 'string' ? (msg['content'] as string) : '';
    if (content) hooks.onEvent({ type: 'text', delta: content });
    const toolCalls: Turn['toolCalls'] = [];
    const raw = Array.isArray(msg['tool_calls']) ? (msg['tool_calls'] as Record<string, any>[]) : [];
    raw.forEach((tc, i) => {
      const fn = tc['function'] ?? {};
      toolCalls.push({
        id: typeof tc['id'] === 'string' && tc['id'] ? tc['id'] : `call_${Date.now()}_${i}`,
        name: String(fn['name'] ?? ''),
        args: typeof fn['arguments'] === 'string' ? fn['arguments'] : JSON.stringify(fn['arguments'] ?? {}),
      });
    });
    const finish = (json as { choices?: { finish_reason?: unknown }[] })?.choices?.[0]?.finish_reason;
    return { content, toolCalls, finish: typeof finish === 'string' ? finish : undefined };
  }

  private async parseStream(res: Response, hooks: AgentHooks, signal: AbortSignal): Promise<Turn> {
    if (!res.body) throw new Error('The model server sent an empty response.');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const calls: { id: string; name: string; args: string }[] = [];
    let idCounter = 0;
    let finish: string | undefined;

    const handleData = (data: string) => {
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        return;
      }
      if (json?.error) {
        const m = typeof json.error === 'string' ? json.error : json.error.message ?? JSON.stringify(json.error);
        throw new Error(`Model server error: ${m}`);
      }
      const fr = json?.choices?.[0]?.finish_reason;
      if (typeof fr === 'string' && fr) finish = fr;
      const delta = json?.choices?.[0]?.delta;
      if (!delta) return;

      if (typeof delta.content === 'string' && delta.content !== '') {
        content += delta.content;
        hooks.onEvent({ type: 'text', delta: delta.content });
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          let target: { id: string; name: string; args: string } | undefined;
          if (typeof tc.index === 'number') {
            target = calls[tc.index];
            if (!target) {
              target = { id: '', name: '', args: '' };
              calls[tc.index] = target;
            }
          } else if (tc.id) {
            target = calls.find((c) => c && c.id === tc.id);
            if (!target) {
              target = { id: '', name: '', args: '' };
              calls.push(target);
            }
          } else {
            target = calls[calls.length - 1];
            if (!target) {
              target = { id: '', name: '', args: '' };
              calls.push(target);
            }
          }
          if (tc.id) target.id = tc.id;
          if (tc.function?.name) target.name += tc.function.name;
          const a = tc.function?.arguments;
          if (typeof a === 'string') target.args += a;
          else if (a && typeof a === 'object') target.args = JSON.stringify(a);
        }
      }
    };

    const processLine = (line: string) => {
      const l = line.trim();
      if (!l.startsWith('data:')) return;
      const data = l.slice(5).trim();
      if (data === '' || data === '[DONE]') return;
      handleData(data);
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          processLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim() !== '') processLine(buffer);
    } catch (err) {
      if (signal.aborted) throw err;
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      reader.releaseLock?.();
    }

    const toolCalls = calls
      .filter((c) => c && c.name)
      .map((c) => ({ id: c.id || `call_${Date.now()}_${idCounter++}`, name: c.name, args: c.args }));
    return { content, toolCalls, finish };
  }

  // ---------- context management ----------

  private historySize(): number {
    let n = 0;
    for (const m of this.messages) {
      n += contentSize(m.content);
      if (m.tool_calls) n += JSON.stringify(m.tool_calls).length;
    }
    return n;
  }

  /** Keep history within budget: drop whole old turns first, then shrink old output. */
  private trimHistory(limit = Math.min(this.cfg.maxContextChars, this.contextCharLimit ?? Number.POSITIVE_INFINITY)): void {
    while (this.historySize() > limit) {
      const firstUser = this.messages.findIndex((m, i) => i > 0 && m.role === 'user');
      if (firstUser === -1) break;
      const nextUser = this.messages.findIndex((m, i) => i > firstUser && m.role === 'user');
      if (nextUser === -1) break;
      this.messages.splice(firstUser, nextUser - firstUser);
    }
    if (this.historySize() > limit) {
      for (const m of this.messages) {
        if (this.historySize() <= limit) break;
        if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > 600) {
          m.content = m.content.slice(0, 300) + '\n[older output trimmed to save context]';
        }
      }
    }
    if (this.historySize() > limit) {
      const lastUser = this.messages.map((m) => m.role).lastIndexOf('user');
      for (let i = 1; i < this.messages.length; i++) {
        if (this.historySize() <= limit) break;
        const m = this.messages[i]!;
        // Keep the newest user request intact; old replies are safe to shorten.
        if (i !== lastUser && m.role === 'assistant' && typeof m.content === 'string' && m.content.length > 600) {
          m.content = m.content.slice(0, 400) + '\n[older reply trimmed to save context]';
        }
      }
    }
  }

  /**
   * Use the server's reported request/limit numbers to drop enough old context
   * to fit, and remember the smaller budget for the next steps in this run.
   * Returns false when there is nothing left to shrink safely.
   */
  private shrinkForTokenLimit(err: ModelError): boolean {
    const text = `${err.message}\n${err.body}`;
    const requested = Number(
      /requested\s+(\d+)/i.exec(text)?.[1] ?? /resulted in\s+(\d+)/i.exec(text)?.[1] ?? Number.NaN,
    );
    const limit = Number(
      /limit\s+(\d+)/i.exec(text)?.[1] ??
        /maximum context length (?:is|of)\s+(\d+)/i.exec(text)?.[1] ??
        /context length is\s+(\d+)/i.exec(text)?.[1] ??
        Number.NaN,
    );

    const before = this.historySize();
    let targetChars: number;
    if (Number.isFinite(requested) && Number.isFinite(limit) && requested > 0 && limit > 0) {
      const estimatedHistoryTokens = Math.ceil(before / 4);
      const overhead = Math.max(0, requested - estimatedHistoryTokens);
      const targetTokens = Math.floor(limit * 0.8) - overhead;
      targetChars = Math.max(2_000, targetTokens * 4);
      if (targetChars >= before) targetChars = Math.floor(before * 0.7);
    } else {
      targetChars = Math.floor(before * 0.7);
    }

    this.trimHistory(Math.max(1, Math.min(targetChars, before - 1)));
    const after = this.historySize();
    if (after >= before) return false;
    this.contextCharLimit = Math.max(2_000, targetChars);
    return true;
  }
}

/**
 * Coalesce consecutive user messages into a single user message.
 * Strict APIs (Groq, Anthropic, etc.) reject consecutive user turns.
 */
export function coalesceUserMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const msg of messages) {
    const prev = result[result.length - 1];
    if (prev && prev.role === 'user' && msg.role === 'user') {
      if (typeof prev.content === 'string' && typeof msg.content === 'string') {
        prev.content = `${prev.content}\n\n${msg.content}`.trim();
      } else {
        const prevParts: ContentPart[] = Array.isArray(prev.content)
          ? [...prev.content]
          : prev.content !== null && prev.content !== undefined ? [{ type: 'text' as const, text: String(prev.content) }] : [];
        const nextParts: ContentPart[] = Array.isArray(msg.content)
          ? [...msg.content]
          : msg.content !== null && msg.content !== undefined ? [{ type: 'text' as const, text: String(msg.content) }] : [];
        prev.content = [...prevParts, ...nextParts];
      }
    } else {
      result.push({ ...msg });
    }
  }
  return result;
}

/**
 * A history a server will accept: starts at a user message, and every tool call has its answer.
 * Used when restoring a saved chat (which may have been cut off by a crash or a stop).
 */
export function sanitizeHistory(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object' || m.role === 'system') continue;
    out.push(m);
  }
  while (out.length > 0 && out[0]!.role !== 'user') out.shift();

  const result: ChatMessage[] = [];
  for (let i = 0; i < out.length; i++) {
    const m = out[i]!;
    if (m.role === 'tool') {
      const hasCall = result.some((x) => x.role === 'assistant' && x.tool_calls?.some((tc) => tc.id === m.tool_call_id));
      if (!hasCall) continue;
    }
    result.push(m);
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) {
        const answered = out.slice(i + 1).some((x) => x.role === 'tool' && x.tool_call_id === tc.id);
        if (!answered) {
          // add the missing answer right after this assistant message
          result.push({ role: 'tool', tool_call_id: tc.id, content: 'Error: this step was interrupted before it finished.' });
        }
      }
    }
  }
  return coalesceUserMessages(result);
}

function validJson(text: string): boolean {
  if (text.trim() === '') return true;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function abortError(): Error {
  const e = new Error('Stopped');
  e.name = 'AbortError';
  return e;
}
