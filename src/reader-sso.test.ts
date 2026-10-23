import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  READER_SSO_EVENTS,
  READER_SSO_NEGATIVE_CACHE_SECONDS,
  READER_SSO_SIGNED_OUT_SECONDS,
  applyCookies,
  authorizeUrl,
  completeSignIn,
  cookieReader,
  linkAccount,
  localReturnPath,
  networkHandoffReturnPath,
  openLinkChallenge,
  openPendingSession,
  openReaderFlow,
  precedence,
  readerSsoBootFlags,
  readerSsoCookieNames,
  sealLinkChallenge,
  sealPendingSession,
  sealReaderFlow,
  sessionSummary,
  sessionSummaryWithCookies,
  setCookieHeader,
  signOut,
  startSignIn,
  switchAccount,
  type ReaderSsoConfig,
  type ReaderSsoEvent,
  type ReaderSsoResponse,
} from "./reader-sso";

const KEY = "unit-test-key";
const ORIGIN = "https://paper.example.test";
const CALLBACK = `${ORIGIN}/api/news/ledvery-callback`;
const names = readerSsoCookieNames("__Host-media");
const NOW = Date.UTC(2026, 9, 19, 15, 0, 0);
const later = new Date(NOW + 3_600_000).toISOString();

type Call = { path: string; method: string; body?: unknown; token?: string };
type Users = Record<string, { id: string; email_verified?: boolean; full_name?: string; locale?: string; time_zone?: string; sso_session_bound?: boolean }>;

function harness(options: { users?: Users; exchange?: ReaderSsoResponse; link?: ReaderSsoResponse; authorize?: ReaderSsoResponse; logout?: ReaderSsoResponse; fail?: boolean } = {}) {
  const calls: Call[] = [];
  const events: ReaderSsoEvent[] = [];
  const users: Users = options.users ?? { "new-token": { id: "alice", email_verified: true, full_name: "Alice Иванова", locale: "bg-BG", time_zone: "Europe/Sofia" } };
  const config: ReaderSsoConfig = {
    prefix: "__Host-media",
    key: KEY,
    origin: ORIGIN,
    clientId: "napsite-paper",
    emailSignIn: true,
    now: () => NOW,
    random: () => "ab".repeat(16),
    record: (event) => events.push(event),
    request: async (path, init) => {
      calls.push({ path, method: init.method, body: init.body, token: init.token });
      if (options.fail) throw new Error("network");
      if (path.startsWith("/v1/auth/oauth/ledvery/authorize")) {
        const query = new URL(path, ORIGIN).searchParams;
        const prompt = query.get("prompt");
        return options.authorize ?? { status: 200, body: { data: { url: `https://api.ledvery.com/authorize?client_id=napsite-paper&response_type=code&scope=openid+email+profile&nonce=n-1&state=st-1&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge_method=S256&code_challenge=abc${prompt ? `&prompt=${prompt}` : ""}`, state: "st-1" } } };
      }
      if (path.startsWith("/v1/auth/oauth/ledvery/callback")) return options.exchange ?? { status: 200, body: { data: { session_token: "new-token", expires_at: later, user: {}, is_new_user: true } } };
      if (path === "/v1/auth/oauth/ledvery/link") return options.link ?? { status: 200, body: { data: { session_token: "new-token", expires_at: later } } };
      if (path.startsWith("/v1/auth/me")) {
        const user = init.token ? users[init.token] : undefined;
        return user ? { status: 200, body: { data: user } } : { status: 401, body: { success: false, error: { code: "UNAUTHORIZED" } } };
      }
      if (path === "/v1/auth/logout") return options.logout ?? { status: 200, body: { success: true, data: null } };
      return { status: 404, body: { success: false } };
    },
  };
  return { config, calls, events };
}

const jar = (cookies: Record<string, string>) => (name: string) => cookies[name];
const flowCookie = (input: Parameters<typeof sealReaderFlow>[0]) => sealReaderFlow(input, KEY, NOW);
const linkCookie = (challengeId = "ch_1", extra: Record<string, string> = {}) => jar({ [names.linkFlow]: sealLinkChallenge(challengeId, KEY, NOW), ...extra });
const callbackUrl = (query: string) => `${CALLBACK}?${query}`;

