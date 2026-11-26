import { buildClientContextHeaders } from "@scalemule/sdk";
import { openPawFlow, PAW_FLOW_COOKIE, PAW_SIGNED_OUT_COOKIE } from "./pets-auth-server";
import { petPrivateHeaders, type PetScope } from "./pets-server";
import {
  completeSignIn, cookieReader, linkAccount, localReturnPath, openLinkChallenge, pendingSwitch,
  readerSsoCookieNames, sealReaderFlow, sessionSummaryWithCookies, setCookieHeader, signOut,
  startSignIn, switchAccount, type CookieInstruction, type CookieReader, type ReaderSsoConfig,
} from "./reader-sso";

// The gateway wraps both Auth outages and actual session refusals in a 401.
// Only a definitive refusal may let reader-sso expire the browser cookie.
function checkSessionResponse(status: number, body: {
  data?: {id?: unknown; email_verified?: unknown};
  error?: {code?: string; message?: string};
  success?: boolean;
} | null) {
  if (status === 200 && body?.success === true && typeof body.data?.id === 'string' &&
      body.data.id.length > 0 && typeof body.data.email_verified === 'boolean') return;
  if (status === 401) {
    let error = body?.error;
    if (error?.code === 'INVALID_USER_SESSION') {
      const nested = error.message?.match(/^Session validation failed \(401 Unauthorized\): (.+)$/s);
      if (nested) {
        try { error = JSON.parse(nested[1]).error; } catch { /* Unknown response. */ }
      }
    }
    if (['SESSION_EXPIRED', 'SESSION_IDLE_EXPIRED', 'SESSION_ABSOLUTE_EXPIRED'].includes(error?.code ?? '') ||
        (error?.code === 'UNAUTHORIZED' && ['Invalid session token', 'Invalid or expired session token',
          'Session does not belong to this application'].includes(error?.message ?? ''))) return;
  }
  throw new Error('Reader session could not be checked');
}

function authJson(body: unknown, status = 200, cookies: CookieInstruction[] = []) {
  const response = Response.json(body, {status, headers: petPrivateHeaders});
  for (const cookie of cookies) response.headers.append('set-cookie', setCookieHeader(cookie));
  return response;
}
function authRedirect(origin: string, location: string, cookies: CookieInstruction[]) {
  const url = new URL(location, origin);
  if (url.origin !== origin) throw new Error('Invalid auth destination');
  const response = new Response(null, {status: 303, headers: {...petPrivateHeaders, location: url.href}});
  for (const cookie of cookies) response.headers.append('set-cookie', setCookieHeader(cookie));
  return response;
}

