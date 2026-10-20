/**
 * Reader single sign-on through Ledvery, shared by every publication. Server only.
 *
 * The publication's server is the only party that talks to the ScaleMule gateway,
 * with the site's own API key. The browser only ever sees host-only cookies and
 * same-origin routes. No internal platform token is involved anywhere here.
 *
 * Contract: docs/ADR-2026-10-19-ledvery-consumer-sso.md sections 3.2 (precedence),
 * 4.4 (silent sign-in), 6 (logout), 7 (greetings) and 8 (telemetry).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ReaderSsoMode = "interactive" | "silent";
export type ReaderSsoProvider = "google" | "email";
export type ReaderSsoMethod = ReaderSsoProvider | "link" | "switch" | "unknown";

export const READER_SSO_FLOW_SECONDS = 600;
export const READER_SSO_NEGATIVE_CACHE_SECONDS = 300;
export const READER_SSO_SIGNED_OUT_SECONDS = 86400;
export const READER_SSO_PENDING_SECONDS = 600;
export const LEDVERY_ISSUER_ORIGIN = "https://api.ledvery.com";

/** Ledvery results that mean "no silent session here"; never authentication failures. */
export const SILENT_NEGATIVE_ERRORS = ["login_required", "consent_required", "interaction_required", "account_selection_required"] as const;

const COOKIE_PREFIX = /^__Host-[A-Za-z0-9_-]{1,60}$/;
const SESSION_TOKEN = /^[A-Za-z0-9._~-]{1,2048}$/;
const CHALLENGE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const HEX64 = /^[a-f0-9]{64}$/;

export type ReaderSsoCookieNames = {
  /** The reader's platform session token. */
  session: string;
  /** Sealed sign-in transaction (10 minutes). */
  flow: string;
  /** Newsletter consent carried through email verification. */
  newsletter: string;
  /** Negative cache: a silent check ran recently and found nothing. */
  ssoChecked: string;
  /** Explicit sign-out: silent sign-in stays off until an explicit sign-in. */
  signedOut: string;
  /** A verified session waiting for the reader to choose between two accounts. */
  pending: string;
};

/** Cookie names derived from a `__Host-` prefix, e.g. `__Host-media` → `__Host-media-reader`. */
export function readerSsoCookieNames(prefix: string): ReaderSsoCookieNames {
  if (!COOKIE_PREFIX.test(prefix)) throw new Error("Reader cookie prefix must be a short __Host- name");
  return {
    session: `${prefix}-reader`,
    flow: `${prefix}-ledvery`,
    newsletter: `${prefix}-newsletter`,
    ssoChecked: `${prefix}-sso-checked`,
    signedOut: `${prefix}-signed-out`,
    pending: `${prefix}-sso-pending`,
  };
}

/** One Set-Cookie instruction. Every reader cookie is host-only, HttpOnly, Secure and Lax. */
export type CookieInstruction = { name: string; value: string; maxAge?: number; expires?: Date };
export const readerSsoCookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
const clear = (name: string): CookieInstruction => ({ name, value: "", maxAge: 0 });
// An explicit choice to retain a legacy local account applies only to that
// validated credential. It is a preference, never an authentication grant.
const keepLocalValue = (token: string) => "keep:" + createHash("sha256").update(token).digest("hex");
const keepsLocal = (checked: string | undefined, token: string | undefined) => Boolean(token && checked === keepLocalValue(token));

/** Apply instructions to a Next.js `cookies()` jar (or anything with the same `set`). */
export function applyCookies(
  jar: { set(name: string, value: string, options: typeof readerSsoCookieOptions & { maxAge?: number; expires?: Date }): unknown },
  cookies: CookieInstruction[],
): void {
  for (const cookie of cookies) {
    jar.set(cookie.name, cookie.value, {
      ...readerSsoCookieOptions,
      ...(cookie.maxAge !== undefined ? { maxAge: cookie.maxAge } : {}),
      ...(cookie.expires ? { expires: cookie.expires } : {}),
    });
  }
}