describe("reader SSO cookies", () => {
  it("derives every cookie name from the prefix and rejects non-host prefixes", () => {
    expect(names).toEqual({
      session: "__Host-media-reader", flow: "__Host-media-ledvery", newsletter: "__Host-media-newsletter",
      ssoChecked: "__Host-media-sso-checked", signedOut: "__Host-media-signed-out", pending: "__Host-media-sso-pending",
      linkCode: "__Host-media-link-code", linkFlow: "__Host-media-sso-link",
    });
    expect(readerSsoCookieNames("__Host-trivalley").session).toBe("__Host-trivalley-reader");
    expect(() => readerSsoCookieNames("media")).toThrow();
    expect(() => readerSsoCookieNames("__Host-a;b")).toThrow();
  });
  it("expires and authenticates the browser's account-link challenge", () => {
    const cookie = sealLinkChallenge("ch_1", KEY, NOW);
    expect(openLinkChallenge(cookie, KEY, NOW)).toBe("ch_1");
    expect(openLinkChallenge(cookie, KEY, NOW + 600_000)).toBeNull();
    expect(openLinkChallenge(cookie, "other-key", NOW)).toBeNull();
    expect(openLinkChallenge(cookie + "x", KEY, NOW)).toBeNull();
    expect(() => sealLinkChallenge("evil?next=alice", KEY, NOW)).toThrow();
  });
  it("renders instructions for a Next jar and as raw headers", () => {
    const set = vi.fn();
    applyCookies({ set }, [{ name: "a", value: "1", maxAge: 5 }, { name: "b", value: "", maxAge: 0 }]);
    expect(set).toHaveBeenCalledWith("a", "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 5 });
    expect(setCookieHeader({ name: "x", value: "y", expires: new Date(NOW) })).toBe("x=y; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Mon, 19 Oct 2026 15:00:00 GMT");
    const read = cookieReader("a=1; b=2; b=3");
    expect(read("a")).toBe("1");
    expect(read("b")).toBeUndefined();
  });
});

describe("flow sealing", () => {
  it("ignores account and redirect parameters attached to a handoff link", () => {
    expect(networkHandoffReturnPath(new URLSearchParams("next=https://evil.test&account=alice&state=forged"))).toBe("/");
    expect(networkHandoffReturnPath(new URLSearchParams("sm_consent=0&next=%2F%2Fevil.test"))).toBe("/?sm_consent=0");
    expect(networkHandoffReturnPath(new URLSearchParams("sm_consent=0&sm_consent=1"))).toBe("/");
  });
  it("round-trips mode, provider and transaction id", () => {
    const cookie = flowCookie({ state: "st-1", subscribe: true, returnTo: "/news/story?x=1", mode: "silent", provider: undefined, tx: "deadbeef" });
    const flow = openReaderFlow(cookie, KEY, NOW);
    // A silent flow never carries newsletter consent, even if the sealed cookie says so.
    expect(flow).toEqual({ digest: createHash("sha256").update("st-1").digest("hex"), subscribe: false, expires: NOW + 600_000, returnTo: "/news/story?x=1", mode: "silent", provider: undefined, tx: "deadbeef" });
    expect(openReaderFlow(cookie, KEY, NOW + 600_001)).toBeNull();
    expect(openReaderFlow(cookie, "other-key", NOW)).toBeNull();
    expect(openReaderFlow(cookie + ".x", KEY, NOW)).toBeNull();
  });
  it("still opens the publications' previous reader-flow:v1 cookies as interactive", () => {
    const legacy = Buffer.from(JSON.stringify({ digest: createHash("sha256").update("st-old").digest("hex"), subscribe: false, expires: NOW + 60_000, returnTo: "/meet" })).toString("base64url");
    const cookie = legacy + "." + createHmac("sha256", KEY).update("reader-flow:v1:" + legacy).digest("hex");
    expect(openReaderFlow(cookie, KEY, NOW)).toMatchObject({ mode: "interactive", returnTo: "/meet", subscribe: false, provider: undefined, tx: undefined });
  });
  it("re-validates the return path with the site's rule for the flow's mode", () => {
    const cookie = flowCookie({ state: "s", returnTo: "/anywhere", mode: "silent" });
    expect(openReaderFlow(cookie, KEY, NOW, (next, mode) => (mode === "silent" ? next : ""))?.returnTo).toBe("/anywhere");
    expect(openReaderFlow(cookie, KEY, NOW, () => "")).toBeNull();
    expect(localReturnPath("//evil")).toBe("");
    expect(localReturnPath("/api/news/me")).toBe("");
    expect(localReturnPath("/news/статия?x=1")).toBe("/news/статия?x=1");
    expect(localReturnPath("/bad\r\nheader")).toBe("");
  });
  it("validates the authorization URL and insists on prompt=none for silent attempts", () => {
    const base = `https://api.ledvery.com/authorize?client_id=napsite-paper&response_type=code&scope=openid&nonce=n&state=st&redirect_uri=${encodeURIComponent(CALLBACK)}&code_challenge_method=S256&code_challenge=c`;
    expect(authorizeUrl(base, "st", CALLBACK, "interactive")).toBe(base);
    expect(() => authorizeUrl(base, "st", CALLBACK, "silent")).toThrow();
    expect(authorizeUrl(base + "&prompt=none", "st", CALLBACK, "silent")).toContain("prompt=none");
    expect(() => authorizeUrl(base + "&prompt=select_account", "st", CALLBACK, "interactive")).toThrow();
    expect(authorizeUrl(base + "&prompt=select_account", "st", CALLBACK, "interactive", undefined, true)).toContain("prompt=select_account");
    expect(() => authorizeUrl(base + "&prompt=none&prompt=none", "st", CALLBACK, "silent")).toThrow();
    expect(() => authorizeUrl(base.replace("api.ledvery.com", "evil.test"), "st", CALLBACK, "interactive")).toThrow();
    expect(() => authorizeUrl(base, "other", CALLBACK, "interactive")).toThrow();
    expect(() => authorizeUrl(base + "&state=st", "st", CALLBACK, "interactive")).toThrow();
    expect(() => authorizeUrl(base.replace("client_id=napsite-paper", "client_id=attacker"), "st", CALLBACK, "interactive", undefined, false, "napsite-paper")).toThrow();
    expect(() => authorizeUrl(base.replace("response_type=code", "response_type=token"), "st", CALLBACK, "interactive")).toThrow();
    expect(() => authorizeUrl(base.replace("nonce=n", "nonce="), "st", CALLBACK, "interactive")).toThrow();
  });
});

describe("startSignIn", () => {
  it("interactive Google start seals the flow, clears suppression and records the start", async () => {
    const h = harness();
    const result = await startSignIn(h.config, { mode: "interactive", provider: "google", subscribe: true, next: "/meet", cookies: jar({ [names.signedOut]: "1" }) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).not.toContain("prompt=");
    expect(h.calls[0].path).toContain("upstream=google");
    expect(h.calls[0].path).not.toContain("prompt=");
    const flow = result.cookies.find((c) => c.name === names.flow)!;
    expect(flow.maxAge).toBe(600);
    expect(openReaderFlow(flow.value, KEY, NOW)).toMatchObject({ subscribe: true, returnTo: "/meet", mode: "interactive", provider: "google", tx: "ab".repeat(16) });
    expect(result.cookies.map((c) => [c.name, c.maxAge])).toContainEqual([names.signedOut, 0]);
    expect(result.cookies.map((c) => [c.name, c.maxAge])).toContainEqual([names.ssoChecked, 0]);
    expect(h.events).toEqual([{ name: "reader_signin_started", properties: { method: "google", mode: "interactive", transaction: "ab".repeat(16) } }]);
  });
  it("only an explicit account-switch start requests the chooser", async () => {
    const h = harness();
    const result = await startSignIn(h.config, { mode: "interactive", selectAccount: true, cookies: jar({}) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new URL(result.url).searchParams.get("prompt")).toBe("select_account");
    expect(h.calls[0].path).toContain("prompt=select_account");
  });
  it("email provider is gated and uses the consumer upstream", async () => {
    const off = harness();
    off.config.emailSignIn = false;
    expect(await startSignIn(off.config, { mode: "interactive", provider: "email", cookies: jar({}) })).toMatchObject({ ok: false, status: 404, reason: "provider" });
    const h = harness();
    const result = await startSignIn(h.config, { mode: "interactive", provider: "email", cookies: jar({}) });
    expect(result.ok).toBe(true);
    expect(h.calls[0].path).toContain("upstream=scalemule_consumer");
  });
  it("silent start is suppressed by a sign-out or the negative cache without touching the gateway", async () => {
    for (const cookie of [names.signedOut, names.ssoChecked]) {
      const h = harness();
      const result = await startSignIn(h.config, { mode: "silent", next: "/news/x", cookies: jar({ [cookie]: "1" }) });
      expect(result).toMatchObject({ ok: false, reason: "suppressed", redirect: "/news/x", cookies: [] });
      expect(h.calls).toEqual([]);
      expect(h.events).toEqual([]);
    }
  });
  it("silent start is suppressed only by a session that still validates", async () => {
    const h = harness();
    const result = await startSignIn(h.config, { mode: "silent", next: "/news/x", cookies: jar({ [names.session]: "new-token" }) });
    expect(result).toMatchObject({ ok: false, reason: "session", cookies: [] });
    expect(h.calls.map((c) => c.path)).toEqual(["/v1/auth/me?passive=true"]);
  });
  it("a session cookie revoked elsewhere is cleared and no longer suppresses the silent check (review R5)", async () => {
    const h = harness();
    const result = await startSignIn(h.config, { mode: "silent", next: "/news/x", cookies: jar({ [names.session]: "revoked-token-abcdef" }) });
    expect(result.ok).toBe(true);
    expect(h.calls.map((c) => c.path.split("?")[0])).toEqual(["/v1/auth/me", "/v1/auth/oauth/ledvery/authorize"]);
    expect(result.cookies.filter((c) => c.name === names.session)).toEqual([{ name: names.session, value: "", maxAge: 0 }]);
    // An explicit sign-out still wins over a stale cookie, and the stale cookie is still cleared.
    const out = harness();
    const suppressed = await startSignIn(out.config, { mode: "silent", next: "/news/x", cookies: jar({ [names.session]: "revoked-token-abcdef", [names.signedOut]: "1" }) });
    expect(suppressed).toMatchObject({ ok: false, reason: "suppressed" });
    expect(suppressed.cookies.map((c) => c.name)).toContain(names.session);
  });
  it("silent start requests prompt=none, never subscribes and keeps the suppression cookies", async () => {
    const h = harness();
    const result = await startSignIn(h.config, { mode: "silent", subscribe: true, next: "/news/story?utm=1", cookies: jar({}) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(h.calls[0].path).toContain("prompt=none");
    expect(h.calls[0].path).not.toContain("upstream");
    expect(result.cookies).toHaveLength(1);
    expect(openReaderFlow(result.cookies[0].value, KEY, NOW)).toMatchObject({ mode: "silent", subscribe: false, returnTo: "/news/story?utm=1" });
    expect(h.events[0]).toMatchObject({ name: "reader_signin_started", properties: { method: "unknown", mode: "silent" } });
  });
  it("a failed silent start still sets the negative cache so the browser does not retry each page", async () => {
    const h = harness({ fail: true });
    const result = await startSignIn(h.config, { mode: "silent", next: "/", cookies: jar({}) });
    expect(result).toMatchObject({ ok: false, reason: "unavailable", cookies: [{ name: names.ssoChecked, value: "1", maxAge: READER_SSO_NEGATIVE_CACHE_SECONDS }] });
    expect(h.events[0]).toMatchObject({ name: "reader_sso_check", properties: { outcome: "error", mode: "silent" } });
    const i = harness({ fail: true });
    expect(await startSignIn(i.config, { mode: "interactive", cookies: jar({}) })).toMatchObject({ ok: false, status: 503 });
    expect(i.events[0]).toMatchObject({ name: "reader_signin_failed", properties: { reason: "unavailable", mode: "interactive" } });
  });
});

describe("completeSignIn", () => {
  it("silent negatives set the negative cache, return to the page and are checks, not failures", async () => {
    for (const error of ["login_required", "consent_required", "interaction_required", "server_error"]) {
      const h = harness();
      const cookies = jar({ [names.flow]: flowCookie({ state: "st-1", mode: "silent", returnTo: "/news/story?x=1" }) });
      const result = await completeSignIn(h.config, { url: callbackUrl(`error=${error}&state=st-1`), cookies });
      expect(result.kind).toBe("redirect");
      expect(result.location).toBe("/news/story?x=1");
      expect(result.cookies).toEqual([{ name: names.flow, value: "", maxAge: 0 }, { name: names.ssoChecked, value: "1", maxAge: 300 }]);
      expect(h.calls).toEqual([]);
      expect(h.events).toEqual([{ name: "reader_sso_check", properties: { outcome: error === "server_error" ? "error" : error, mode: "silent", transaction: undefined } }]);
    }
  });
  it("interactive cancellation is a failure that returns to the retry page", async () => {
    const h = harness();
    const cookies = jar({ [names.flow]: flowCookie({ state: "st-1", mode: "interactive", provider: "google", returnTo: "/meet", tx: "ab" }) });
    const result = await completeSignIn(h.config, { url: callbackUrl("error=access_denied&state=st-1"), cookies });
    expect(result.location).toBe("/account?signin=retry&next=%2Fmeet");
    expect(result.cookies.map((c) => c.name)).toEqual([names.flow]);
    expect(h.events).toEqual([{ name: "reader_signin_failed", properties: { reason: "cancelled", mode: "interactive", transaction: "ab" } }]);
  });
  it("a callback without a bound transaction never exchanges the code", async () => {
    const h = harness();
    const result = await completeSignIn(h.config, { url: callbackUrl("code=one-time&state=st-1"), cookies: jar({}) });
    expect(result).toMatchObject({ kind: "redirect", location: "/account?signin=retry", outcome: "state" });
    expect(h.calls).toEqual([]);
    const wrong = await completeSignIn(h.config, { url: callbackUrl("code=one-time&state=other"), cookies: jar({ [names.flow]: flowCookie({ state: "st-1" }) }) });
    expect(wrong.outcome).toBe("state");
    expect(h.calls).toEqual([]);
  });
  it("exchanges the code, verifies the reader and issues the session cookie", async () => {
    const h = harness();
    const cookies = jar({ [names.flow]: flowCookie({ state: "st-1", mode: "interactive", provider: "google", subscribe: true, tx: "ab" }), [names.signedOut]: "1" });
    const result = await completeSignIn(h.config, { url: callbackUrl("code=one-time&state=st-1"), cookies });
    expect(result.kind).toBe("signed-in");
    if (result.kind !== "signed-in") return;
    expect(result.token).toBe("new-token");
    expect(result.isNew).toBe(true);
    expect(result.user).toMatchObject({ id: "alice", full_name: "Alice Иванова", locale: "bg-BG", time_zone: "Europe/Sofia" });
    expect(result.flow.subscribe).toBe(true);
    expect(result.location).toBe("/account");
    expect(result.cookies).toEqual([
      { name: names.flow, value: "", maxAge: 0 },
      { name: names.session, value: "new-token", expires: new Date(later) },
      { name: names.signedOut, value: "", maxAge: 0 },
      { name: names.ssoChecked, value: "", maxAge: 0 },
      { name: names.pending, value: "", maxAge: 0 },
    ]);
    expect(h.calls.map((c) => c.path.split("?")[0])).toEqual(["/v1/auth/oauth/ledvery/callback", "/v1/auth/me"]);
    expect(h.events).toEqual([{ name: "reader_signin_completed", properties: { method: "google", mode: "interactive", is_new: "true", transaction: "ab" } }]);
    expect(JSON.stringify(h.events)).not.toContain("st-1");
  });
  it("an unverified reader never receives a session cookie", async () => {
    const h = harness({ users: { "new-token": { id: "alice", email_verified: false } } });
    const result = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.flow]: flowCookie({ state: "st-1", mode: "silent", returnTo: "/news" }) }) });
    expect(result).toMatchObject({ kind: "redirect", location: "/news", outcome: "unverified" });
    expect(result.cookies.map((c) => c.name)).toEqual([names.flow, names.ssoChecked]);
    expect(h.events[0]).toMatchObject({ name: "reader_signin_failed", properties: { reason: "unverified", mode: "silent" } });
  });
  it("precedence: Bob stays signed in and Alice becomes a pending choice", async () => {
    expect(precedence(null, { id: "a", email_verified: true, full_name: "" })).toBe("replace");
    expect(precedence({ id: "a", email_verified: true, full_name: "" }, { id: "a", email_verified: true, full_name: "" })).toBe("renew");
    expect(precedence({ id: "bob", email_verified: true, full_name: "" }, { id: "alice", email_verified: true, full_name: "" })).toBe("switch");
    const h = harness({ users: { "bob-token": { id: "bob", email_verified: true, full_name: "Bob Builder" }, "new-token": { id: "alice", email_verified: true, full_name: "Alice" } } });
    const cookies = jar({ [names.session]: "bob-token", [names.flow]: flowCookie({ state: "st-1", mode: "silent", returnTo: "/news/story" }) });
    const result = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies });
    expect(result).toMatchObject({ kind: "redirect", location: "/news/story", outcome: "switch_offered" });
    expect(result.cookies.find((c) => c.name === names.session)).toBeUndefined();
    const pending = openPendingSession(result.cookies.find((c) => c.name === names.pending)!.value, KEY, NOW);
    expect(pending).toMatchObject({ token: "new-token", userId: "alice", name: "Alice", mode: "silent", returnTo: "/news/story" });
    expect(h.events[0]).toMatchObject({ name: "reader_sso_check", properties: { outcome: "switch_offered" } });

    const stay = await switchAccount(h.config, { choice: "stay", cookies: jar({ [names.session]: "bob-token", [names.pending]: result.cookies.find((c) => c.name === names.pending)!.value }) });
    expect(stay).toMatchObject({ ok: true, choice: "stay", location: "/news/story" });
    expect(stay.cookies).toEqual([{ name: names.pending, value: "", maxAge: 0 }]);
    expect(h.calls.at(-1)).toMatchObject({ path: "/v1/auth/logout", token: "new-token" });

    const go = await switchAccount(h.config, { choice: "continue", cookies: jar({ [names.session]: "bob-token", [names.pending]: result.cookies.find((c) => c.name === names.pending)!.value }) });
    expect(go).toMatchObject({ ok: true, choice: "continue", token: "new-token", location: "/news/story", subscribe: false });
    expect(go.cookies.find((c) => c.name === names.session)).toMatchObject({ value: "new-token" });
    expect(h.calls.filter((c) => c.path === "/v1/auth/logout").at(-1)).toMatchObject({ token: "bob-token" });
    expect(h.events.at(-1)).toMatchObject({ name: "reader_signin_completed", properties: { method: "switch", mode: "silent" } });
    expect(await switchAccount(h.config, { choice: "continue", cookies: jar({}) })).toMatchObject({ ok: false, status: 410 });
  });
  it("the same reader renews instead of being asked to switch", async () => {
    const h = harness({ users: { "old-token": { id: "alice", email_verified: true }, "new-token": { id: "alice", email_verified: true, full_name: "Alice" } } });
    const result = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.session]: "old-token", [names.flow]: flowCookie({ state: "st-1" }) }) });
    expect(result.kind).toBe("signed-in");
    expect(result.cookies.find((c) => c.name === names.session)).toMatchObject({ value: "new-token" });
  });
  it("LINK_REQUIRED sends an interactive reader to the link form and a silent one quietly home", async () => {
    const exchange = { status: 409, body: { success: false, error: { code: "LINK_REQUIRED", message: "x" }, data: { challenge_id: "ch_123", email_hint: "a***@example.test", expires_at: later, methods: ["password"] } } };
    const h = harness({ exchange });
    const interactive = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.flow]: flowCookie({ state: "st-1", provider: "google", subscribe: true, returnTo: "/meet" }) }) });
    expect(interactive).toMatchObject({ kind: "redirect", location: "/account?link=ch_123&hint=a***%40example.test&next=%2Fmeet&subscribe=1", outcome: "link_required" });
    expect(interactive.cookies.map((c) => c.name)).toEqual([names.flow, names.linkFlow]);
    expect(openLinkChallenge(interactive.cookies[1].value, KEY, NOW)).toBe("ch_123");
    const silent = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.flow]: flowCookie({ state: "st-1", mode: "silent", returnTo: "/news" }) }) });
    expect(silent).toMatchObject({ kind: "redirect", location: "/news" });
    expect(silent.cookies.map((c) => c.name)).toEqual([names.flow, names.ssoChecked]);
    expect(h.events.every((e) => e.name === "reader_sso_check" && e.properties.outcome === "link_required")).toBe(true);
  });
  it("exchange failures retry interactively and stay quiet silently", async () => {
    const h = harness({ exchange: { status: 400, body: { success: false, error: { code: "INVALID_CODE" } } } });
    const interactive = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.flow]: flowCookie({ state: "st-1" }) }) });
    expect(interactive).toMatchObject({ location: "/account?signin=retry", outcome: "exchange" });
    const silent = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.flow]: flowCookie({ state: "st-1", mode: "silent", returnTo: "/x" }) }) });
    expect(silent).toMatchObject({ location: "/x", outcome: "exchange" });
    expect(silent.cookies.map((c) => c.name)).toContain(names.ssoChecked);
  });
});

