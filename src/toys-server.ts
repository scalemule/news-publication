/** Server-only ToyRound proxy. The host publication keeps its API key and reader cookie. */
import { buildClientContextHeaders } from "@scalemule/sdk";
import { petRequest, petPrivateHeaders, PetRequestError, type PetScope } from "./pets-server";
import { TOY_SLUG, TOY_UUID } from "./toys";
export type ToyScope = PetScope;
export const toyPrivateHeaders = petPrivateHeaders;
export const toyRequest = petRequest;
export { PetRequestError as ToyRequestError };
export const TOY_COMMUNITY_COOKIE = "__Host-toy-community";
export function toyCollectionRequest<T>(scope: ToyScope, suffix = "") {
  return petRequest<T>(scope, `/v1/knowledge/community-maps/collections/${scope.collectionSlug}/toys${suffix}`);
}
async function bounded(request: Request, max: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > max) throw new PetRequestError(413, "The submission is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new PetRequestError(413, "The submission is too large.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts);
}
function gatewayOrigin(scope: ToyScope) {
  const url = new URL(scope.gatewayUrl);
  if (
    !scope.apiKey ||
    !TOY_SLUG.test(scope.collectionSlug) ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
  )
    throw new PetRequestError(503, "The toy exchange is not available yet.");
  return url.origin;
}
type Route = { method: string; endpoint: string; auth: boolean; write: boolean; kind?: "upload" | "media" | "phone" };
const LIST_FILTERS = ["area_id", "category", "age_range", "condition", "exchange_type", "availability", "q", "owner", "after", "limit"];
/** Explicit allowlist: management, moderation and arbitrary paths never reach the platform. */
function route(method: string, path: string[], url: URL): Route | null {
  const [a, b, c, d] = path;
  const id = (v?: string) => Boolean(v && TOY_UUID.test(v));
  const base = "/toys";
  if (method === "GET") {
    if (!path.length) {
      const q = new URLSearchParams();
      for (const key of LIST_FILTERS) {
        const value = url.searchParams.get(key);
        if (value) q.set(key, value);
      }
      return { method, endpoint: base + (q.size ? "?" + q : ""), auth: false, write: false };
    }
    if (path.length === 1 && a === "policy") return { method, endpoint: base + "/policy", auth: false, write: false };
    if (path.length === 1 && a === "locations") {
      const area = url.searchParams.get("area_id");
      return { method, endpoint: base + "/locations" + (area && TOY_UUID.test(area) ? "?area_id=" + area : ""), auth: false, write: false };
    }
    if (path.length === 2 && a === "profiles" && id(b)) return { method, endpoint: `${base}/profiles/${b}`, auth: false, write: false };
    if (path.length === 3 && a === "profiles" && id(b) && c === "block") return { method, endpoint: `${base}/profiles/${b}/block`, auth: true, write: false };
    if (path.length === 1 && a === "member") return { method, endpoint: base + "/member", auth: true, write: false };
    if (path.length === 1 && a === "mine") {
      const after = url.searchParams.get("after");
      return { method, endpoint: base + "/mine" + (after && TOY_UUID.test(after) ? "?after=" + after : ""), auth: true, write: false };
    }
    if (path.length === 2 && a === "mine" && id(b)) return { method, endpoint: `${base}/mine/${b}`, auth: true, write: false };
    if (path.length === 1 && a === "requests") return { method, endpoint: base + "/requests", auth: true, write: false };
    if (path.length === 2 && a === "requests" && id(b)) return { method, endpoint: `${base}/requests/${b}`, auth: true, write: false };
    if (path.length === 1 && id(a)) return { method, endpoint: `${base}/${a}`, auth: false, write: false };
    if (path.length === 3 && id(a) && b === "media" && id(c)) return { method, endpoint: `${base}/${a}/media/${c}`, auth: false, write: false, kind: "media" };
    if (path.length === 4 && a === "submissions" && id(b) && c === "media" && id(d)) return { method, endpoint: `/submissions/${b}/media/${d}`, auth: true, write: false, kind: "media" };
    return null;
  }
  if (method === "POST") {
    if (!path.length) return { method, endpoint: base, auth: true, write: true };
    if (path.length === 1 && a === "phone") return { method, endpoint: "", auth: true, write: true, kind: "phone" };
    if (path.length === 3 && a === "submissions" && id(b) && c === "media") return { method, endpoint: `/submissions/${b}/media`, auth: true, write: true, kind: "upload" };
    if (path.length === 2 && a === "locations" && b === "suggestions") return { method, endpoint: base + "/locations/suggestions", auth: true, write: true };
    if (path.length === 3 && a === "profiles" && id(b) && c === "reports") return { method, endpoint: `${base}/profiles/${b}/reports`, auth: true, write: true };
    if (path.length === 2 && id(a) && ["requests", "reports"].includes(b)) return { method, endpoint: `${base}/${a}/${b}`, auth: true, write: true };
    if (a === "requests" && id(b)) {
      const action = path.slice(2).join("/");
      if (["decision", "cancel", "complete", "messages", "appointment", "appointment/confirm", "appointment/cancel", "feedback", "reports"].includes(action))
        return { method, endpoint: `${base}/requests/${b}/${action}`, auth: true, write: true };
    }
    return null;
  }
  if (method === "PUT") {
    if (path.length === 1 && a === "member") return { method, endpoint: base + "/member", auth: true, write: true };
    if (path.length === 3 && a === "profiles" && id(b) && c === "block") return { method, endpoint: `${base}/profiles/${b}/block`, auth: true, write: true };
    if (path.length === 1 && id(a)) return { method, endpoint: `${base}/${a}`, auth: true, write: true };
    return null;
  }
  if (method === "DELETE") {
    if (path.length === 1 && a === "member") return { method, endpoint: base + "/member", auth: true, write: true };
    if (path.length === 1 && id(a)) return { method, endpoint: `${base}/${a}`, auth: true, write: true };
    return null;
  }
  return null;
}
/** Phone verification reuses Auth's OTP flow with the reader's own session. The
 * publication never sees the code logic; Auth binds the verified phone to the user. */
