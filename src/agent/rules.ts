import type { Args } from './tools';

/**
 * "Always allow" rules, kept per project. A rule is a short string:
 *   edit:*         every file change in the project (write_file and edit_file)
 *   cmd:<words>    a command that starts with these words, for example "cmd:npm install"
 *   host:<name>    web requests to one host, for example "host:github.com"
 */

// Programs that can run anything (or reach out, delete, escalate): never offered as "always".
const NEVER_ALWAYS = new Set([
  'rm', 'rmdir', 'sudo', 'su', 'dd', 'mkfs', 'chmod', 'chown', 'kill', 'killall', 'pkill', 'shutdown', 'reboot',
  'sh', 'bash', 'zsh', 'fish', 'eval', 'exec', 'env', 'xargs', 'find', 'curl', 'wget', 'ssh', 'scp', 'sftp', 'nc', 'ncat',
  'osascript', 'open', 'python', 'python3', 'node', 'ruby', 'perl', 'php', 'deno', 'bun', 'npx', 'launchctl', 'defaults', 'diskutil',
]);

const SIMPLE_WORD = /^[A-Za-z][\w:.-]*$/;
// Anything that can chain, redirect, substitute or continue a command: such a command never matches a rule.
const SHELL_TRICKS = /[;&|`$<>\n\r(){}\\]/;

function words(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

/** The rule key for a command, or null when the command must always be asked about. */
export function commandKey(command: string): string | null {
  if (SHELL_TRICKS.test(command)) return null;
  const w = words(command);
  if (w.length === 0) return null;
  const first = w[0]!;
  if (!/^[\w./-]+$/.test(first) || NEVER_ALWAYS.has(first.split('/').pop()!)) return null;
  const second = w[1];
  return second && SIMPLE_WORD.test(second) ? `${first} ${second}` : first;
}

export function hostOf(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export interface RuleOffer {
  rule: string;
  label: string;
}

/** What "Always allow" would mean for this call, or null when it should never be automatic. */
export function suggestRule(tool: string, args: Args): RuleOffer | null {
  if (tool === 'write_file' || tool === 'edit_file') return { rule: 'edit:*', label: 'Always allow file changes in this project' };
  if (tool === 'run_command') {
    const key = typeof args['command'] === 'string' ? commandKey(args['command']) : null;
    return key ? { rule: `cmd:${key}`, label: `Always allow “${key}” in this project` } : null;
  }
  if (tool === 'fetch_url') {
    const host = hostOf(args['url']);
    return host ? { rule: `host:${host}`, label: `Always allow web requests to ${host}` } : null;
  }
  return null;
}

/** Does any saved rule already cover this call? */
export function isPreApproved(rules: readonly string[], tool: string, args: Args): boolean {
  if (rules.length === 0) return false;
  if (tool === 'write_file' || tool === 'edit_file') return rules.includes('edit:*');
  if (tool === 'run_command') {
    const command = typeof args['command'] === 'string' ? args['command'] : '';
    if (commandKey(command) === null) return false;
    const w = words(command).join(' ');
    return rules.some((r) => {
      if (!r.startsWith('cmd:')) return false;
      const key = r.slice(4);
      return w === key || w.startsWith(key + ' ');
    });
  }
  if (tool === 'fetch_url') {
    const host = hostOf(args['url']);
    return host !== null && rules.includes(`host:${host}`);
  }
  return false;
}

export function isValidRule(rule: unknown): rule is string {
  if (typeof rule !== 'string' || rule.length > 200) return false;
  return rule === 'edit:*' || /^cmd:[\w./-]+( [A-Za-z][\w:.-]*)?$/.test(rule) || /^host:[a-z0-9.-]+$/.test(rule);
}

export function describeRule(rule: string): string {
  if (rule === 'edit:*') return 'Change files in this project';
  if (rule.startsWith('cmd:')) return `Run “${rule.slice(4)} …”`;
  if (rule.startsWith('host:')) return `Fetch web pages from ${rule.slice(5)}`;
  return rule;
}
