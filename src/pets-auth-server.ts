/** Reuses the publications' ScaleMule → Ledvery → ScaleMule flow, with host-only cookies. */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { petPrivateHeaders, petRequest, type PetScope } from "./pets-server";
export const PAW_SESSION_COOKIE = "__Host-paw-reader";
const FLOW = "__Host-paw-signin";
const attrs = "Path=/; HttpOnly; Secure; SameSite=Lax";
export function pawCookie(
  request: Request,
  name = PAW_SESSION_COOKIE,
): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + "="))
    ?.slice(name.length + 1);
}
function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function returnPath(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    value.length <= 500 &&
    !/[\\\r\n]/.test(value)
    ? value
    : "/account";
}
export function sealPawFlow(
  state: string,
  next: string,
  key: string,
  now = Date.now(),
) {
  const payload = Buffer.from(
    JSON.stringify({
      state: digest(state),
      next: returnPath(next),
      expires: now + 600000,
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", key)
      .update("paw-signin:v1:" + payload)
      .digest("hex")
  );
}
export function openPawFlow(
  raw: string | undefined,
  state: string | null,
  key: string,
  now = Date.now(),
): string | null {
  if (!key || !raw || raw.length > 2048 || !state || state.length > 2048)
    return null;
  const [payload, signature, extra] = raw.split(".");
  if (!payload || extra || !/^[a-f0-9]{64}$/.test(signature || "")) return null;
  if (
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      createHmac("sha256", key)
        .update("paw-signin:v1:" + payload)
        .digest(),
    )
  )
    return null;
  try {
    const flow = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      !Number.isFinite(flow.expires) ||
      flow.expires <= now ||
      !/^[a-f0-9]{64}$/.test(flow.state) ||
      !timingSafeEqual(
        Buffer.from(flow.state, "hex"),
        Buffer.from(digest(state), "hex"),
      )
    )
      return null;
    return returnPath(flow.next);
  } catch {
    return null;
  }
}
export function createPawAuthHandler(options: {
  resolve(request: Request): Promise<PetScope>;
  enabled: boolean;
  issuerOrigin: string;
  fetch?: typeof fetch;
}) {
  return async (request: Request, action: string): Promise<Response> => {
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: petPrivateHeaders });
    try {
      if (!options.enabled)
        return json({ error: "Community sign-in is not available yet." }, 503);
      const scope = await options.resolve(request),
        origin = new URL(scope.origin).origin;
      if (!origin.startsWith("https://") || !scope.apiKey)
        return json({ error: "Sign-in is not configured." }, 503);
      const redirect = (path: string) =>
        new Response(null, {
          status: 303,
          headers: {
            ...petPrivateHeaders,
            location: origin + returnPath(path),
          },
        });
      if (action === "start" && request.method === "POST") {
        if (request.headers.get("origin") !== origin)
          return json({ error: "Sign in from this website." }, 403);
        const callback = origin + "/api/paw-auth/callback";
        const result = await petRequest<{ url: string; state: string }>(
          scope,
          "/v1/auth/oauth/ledvery/authorize?" +
            new URLSearchParams({ redirect_uri: callback }),
          {},
          options.fetch,
        );
        const url = new URL(result.url);
        if (
          url.origin !== new URL(options.issuerOrigin).origin ||
          url.pathname !== "/authorize" ||
          url.username ||
          url.password ||
          url.searchParams.get("state") !== result.state ||
          url.searchParams.get("redirect_uri") !== callback ||
          url.searchParams.get("code_challenge_method") !== "S256" ||
          !url.searchParams.get("code_challenge")
        )
          throw new Error("Invalid authorization response");
        const response = json({ url: url.href });
        response.headers.append(
          "set-cookie",
          `${FLOW}=${sealPawFlow(result.state, returnPath(new URL(request.url).searchParams.get("next")), scope.apiKey)}; ${attrs}; Max-Age=600`,
        );
        return response;
      }
      if (action === "callback" && request.method === "GET") {
        const query = new URL(request.url).searchParams,
          code = query.get("code"),
          state = query.get("state");
        const next = openPawFlow(pawCookie(request, FLOW), state, scope.apiKey);
        const response = redirect(next || "/account?signin=retry");
        response.headers.append("set-cookie", `${FLOW}=; ${attrs}; Max-Age=0`);
        if (!next || !code || code.length > 4096 || query.has("error"))
          return response;
        try {
          // Auth owns PKCE, nonce, signature, issuer/audience and one-use exchange. No local users database.
          const session = await petRequest<{
            session_token: string;
            expires_at: string;
          }>(
            scope,
            "/v1/auth/oauth/ledvery/callback?" +
              new URLSearchParams({ code, state: state! }),
            {},
            options.fetch,
          );
          const expiry = Date.parse(session.expires_at);
          if (
            !session.session_token ||
            !/^[A-Za-z0-9._~-]{1,2048}$/.test(session.session_token) ||
            !Number.isFinite(expiry) ||
            expiry <= Date.now()
          )
            throw new Error("Invalid session");
          const me = await petRequest<{ id: string; email_verified: boolean }>(
            { ...scope, accessToken: session.session_token },
            "/v1/auth/me",
            {},
            options.fetch,
          );
          if (!me.id || !me.email_verified)
            throw new Error("Verified reader required");
          response.headers.append(
            "set-cookie",
            `${PAW_SESSION_COOKIE}=${session.session_token}; ${attrs}; Expires=${new Date(expiry).toUTCString()}`,
          );
          return response;
        } catch {
          response.headers.set("location", origin + "/account?signin=retry");
          return response;
        }
      }
      if (action === "session" && request.method === "GET") {
        if (!scope.accessToken) return json({ authenticated: false });
        const me = await petRequest<{
          id: string;
          email_verified: boolean;
          full_name?: string;
        }>(scope, "/v1/auth/me", {}, options.fetch);
        return json({
          authenticated: Boolean(me.id && me.email_verified),
          name: me.full_name || "Neighbor",
        });
      }
      if (action === "logout" && request.method === "POST") {
        if (request.headers.get("origin") !== origin)
          return json({ error: "Continue from this website." }, 403);
        if (scope.accessToken)
          await petRequest(
            scope,
            "/v1/auth/logout",
            { method: "POST", body: { session_token: scope.accessToken } },
            options.fetch,
          );
        const response = json({ authenticated: false });
        response.headers.append(
          "set-cookie",
          `${PAW_SESSION_COOKIE}=; ${attrs}; Max-Age=0`,
        );
        return response;
      }
      return json({ error: "Route not found" }, 404);
    } catch {
      return json(
        { error: "Sign-in is temporarily unavailable. Please try again." },
        503,
      );
    }
  };
}