/** The same instruction as a raw Set-Cookie header value. */
export function setCookieHeader(cookie: CookieInstruction): string {
  const parts = [`${cookie.name}=${cookie.value}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax"];
  if (cookie.maxAge !== undefined) parts.push(`Max-Age=${cookie.maxAge}`);
  if (cookie.expires) parts.push(`Expires=${cookie.expires.toUTCString()}`);
  return parts.join("; ");
}

export type CookieReader = (name: string) => string | undefined;

/** Read a cookie from a Cookie header. A name sent twice is treated as absent. */
export function cookieReader(header: string | null | undefined): CookieReader {
  const parts = (header || "").split(";").map((part) => part.trim());
  return (name) => {
    const values = parts.filter((part) => part.startsWith(name + "="));
    return values.length === 1 ? values[0].slice(name.length + 1) : undefined;
  };
}

// ---------------------------------------------------------------------------
// Telemetry contract (ADR section 8). Bounded values only: never email, state,
// nonce, tokens or URLs. Server records establish completion; browser analytics
// are advisory. Silent negatives are checks, not failures.
// ---------------------------------------------------------------------------
export type ReaderSsoFailure =
  | "cancelled" | "provider_error" | "state" | "exchange" | "unverified" | "session" | "unavailable" | "link_invalid" | "disabled" | "mfa_required";
export type ReaderSsoCheckOutcome =
  | (typeof SILENT_NEGATIVE_ERRORS)[number] | "error" | "link_required" | "suppressed" | "switch_offered" | "switch_declined";

export type ReaderSsoEvent =
  | { name: "reader_signin_started"; properties: { method: ReaderSsoMethod; mode: ReaderSsoMode; transaction: string } }
  | { name: "reader_signin_completed"; properties: { method: ReaderSsoMethod; mode: ReaderSsoMode; is_new: "true" | "false"; transaction?: string } }
  | { name: "reader_signin_failed"; properties: { reason: ReaderSsoFailure; mode: ReaderSsoMode; transaction?: string } }
  | { name: "reader_sso_check"; properties: { outcome: ReaderSsoCheckOutcome; mode: ReaderSsoMode; transaction?: string } }
  | { name: "reader_signed_out"; properties: { method: "explicit" } }
  | { name: "reader_account_linked"; properties: { transaction?: string } };

export { READER_SSO_EVENTS, READER_SSO_PROPERTY_KEYS } from "./reader-sso-events";
export type { ReaderSsoEventName, ReaderSsoEventDefinition } from "./reader-sso-events";

// ---------------------------------------------------------------------------
// Gateway adapter. The site supplies a function that performs the request with
// its own API key and the reader's client context, and returns the HTTP status
// with the parsed body; it must not throw on an HTTP error status.
// ---------------------------------------------------------------------------
export type ReaderSsoResponse = { status: number; body: unknown };
export type ReaderSsoRequest = (path: string, init: { method: "GET" | "POST"; body?: unknown; token?: string }) => Promise<ReaderSsoResponse>;

function payload(response: ReaderSsoResponse): Record<string, unknown> {
  const body = response.body as Record<string, unknown> | null;
  const data = body && typeof body === "object" ? body.data : undefined;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : body && typeof body === "object" ? body : {};
}
function errorCode(response: ReaderSsoResponse): string {
  const body = response.body as Record<string, unknown> | null;
  const error = body && typeof body === "object" ? body.error : undefined;
  const code = error && typeof error === "object" ? (error as Record<string, unknown>).code : body && typeof body === "object" ? body.code : undefined;
  return typeof code === "string" ? code : "";
}
function failed(response: ReaderSsoResponse): boolean {
  const body = response.body as Record<string, unknown> | null;
  return response.status < 200 || response.status >= 300 || Boolean(body && typeof body === "object" && body.success === false);
}

export type ReaderSsoConfig = {
  /** `__Host-media` on most papers; `__Host-trivalley` on Tri-Valley Weekly. */
  prefix: string;
  /** HMAC key for sealed cookies. The site's API key is used today; never sent to the browser. */
  key: string;
  /** Canonical https origin of the publication, e.g. `https://sanramontimes.com`. */
  origin: string;
  /** Ledvery OIDC client id for this publication (env LEDVERY_CLIENT_ID, default `napsite-<slug>`). */
  clientId: string;
  request: ReaderSsoRequest;
  record?: (event: ReaderSsoEvent) => void;
  callbackPath?: string;
  accountPath?: string;
  issuerOrigin?: string;
  /** Explicit email sign-in through Ledvery (env LEDVERY_EMAIL_SIGNIN); off by default. */
  emailSignIn?: boolean;
  /** Emergency off switch for all Ledvery sign-in. */
  enabled?: boolean;
  /** Validates a local return path per mode; returns "" when the path is not allowed. */
  returnPath?: (next: string, mode: ReaderSsoMode) => string;
  /** Where an interactive failure sends the reader; defaults to `/account?signin=retry[&next=]`. */
  retryPath?: (flow: ReaderSsoFlow | null) => string;
  now?: () => number;
  random?: () => string;
};

/** Any same-site path: no protocol-relative URLs, control characters or API routes. */
export function localReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.length > 500) return "";
  if (/[\\\r\n\u0000-\u001f]/.test(value) || value === "/api" || value.startsWith("/api/")) return "";
  return value;
}

type Resolved = Required<Pick<ReaderSsoConfig, "callbackPath" | "accountPath" | "issuerOrigin" | "returnPath" | "retryPath" | "now" | "random">> & ReaderSsoConfig & { names: ReaderSsoCookieNames };

function resolve(config: ReaderSsoConfig): Resolved {
  const origin = new URL(config.origin);
  if (origin.protocol !== "https:" || origin.origin !== config.origin) throw new Error("Reader SSO origin must be a bare https origin");
  if (!config.key) throw new Error("Reader SSO key is required");
  const accountPath = localReturnPath(config.accountPath ?? "/account") || "/account";
  const returnPath = config.returnPath ?? ((next) => localReturnPath(next));
  return {
    ...config,
    names: readerSsoCookieNames(config.prefix),
    callbackPath: localReturnPath(config.callbackPath ?? "/api/news/ledvery-callback") || "/api/news/ledvery-callback",
    accountPath,
    issuerOrigin: new URL(config.issuerOrigin ?? LEDVERY_ISSUER_ORIGIN).origin,
    returnPath,
    retryPath: config.retryPath ?? ((flow) => flow?.returnTo ? `${accountPath}?signin=retry&next=${encodeURIComponent(flow.returnTo)}` : `${accountPath}?signin=retry`),
    now: config.now ?? (() => Date.now()),
    random: config.random ?? (() => randomBytes(16).toString("hex")),
  };
}