describe("linkAccount", () => {
  it("rejects a challenge attached to a link without the matching callback cookie", async () => {
    const h = harness();
    for (const cookies of [jar({}), linkCookie("attacker-challenge"), jar({ [names.linkFlow]: sealLinkChallenge("ch_1", KEY, NOW - 600_001) })]) {
      const result = await linkAccount(h.config, { challenge_id: "ch_1", password: "victim-password", cookies });
      expect(result).toMatchObject({ ok: false, status: 400 });
    }
    h.config.enabled = false;
    expect(await linkAccount(h.config, { challenge_id: "ch_1", password: "victim-password", cookies: linkCookie() })).toMatchObject({ ok: false, status: 400 });
    expect(h.calls).toHaveLength(0);
  });
  it("validates input neutrally and issues the session on success", async () => {
    const h = harness();
    expect(await linkAccount(h.config, { challenge_id: "bad id!", password: "x", cookies: jar({}) })).toMatchObject({ ok: false, status: 400 });
    expect(await linkAccount(h.config, { challenge_id: "ch_1", password: "", cookies: linkCookie() })).toMatchObject({ ok: false, status: 400 });
    const result = await linkAccount(h.config, { challenge_id: "ch_1", password: "pw", next: "/meet", cookies: linkCookie() });
    expect(result).toMatchObject({ ok: true, switch: false, token: "new-token", location: "/meet" });
    expect(result.cookies).toContainEqual({ name: names.linkFlow, value: "", maxAge: 0 });
    expect(h.calls[0]).toMatchObject({ path: "/v1/auth/oauth/ledvery/link", method: "POST", body: { challenge_id: "ch_1", password: "pw" } });
    expect(h.events.map((e) => e.name)).toEqual(["reader_signin_failed", "reader_signin_failed", "reader_signin_completed", "reader_account_linked"]);
    expect(JSON.stringify(h.events)).not.toContain("pw");
    const wrong = harness({ link: { status: 401, body: { success: false, error: { code: "INVALID_CREDENTIALS" } } } });
    expect(await linkAccount(wrong.config, { challenge_id: "ch_1", password: "pw", cookies: linkCookie() })).toMatchObject({ ok: false, status: 400 });
  });
  it("asks for and forwards the MFA code an existing protected account requires (review R6)", async () => {
    const mfa = harness({ link: { status: 401, body: { success: false, error: { code: "MFA_REQUIRED" } } } });
    expect(await linkAccount(mfa.config, { challenge_id: "ch_1", password: "pw", cookies: linkCookie() })).toMatchObject({ ok: false, status: 401, mfaRequired: true });
    const h = harness();
    const result = await linkAccount(h.config, { challenge_id: "ch_1", password: "pw", mfa_code: " 123456 ", cookies: linkCookie() });
    expect(result.ok).toBe(true);
    expect(h.calls[0].body).toEqual({ challenge_id: "ch_1", password: "pw", mfa_code: "123456" });
    expect(await linkAccount(h.config, { challenge_id: "ch_1", password: "pw", mfa_code: "12 34<script>", cookies: linkCookie() })).toMatchObject({ ok: false, status: 400, mfaRequired: true });
    for (const code of ["MFA_SETUP_REQUIRED", "MFA_METHOD_UNSUPPORTED", "IDENTITY_ALREADY_BOUND"]) {
      const x = harness({ link: { status: 409, body: { success: false, error: { code } } } });
      const r = await linkAccount(x.config, { challenge_id: "ch_1", password: "pw", cookies: linkCookie() });
      expect(r).toMatchObject({ ok: false, status: 409 });
      expect(r.ok === false && r.mfaRequired).toBeFalsy();
    }
  });
});

