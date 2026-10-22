"use client";
/**
 * Browser half of reader single sign-on. Nothing here holds a credential: every
 * component talks to the publication's own same-origin routes, which carry the
 * HttpOnly reader cookies. See ./reader-sso.ts for the server contract.
 */
import { useEffect, useId, useState } from "react";

export type ReaderSsoProvider = "google" | "email";

// ---------------------------------------------------------------------------
// Legacy silent sign-in helpers remain exported for compatibility. The SDK no
// longer schedules or performs automatic navigation from a rendered page.
// ---------------------------------------------------------------------------
export const READER_SSO_BOT_PATTERN =
  /bot|crawl|spider|headless|lighthouse|pagespeed|preview|slurp|facebookexternalhit|embedly|python|curl|wget|phantom|puppeteer|playwright|selenium|prerender/i;

/** Pages where a background navigation would be unwelcome or pointless. */
export const READER_SSO_PRIVATE_PATHS: RegExp[] = [
  /^\/account(\/|$)/, /^\/api(\/|$)/, /^\/review(\/|$)/, /^\/reset-password(\/|$)/, /^\/verify-email(\/|$)/,
  /^\/claim(\/|$)/, /^\/tip(\/|$)/, /^\/news\/unsubscribe(\/|$)/, /^\/pets\/account(\/|$)/, /^\/newsletter(\/|$)/,
];

/** Query parameters that mark a page as the result of a sign-in step. */
const FLOW_QUERY = ["signin", "signed_out", "switch", "link", "subscription", "code", "state", "error"];

/** One attempt per browser session window; the server's negative cache is the real guard. */
export const READER_SSO_ATTEMPT_WINDOW_MS = 5 * 60_000;

export type SilentSignInEnvironment = {
  enabled: boolean;
  hasSession: boolean;
  suppressed: boolean;
  webdriver: boolean;
  userAgent: string;
  pathname: string;
  search: string;
  fieldFocused: boolean;
  prerendering: boolean;
  visibilityState: string;
  framed: boolean;
  lastAttemptAt: number | null;
  now: number;
  privatePaths?: RegExp[];
};

export type SilentSignInDecision = { attempt: true } | { attempt: false; reason: string };

/** @deprecated No automatic reader sign-in should use this decision. */
export function silentSignInDecision(env: SilentSignInEnvironment): SilentSignInDecision {
  if (!env.enabled) return { attempt: false, reason: "disabled" };
  if (env.hasSession) return { attempt: false, reason: "session" };
  if (env.suppressed) return { attempt: false, reason: "suppressed" };
  if (env.webdriver) return { attempt: false, reason: "webdriver" };
  if (!env.userAgent || READER_SSO_BOT_PATTERN.test(env.userAgent)) return { attempt: false, reason: "bot" };
  if (env.framed) return { attempt: false, reason: "framed" };
  if (env.prerendering || env.visibilityState !== "visible") return { attempt: false, reason: "hidden" };
  if ((env.privatePaths ?? READER_SSO_PRIVATE_PATHS).some((pattern) => pattern.test(env.pathname))) return { attempt: false, reason: "private" };
  const params = new URLSearchParams(env.search);
  if (FLOW_QUERY.some((key) => params.has(key))) return { attempt: false, reason: "flow" };
  if (env.fieldFocused) return { attempt: false, reason: "typing" };
  if (env.lastAttemptAt !== null && env.now - env.lastAttemptAt < READER_SSO_ATTEMPT_WINDOW_MS) return { attempt: false, reason: "recent" };
  return { attempt: true };
}

/** @deprecated Use an explicit, user-initiated handoff flow instead. */
export function silentSignInUrl(startPath: string, pathname: string, search: string): string {
  return `${startPath}?${new URLSearchParams({ mode: "silent", next: pathname + search })}`;
}

export function isFormField(element: Element | null): boolean {
  // The newsroom widget uses Shadow DOM: its host is the document's active
  // element, while the actual focused text field lives inside the shadow root.
  let focused = element;
  while (focused?.shadowRoot?.activeElement && focused.shadowRoot.activeElement !== focused) {
    focused = focused.shadowRoot.activeElement;
  }
  if (!focused) return false;
  const tag = focused.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (focused as HTMLElement).isContentEditable === true;
}