function emit(config: ReaderSsoConfig, event: ReaderSsoEvent): void {
  // Advisory telemetry never changes the outcome of a sign-in.
  try { config.record?.(event); } catch { /* recorded nowhere; the sign-in still completes */ }
}

// ---------------------------------------------------------------------------
// Sealed cookies. The flow format is byte-compatible with the publications'
// previous `reader-flow:v1` cookie so transactions started before a release
// still complete after it; `mode`, `provider` and `tx` are additive.
// ---------------------------------------------------------------------------
export function stateDigest(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}
export function validState(state: string | null | undefined, digest: string | undefined): boolean {
  if (!state || state.length > 2048 || !digest || !HEX64.test(digest)) return false;
  return timingSafeEqual(Buffer.from(stateDigest(state), "hex"), Buffer.from(digest, "hex"));
}

function seal(label: string, body: unknown, key: string): string {
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  return encoded + "." + createHmac("sha256", key).update(`${label}:` + encoded).digest("hex");
}
function open(label: string, cookie: string | undefined, key: string): Record<string, unknown> | null {
  if (!key || !cookie || cookie.length > 4096) return null;
  const [encoded, signature, extra] = cookie.split(".");
  if (extra !== undefined || !encoded || !signature || !HEX64.test(signature)) return null;
  const expected = createHmac("sha256", key).update(`${label}:` + encoded).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch { return null; }
}

export type ReaderSsoFlow = {
  digest: string;
  subscribe: boolean;
  expires: number;
  returnTo: string;
  mode: ReaderSsoMode;
  provider?: ReaderSsoProvider;
  tx?: string;
};

export function sealReaderFlow(
  input: { state: string; subscribe?: boolean; returnTo?: string; mode?: ReaderSsoMode; provider?: ReaderSsoProvider; tx?: string },
  key: string,
  now = Date.now(),
): string {
  const body: Record<string, unknown> = {
    digest: stateDigest(input.state),
    subscribe: input.subscribe === true,
    expires: now + READER_SSO_FLOW_SECONDS * 1000,
    returnTo: localReturnPath(input.returnTo ?? ""),
  };
  if (input.mode) body.mode = input.mode;
  if (input.provider) body.provider = input.provider;
  if (input.tx) body.tx = input.tx;
  return seal("reader-flow:v1", body, key);
}

export function openReaderFlow(
  cookie: string | undefined,
  key: string,
  now = Date.now(),
  returnPath: (next: string, mode: ReaderSsoMode) => string = (next) => localReturnPath(next),
): ReaderSsoFlow | null {
  const raw = open("reader-flow:v1", cookie, key);
  if (!raw) return null;
  const mode: ReaderSsoMode = raw.mode === "silent" ? "silent" : "interactive";
  if (raw.mode !== undefined && raw.mode !== "silent" && raw.mode !== "interactive") return null;
  if (typeof raw.subscribe !== "boolean" || typeof raw.digest !== "string" || !HEX64.test(raw.digest)) return null;
  if (typeof raw.expires !== "number" || !Number.isFinite(raw.expires) || raw.expires <= now) return null;
  const returnTo = typeof raw.returnTo === "string" ? raw.returnTo : "";
  if (returnTo && returnPath(returnTo, mode) !== returnTo) return null;
  const provider = raw.provider === "google" || raw.provider === "email" ? raw.provider : undefined;
  const tx = typeof raw.tx === "string" && /^[a-f0-9]{1,64}$/.test(raw.tx) ? raw.tx : undefined;
  // Newsletter consent is interactive-only: a silent check never subscribes,
  // whatever a (signed) flow cookie claims.
  return { digest: raw.digest, subscribe: raw.subscribe && mode === "interactive", expires: raw.expires, returnTo, mode, provider, tx };
}

/** A verified session the reader has not yet chosen over their current one. */
export type PendingSession = {
  token: string;
  expires: number;
  userId: string;
  name: string;
  mode: ReaderSsoMode;
  method: ReaderSsoMethod;
  returnTo: string;
  subscribe: boolean;
  tx?: string;
};

export function sealPendingSession(pending: PendingSession, key: string, now = Date.now()): string {
  return seal("reader-pending:v1", { ...pending, until: now + READER_SSO_PENDING_SECONDS * 1000 }, key);
}
export function openPendingSession(cookie: string | undefined, key: string, now = Date.now()): PendingSession | null {
  const raw = open("reader-pending:v1", cookie, key);
  if (!raw || typeof raw.until !== "number" || raw.until <= now) return null;
  if (typeof raw.token !== "string" || !SESSION_TOKEN.test(raw.token) || typeof raw.expires !== "number" || raw.expires <= now) return null;
  if (typeof raw.userId !== "string" || !raw.userId) return null;
  return {
    token: raw.token,
    expires: raw.expires,
    userId: raw.userId,
    name: typeof raw.name === "string" ? raw.name : "",
    mode: raw.mode === "silent" ? "silent" : "interactive",
    method: raw.method === "google" || raw.method === "email" || raw.method === "link" ? raw.method : "unknown",
    returnTo: localReturnPath(raw.returnTo),
    subscribe: raw.subscribe === true,
    tx: typeof raw.tx === "string" ? raw.tx : undefined,
  };
}