async function phone(scope: ToyScope, body: { action?: string; phone?: string; code?: string }, fetcher: typeof fetch) {
  const number = typeof body.phone === "string" ? body.phone.replace(/[^\d+]/g, "") : "";
  if (!/^\+?\d{10,15}$/.test(number)) throw new PetRequestError(400, "Enter a mobile number with country code, like +1 925 555 0100.");
  if (body.action === "send") {
    await petRequest(scope, "/v1/auth/phone/send-otp", { method: "POST", body: { phone: number, purpose: "verify_phone" } }, fetcher);
    return { sent: true };
  }
  if (body.action === "verify") {
    if (!/^\d{4,8}$/.test(body.code || "")) throw new PetRequestError(400, "Enter the code from the text message.");
    await petRequest(scope, "/v1/auth/phone/verify-otp", { method: "POST", body: { phone: number, code: body.code } }, fetcher);
    return { verified: true };
  }
  throw new PetRequestError(400, "Choose send or verify.");
}
export function createPublicationToysHandler(options: { resolve(request: Request): Promise<ToyScope>; fetch?: typeof fetch }) {
  const fetcher = options.fetch || fetch;
  return async function handler(request: Request, path: string[]): Promise<Response> {
    const json = (data: unknown, status = 200) => Response.json(data, { status, headers: petPrivateHeaders });
    try {
      const scope = await options.resolve(request);
      const gateway = gatewayOrigin(scope);
      const url = new URL(request.url);
      if (path.some((segment) => segment.includes("..") || /[\\\r\n]/.test(segment))) return json({ error: "Route not found" }, 404);
      const matched = route(request.method, path, url);
      if (!matched) return json({ error: "Route not found" }, 404);
      if (matched.write && (!scope.writesEnabled || request.headers.get("origin") !== new URL(scope.origin).origin))
        return json({ error: "Continue from the exchange's official website." }, 403);
      if (matched.auth && !scope.accessToken) return json({ error: "Sign in to continue." }, 401);
      const root = `/v1/knowledge/community-maps/collections/${scope.collectionSlug}`;
      if (matched.kind === "phone") {
        let body: { action?: string; phone?: string; code?: string };
        try {
          body = JSON.parse(new TextDecoder().decode(await bounded(request, 2048)));
        } catch (error) {
          if (error instanceof PetRequestError) throw error;
          throw new PetRequestError(400, "Check the phone details.");
        }
        return json({ data: await phone(scope, body, fetcher) });
      }
      let endpoint = root + matched.endpoint;
      if (matched.kind === "media" || matched.kind === "upload") {
        const sourceQuery = url.searchParams;
        const imageQuery = new URLSearchParams();
        if (["640", "1280"].includes(sourceQuery.get("width") || "")) imageQuery.set("width", sourceQuery.get("width")!);
        if (["jpeg", "webp"].includes(sourceQuery.get("format") || "")) imageQuery.set("format", sourceQuery.get("format")!);
        if (matched.kind === "media" && imageQuery.size) endpoint += "?" + imageQuery;
        let body: Uint8Array | undefined;
        const type = request.headers.get("content-type") || "";
        if (matched.kind === "upload") {
          if (!type.startsWith("multipart/form-data;")) throw new PetRequestError(415, "Choose a photograph.");
          body = await bounded(request, 9 * 1024 * 1024);
        }
        const response = await fetcher(gateway + endpoint, {
          method: request.method,
          headers: {
            ...buildClientContextHeaders(scope.clientContext),
            "x-api-key": scope.apiKey,
            ...(scope.accessToken ? { authorization: `Bearer ${scope.accessToken}` } : {}),
            ...(matched.kind === "upload" ? { "content-type": type } : {}),
          },
          body: body as BodyInit | undefined,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(45000),
        });
        if (!response.ok) {
          await response.body?.cancel();
          return json({ error: "The photograph is unavailable. Check its size and try again." }, response.status >= 500 ? 503 : response.status);
        }
        if (matched.kind === "upload") return json(await response.json());
        const imageType = response.headers.get("content-type")?.split(";")[0] || "";
        if (!["image/png", "image/jpeg", "image/webp"].includes(imageType)) {
          await response.body?.cancel();
          return json({ error: "Photograph unavailable" }, 404);
        }
        return new Response(response.body, { headers: { ...petPrivateHeaders, "content-type": imageType } });
      }
      let body: unknown;
      if (matched.write) {
        if (!request.headers.get("content-type")?.startsWith("application/json")) throw new PetRequestError(415, "Use the ToyRound form.");
        try {
          body = JSON.parse(new TextDecoder().decode(await bounded(request, 32768)));
        } catch (error) {
          if (error instanceof PetRequestError) throw error;
          throw new PetRequestError(400, "Check the form fields.");
        }
      }
      return json({ data: await petRequest(scope, endpoint, { method: request.method, body }, fetcher) });
    } catch (error) {
      const status = error instanceof PetRequestError ? error.status : 503;
      const message = error instanceof PetRequestError ? error.message : "ToyRound is temporarily unavailable.";
      return json({ error: message, code: status === 403 && message.includes("_REQUIRED") ? message : undefined }, status);
    }
  };
}
/** Remember the reader's chosen community on this device (host-only cookie, no location). */
export function createToyCommunityHandler(options: { resolve(request: Request): Promise<ToyScope>; fetch?: typeof fetch }) {
  return async function handler(request: Request): Promise<Response> {
    try {
      const scope = await options.resolve(request);
      if (request.method !== "POST" || request.headers.get("origin") !== new URL(scope.origin).origin) return new Response(null, { status: 403 });
      const { area_id } = JSON.parse(new TextDecoder().decode(await bounded(request, 256)));
      if (area_id !== null && !TOY_UUID.test(String(area_id))) return new Response(null, { status: 400 });
      if (area_id !== null) {
        const policy = await petRequest<{ all_areas: { id: string }[] }>({ ...scope, accessToken: undefined }, `/v1/knowledge/community-maps/collections/${scope.collectionSlug}/toys/policy`, {}, options.fetch || fetch);
        if (!policy.all_areas.some((a) => a.id === area_id)) return new Response(null, { status: 400 });
      }
      return Response.json({ saved: true }, { headers: { ...petPrivateHeaders, "set-cookie": `${TOY_COMMUNITY_COOKIE}=${area_id || "all"}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000` } });
    } catch {
      return Response.json({ error: "Community preference unavailable" }, { status: 503, headers: petPrivateHeaders });
    }
  };
}
