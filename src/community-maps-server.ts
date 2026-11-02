/** Server-only publication proxy. Import this subpath only in server modules. */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  ScaleMule,
  buildClientContextHeaders,
  type ClientContext,
  type CommunityMapFeatureQuery,
  type RequestOptions,
} from "@scalemule/sdk";
export interface PublicationCommunityMapScope {
  apiKey: string;
  gatewayUrl: string;
  origin: string;
  clientContext: ClientContext;
  accessToken?: string;
}
export interface PublicationCommunityMapServerOptions {
  resolve: (request: Request) => Promise<PublicationCommunityMapScope>;
}
const ROOT = "/v1/knowledge/community-maps";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOKIE = "sm_community_reader";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
function identity(request: Request, key: string, origin: string) {
  const sign = (id: string) =>
    createHmac("sha256", key)
      .update("community-maps-reader:" + id)
      .digest("base64url");
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (raw) {
    const [id, signature] = raw.split(".");
    if (
      id &&
      signature &&
      UUID.test(id) &&
      /^[A-Za-z0-9_-]{43}$/.test(signature)
    ) {
      const expected = sign(id);
      if (
        expected.length === signature.length &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        return { id, cookie: null };
    }
  }
  const id = randomUUID();
  return {
    id,
    cookie: `${COOKIE}=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(origin).protocol === "https:" ? "; Secure" : ""}`,
  };
}
async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new ProxyProblem(413, "The submission is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max) {
        await reader.cancel();
        throw new ProxyProblem(413, "The submission is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
class ProxyProblem extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
const DIAGNOSTIC_KINDS = new Set([
  "upload_failed",
  "submit_failed",
  "storage_degraded",
  "load_failed",
]);
const clip = (v: unknown, max: number) =>
  typeof v === "string" && v ? Array.from(v).slice(0, max).join("") : null;
const whole = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
    ? v
    : null;
/** A browser's own report of a failed send; only known, bounded fields pass. */
function browserDiagnostic(body: unknown, host: string) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const v = body as Record<string, unknown>;
  if (typeof v.kind !== "string" || !DIAGNOSTIC_KINDS.has(v.kind)) return null;
  return {
    kind: v.kind,
    source: "browser",
    stage: clip(v.stage, 32),
    status: whole(v.status, 0, 599),
    code: clip(v.code, 64),
    reference: clip(v.reference, 80),
    attempts: whole(v.attempts, 0, 20),
    file_type: clip(v.file_type, 100),
    file_size: whole(v.file_size, 0, 1024 * 1024 * 1024),
    browser: clip(v.browser, 64),
    storage:
      v.storage === "memory" || v.storage === "indexeddb" ? v.storage : null,
    online: typeof v.online === "boolean" ? v.online : null,
    host: clip(host, 253),
    submission_id:
      typeof v.submission_id === "string" && UUID.test(v.submission_id)
        ? v.submission_id
        : null,
  };
}
/**
 * Bounds for reports, per process: a signed reader may send a few; readers
 * without a cookie yet (their very first request failed) share a small budget;
 * proxy-side forwards are throttled per slug, route and status during an outage.
 */
const budgets = new Map<string, { count: number; until: number }>();
function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (budgets.size > 5000)
    for (const [k, v] of budgets) if (v.until <= now) budgets.delete(k);
  const entry = budgets.get(key);
  if (!entry || entry.until <= now) {
    budgets.set(key, { count: 1, until: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
/** Durable record + editor alert in the Knowledge service; best effort, never blocks a reader. */
async function sendDiagnostic(
  gatewayOrigin: string,
  apiKey: string,
  slug: string,
  event: Record<string, unknown>,
) {
  try {
    const response = await fetch(
      `${gatewayOrigin}${ROOT}/collections/${slug}/diagnostics`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(event),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(3000),
      },
    );
    await response.body?.cancel();
    if (!response.ok)
      console.error(
        JSON.stringify({
          event: "community_maps_diagnostic_rejected",
          slug,
          status: response.status,
        }),
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "community_maps_diagnostic_unsent",
        slug,
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
  }
}
/** Only public collection routes are accepted. The URL never selects tenant credentials. */
export function createPublicationCommunityMapsHandler(
  options: PublicationCommunityMapServerOptions,
) {
  return async (request: Request, path: string[]): Promise<Response> => {
    const started = Date.now();
    // What a failure log needs; never reader content, contact details or coordinates.
    const trace: {
      route: string;
      slug?: string;
      bytes?: number;
      fileType?: string;
      upstreamStatus?: number;
      upstreamCode?: string;
      upstreamMessage?: string;
      reference?: string;
    } = { route: "unknown" };
    let scope: PublicationCommunityMapScope | undefined;
    const finish = (response: Response, error?: unknown) => {
      if (request.method === "GET" && response.status < 500) return response;
      const failed = response.status >= 400;
      const record = {
        event: failed ? "community_maps_proxy_error" : "community_maps_proxy",
        route: trace.route,
        slug: trace.slug,
        method: request.method,
        status: response.status,
        upstream_status: trace.upstreamStatus,
        upstream_code: trace.upstreamCode,
        upstream_message: trace.upstreamMessage,
        reference: trace.reference,
        error:
          error instanceof Error
            ? `${error.name}: ${Array.from(error.message).slice(0, 200).join("")}`
            : undefined,
        bytes: trace.bytes,
        file_type: trace.fileType,
        duration_ms: Date.now() - started,
      };
      (response.status >= 500
        ? console.error
        : failed
          ? console.warn
          : console.info)(JSON.stringify(record));
      if (
        response.status >= 500 &&
        request.method !== "GET" &&
        scope?.apiKey &&
        trace.slug &&
        allow(
          `forward:${trace.slug}:${trace.route}:${response.status}`,
          1,
          60_000,
        )
      )
        void sendDiagnostic(
          new URL(scope.gatewayUrl).origin,
          scope.apiKey,
          trace.slug,
          {
            kind: "proxy_error",
            source: "proxy",
            stage: trace.route,
            status: response.status,
            code: trace.upstreamCode ?? null,
            reference: trace.reference ?? null,
            file_type: trace.fileType ?? null,
            file_size: trace.bytes ?? null,
            host: clip(new URL(scope.origin).host, 253),
            message: clip(record.error ?? trace.upstreamMessage, 300),
          },
        );
      return response;
    };
    const problem = (status: number, message: string, retryable: boolean) => {
      trace.reference ??= `cm_${randomUUID().slice(0, 8)}`;
      return json(
        { error: { message, retryable, reference: trace.reference } },
        status,
      );
    };
    try {
      if (
        path[0] !== "collections" ||
        !path[1] ||
        !/^[a-z0-9-]{1,191}$/.test(path[1])
      )
        return json({ error: { message: "Guide not found" } }, 404);
      const slug = path[1];
      trace.slug = slug;
      const rest = path.slice(2);
      const method = request.method;
      const discussion = rest.length === 1 && rest[0] === "comments";
      const voting =
        rest.length === 3 &&
        rest[0] === "features" &&
        UUID.test(rest[1]) &&
        rest[2] === "vote";
      const params = new URL(request.url).searchParams;
      const featureId = params.get("feature_id") || undefined;
      if (discussion && featureId && !UUID.test(featureId))
        return json({ error: { message: "Invalid place" } }, 400);
      const ownList = rest.length === 1 && rest[0] === "submissions";
      const ownUpdate =
        method === "POST" &&
        rest.length === 2 &&
        rest[0] === "submissions" &&
        UUID.test(rest[1]);
      const ownMedia =
        rest.length === 4 &&
        rest[0] === "submissions" &&
        UUID.test(rest[1]) &&
        rest[2] === "media" &&
        UUID.test(rest[3]);
      const read =
        method === "GET" &&
        (ownList ||
          ownMedia ||
          discussion ||
          voting ||
          rest.length === 0 ||
          (rest[0] === "features" &&
            (rest.length === 1 || (rest.length === 2 && UUID.test(rest[1])))) ||
          (rest[0] === "media" && rest.length === 2 && UUID.test(rest[1])));
      const upload =
        method === "POST" &&
        rest.length === 3 &&
        rest[0] === "submissions" &&
        UUID.test(rest[1]) &&
        rest[2] === "media";
      const submission =
        method === "POST" && rest.length === 1 && rest[0] === "submissions";
      const action =
        method === "POST" &&
        rest.length === 3 &&
        rest[0] === "features" &&
        UUID.test(rest[1]) &&
        ["reactions", "reports"].includes(rest[2]);
      const engagementWrite = method === "POST" && (discussion || voting);
      const diagnostics =
        method === "POST" && rest.length === 1 && rest[0] === "diagnostics";
      trace.route = upload
        ? "upload"
        : submission
          ? "submit"
          : ownUpdate
            ? "update"
            : diagnostics
              ? "diagnostics"
              : action
                ? rest[2]
                : engagementWrite
                  ? discussion
                    ? "comment"
                    : "vote"
                  : "read";
      if (
        !read &&
        !upload &&
        !submission &&
        !ownUpdate &&
        !action &&
        !engagementWrite &&
        !diagnostics
      )
        return json({ error: { message: "Route not found" } }, 404);
      scope = await options.resolve(request);
      if (
        method !== "GET" &&
        request.headers.get("origin") !== new URL(scope.origin).origin
      )
        return finish(
          problem(403, "Submit from this publication’s website.", false),
        );
      const gateway = new URL(scope.gatewayUrl);
      if (
        gateway.protocol !== "https:" &&
        !(
          gateway.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(gateway.hostname)
        )
      )
        throw new ProxyProblem(503, "The guide is unavailable.");
      if (!scope.apiKey)
        throw new ProxyProblem(503, "The guide is unavailable.");
      if (diagnostics) {
        let body: unknown;
        try {
          body = JSON.parse(
            new TextDecoder().decode(await boundedBody(request, 4096)),
          );
        } catch (e) {
          if (e instanceof ProxyProblem) throw e;
          throw new ProxyProblem(400, "Invalid report.");
        }
        const event = browserDiagnostic(body, new URL(scope.origin).host);
        if (!event) throw new ProxyProblem(400, "Invalid report.");
        const reader = identity(request, scope.apiKey, scope.origin);
        if (
          !(reader.cookie
            ? allow(`anonymous:${slug}`, 20, 60_000)
            : allow(`reader:${reader.id}`, 10, 600_000))
        )
          return json({ data: { received: false } }, 202);
        console.warn(
          JSON.stringify({
            event: "community_maps_reader_problem",
            slug,
            ...event,
          }),
        );
        await sendDiagnostic(gateway.origin, scope.apiKey, slug, event);
        return json({ data: { received: true } }, 202);
      }
      const reader = identity(request, scope.apiKey, scope.origin);
      const clientContext = { ...scope.clientContext, anonymousId: reader.id };
      const sdk = new ScaleMule({
        apiKey: scope.apiKey,
        baseUrl: scope.gatewayUrl,
      });
      const callOptions: RequestOptions = {
        clientContext,
        headers: scope.accessToken
          ? { authorization: `Bearer ${scope.accessToken}` }
          : {},
      };
      let response: Response;
      if (read && (rest[0] === "media" || ownMedia)) {
        const upstream = await fetch(
          `${gateway.origin}${ROOT}/collections/${slug}/${ownMedia ? `submissions/${rest[1]}/media/${rest[3]}` : `media/${rest[1]}`}`,
          {
            headers: {
              ...buildClientContextHeaders(clientContext),
              "x-api-key": scope.apiKey,
              ...callOptions.headers,
              ...(request.headers.has("range")
                ? { range: request.headers.get("range")! }
                : {}),
            },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(30000),
          },
        );
        const contentType =
          upstream.headers.get("content-type")?.split(";")[0] || "";
        const allowed = [
          "image/png",
          "video/mp4",
          "video/webm",
          "audio/mpeg",
          "audio/mp4",
          "audio/ogg",
          "audio/wav",
        ].includes(contentType);
        const mediaHeaders = new Headers({
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        });
        for (const key of [
          "content-range",
          "accept-ranges",
          "content-length",
        ]) {
          const value = upstream.headers.get(key);
          if (value) mediaHeaders.set(key, value);
        }
        if ((upstream.ok || upstream.status === 416) && allowed) {
          mediaHeaders.set("content-type", contentType);
          response = new Response(upstream.body, {
            status: upstream.status,
            headers: mediaHeaders,
          });
        } else {
          await upstream.body?.cancel();
          response = json(
            { error: { message: "Media unavailable" } },
            upstream.ok || upstream.status >= 500 ? 503 : upstream.status,
          );
        }
      } else {
        let result;
        if (read) {
          if (ownList) {
            const after = params.get("after") || undefined;
            if (after && !UUID.test(after))
              throw new ProxyProblem(400, "Invalid submission cursor.");
            result = await sdk.communityMaps.listOwnSubmissions(
              slug,
              after,
              callOptions,
            );
          } else if (discussion)
            result = await sdk.communityMaps.listComments(
              slug,
              {
                feature_id: featureId,
                page: Math.min(
                  10000,
                  Math.max(1, Number(params.get("page")) || 1),
                ),
              },
              callOptions,
            );
          else if (voting)
            result = await sdk.communityMaps.getVote(
              slug,
              rest[1],
              callOptions,
            );
          else if (!rest.length)
            result = await sdk.communityMaps.getCollection(slug, callOptions);
          else if (rest.length === 2)
            result = await sdk.communityMaps.getFeature(
              slug,
              rest[1],
              callOptions,
            );
          else {
            const query: Record<string, string | number> = {};
            const params = new URL(request.url).searchParams;
            for (const key of [
              "after",
              "area_id",
              "category",
              "geometry_type",
              "active_at",
              "bbox",
            ]) {
              const value = params.get(key);
              if (value) query[key] = value;
            }
            const limit = params.get("limit");
            if (limit)
              query.limit = Math.min(200, Math.max(1, Number(limit) || 50));
            const filters: CommunityMapFeatureQuery = { ...query };
            for (const key of ["featured", "verified"] as const) {
              const value = params.get(key);
              if (value === "true" || value === "false")
                filters[key] = value === "true";
            }
            result = await sdk.communityMaps.listFeatures(
              slug,
              filters,
              callOptions,
            );
          }
        } else if (upload) {
          const contentType = request.headers.get("content-type") || "";
          if (!contentType.startsWith("multipart/form-data;"))
            throw new ProxyProblem(415, "Choose a photo, video or audio file.");
          let bytes: Uint8Array;
          let form: FormData;
          try {
            bytes = await boundedBody(request, 26 * 1024 * 1024);
            trace.bytes = bytes.length;
            form = await new Response(bytes as BodyInit, {
              headers: { "content-type": contentType },
            }).formData();
          } catch (e) {
            if (e instanceof ProxyProblem) throw e;
            // A connection that drops mid-upload leaves a cut-off body.
            trace.upstreamMessage =
              e instanceof Error
                ? `${e.name}: ${e.message}`
                : "unreadable body";
            throw new ProxyProblem(
              400,
              "The upload was interrupted before it finished. Please send it again.",
              true,
            );
          }
          const file = form.get("file");
          if (!(file instanceof Blob))
            throw new ProxyProblem(400, "Media is required.");
          trace.fileType = file.type || "unknown";
          result = await sdk.communityMaps.uploadMedia(
            slug,
            rest[1],
            file,
            {
              caption: String(form.get("caption") || ""),
              attribution: String(form.get("attribution") || ""),
              rights_confirmed: form.get("rights_confirmed") === "true",
              consent_version: String(form.get("consent_version") || ""),
              ...(form.has("idempotency_key")
                ? { idempotency_key: String(form.get("idempotency_key")) }
                : {}),
              ...(form.has("device_position")
                ? {
                    device_position: devicePosition(
                      form.get("device_position"),
                    ),
                  }
                : {}),
            },
            callOptions,
          );
        } else {
          if (
            !request.headers.get("content-type")?.startsWith("application/json")
          )
            throw new ProxyProblem(415, "Use the community submission form.");
          let body;
          try {
            body = JSON.parse(
              new TextDecoder().decode(await boundedBody(request, 65536)),
            );
          } catch (e) {
            if (e instanceof ProxyProblem) throw e;
            throw new ProxyProblem(400, "Invalid submission.");
          }
          if (!body || typeof body !== "object" || Array.isArray(body))
            throw new ProxyProblem(400, "Invalid submission.");
          if (discussion)
            result = await sdk.communityMaps.createComment(
              slug,
              body,
              featureId,
              callOptions,
            );
          else if (voting)
            result = await sdk.communityMaps.vote(
              slug,
              rest[1],
              body.value,
              callOptions,
            );
          else if (ownUpdate)
            result = await sdk.communityMaps.updateOwnSubmission(
              slug,
              rest[1],
              body,
              callOptions,
            );
          else if (submission)
            result = await sdk.communityMaps.createSubmission(
              slug,
              body,
              callOptions,
            );
          else if (rest[2] === "reactions")
            result = await sdk.communityMaps.react(
              slug,
              rest[1],
              body.reaction,
              body.active !== false,
              callOptions,
            );
          else
            result = await sdk.communityMaps.report(
              slug,
              rest[1],
              body,
              callOptions,
            );
        }
        if (result.error) {
          const error = result.error as {
            status?: number;
            code?: string;
            message?: string;
          };
          // The SDK reports a transport failure (no HTTP answer) as status 0.
          const upstream =
            typeof error.status === "number" ? error.status : 400;
          const status = upstream === 0 ? 502 : upstream;
          trace.upstreamStatus = upstream;
          trace.upstreamCode = error.code;
          trace.upstreamMessage = clip(error.message, 200) ?? undefined;
          response =
            status >= 500
              ? problem(
                  status,
                  "The guide is temporarily unavailable. Please try again.",
                  true,
                )
              : problem(
                  status,
                  error.message || "Request failed.",
                  RETRYABLE.has(status),
                );
        } else response = json({ data: result.data });
      }
      if (reader.cookie) response.headers.set("set-cookie", reader.cookie);
      return finish(response);
    } catch (error) {
      if (error instanceof ProxyProblem)
        return finish(
          problem(
            error.status,
            error.message,
            error.retryable || RETRYABLE.has(error.status),
          ),
        );
      return finish(
        problem(
          503,
          "The guide is temporarily unavailable. Please try again.",
          true,
        ),
        error,
      );
    }
  };
}

/**
 * The reader's device position travels as one JSON multipart field; only the
 * documented keys are forwarded (the service rejects unknown ones) and anything
 * malformed is the contributor's problem, not a 500.
 */
function devicePosition(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || raw.length > 512)
    throw new ProxyProblem(400, "Invalid device position.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ProxyProblem(400, "Invalid device position.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProxyProblem(400, "Invalid device position.");
  const v = value as Record<string, unknown>;
  if (
    typeof v.latitude !== "number" ||
    typeof v.longitude !== "number" ||
    typeof v.accuracy_m !== "number" ||
    typeof v.read_at !== "string" ||
    (v.method !== "camera" && v.method !== "at-display") ||
    Math.abs(v.latitude) > 90 ||
    Math.abs(v.longitude) > 180 ||
    v.accuracy_m < 0
  )
    throw new ProxyProblem(400, "Invalid device position.");
  return {
    latitude: v.latitude,
    longitude: v.longitude,
    accuracy_m: v.accuracy_m,
    read_at: v.read_at,
    method: v.method as "camera" | "at-display",
  };
}