describe("linking onto an unconfirmed account", () => {
  it("keeps the emailed-code challenge in an HttpOnly cookie and sends the typed code with it", async () => {
    const needs = harness({ link: { status: 403, body: { success: false, error: { code: "LOGIN_CHALLENGE_REQUIRED", message: JSON.stringify({ challenge_token: "tok-1", method: "email" }) } } } });
    const first = await linkAccount(needs.config, { challenge_id: "ch_1", password: "pw", cookies: linkCookie() });
    expect(first).toMatchObject({ ok: false, status: 401, mfaRequired: true });
    const cookieName = needs.config.prefix + "-link-code";
    expect(first.cookies).toEqual([{ name: cookieName, value: "tok-1", maxAge: 600 }]);
    expect(first.ok === false && first.error).toMatch(/6-digit code/);

    const h = harness();
    const done = await linkAccount(h.config, { challenge_id: "ch_1", password: "pw", mfa_code: "123456", cookies: linkCookie("ch_1", { [cookieName]: "tok-1" }) });
    expect(done.ok).toBe(true);
    expect(h.calls[0].body).toEqual({ challenge_id: "ch_1", password: "pw", challenge_token: "tok-1", challenge_code: "123456" });
    expect(done.cookies).toContainEqual({ name: cookieName, value: "", maxAge: 0 });
  });

  it("explains wrong, throttled and locked codes", async () => {
    const cookieName = (c: { prefix: string }) => c.prefix + "-link-code";
    for (const [code, status, mfa] of [["LOGIN_CHALLENGE_INVALID", 401, true], ["CHALLENGE_RATE_LIMITED", 429, true], ["LOGIN_CHALLENGE_LOCKED", 429, false]] as const) {
      const x = harness({ link: { status: 400, body: { success: false, error: { code } } } });
      const r = await linkAccount(x.config, { challenge_id: "ch_1", password: "pw", mfa_code: "123456", cookies: linkCookie("ch_1", { [cookieName(x.config)]: "tok-1" }) });
      expect(r).toMatchObject({ ok: false, status });
      expect(Boolean(r.ok === false && r.mfaRequired)).toBe(mfa);
    }
  });
});