/**
 * Compatibility export for publications that still mount the old boot island.
 * Reader identity is checked by the same-origin session UI; authentication
 * must begin with an intentional click, never a timer or page-load navigation.
 * @deprecated Remove this component from publication layouts.
 */
export function ReaderSsoBoot(_props: {
  enabled?: boolean;
  /** A reader session cookie is present (it may have been revoked elsewhere). */
  hasSession: boolean;
  suppressed: boolean;
  startPath?: string;
  /** Private, no-store endpoint that validates the cookie and clears it when stale. */
  sessionPath?: string;
  privatePaths?: RegExp[];
  idleDelayMs?: number;
}) {
  return null;
}

// ---------------------------------------------------------------------------
// Greeting (ADR section 7): server-derived display profile, neutral fallback,
// the reader's own time zone and locale, escaped by React. Client island only,
// so it never lands in shared or static HTML.
// ---------------------------------------------------------------------------
export type GreetingProfile = { full_name?: string | null; locale?: string | null; time_zone?: string | null };

/** The first whitespace-separated token of a display name, Unicode-safe, at most 40 characters. */
export function firstName(fullName: string | null | undefined): string {
  if (typeof fullName !== "string") return "";
  const token = fullName.replace(/[\u0000-\u001f\u007f]/g, " ").trim().split(/\s+/u)[0] ?? "";
  return Array.from(token).slice(0, 40).join("");
}

export function localHour(now: Date, timeZone?: string | null, locale?: string | null): number {
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", hourCycle: "h23" };
  const attempts: Array<[string | undefined, string | undefined]> = [[locale ?? undefined, timeZone ?? undefined], [undefined, timeZone ?? undefined], [undefined, undefined]];
  for (const [loc, tz] of attempts) {
    try {
      const part = new Intl.DateTimeFormat(loc, { ...options, ...(tz ? { timeZone: tz } : {}) }).formatToParts(now).find((p) => p.type === "hour");
      const hour = part ? Number(part.value) : NaN;
      if (Number.isInteger(hour) && hour >= 0 && hour < 24) return hour;
    } catch { /* unknown locale or zone: try the next fallback */ }
  }
  return now.getHours();
}

export function greetingWord(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function greetingText(profile: GreetingProfile, now = new Date(), fallback = "Welcome back"): string {
  const name = firstName(profile.full_name);
  if (!name) return fallback;
  return `${greetingWord(localHour(now, profile.time_zone, profile.locale))}, ${name}`;
}

export type SessionSummaryResponse = { authenticated: boolean; full_name?: string; locale?: string; time_zone?: string };

export const READER_GREETING_POLL_MS = 30_000;
export const READER_GREETING_TIMEOUT_MS = 8_000;
export const READER_IDENTITY_CHANGED_EVENT = "scalemule:reader-identity-changed";

export function ReaderGreeting({ endpoint = "/api/news/session", className, fallback = "Welcome back", as: Tag = "span" }: {
  endpoint?: string;
  className?: string;
  fallback?: string;
  as?: "span" | "p" | "div";
}) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let generation = 0;
    let authenticated = false;
    let controller: AbortController | undefined;
    let deadline: number | undefined;
    const refresh = (clear = false) => {
      if (!alive) return;
      if (clear) { authenticated = false; setText(null); }
      const current = ++generation;
      controller?.abort();
      if (deadline !== undefined) window.clearTimeout(deadline);
      if (document.visibilityState === "hidden") return;
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => {
        if (!alive || current !== generation) return;
        generation++;
        authenticated = false;
        setText(null);
        request.abort();
      }, READER_GREETING_TIMEOUT_MS);
      deadline = timeout;
      fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: request.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((summary: SessionSummaryResponse | null) => {
          if (!alive || current !== generation) return;
          authenticated = summary?.authenticated === true;
          setText(authenticated && summary ? greetingText(summary, new Date(), fallback) : null);
        })
        .catch(() => {
          if (!alive || current !== generation) return;
          authenticated = false;
          setText(null);
        })
        .finally(() => window.clearTimeout(timeout));
    };
    const recheck = () => refresh(true);
    const timer = window.setInterval(() => {
      // Anonymous pages need only their initial check and user-focus events.
      if (authenticated) refresh();
    }, READER_GREETING_POLL_MS);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    document.addEventListener(READER_IDENTITY_CHANGED_EVENT, recheck);
    refresh(true);
    return () => {
      alive = false;
      generation++;
      controller?.abort();
      if (deadline !== undefined) window.clearTimeout(deadline);
      window.clearInterval(timer);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
      document.removeEventListener(READER_IDENTITY_CHANGED_EVENT, recheck);
    };
  }, [endpoint, fallback]);
  if (text === null) return null;
  return <Tag className={className} data-reader-greeting="">{text}</Tag>;
}