// ---------------------------------------------------------------------------
// Authorization URL: only the registered issuer, only /authorize, only our state
// and callback, PKCE S256, and `prompt=none` whenever the attempt is silent so a
// background navigation can never land a reader on an interactive page.
// ---------------------------------------------------------------------------
export function authorizeUrl(value: string, state: string, callback: string, mode: ReaderSsoMode, issuerOrigin = LEDVERY_ISSUER_ORIGIN): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.origin !== new URL(issuerOrigin).origin || url.pathname !== "/authorize" || url.username || url.password ||
    url.searchParams.get("state") !== state || url.searchParams.get("redirect_uri") !== callback ||
    url.searchParams.get("code_challenge_method") !== "S256" || !url.searchParams.get("code_challenge") ||
    (mode === "silent" && url.searchParams.get("prompt") !== "none")
  ) throw new Error("Invalid Ledvery authorization response");
  return url.toString();
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
export type StartSignInInput = {
  mode: ReaderSsoMode;
  provider?: ReaderSsoProvider;
  subscribe?: boolean;
  next?: string;
  cookies: CookieReader;
};
export type StartSignInResult =
  | { ok: true; url: string; tx: string; cookies: CookieInstruction[] }
  | { ok: false; status: number; error: string; reason: "disabled" | "suppressed" | "session" | "unavailable" | "provider"; redirect: string; cookies: CookieInstruction[] };

export async function startSignIn(config: ReaderSsoConfig, input: StartSignInInput): Promise<StartSignInResult> {
  const c = resolve(config);
  const mode = input.mode === "silent" ? "silent" : "interactive";
  const next = c.returnPath(input.next ?? "", mode);
  const redirect = next || (mode === "silent" ? "/" : c.accountPath);
  const provider: ReaderSsoProvider | undefined = mode === "silent" ? undefined : input.provider === "email" ? "email" : "google";
  if (c.enabled === false) {
    return { ok: false, status: 503, error: "Sign-in is temporarily unavailable. Please try again shortly.", reason: "disabled", redirect, cookies: [] };
  }
  if (provider === "email" && !c.emailSignIn) {
    return { ok: false, status: 404, error: "Email sign-in is not available on this publication yet.", reason: "provider", redirect, cookies: [] };
  }
  // A session cookie only counts if it still validates: a session revoked
  // elsewhere (back-channel logout, another device) leaves its host-only cookie
  // behind, and that stale cookie must not suppress sign-in (release review R5).
  const staleSession: CookieInstruction[] = [];
  if (input.cookies(c.names.session)) {
    const current = await currentUser(c, input.cookies(c.names.session), mode === "silent" ? "passive" : "active");
    if (current && current.email_verified) {
      if (mode === "silent" && (!current.needsSsoUpgrade || keepsLocal(input.cookies(c.names.ssoChecked), input.cookies(c.names.session)))) return { ok: false, status: 204, error: "", reason: "session", redirect, cookies: [] };
    } else {
      staleSession.push(clear(c.names.session), clear(c.names.pending));
    }
  }
  if (mode === "silent") {
    // ADR 4.4: never after an explicit sign-out, and at most once per
    // negative-cache window.
    if (input.cookies(c.names.signedOut) || input.cookies(c.names.ssoChecked) === "1") {
      return { ok: false, status: 204, error: "", reason: "suppressed", redirect, cookies: staleSession };
    }
  }
  const tx = c.random();
  const callback = c.origin + c.callbackPath;
  const query = new URLSearchParams({ redirect_uri: callback });
  if (mode === "silent") query.set("prompt", "none");
  else {
    query.set("prompt", "select_account");
    query.set("upstream", provider === "email" ? "scalemule_consumer" : "google");
  }
  try {
    const response = await c.request(`/v1/auth/oauth/ledvery/authorize?${query}`, { method: "GET" });
    if (failed(response)) throw new Error("authorize");
    const value = payload(response);
    if (typeof value.url !== "string" || typeof value.state !== "string" || !value.state) throw new Error("authorize");
    const url = authorizeUrl(value.url, value.state, callback, mode, c.issuerOrigin);
    const cookies: CookieInstruction[] = [
      ...staleSession,
      { name: c.names.flow, value: sealReaderFlow({ state: value.state, subscribe: input.subscribe === true && mode === "interactive", returnTo: next, mode, provider, tx }, c.key, c.now()), maxAge: READER_SSO_FLOW_SECONDS },
    ];
    // An explicit sign-in bypasses the negative cache and ends the signed-out suppression.
    if (mode === "interactive") cookies.push(clear(c.names.signedOut), clear(c.names.ssoChecked));
    emit(c, { name: "reader_signin_started", properties: { method: provider ?? "unknown", mode, transaction: tx } });
    return { ok: true, url, tx, cookies };
  } catch {
    if (mode === "silent") {
      // A failed start still counts as a check so the browser does not retry every page.
      emit(c, { name: "reader_sso_check", properties: { outcome: "error", mode, transaction: tx } });
      return { ok: false, status: 503, error: "", reason: "unavailable", redirect, cookies: [...staleSession, { name: c.names.ssoChecked, value: "1", maxAge: READER_SSO_NEGATIVE_CACHE_SECONDS }] };
    }
    emit(c, { name: "reader_signin_failed", properties: { reason: "unavailable", mode, transaction: tx } });
    return { ok: false, status: 503, error: "Ledvery sign-in is temporarily unavailable. Please try again shortly or use your existing reader account.", reason: "unavailable", redirect, cookies: [] };
  }
}