describe("signOut and session", () => {
  it("revokes, clears every reader cookie, suppresses silent sign-in for a day and builds the end-session URL", async () => {
    const h = harness();
    const result = await signOut(h.config, { cookies: jar({ [names.session]: "new-token" }), extraCookies: [{ name: "__Host-paw-signed-out", value: "1", maxAge: 10 }] });
    expect(h.calls[0]).toMatchObject({ path: "/v1/auth/logout", body: { session_token: "new-token" }, token: "new-token" });
    expect(result.cookies.map((c) => [c.name, c.maxAge])).toEqual([
      [names.session, 0], [names.flow, 0], [names.newsletter, 0], [names.pending, 0], [names.ssoChecked, 0], [names.linkFlow, 0], [names.linkCode, 0],
      [names.signedOut, READER_SSO_SIGNED_OUT_SECONDS], ["__Host-paw-signed-out", 10],
    ]);
    const url = new URL(result.endSessionUrl);
    expect(url.origin + url.pathname).toBe("https://api.ledvery.com/end-session");
    expect(url.searchParams.get("client_id")).toBe("napsite-paper");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(`${ORIGIN}/account?signed_out=1`);
    expect(url.searchParams.get("state")).toBe(result.state);
    expect(h.events).toEqual([{ name: "reader_signed_out", properties: { method: "explicit" } }]);
    const quiet = harness({ fail: true });
    await expect(signOut(quiet.config, { cookies: jar({ [names.session]: "t" }) })).resolves.toMatchObject({ endSessionUrl: expect.stringContaining("end-session") });
  });
  it("summarises the display profile without the email and reports boot flags", async () => {
    const h = harness();
    expect(await sessionSummary(h.config, jar({}))).toEqual({ authenticated: false });
    expect(await sessionSummary(h.config, jar({ [names.session]: "new-token" }))).toEqual({ authenticated: true, full_name: "Alice Иванова", locale: "bg-BG", time_zone: "Europe/Sofia" });
    expect(h.calls.filter(call => call.path.startsWith("/v1/auth/me")).every(call => call.path === "/v1/auth/me?passive=true")).toBe(true);
    expect(readerSsoBootFlags(jar({ [names.session]: "x" }), names)).toEqual({ hasSession: true, suppressed: false });
    expect(readerSsoBootFlags(jar({ [names.ssoChecked]: "1" }), names)).toEqual({ hasSession: false, suppressed: true });
    expect(readerSsoBootFlags(jar({}), names)).toEqual({ hasSession: false, suppressed: false });
  });
  it("pending cookies expire and are bound to the key", () => {
    const cookie = sealPendingSession({ token: "t", expires: NOW + 1000, userId: "u", name: "N", mode: "interactive", method: "google", returnTo: "/x", subscribe: false }, KEY, NOW);
    expect(openPendingSession(cookie, KEY, NOW)).toMatchObject({ token: "t", userId: "u" });
    expect(openPendingSession(cookie, KEY, NOW + 600_001)).toBeNull();
    expect(openPendingSession(cookie, "other", NOW)).toBeNull();
  });
  it("exports a server-sourced events fragment with every event name", () => {
    expect(Object.keys(READER_SSO_EVENTS).sort()).toEqual(["reader_account_linked", "reader_signed_out", "reader_signin_completed", "reader_signin_failed", "reader_signin_started", "reader_sso_check"]);
    expect(Object.values(READER_SSO_EVENTS).every((d) => d.source === "server")).toBe(true);
  });
});

