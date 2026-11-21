import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { ChatMessage, ContentPart } from './agent/agent';

export interface ChatMeta {
  id: string;
  folder: string;
  title: string;
  updatedAt: number;
}

export interface SavedChat extends ChatMeta {
  messages: ChatMessage[];
}

const ID_RE = /^c_[a-f0-9]{16}$/;
const MAX_MESSAGES = 400;

export function newChatId(): string {
  return 'c_' + crypto.randomBytes(8).toString('hex');
}

export function isChatId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

const IMAGE_MARKER = '[image attached earlier, not kept]';

function textOf(c: ChatMessage['content']): string {
  if (typeof c === 'string') return c;
  if (!c) return '';
  return c.map((p) => (p.type === 'text' && p.text !== IMAGE_MARKER ? p.text : '')).join(' ');
}

export function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  const t = textOf(first?.content ?? '')
    .replace(/<attached_file[\s\S]*?<\/attached_file>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t === '' ? 'New chat' : t.length > 60 ? t.slice(0, 57) + '…' : t;
}

/** Pictures are big and not worth keeping on disk: leave a marker instead. */
export function stripImages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (!Array.isArray(m.content)) return m;
    const parts: ContentPart[] = m.content.map((p) => (p.type === 'image_url' ? { type: 'text', text: IMAGE_MARKER } : p));
    return { ...m, content: parts };
  });
}

export class ChatStore {
  constructor(private readonly dir: string) {}

  private file(id: string): string {
    if (!isChatId(id)) throw new Error('Invalid chat id.');
    return path.join(this.dir, `${id}.json`);
  }

  async save(chat: { id: string; folder: string; messages: ChatMessage[] }): Promise<ChatMeta | null> {
    const messages = stripImages(chat.messages).slice(-MAX_MESSAGES);
    if (!messages.some((m) => m.role === 'user')) return null; // nothing worth saving yet
    const saved: SavedChat = { id: chat.id, folder: chat.folder, title: titleFrom(messages), updatedAt: Date.now(), messages };
    await fs.mkdir(this.dir, { recursive: true });
    const file = this.file(chat.id);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(saved), { mode: 0o600 });
    await fs.rename(tmp, file);
    return { id: saved.id, folder: saved.folder, title: saved.title, updatedAt: saved.updatedAt };
  }

  async load(id: string): Promise<SavedChat | null> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file(id), 'utf8')) as SavedChat;
      if (!raw || !Array.isArray(raw.messages) || typeof raw.folder !== 'string') return null;
      return raw;
    } catch {
      return null;
    }
  }

  async list(folder?: string): Promise<ChatMeta[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.dir);
    } catch {
      return [];
    }
    const out: ChatMeta[] = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      const id = n.slice(0, -5);
      if (!isChatId(id)) continue;
      const c = await this.load(id);
      if (!c || (folder !== undefined && c.folder !== folder)) continue;
      out.push({ id: c.id, folder: c.folder, title: c.title, updatedAt: c.updatedAt });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    await fs.rm(this.file(id), { force: true });
  }

  async rename(id: string, title: string): Promise<ChatMeta | null> {
    const chat = await this.load(id);
    if (!chat) return null;
    chat.title = title.trim() || chat.title;
    const file = this.file(id);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(chat), { mode: 0o600 });
    await fs.rename(tmp, file);
    return { id: chat.id, folder: chat.folder, title: chat.title, updatedAt: chat.updatedAt };
  }
}