// ---------------------------------------------------------------------------
// Callback
// ---------------------------------------------------------------------------
export type SessionUser = { id: string; email_verified: boolean; full_name: string; locale?: string; time_zone?: string; needsSsoUpgrade?: true };

async function currentUser(c: Resolved, token: string | undefined, activity: "active" | "passive" = "active"): Promise<SessionUser | null> {
  if (!token || !SESSION_TOKEN.test(token)) return null;
  const response = await c.request(activity === "passive" ? "/v1/auth/me?passive=true" : "/v1/auth/me", { method: "GET", token });
  if (failed(response)) return null;
  const me = payload(response);
  if (typeof me.id !== "string" || !me.id) return null;
  return {
    id: me.id,
    email_verified: me.email_verified === true,
    full_name: typeof me.full_name === "string" ? Array.from(me.full_name.trim()).slice(0, 150).join("") : "",
    locale: typeof me.locale === "string" && me.locale.length <= 35 ? me.locale : undefined,
    time_zone: typeof me.time_zone === "string" && me.time_zone.length <= 64 ? me.time_zone : undefined,
    ...(me.sso_session_bound === false ? { needsSsoUpgrade: true as const } : {}),
  };
}

type IssuedSession = { token: string; expiresAt: Date; isNew: boolean };
function issuedSession(response: ReaderSsoResponse, now: number): IssuedSession {
  const value = payload(response);
  const token = typeof value.session_token === "string" ? value.session_token : "";
  const expiresAt = new Date(typeof value.expires_at === "string" || typeof value.expires_at === "number" ? value.expires_at : NaN);
  if (!SESSION_TOKEN.test(token) || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now) throw new Error("Invalid reader session");
  return { token, expiresAt, isNew: value.is_new_user === true };
}

/** ADR 3.2: an active session for Bob is never replaced by Alice without an explicit choice. */
export function precedence(current: SessionUser | null, incoming: SessionUser): "replace" | "renew" | "switch" {
  if (!current) return "replace";
  return current.id === incoming.id ? "renew" : "switch";
}

export type CompleteSignInInput = { url: string | URL; cookies: CookieReader };
export type CompleteSignInResult =
  | { kind: "redirect"; location: string; cookies: CookieInstruction[]; outcome: ReaderSsoCheckOutcome | ReaderSsoFailure; flow: ReaderSsoFlow | null }
  | { kind: "signed-in"; location: string; cookies: CookieInstruction[]; token: string; expiresAt: Date; user: SessionUser; flow: ReaderSsoFlow; isNew: boolean };

/**
 * Finish a transaction that Ledvery returned to the callback. Produces cookies and
 * a destination; the caller subscribes to the newsletter (interactive consent only)
 * and performs the redirect with private, no-store headers.
 */
export async function completeSignIn(config: ReaderSsoConfig, input: CompleteSignInInput): Promise<CompleteSignInResult> {
  const c = resolve(config);
  const now = c.now();
  const query = new URL(String(input.url), c.origin).searchParams;
  const state = query.get("state");
  const code = query.get("code");
  const error = query.get("error");
  const flow = openReaderFlow(input.cookies(c.names.flow), c.key, now, c.returnPath);
  const cookies: CookieInstruction[] = [clear(c.names.flow)];
  const negativeCache: CookieInstruction = { name: c.names.ssoChecked, value: "1", maxAge: READER_SSO_NEGATIVE_CACHE_SECONDS };
  const redirect = (location: string, outcome: ReaderSsoCheckOutcome | ReaderSsoFailure): CompleteSignInResult =>
    ({ kind: "redirect", location, cookies, outcome, flow });

  if (!flow || !validState(state, flow.digest)) {
    // No bound transaction: a stale tab, a replay or a forged callback. The mode is
    // unknown, so suppress silent retries briefly and send the reader to the retry page.
    cookies.push(negativeCache);
    emit(c, { name: "reader_signin_failed", properties: { reason: "state", mode: flow?.mode ?? "interactive", transaction: flow?.tx } });
    return redirect(c.retryPath(flow), "state");
  }
  const silent = flow.mode === "silent";
  const quiet = flow.returnTo || "/";
  const method: ReaderSsoMethod = flow.provider ?? "unknown";
  if (error !== null) {
    if (silent) {
      // No UI, no mutation: remember the negative result for five minutes.
      const outcome = (SILENT_NEGATIVE_ERRORS as readonly string[]).includes(error) ? (error as ReaderSsoCheckOutcome) : "error";
      cookies.push(negativeCache);
      emit(c, { name: "reader_sso_check", properties: { outcome, mode: "silent", transaction: flow.tx } });
      return redirect(quiet, outcome);
    }
    const reason: ReaderSsoFailure = error === "access_denied" ? "cancelled" : "provider_error";
    emit(c, { name: "reader_signin_failed", properties: { reason, mode: "interactive", transaction: flow.tx } });
    return redirect(c.retryPath(flow), reason);
  }
  if (!code || code.length > 4096) {
    if (silent) cookies.push(negativeCache);
    emit(c, { name: "reader_signin_failed", properties: { reason: "state", mode: flow.mode, transaction: flow.tx } });
    return redirect(silent ? quiet : c.retryPath(flow), "state");
  }
  try {
    // Auth owns PKCE, OIDC nonce/signature verification, tenant binding and one-time code consumption.
    const exchange = await c.request(`/v1/auth/oauth/ledvery/callback?${new URLSearchParams({ code, state: state! })}`, { method: "GET" });
    if (exchange.status === 409 && errorCode(exchange) === "LINK_REQUIRED") {
      const challenge = payload(exchange);
      const challengeId = typeof challenge.challenge_id === "string" && CHALLENGE_ID.test(challenge.challenge_id) ? challenge.challenge_id : "";
      const hint = typeof challenge.email_hint === "string" && challenge.email_hint.length <= 254 ? challenge.email_hint : "";
      if (silent || !challengeId) {
        // Linking needs the reader's password: that is an interaction, never a silent step.
        cookies.push(negativeCache);
        emit(c, { name: "reader_sso_check", properties: { outcome: "link_required", mode: flow.mode, transaction: flow.tx } });
        return redirect(silent ? quiet : c.retryPath(flow), "link_required");
      }
      emit(c, { name: "reader_sso_check", properties: { outcome: "link_required", mode: "interactive", transaction: flow.tx } });
      const link = new URLSearchParams({ link: challengeId });
      if (hint) link.set("hint", hint);
      if (flow.returnTo) link.set("next", flow.returnTo);
      if (flow.subscribe) link.set("subscribe", "1");
      return redirect(`${c.accountPath}?${link}`, "link_required");
    }
    if (failed(exchange)) throw new Error("exchange");
    const session = issuedSession(exchange, now);
    return await establish(c, { session, flow, method, cookies, input, negativeCache });
  } catch (e) {
    const reason: ReaderSsoFailure = e instanceof Error && e.message === "unverified" ? "unverified" : "exchange";
    if (silent) cookies.push(negativeCache);
    emit(c, { name: "reader_signin_failed", properties: { reason, mode: flow.mode, transaction: flow.tx } });
    return redirect(silent ? quiet : c.retryPath(flow), reason);
  }
}