describe("silent flows never carry newsletter consent", () => {
  it("drops subscribe from a silent flow even when the sealed cookie claims it", async () => {
    const { sealReaderFlow: seal, openReaderFlow: open } = await import("./reader-sso");
    const key = "unit-test-key";
    const silent = seal({ state: "s", subscribe: true, returnTo: "/news", mode: "silent" }, key, 1000);
    expect(open(silent, key, 2000)?.subscribe).toBe(false);
    const interactive = seal({ state: "s", subscribe: true, returnTo: "/news", mode: "interactive" }, key, 1000);
    expect(open(interactive, key, 2000)?.subscribe).toBe(true);
    const legacy = seal({ state: "s", subscribe: true, returnTo: "/news" }, key, 1000);
    expect(open(legacy, key, 2000)?.subscribe).toBe(true);
  });
});

describe("sessionSummaryWithCookies", () => {
  it("clears a stale session cookie and leaves a valid one alone (review R5)", async () => {
    const h = harness();
    expect(await sessionSummaryWithCookies(h.config, jar({ [names.session]: "revoked-token-abcdef" }))).toEqual({
      summary: { authenticated: false },
      cookies: [{ name: names.session, value: "", maxAge: 0 }, { name: names.pending, value: "", maxAge: 0 }],
    });
    const ok = await sessionSummaryWithCookies(h.config, jar({ [names.session]: "new-token" }));
    expect(ok.summary.authenticated).toBe(true);
    expect(ok.cookies).toEqual([]);
    expect((await sessionSummaryWithCookies(h.config, jar({}))).cookies).toEqual([]);
  });
});