// ---------------------------------------------------------------------------
// Buttons and forms. Styling is the site's: pass class names. Errors render
// inline with role="alert" (no toast libraries).
// ---------------------------------------------------------------------------
export type ReaderSsoClassNames = { wrapper?: string; button?: string; fine?: string; error?: string; form?: string; secondary?: string };

async function postJson<T>(endpoint: string, body: unknown, timeoutMs = 30000): Promise<T & { error?: string }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string; mfa_required?: boolean };
  if (!response.ok) throw Object.assign(new Error(data.error || "Please try again."), { mfaRequired: data.mfa_required === true });
  return data;
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.805 10.023H12.24v3.955h5.483c-.237 1.273-.958 2.352-2.042 3.073v2.552h3.305c1.936-1.782 3.05-4.41 3.05-7.603 0-.676-.06-1.326-.171-1.977Z" fill="#4285F4" />
      <path d="M12.24 22c2.745 0 5.047-.909 6.73-2.447l-3.305-2.552c-.918.615-2.094.978-3.425.978-2.636 0-4.87-1.78-5.67-4.173H3.154v2.632A10.16 10.16 0 0 0 12.24 22Z" fill="#34A853" />
      <path d="M6.57 13.806A6.112 6.112 0 0 1 6.253 12c0-.627.109-1.235.317-1.806V7.562H3.154A10.157 10.157 0 0 0 2 12c0 1.633.39 3.177 1.154 4.438l3.416-2.632Z" fill="#FBBC04" />
      <path d="M12.24 6.02c1.493 0 2.833.514 3.888 1.523l2.913-2.913C17.281 2.998 14.979 2 12.24 2A10.16 10.16 0 0 0 3.154 7.562l3.416 2.632c.8-2.393 3.034-4.174 5.67-4.174Z" fill="#EA4335" />
    </svg>
  );
}
function MailMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export const LEDVERY_BUTTON_LABELS: Record<ReaderSsoProvider, { label: string; busy: string }> = {
  google: { label: "Continue with Google", busy: "Opening Google…" },
  email: { label: "Continue with email", busy: "Opening sign-in…" },
};

export function LedveryButton({
  provider = "google",
  subscribe = false,
  disabled = false,
  returnTo = "",
  startPath = "/api/news/ledvery-start",
  label,
  busyLabel,
  description,
  classNames = {},
  onStart,
}: {
  provider?: ReaderSsoProvider;
  subscribe?: boolean;
  disabled?: boolean;
  returnTo?: string;
  startPath?: string;
  label?: string;
  busyLabel?: string;
  description?: string;
  classNames?: ReaderSsoClassNames;
  onStart?: (provider: ReaderSsoProvider) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const descriptionId = useId();
  const labels = LEDVERY_BUTTON_LABELS[provider];
  return (
    <div className={classNames.wrapper} data-reader-signin={provider}>
      <button
        type="button"
        className={classNames.button}
        disabled={busy || disabled}
        aria-describedby={description ? descriptionId : undefined}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            onStart?.(provider);
          } catch { /* advisory */ }
          try {
            const data = await postJson<{ url?: string }>(startPath, { provider, subscribe, consent: subscribe, returnTo });
            if (!data.url) throw new Error("Sign-in is temporarily unavailable. Please try again.");
            window.location.assign(data.url);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
            setBusy(false);
          }
        }}
      >
        {provider === "google" ? <GoogleMark /> : <MailMark />}
        <span>{busy ? busyLabel ?? labels.busy : label ?? labels.label}</span>
      </button>
      {description && <p id={descriptionId} className={classNames.fine}>{description}</p>}
      {error && <p role="alert" className={classNames.error}>{error}</p>}
    </div>
  );
}

