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
  ) {
    super(message);
  }
}
/** Only public collection routes are accepted. The URL never selects tenant credentials. */
export function createPublicationCommunityMapsHandler(
  options: PublicationCommunityMapServerOptions,
) {
  return async (request: Request, path: string[]): Promise<Response> => {
    try {
      if (
        path[0] !== "collections" ||
        !path[1] ||
        !/^[a-z0-9-]{1,191}$/.test(path[1])
      )
        return json({ error: { message: "Guide not found" } }, 404);
      const slug = path[1];
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
      const read =
        method === "GET" &&
        (discussion ||
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
      if (!read && !upload && !submission && !action && !engagementWrite)
        return json({ error: { message: "Route not found" } }, 404);
      const scope = await options.resolve(request);
      if (
        method !== "GET" &&
        request.headers.get("origin") !== new URL(scope.origin).origin
      )
        return json(
          { error: { message: "Submit from this publication’s website." } },
          403,
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
      if (read && rest[0] === "media") {
        const upstream = await fetch(
          `${gateway.origin}${ROOT}/collections/${slug}/media/${rest[1]}`,
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
          if (discussion)
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
          const bytes = await boundedBody(request, 26 * 1024 * 1024);
          const form = await new Response(bytes as BodyInit, {
            headers: { "content-type": contentType },
          }).formData();
          const file = form.get("file");
          if (!(file instanceof Blob))
            throw new ProxyProblem(400, "Media is required.");
          result = await sdk.communityMaps.uploadMedia(
            slug,
            rest[1],
            file,
            {
              caption: String(form.get("caption") || ""),
              attribution: String(form.get("attribution") || ""),
              rights_confirmed: form.get("rights_confirmed") === "true",
              consent_version: String(form.get("consent_version") || ""),
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
          const error = result.error;
          const status = typeof error.status === "number" ? error.status : 400;
          response = json(
            {
              error: {
                message:
                  status >= 500
                    ? "The guide is temporarily unavailable. Please try again."
                    : error.message,
              },
            },
            status,
          );
        } else response = json({ data: result.data });
      }
      if (reader.cookie) response.headers.set("set-cookie", reader.cookie);
      return response;
    } catch (error) {
      return json(
        {
          error: {
            message:
              error instanceof ProxyProblem
                ? error.message
                : "The guide is temporarily unavailable. Please try again.",
          },
        },
        error instanceof ProxyProblem ? error.status : 503,
      );
    }
  };
}