describe("upgrading established reader sessions", () => {
  const returning = { id: "alice", email_verified: true, full_name: "Пламен", sso_session_bound: false };
  it("allows one silent renewal for an authenticated session without its logout binding", async () => {
    const h = harness({ users: { "old-token": returning } });
    const result = await startSignIn(h.config, { mode: "silent", next: "/news/story", cookies: jar({ [names.session]: "old-token" }) });
    expect(result.ok).toBe(true);
    expect(h.calls.some(call => call.path.includes("prompt=none"))).toBe(true);
    expect(result.cookies.some(cookie => cookie.name === names.session && cookie.maxAge === 0)).toBe(false);
  });
  it("keeps a bound session and makes no unnecessary authorization hop", async () => {
    const h = harness({ users: { "old-token": { ...returning, sso_session_bound: true } } });
    expect(await startSignIn(h.config, { mode: "silent", cookies: jar({ [names.session]: "old-token" }) })).toMatchObject({ ok: false, reason: "session" });
    expect(h.calls).toHaveLength(1);
  });
  it("requests an upgrade without clearing the valid local account", async () => {
    const h = harness({ users: { "old-token": returning } });
    const result = await sessionSummaryWithCookies(h.config, jar({ [names.session]: "old-token" }));
    expect(result.summary).toMatchObject({ authenticated: true, full_name: "Пламен", session_upgrade_required: true });
    expect(result.cookies).toEqual([]);
  });
  it("retires the old local credential before installing its bound replacement", async () => {
    const h = harness({ users: { "old-token": returning, "new-token": { ...returning, sso_session_bound: true } } });
    const result = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.session]: "old-token", [names.flow]: flowCookie({ state: "st-1", mode: "silent", returnTo: "/news/story" }) }) });
    expect(result.kind).toBe("signed-in");
    expect(h.calls.at(-1)).toMatchObject({ path: "/v1/auth/logout", token: "old-token", body: { session_token: "old-token" } });
    expect(result.cookies.find(cookie => cookie.name === names.session)?.value).toBe("new-token");
  });
  it("does not install a replacement if retirement was not confirmed", async () => {
    const h = harness({ users: { "old-token": returning, "new-token": { ...returning, sso_session_bound: true } }, logout: { status: 500, body: { success: false } } });
    const result = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.session]: "old-token", [names.flow]: flowCookie({ state: "st-1", mode: "silent", returnTo: "/news/story" }) }) });
    expect(result.kind).not.toBe("signed-in");
    expect(result.cookies.some(cookie => cookie.name === names.session)).toBe(false);
  });
  it("refuses a newly issued session missing its binding", async () => {
    const h = harness({ users: { "new-token": returning } });
    const result = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.flow]: flowCookie({ state: "st-1" }) }) });
    expect(result.kind).not.toBe("signed-in");
    expect(result.cookies.some(cookie => cookie.name === names.session)).toBe(false);
  });
  it("an explicitly requested account conflict still opens the choice screen", async () => {
    const h = harness({ users: { "bob-token": { id: "bob", email_verified: true }, "new-token": { id: "alice", email_verified: true } } });
    const result = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.session]: "bob-token", [names.flow]: flowCookie({ state: "st-1", mode: "interactive" }) }) });
    expect(result).toMatchObject({ kind: "redirect", location: "/account?switch=1", outcome: "switch_offered" });
    expect(h.calls.some(call => call.path === "/v1/auth/logout")).toBe(false);
  });
});