export type LinkResult = { user?: { id: string; email?: string; email_verified?: boolean }; switch?: boolean; location?: string };

/** Password proof for an existing local account (HTTP 409 LINK_REQUIRED from the callback). */
export function AccountLinkForm({
  challengeId,
  hint = "",
  endpoint = "/api/news/ledvery-link",
  next = "",
  subscribe = false,
  classNames = {},
  onLinked,
  onCancel,
}: {
  challengeId: string;
  hint?: string;
  endpoint?: string;
  next?: string;
  subscribe?: boolean;
  classNames?: ReaderSsoClassNames;
  onLinked?: (result: LinkResult) => void;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [code, setCode] = useState("");
  return (
    <form
      className={classNames.form}
      data-reader-link=""
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        postJson<LinkResult>(endpoint, { challenge_id: challengeId, password, next, subscribe, ...(mfaRequired && code ? { mfa_code: code } : {}) })
          .then((result) => {
            setPassword("");
            setCode("");
            if (onLinked) onLinked(result);
            else window.location.assign(result.location || "/account");
          })
          .catch((e: unknown) => {
            // The challenge stays server-side and single-use per success; the
            // code step keeps it and asks for the second factor.
            if ((e as { mfaRequired?: boolean })?.mfaRequired) setMfaRequired(true);
            setCode("");
            setError(e instanceof Error ? e.message : "Please try again.");
            setBusy(false);
          });
      }}
    >
      <h2>You already have a reader account</h2>
      <p className={classNames.fine}>
        {hint ? <>An account for <strong>{hint}</strong> already exists. </> : null}
        Enter its password once to connect your sign-in. Your preferences and subscriptions stay as they are.
      </p>
      <label>
        Reader account password
        <input type="password" autoComplete="current-password" required minLength={1} maxLength={1024} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {mfaRequired && (
        <label>
          Verification code
          <input type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={32} value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
      )}
      <button className={classNames.button} disabled={busy || !password || (mfaRequired && !code)}>{busy ? "Connecting…" : "Connect and sign in"}</button>
      {onCancel && <button type="button" className={classNames.secondary} disabled={busy} onClick={onCancel}>Start over</button>}
      {error && <p role="alert" className={classNames.error}>{error}</p>}
    </form>
  );
}

export type SwitchChoice = "continue" | "stay";
export type SwitchResult = { choice?: SwitchChoice; location?: string };

/** ADR 3.2: Bob stays signed in until the reader explicitly chooses Alice. */
export function AccountSwitchPrompt({
  currentName,
  pendingName,
  endpoint = "/api/news/switch-account",
  classNames = {},
  onDone,
}: {
  currentName: string;
  pendingName: string;
  endpoint?: string;
  classNames?: ReaderSsoClassNames;
  onDone?: (result: SwitchResult) => void;
}) {
  const [busy, setBusy] = useState<SwitchChoice | null>(null);
  const [error, setError] = useState("");
  const current = firstName(currentName) || "your current account";
  const pending = firstName(pendingName) || "the new account";
  const choose = (choice: SwitchChoice) => {
    setBusy(choice);
    setError("");
    postJson<SwitchResult>(endpoint, { choice })
      .then((result) => {
        if (onDone) onDone({ ...result, choice });
        else window.location.assign(result.location || "/account");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Please try again.");
        setBusy(null);
      });
  };
  return (
    <div className={classNames.wrapper} data-reader-switch="" role="group" aria-label="Choose an account">
      <h2>Which account would you like to use?</h2>
      <p className={classNames.fine}>You are signed in as {current}. A different account, {pending}, just signed in through Ledvery.</p>
      <button type="button" className={classNames.button} disabled={busy !== null} onClick={() => choose("continue")}>
        {busy === "continue" ? "Switching…" : `Continue as ${pending}`}
      </button>
      <button type="button" className={classNames.secondary} disabled={busy !== null} onClick={() => choose("stay")}>
        {busy === "stay" ? "One moment…" : `Stay as ${current}`}
      </button>
      {error && <p role="alert" className={classNames.error}>{error}</p>}
    </div>
  );
}