async function establish(
  c: Resolved,
  args: { session: IssuedSession; flow: ReaderSsoFlow; method: ReaderSsoMethod; cookies: CookieInstruction[]; input: { cookies: CookieReader }; negativeCache: CookieInstruction },
): Promise<CompleteSignInResult> {
  const { session, flow, method, cookies } = args;
  // Confirm the issued session belongs to this application's verified reader.
  const user = await currentUser(c, session.token);
  if (!user || !user.email_verified || user.needsSsoUpgrade) throw new Error("unverified");
  const current = await currentUser(c, args.input.cookies(c.names.session));
  const decision = precedence(current, user);
  if (decision === "switch") {
    cookies.push({
      name: c.names.pending,
      value: sealPendingSession({ token: session.token, expires: session.expiresAt.getTime(), userId: user.id, name: user.full_name, mode: flow.mode, method, returnTo: flow.returnTo, subscribe: flow.subscribe, tx: flow.tx }, c.key, c.now()),
      maxAge: READER_SSO_PENDING_SECONDS,
    });
    if (flow.mode === "silent") cookies.push(args.negativeCache);
    emit(c, { name: "reader_sso_check", properties: { outcome: "switch_offered", mode: flow.mode, transaction: flow.tx } });
    return { kind: "redirect", location: flow.mode === "silent" ? flow.returnTo || "/" : `${c.accountPath}?switch=1`, cookies, outcome: "switch_offered", flow };
  }
  const previousToken = args.input.cookies(c.names.session);
  if (current && previousToken && previousToken !== session.token) {
    const retired = await c.request("/v1/auth/logout", { method: "POST", body: { session_token: previousToken }, token: previousToken });
    if (failed(retired) || (retired.body as { success?: unknown } | null)?.success !== true) throw new Error("session retirement failed");
  }
  cookies.push({ name: c.names.session, value: session.token, expires: session.expiresAt }, clear(c.names.signedOut), clear(c.names.ssoChecked), clear(c.names.pending));
  emit(c, { name: "reader_signin_completed", properties: { method, mode: flow.mode, is_new: session.isNew ? "true" : "false", transaction: flow.tx } });
  return { kind: "signed-in", location: flow.returnTo || c.accountPath, cookies, token: session.token, expiresAt: session.expiresAt, user, flow, isNew: session.isNew };
}

// ---------------------------------------------------------------------------
// Linking (409 LINK_REQUIRED): the reader proves the existing local account with
// its password; the platform binds the Ledvery identity and issues the session.
// ---------------------------------------------------------------------------
export type LinkAccountInput = { challenge_id: unknown; password: unknown; mfa_code?: unknown; cookies: CookieReader; next?: string; subscribe?: boolean };
export type LinkAccountResult =
  | { ok: true; switch: false; cookies: CookieInstruction[]; token: string; expiresAt: Date; user: SessionUser; location: string }
  | { ok: true; switch: true; cookies: CookieInstruction[]; location: string }
  | { ok: false; status: number; error: string; cookies: CookieInstruction[]; mfaRequired?: boolean };

