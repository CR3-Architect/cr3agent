/** GitHub sign-in (device flow, no secret needed) and the few API calls the Git panel uses. */

export interface GithubEndpoints {
  web: string;
  api: string;
}
export const GITHUB: GithubEndpoints = { web: 'https://github.com', api: 'https://api.github.com' };

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  intervalSec: number;
  expiresInSec: number;
}

const SCOPES = 'repo read:user user:email';

async function json(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function startDeviceFlow(clientId: string, ep: GithubEndpoints = GITHUB): Promise<DeviceCode> {
  if (clientId.trim() === '') throw new Error('Add your GitHub OAuth Client ID first (Settings → Accounts → GitHub setup).');
  const res = await fetch(`${ep.web}/login/device/code`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId.trim(), scope: SCOPES }),
  });
  const j = await json(res);
  if (!res.ok || j.error) {
    const why = j.error === 'device_flow_disabled' ? 'Device flow is switched off for that OAuth app. Tick "Enable Device Flow" in its GitHub settings.' : j.error_description || j.error || `HTTP ${res.status}`;
    throw new Error(`GitHub refused the sign-in request: ${why}`);
  }
  return {
    deviceCode: String(j.device_code),
    userCode: String(j.user_code),
    verificationUri: String(j.verification_uri),
    intervalSec: Number(j.interval) || 5,
    expiresInSec: Number(j.expires_in) || 900,
  };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Sign-in cancelled.'));
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error('Sign-in cancelled.'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Waits until the person approves in the browser. Returns the access token. */
export async function pollDeviceFlow(clientId: string, code: DeviceCode, signal: AbortSignal, ep: GithubEndpoints = GITHUB, speedUp = 1): Promise<string> {
  let interval = code.intervalSec;
  const deadline = Date.now() + code.expiresInSec * 1000;
  while (Date.now() < deadline) {
    await wait((interval * 1000) / speedUp, signal);
    const res = await fetch(`${ep.web}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId.trim(), device_code: code.deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
      signal,
    });
    const j = await json(res);
    if (typeof j.access_token === 'string') return j.access_token;
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') {
      interval += 5;
      continue;
    }
    if (j.error === 'access_denied') throw new Error('You cancelled the sign-in on GitHub.');
    if (j.error === 'expired_token') throw new Error('The code expired. Start the sign-in again.');
    throw new Error(`GitHub sign-in failed: ${j.error_description || j.error || 'HTTP ' + res.status}`);
  }
  throw new Error('The code expired. Start the sign-in again.');
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'folder-agent' };
}

async function api(token: string, ep: GithubEndpoints, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${ep.api}${path}`, {
    method,
    headers: { ...authHeaders(token), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = await json(res);
  if (!res.ok) {
    const detail = Array.isArray(j.errors) ? ' ' + j.errors.map((e: any) => e.message || e.code).filter(Boolean).join('; ') : '';
    if (res.status === 401) throw new Error('GitHub rejected the saved sign-in. Sign in again in Settings → Accounts.');
    throw new Error(`GitHub said: ${j.message || 'HTTP ' + res.status}${detail}`);
  }
  return j;
}

export async function githubUser(token: string, ep: GithubEndpoints = GITHUB): Promise<{ login: string; name?: string; email?: string }> {
  const j = await api(token, ep, 'GET', '/user');
  return { login: String(j.login), name: typeof j.name === 'string' ? j.name : undefined, email: typeof j.email === 'string' ? j.email : undefined };
}

export async function createRepo(token: string, input: { name: string; description?: string; isPrivate: boolean }, ep: GithubEndpoints = GITHUB): Promise<{ cloneUrl: string; htmlUrl: string; fullName: string }> {
  if (!/^[\w.-]{1,100}$/.test(input.name)) throw new Error('Repository names can use letters, digits, - _ and . only.');
  const j = await api(token, ep, 'POST', '/user/repos', { name: input.name, description: input.description ?? '', private: input.isPrivate });
  return { cloneUrl: String(j.clone_url), htmlUrl: String(j.html_url), fullName: String(j.full_name) };
}

export async function defaultBranch(token: string, owner: string, repo: string, ep: GithubEndpoints = GITHUB): Promise<string> {
  const j = await api(token, ep, 'GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  return typeof j.default_branch === 'string' ? j.default_branch : 'main';
}

export async function createPullRequest(
  token: string,
  input: { owner: string; repo: string; title: string; body?: string; head: string; base: string },
  ep: GithubEndpoints = GITHUB,
): Promise<{ url: string; number: number }> {
  if (input.title.trim() === '') throw new Error('Give the pull request a title.');
  const j = await api(token, ep, 'POST', `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls`, {
    title: input.title.trim(),
    body: input.body ?? '',
    head: input.head,
    base: input.base,
  });
  return { url: String(j.html_url), number: Number(j.number) };
}
