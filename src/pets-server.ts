/** Server-only, publication-scoped proxy. Never import credentials into a client component. */
import { buildClientContextHeaders, type ClientContext } from "@scalemule/sdk";
import type { PublicAcknowledgment } from "./sponsorships";
import { PET_SLUG, PET_UUID, petReferences, type PetResource } from "./pets";
export type PetScope = {
  apiKey: string;
  gatewayUrl: string;
  origin: string;
  collectionSlug: string;
  publicationId?: string;
  accessToken?: string;
  clientContext: ClientContext;
  writesEnabled?: boolean;
};
export class PetRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const petPrivateHeaders = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};
async function bounded(request: Request, max: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > max)
    throw new PetRequestError(413, "The submission is too large.");
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
function config(scope: PetScope) {
  const url = new URL(scope.gatewayUrl);
  if (
    !scope.apiKey ||
    !PET_SLUG.test(scope.collectionSlug) ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new PetRequestError(503, "The pet community is not available yet.");
  return url.origin;
}
export async function petRequest<T>(
  scope: PetScope,
  path: string,
  init: { method?: string; body?: unknown } = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const gateway = config(scope);
  if (!path.startsWith("/v1/") || path.includes("..") || /[\\\r\n]/.test(path))
    throw new Error("Invalid platform path");
  const response = await fetcher(gateway + path, {
    method: init.method || "GET",
    headers: {
      ...buildClientContextHeaders(scope.clientContext),
      "x-api-key": scope.apiKey,
      "content-type": "application/json",
      ...(scope.accessToken
        ? { authorization: `Bearer ${scope.accessToken}` }
        : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new PetRequestError(
      response.status,
      response.status === 401
        ? "Please sign in to continue."
        : response.status === 404
          ? "This pet resource is not available."
          : response.status === 409
            ? "This contribution changed. Reload before saving."
            : response.status === 429
              ? "Please wait before trying again."
              : "We couldn’t complete that request. Please try again.",
    );
  const json = await response.json();
  return json?.data ?? json;
}
export function createPublicationPetsHandler(options: {
  resolve(request: Request): Promise<PetScope>;
  fetch?: typeof fetch;
}) {
  const fetcher = options.fetch || fetch;
  return async function handler(
    request: Request,
    path: string[],
  ): Promise<Response> {
    const json = (data: unknown, status = 200) =>
      Response.json(data, { status, headers: petPrivateHeaders });
    try {
      const scope = await options.resolve(request),
        gateway = config(scope),
        method = request.method;
      const root = `/v1/knowledge/community-maps/collections/${scope.collectionSlug}`;
      const id = path[0] && PET_UUID.test(path[0]);
      const isMedia =
        id &&
        path.length === 3 &&
        path[1] === "media" &&
        PET_UUID.test(path[2]);
      const upload =
        path.length === 3 &&
        path[0] === "submissions" &&
        PET_UUID.test(path[1]) &&
        path[2] === "media";
      const ownMedia =
        path.length === 4 &&
        path[0] === "submissions" &&
        PET_UUID.test(path[1]) &&
        path[2] === "media" &&
        PET_UUID.test(path[3]);
      const own =
        path[0] === "mine" &&
        (path.length === 1 || (path.length === 2 && PET_UUID.test(path[1])));
      const preferences = path.length === 1 && path[0] === "preferences";
      const reaction = id && path.length === 2 && path[1] === "reaction";
      const report = id && path.length === 2 && path[1] === "reports";
      const publicRead =
        method === "GET" &&
        (!path.length ||
          (id && path.length === 1) ||
          isMedia ||
          (path.length === 1 && path[0] === "community"));
      const read =
        publicRead ||
        (method === "GET" && (own || ownMedia || preferences || reaction));
      const write =
        (method === "POST" &&
          (!path.length ||
            upload ||
            report ||
            (id && path.length === 2 && path[1] === "reunited"))) ||
        (method === "PUT" && (preferences || reaction)) ||
        (["PUT", "DELETE"].includes(method) && id && path.length === 1);
      if (!read && !write) return json({ error: "Route not found" }, 404);
      if (
        write &&
        (!scope.writesEnabled ||
          request.headers.get("origin") !== new URL(scope.origin).origin)
      )
        return json(
          { error: "Continue from the pet community’s official website." },
          403,
        );
      if (
        (write || own || ownMedia || preferences || reaction) &&
        !scope.accessToken
      )
        return json({ error: "Sign in to continue." }, 401);
      let endpoint =
        root +
        (path[0] === "community"
          ? ""
          : upload || ownMedia
            ? "/" + path.join("/")
            : "/pets" + (path.length ? "/" + path.join("/") : ""));
      const query = new URLSearchParams();
      if (method === "GET" && !path.length)
        for (const key of [
          "area_id",
          "kind",
          "after",
          "week",
          "limit",
          "category",
          "species",
          "event_type",
          "cost",
          "starts_after",
          "starts_before",
        ]) {
          const value = new URL(request.url).searchParams.get(key);
          if (value) query.set(key, value);
        }
      if (own) {
        const after = new URL(request.url).searchParams.get("after");
        if (after && PET_UUID.test(after)) query.set("after", after);
      }
      if (query.size) endpoint += "?" + query;
      if (isMedia) {
        const imageQuery = new URLSearchParams();
        const sourceQuery = new URL(request.url).searchParams;
        if (["640", "1280"].includes(sourceQuery.get("width") || ""))
          imageQuery.set("width", sourceQuery.get("width")!);
        if (["jpeg", "webp"].includes(sourceQuery.get("format") || ""))
          imageQuery.set("format", sourceQuery.get("format")!);
        if (imageQuery.size) endpoint += "?" + imageQuery;
      }
      if (isMedia || upload || ownMedia) {
        let body: Uint8Array | undefined;
        const type = request.headers.get("content-type") || "";
        if (upload) {
          if (!type.startsWith("multipart/form-data;"))
            throw new PetRequestError(415, "Choose a photograph.");
          body = await bounded(request, 9 * 1024 * 1024);
        }
        const response = await fetcher(gateway + endpoint, {
          method,
          headers: {
            ...buildClientContextHeaders(scope.clientContext),
            "x-api-key": scope.apiKey,
            ...(scope.accessToken
              ? { authorization: `Bearer ${scope.accessToken}` }
              : {}),
            ...(upload ? { "content-type": type } : {}),
          },
          body: body as BodyInit | undefined,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(45000),
        });
        if (!response.ok) {
          await response.body?.cancel();
          return json(
            {
              error:
                "The photograph is unavailable. Check its size and try again.",
            },
            response.status >= 500 ? 503 : response.status,
          );
        }
        if (upload) return json(await response.json());
        const imageType =
          response.headers.get("content-type")?.split(";")[0] || "";
        if (!["image/png", "image/jpeg", "image/webp"].includes(imageType)) {
          await response.body?.cancel();
          return json({ error: "Photograph unavailable" }, 404);
        }
        return new Response(response.body, {
          headers: { ...petPrivateHeaders, "content-type": imageType },
        });
      }
      let body: unknown;
      if (write) {
        if (
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          throw new PetRequestError(415, "Use the pet contribution form.");
        try {
          body = JSON.parse(
            new TextDecoder().decode(await bounded(request, 32768)),
          );
        } catch (error) {
          if (error instanceof PetRequestError) throw error;
          throw new PetRequestError(400, "Check the contribution fields.");
        }
      }
      return json({
        data: await petRequest(scope, endpoint, { method, body }, fetcher),
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof PetRequestError
              ? error.message
              : "The pet community is temporarily unavailable.",
        },
        error instanceof PetRequestError ? error.status : 503,
      );
    }
  };
}

/** Resolve article references at render time through the publication's accepted view.
 * Withdrawing a resource removes its embedded card; articles never cache private snapshots. */
export async function resolvePetReferences(
  scope: PetScope,
  metadata: unknown,
  fetcher: typeof fetch = fetch,
): Promise<PetResource[]> {
  const references = petReferences(metadata).filter(
    (ref) => ref.collection_slug === scope.collectionSlug,
  );
  const results = await Promise.all(
    references.map(async (ref) => {
      try {
        const resource = await petRequest<PetResource>(
          { ...scope, accessToken: undefined },
          `/v1/knowledge/community-maps/collections/${ref.collection_slug}/pets/${ref.id}`,
          {},
          fetcher,
        );
        return resource.kind === ref.kind ? resource : null;
      } catch (error) {
        if (
          error instanceof PetRequestError &&
          [403, 404].includes(error.status)
        )
          return null;
        throw error;
      }
    }),
  );
  return results.filter(
    (resource): resource is PetResource => resource !== null,
  );
}

/** The existing campaign service owns approval, agreements, geography and reporting.
 * No campaign is inferred from a logo, partner prospect or submitted pet content. */
export async function petAcknowledgments(
  scope: PetScope,
  community?: string,
  productPath = "/pets",
  fetcher: typeof fetch = fetch,
): Promise<PublicAcknowledgment[]> {
  if (!scope.publicationId || !PET_UUID.test(scope.publicationId)) return [];
  try {
    const groups = await Promise.all(
      (["community_partner", "community_guide"] as const).map(
        async (placement) => {
          const query = new URLSearchParams({
            placement_type: placement,
            product_path: productPath,
          });
          if (community) query.set("community", community);
          const response = await petRequest<{ items: PublicAcknowledgment[] }>(
            { ...scope, accessToken: undefined },
            `/v1/blog/publications/${scope.publicationId}/sponsorships/delivery?${query}`,
            {},
            fetcher,
          );
          return response.items.filter(
            (item) =>
              item.publication_id === scope.publicationId &&
              item.placement_type === placement,
          );
        },
      ),
    );
    return groups.flat().slice(0, 2);
  } catch {
    console.warn("paw.sponsorship_delivery_unavailable");
    return [];
  }
}