/** Platform answers to an ownership proof that are not a plain "wrong details". */
export function linkFailureMessage(code: string): { error: string; mfaRequired?: boolean } | null {
  switch (code) {
    case "MFA_REQUIRED":
      return { error: "Enter the code from your authenticator app (or a backup code) to finish connecting your account.", mfaRequired: true };
    case "MFA_SETUP_REQUIRED":
      return { error: "Your existing account requires two-step verification. Set it up from your account page, then try again." };
    case "MFA_METHOD_UNSUPPORTED":
      return { error: "Your account's verification method can't be used here. Sign in with your password first, then connect from your account page." };
    case "IDENTITY_ALREADY_BOUND":
      return { error: "That account already signs in with a different identity. Sign in the way you did before." };
    default:
      return null;
  }
}

export async function linkAccount(config: ReaderSsoConfig, input: LinkAccountInput): Promise<LinkAccountResult> {
  const c = resolve(config);
  const challengeId = typeof input.challenge_id === "string" && CHALLENGE_ID.test(input.challenge_id) ? input.challenge_id : "";
  const password = typeof input.password === "string" && input.password.length > 0 && input.password.length <= 1024 ? input.password : "";
  if (!challengeId || !password) {
    emit(c, { name: "reader_signin_failed", properties: { reason: "link_invalid", mode: "interactive" } });
    return { ok: false, status: 400, error: "Enter the password of your existing reader account.", cookies: [] };
  }
  const next = c.returnPath(input.next ?? "", "interactive");
  const mfaCode = typeof input.mfa_code === "string" ? input.mfa_code.trim() : "";
  if (mfaCode && (mfaCode.length > 32 || !/^[A-Za-z0-9-]+$/.test(mfaCode))) {
    return { ok: false, status: 400, error: "Enter the code exactly as your authenticator app shows it.", cookies: [], mfaRequired: true };
  }
  try {
    const response = await c.request("/v1/auth/oauth/ledvery/link", { method: "POST", body: { challenge_id: challengeId, password, ...(mfaCode ? { mfa_code: mfaCode } : {}) } });
    if (failed(response)) {
      const specific = linkFailureMessage(errorCode(response));
      if (specific) {
        emit(c, { name: "reader_signin_failed", properties: { reason: specific.mfaRequired ? "mfa_required" : "link_invalid", mode: "interactive" } });
        return { ok: false, status: specific.mfaRequired ? 401 : 409, cookies: [], ...specific };
      }
      // Neutral wording: never confirm whether the address or the password was the problem.
      emit(c, { name: "reader_signin_failed", properties: { reason: response.status >= 500 ? "unavailable" : "link_invalid", mode: "interactive" } });
      return response.status >= 500
        ? { ok: false, status: 503, error: "The publication is temporarily unavailable. Please try again.", cookies: [] }
        : { ok: false, status: 400, error: "We couldn’t link the accounts with those details. Check the password or start the sign-in again.", cookies: [] };
    }
    const session = issuedSession(response, c.now());
    const flow: ReaderSsoFlow = { digest: "", subscribe: input.subscribe === true, expires: 0, returnTo: next, mode: "interactive", provider: undefined };
    const result = await establish(c, { session, flow, method: "link", cookies: [], input, negativeCache: { name: c.names.ssoChecked, value: "1", maxAge: READER_SSO_NEGATIVE_CACHE_SECONDS } });
    if (result.kind === "signed-in") emit(c, { name: "reader_account_linked", properties: {} });
    return result.kind === "signed-in"
      ? { ok: true, switch: false, cookies: result.cookies, token: result.token, expiresAt: result.expiresAt, user: result.user, location: result.location }
      : { ok: true, switch: true, cookies: result.cookies, location: result.location };
  } catch {
    emit(c, { name: "reader_signin_failed", properties: { reason: "exchange", mode: "interactive" } });
    return { ok: false, status: 503, error: "Sign-in could not be completed. Please start again.", cookies: [] };
  }
}

// ---------------------------------------------------------------------------
// Account switch: the reader chooses between the current and the pending session.
// ---------------------------------------------------------------------------
export type SwitchAccountResult =
  | { ok: true; choice: "continue"; cookies: CookieInstruction[]; token: string; location: string; subscribe: boolean }
  | { ok: true; choice: "stay"; cookies: CookieInstruction[]; location: string }
  | { ok: false; status: number; error: string; cookies: CookieInstruction[] };

/** Names shown on the switch prompt. Nothing here is ever an email address. */
export async function pendingSwitch(config: ReaderSsoConfig, cookies: CookieReader): Promise<{ current: string; pending: string } | null> {
  const c = resolve(config);
  const pending = openPendingSession(cookies(c.names.pending), c.key, c.now());
  if (!pending) return null;
  const current = await currentUser(c, cookies(c.names.session));
  return { current: current?.full_name ?? "", pending: pending.name };
}

