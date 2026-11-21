import * as crypto from 'node:crypto';
import * as http from 'node:http';

export interface GoogleEndpoints {
  auth: string;
  token: string;
  userinfo: string;
}
export const GOOGLE: GoogleEndpoints = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
};

const b64url = (b: Buffer) => b.toString('base64url');

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

export interface GoogleOptions {
  clientId: string;
  clientSecret?: string;
  /** Open the sign-in address in the person's browser. */
  openUrl: (url: string) => void | Promise<void>;
  signal: AbortSignal;
  endpoints?: GoogleEndpoints;
  timeoutMs?: number;
}

/**
 * Google sign-in for a desktop app: browser + PKCE + a one-time listener on 127.0.0.1.
 * No tokens are kept; we only read who signed in.
 */
export async function googleSignIn(opts: GoogleOptions): Promise<GoogleProfile> {
  const ep = opts.endpoints ?? GOOGLE;
  if (opts.clientId.trim() === '') throw new Error('Add your Google OAuth Client ID first (Settings → Accounts → Google setup).');

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  let resolveCode!: (c: string) => void;
  let rejectCode!: (e: Error) => void;
  const codePromise = new Promise<string>((res, rej) => {
    resolveCode = res;
    rejectCode = rej;
  });
  codePromise.catch(() => undefined); // the sign-in can fail before we start waiting; the failure is still delivered below
  const page = (msg: string) => `<!doctype html><meta charset="utf-8"><title>Folder Agent</title><body style="font:16px -apple-system,sans-serif;padding:48px;text-align:center"><p>${msg}</p>`;

  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (u.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    const err = u.searchParams.get('error');
    if (err) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page('Sign-in was cancelled. You can close this tab.'));
      rejectCode(new Error(err === 'access_denied' ? 'You cancelled the Google sign-in.' : `Google sign-in failed: ${err}`));
      return;
    }
    if (u.searchParams.get('state') !== state || !u.searchParams.get('code')) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(page('This sign-in link is not valid.'));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page('Signed in. You can close this tab and go back to Folder Agent.'));
    resolveCode(u.searchParams.get('code')!);
  });
  await new Promise<void>((res, rej) => {
    server.once('error', rej);
    server.listen(0, '127.0.0.1', res);
  });
  const port = (server.address() as { port: number }).port;
  const redirect = `http://127.0.0.1:${port}/callback`;

  const onAbort = () => rejectCode(new Error('Sign-in cancelled.'));
  opts.signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => rejectCode(new Error('Google sign-in timed out. Try again.')), opts.timeoutMs ?? 5 * 60_000);

  try {
    const url = new URL(ep.auth);
    url.search = new URLSearchParams({
      client_id: opts.clientId.trim(),
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      prompt: 'select_account',
    }).toString();
    await opts.openUrl(url.toString());
    const code = await codePromise;

    const form = new URLSearchParams({
      client_id: opts.clientId.trim(),
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
    });
    if (opts.clientSecret) form.set('client_secret', opts.clientSecret);
    const tokRes = await fetch(ep.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(20_000) });
    const tok: any = await tokRes.json().catch(() => ({}));
    if (!tokRes.ok || typeof tok.access_token !== 'string') throw new Error(`Google did not accept the sign-in: ${tok.error_description || tok.error || 'HTTP ' + tokRes.status}`);
    const infoRes = await fetch(ep.userinfo, { headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(20_000) });
    const info: any = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok || typeof info.email !== 'string') throw new Error('Google signed you in but did not share your email.');
    return { sub: String(info.sub ?? ''), email: info.email, name: typeof info.name === 'string' ? info.name : info.email };
  } finally {
    clearTimeout(timer);
    opts.signal.removeEventListener('abort', onAbort);
    server.close();
    server.closeAllConnections?.();
  }
}