/** Host-only sessions survive adoption of the shared ownership-proof flow. */
export function createCommunityReaderAuth(options: {
  resolve(request?: Request): Promise<PetScope>;
  clientId: string;
  prefix: string;
  accountPath: string;
  issuerOrigin: string;
  enabled: boolean;
  appleSignIn: boolean;
}) {
  const names = readerSsoCookieNames(options.prefix);
  const account = options.accountPath;
  function shouldResume(jar: CookieReader) {
    return !jar(names.signedOut) && !jar(PAW_SIGNED_OUT_COOKIE) && !jar(names.ssoChecked) && !jar(names.pending);
  }
  function callbackCookies(jar: CookieReader, state: string | null, key: string): CookieReader {
    if (!state || jar(names.flow) || (jar(names.signedOut) || jar(PAW_SIGNED_OUT_COOKIE))) return jar;
    const next = openPawFlow(jar(PAW_FLOW_COOKIE), state, key);
    if (!next) return jar;
    const flow = sealReaderFlow({state, returnTo: next, subscribe: false, mode: 'silent'}, key);
    return name => name === names.flow ? flow : jar(name);
  }
  async function configuration(request?: Request): Promise<ReaderSsoConfig> {
    const config = await options.resolve(request);
    return {
      prefix: options.prefix, key: config.apiKey, origin: new URL(config.origin).origin,
      clientId: options.clientId, callbackPath: '/api/paw-auth/callback', accountPath: account,
      issuerOrigin: options.issuerOrigin,
      enabled: options.enabled, emailSignIn: true,
      appleSignIn: options.appleSignIn,
      request: async (path, init) => {
        if (!path.startsWith('/v1/auth/') || path.includes('..')) throw new Error('Invalid auth path');
        const response = await fetch(new URL(path, config.gatewayUrl), {
          method: init.method, headers: {
            ...buildClientContextHeaders(config.clientContext), 'x-api-key': config.apiKey,
            'content-type': 'application/json', ...(init.token ? {authorization: `Bearer ${init.token}`} : {}),
          },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
        });
        const body = await response.json();
        if (path.split('?')[0] === '/v1/auth/me') checkSessionResponse(response.status, body);
        return {status: response.status, body};
      },
    };
  }
  async function route(request: Request, action: string) {
    try {
      const config = await configuration(request), origin = config.origin;
      const jar = cookieReader(request.headers.get('cookie'));
      const url = new URL(request.url);
      if (request.method === 'POST') {
        if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site')
          return authJson({error: 'Continue from this website.'}, 403);
        if (!request.headers.get('content-type')?.startsWith('application/json'))
          return authJson({error: 'JSON is required.'}, 415);
      }
      if (action === 'callback' && request.method === 'GET') {
        const result = await completeSignIn(config, {url, cookies: callbackCookies(jar, url.searchParams.get('state'), config.key)});
        if (result.kind === 'signed-in' && jar(PAW_SIGNED_OUT_COOKIE) && names.signedOut !== PAW_SIGNED_OUT_COOKIE)
          result.cookies.push({name: PAW_SIGNED_OUT_COOKIE, value: '', maxAge: 0});
        if (jar(PAW_FLOW_COOKIE)) result.cookies.push({name: PAW_FLOW_COOKIE, value: '', maxAge: 0});
        return authRedirect(origin, result.location, result.cookies);
      }
      if ((action === 'start' && request.method === 'POST') || (action === 'resume' && request.method === 'GET')) {
        const silent = action === 'resume';
        if (silent && ((request.headers.has('sec-fetch-mode') && request.headers.get('sec-fetch-mode') !== 'navigate') ||
          (request.headers.has('sec-fetch-dest') && request.headers.get('sec-fetch-dest') !== 'document')))
          return authJson({error: 'Open sign-in from this website.'}, 403);
        const provider = url.searchParams.get('provider') || 'google';
        if (provider !== 'google' && provider !== 'email' && provider !== 'apple') return authJson({error: 'Choose an available sign-in method.'}, 400);
        if (silent && !shouldResume(jar)) {
          return authRedirect(origin, localReturnPath(url.searchParams.get('next')) || account, []);
        }
        const result = await startSignIn(config, {mode: silent ? 'silent' : 'interactive',
          selectAccount: !silent && url.searchParams.get('select_account') === '1', provider, next: url.searchParams.get('next') || account, cookies: jar});
        if (!silent && result.ok && jar(PAW_SIGNED_OUT_COOKIE) && names.signedOut !== PAW_SIGNED_OUT_COOKIE)
          result.cookies.push({name: PAW_SIGNED_OUT_COOKIE, value: '', maxAge: 0});
        if (silent) {
          if (!result.ok) return authRedirect(origin, result.redirect, result.cookies);
          const response = authJson({}, 303, result.cookies);
          response.headers.set('location', result.url);
          return response;
        }
        return result.ok ? authJson({url: result.url}, 200, result.cookies)
          : authJson({error: result.error}, result.status, result.cookies);
      }
      if (action === 'session' && request.method === 'GET') {
        const {summary, cookies} = await sessionSummaryWithCookies(config, jar);
        return authJson({...summary, name: summary.authenticated ? summary.full_name : undefined}, 200, cookies);
      }
      if (request.method !== 'POST') return authJson({error: 'Route not found'}, 404);
      if (action === 'logout') {
        const result = await signOut(config, {cookies: jar, extraCookies: [{name: PAW_FLOW_COOKIE, value: '', maxAge: 0}]});
        // The pet account button says “Sign out of this site”. Other properties
        // retain their own sessions when this endpoint is used.
        if (names.signedOut !== PAW_SIGNED_OUT_COOKIE) result.cookies.push({name: PAW_SIGNED_OUT_COOKIE, value: '1', maxAge: 30 * 86400});
        return authJson({authenticated: false}, 200, result.cookies);
      }
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) {
        try {
          for (;;) {
            const {done, value} = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 16384) {
              await reader.cancel();
              return authJson({error: 'Request is too large.'}, 413);
            }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: Record<string, unknown>;
      try { body = JSON.parse(raw); } catch { return authJson({error: 'Invalid request.'}, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return authJson({error: 'Invalid request.'}, 400);
      if (action === 'ledvery-link') {
        const result = await linkAccount(config, {challenge_id: body.challenge_id, password: body.password,
          mfa_code: body.mfa_code, next: typeof body.next === 'string' ? body.next : account, cookies: jar});
        return result.ok ? authJson({location: result.location}, 200, result.cookies)
          : authJson({error: result.error, mfa_required: result.mfaRequired}, result.status, result.cookies);
      }
      if (action === 'switch') {
        const result = await switchAccount(config, {choice: body.choice, cookies: jar});
        return result.ok ? authJson({location: result.location}, 200, result.cookies)
          : authJson({error: result.error}, result.status, result.cookies);
      }
      return authJson({error: 'Route not found'}, 404);
    } catch { return authJson({error: 'Sign-in is temporarily unavailable. Please try again.'}, 503); }
  }
  return {
    route,
    async accountState(cookie: string | null, query: Record<string,string | undefined>) {
      const config = await configuration();
      const jar = cookieReader(cookie);
      const challenge = query.link && openLinkChallenge(jar(names.linkFlow), config.key) === query.link ? query.link : undefined;
      return {challenge, switching: await pendingSwitch(config, jar), canResume: shouldResume(jar)};
    },
  };
}