export async function switchAccount(config: ReaderSsoConfig, input: { choice: unknown; cookies: CookieReader }): Promise<SwitchAccountResult> {
  const c = resolve(config);
  const pending = openPendingSession(input.cookies(c.names.pending), c.key, c.now());
  const cookies: CookieInstruction[] = [clear(c.names.pending)];
  if (!pending) return { ok: false, status: 410, error: "That sign-in has expired. Please start again.", cookies };
  const logout = async (token: string | undefined) => {
    if (!token || !SESSION_TOKEN.test(token)) return;
    try { await c.request("/v1/auth/logout", { method: "POST", body: { session_token: token }, token }); } catch { /* best effort */ }
  };
  if (input.choice === "stay") {
    const token = input.cookies(c.names.session);
    const current = await currentUser(c, token);
    if (token && current?.email_verified && current.needsSsoUpgrade) {
      cookies.push({ name: c.names.ssoChecked, value: keepLocalValue(token), maxAge: 90 * 86400 });
    }
    await logout(pending.token);
    emit(c, { name: "reader_sso_check", properties: { outcome: "switch_declined", mode: pending.mode, transaction: pending.tx } });
    return { ok: true, choice: "stay", cookies, location: pending.returnTo || c.accountPath };
  }
  if (input.choice !== "continue") return { ok: false, status: 400, error: "Choose which account to continue with.", cookies: [] };
  const user = await currentUser(c, pending.token);
  if (!user || !user.email_verified || user.id !== pending.userId) {
    emit(c, { name: "reader_signin_failed", properties: { reason: "session", mode: pending.mode, transaction: pending.tx } });
    return { ok: false, status: 410, error: "That sign-in is no longer valid. Please start again.", cookies };
  }
  await logout(input.cookies(c.names.session));
  cookies.push({ name: c.names.session, value: pending.token, expires: new Date(pending.expires) }, clear(c.names.signedOut), clear(c.names.ssoChecked));
  emit(c, { name: "reader_signin_completed", properties: { method: "switch", mode: pending.mode, is_new: "false", transaction: pending.tx } });
  return { ok: true, choice: "continue", cookies, token: pending.token, location: pending.returnTo || c.accountPath, subscribe: pending.subscribe && pending.mode === "interactive" };
}

// ---------------------------------------------------------------------------
// Sign-out (ADR section 6): revoke the platform session, clear every reader
// cookie, suppress silent sign-in for a day and hand the browser to Ledvery's
// RP-initiated end-session so the Ledvery session ends too.
// ---------------------------------------------------------------------------
export type SignOutResult = { cookies: CookieInstruction[]; endSessionUrl: string; state: string };

export async function signOut(config: ReaderSsoConfig, input: { cookies: CookieReader; extraCookies?: CookieInstruction[] }): Promise<SignOutResult> {
  const c = resolve(config);
  const token = input.cookies(c.names.session);
  try {
    if (token && SESSION_TOKEN.test(token)) await c.request("/v1/auth/logout", { method: "POST", body: { session_token: token }, token });
  } catch { /* the local cookies are cleared regardless */ }
  const state = c.random();
  const endSession = new URL("/end-session", c.issuerOrigin);
  endSession.searchParams.set("client_id", c.clientId);
  endSession.searchParams.set("post_logout_redirect_uri", `${c.origin}${c.accountPath}?signed_out=1`);
  endSession.searchParams.set("state", state);
  emit(c, { name: "reader_signed_out", properties: { method: "explicit" } });
  return {
    cookies: [
      clear(c.names.session), clear(c.names.flow), clear(c.names.newsletter), clear(c.names.pending), clear(c.names.ssoChecked),
      { name: c.names.signedOut, value: "1", maxAge: READER_SSO_SIGNED_OUT_SECONDS },
      ...(input.extraCookies ?? []),
    ],
    endSessionUrl: endSession.toString(),
    state,
  };
}

// ---------------------------------------------------------------------------
// Session summary for the greeting (ADR section 7): display profile only, no
// email, served private/no-store by the site route.
// ---------------------------------------------------------------------------
export type SessionSummary = { authenticated: false } | { authenticated: true; full_name: string; locale?: string; time_zone?: string; session_upgrade_required?: true };

export async function sessionSummary(config: ReaderSsoConfig, cookies: CookieReader): Promise<SessionSummary> {
  const c = resolve(config);
  const user = await currentUser(c, cookies(c.names.session), "passive");
  if (!user || !user.email_verified) return { authenticated: false };
  return { authenticated: true, full_name: user.full_name, locale: user.locale, time_zone: user.time_zone, ...(user.needsSsoUpgrade && !keepsLocal(cookies(c.names.ssoChecked), cookies(c.names.session)) ? { session_upgrade_required: true as const } : {}) };
}

/**
 * Session summary plus the cookies to clear when a present session cookie no
 * longer validates (revoked elsewhere). The site's session route applies them
 * so a stale cookie stops suppressing sign-in (release review R5).
 */
export async function sessionSummaryWithCookies(config: ReaderSsoConfig, cookies: CookieReader): Promise<{ summary: SessionSummary; cookies: CookieInstruction[] }> {
  const c = resolve(config);
  const present = cookies(c.names.session);
  const summary = await sessionSummary(config, cookies);
  return { summary, cookies: present && !summary.authenticated ? [clear(c.names.session), clear(c.names.pending)] : [] };
}

/** Flags the layout passes to `ReaderSsoBoot`; the cookies themselves are HttpOnly. */
export function readerSsoBootFlags(cookies: CookieReader, names: ReaderSsoCookieNames): { hasSession: boolean; suppressed: boolean } {
  return {
    hasSession: Boolean(cookies(names.session)),
    suppressed: Boolean(cookies(names.signedOut) || cookies(names.ssoChecked) === "1" || cookies(names.pending)),
  };
}