it("reader profile bounds keep the last Unicode code point intact", async () => {
  const full_name = "A".repeat(149) + "😀你好";
  const h = harness({ users: { "new-token": { id: "reader", email_verified: true, full_name } } });
  const result = await sessionSummary(h.config, jar({ [names.session]: "new-token" }));
  expect(result).toMatchObject({ authenticated: true, full_name: "A".repeat(149) + "😀" });
});


it("retaining a legacy account suppresses renewal only for its validated credential", async () => {
  const legacy = { id: "bob", email_verified: true, full_name: "Bob", sso_session_bound: false };
  const h = harness({ users: { "bob-token": legacy, "other-token": legacy, "new-token": { id: "alice", email_verified: true, sso_session_bound: true } } });
  const conflict = await completeSignIn(h.config, { url: callbackUrl("code=c&state=st-1"), cookies: jar({ [names.session]: "bob-token", [names.flow]: flowCookie({ state: "st-1", mode: "silent" }) }) });
  expect(conflict).toMatchObject({ kind: "redirect", outcome: "switch_offered" });
  const pending = conflict.cookies.find(cookie => cookie.name === names.pending)!.value;
  const stay = await switchAccount(h.config, { choice: "stay", cookies: jar({ [names.session]: "bob-token", [names.pending]: pending }) });
  const preference = stay.cookies.find(cookie => cookie.name === names.ssoChecked)!.value;
  const retained = jar({ [names.session]: "bob-token", [names.ssoChecked]: preference });
  expect((await sessionSummary(h.config, retained))).not.toHaveProperty("session_upgrade_required");
  expect(await startSignIn(h.config, { mode: "silent", cookies: retained })).toMatchObject({ ok: false, reason: "session" });
  expect(readerSsoBootFlags(retained, names).suppressed).toBe(false);
  for (const token of [undefined, "revoked-token", "other-token"]) {
    const cookies = jar({ ...(token ? { [names.session]: token } : {}), [names.ssoChecked]: preference });
    expect((await startSignIn(h.config, { mode: "silent", cookies })).ok).toBe(true);
  }
});
