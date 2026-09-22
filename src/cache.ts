/**
 * Cache policy verified on walnutcreektimes.com.
 * Feeds refresh every 30s, articles every 60s, and the edge holds a page for
 * 60s with five minutes of stale-while-revalidate. Publishing calls
 * POST /api/revalidate to drop that wait.
 */
export const NEWS_CACHE = {
  feedRevalidateSeconds: 30,
  articleRevalidateSeconds: 60,
  edgeMaxAgeSeconds: 60,
  staleWhileRevalidateSeconds: 300,
  feedTag: "news-feed",
  articleTag: "news-article",
  inventoryTag: "public-news-discovery-v2",
  paths: ["/", "/news"],
} as const;

export const feedCacheOptions = {
  revalidate: NEWS_CACHE.feedRevalidateSeconds,
  tags: [NEWS_CACHE.feedTag],
} as const;

export const articleCacheOptions = {
  revalidate: NEWS_CACHE.articleRevalidateSeconds,
  tags: [NEWS_CACHE.articleTag],
} as const;

export const inventoryCacheOptions = {
  revalidate: NEWS_CACHE.feedRevalidateSeconds,
  tags: [NEWS_CACHE.feedTag, NEWS_CACHE.inventoryTag],
} as const;

export function edgeCacheControl(): string {
  return `public, s-maxage=${NEWS_CACHE.edgeMaxAgeSeconds}, stale-while-revalidate=${NEWS_CACHE.staleWhileRevalidateSeconds}`;
}

export function feedCacheKey(publicationId: string, before?: string, section?: string): string {
  return `${publicationId}:${before ?? ""}:${section ?? ""}`;
}

export function articleCacheKey(publicationId: string, slug: string): string {
  return `${publicationId}:${slug}`;
}

export class NewsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "NewsError";
  }
}

/** A missing article must 404. Every other failure may serve the last good copy. */
export function shouldServeLastKnown(error: unknown): boolean {
  const status = error instanceof NewsError
    ? error.status
    : error && typeof error === "object" && "status" in error
      ? (error as { status: unknown }).status
      : undefined;
  return status !== 404;
}

/**
 * In-memory stale fallback used when the gateway times out or returns 429/5xx.
 * The Next.js data cache is separate and is configured with `feedCacheOptions`.
 */
export async function withLastKnown<T>(
  store: Map<string, T>,
  key: string,
  load: () => Promise<T>,
  accept: (value: T) => boolean = () => true,
): Promise<T> {
  try {
    const value = await load();
    if (accept(value)) store.set(key, value);
    return value;
  } catch (error) {
    if (!shouldServeLastKnown(error)) throw error;
    const cached = store.get(key);
    if (cached) return cached;
    throw error;
  }
}

export function secretsMatch(provided: string | null | undefined, secret: string | null | undefined): boolean {
  if (!provided || !secret) return false;
  const left = Array.from(provided);
  const right = Array.from(secret);
  let mismatch = left.length === right.length ? 0 : 1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index]?.codePointAt(0) ?? 0) ^ (right[index]?.codePointAt(0) ?? 0);
  }
  return mismatch === 0;
}

export type RevalidateDecision = {
  status: number;
  body: { error: string } | { revalidated: true; tag: string; path: string; now: number };
};

/** Pure form of POST /api/revalidate. The site route performs the Next.js purge. */
export function revalidateDecision(input: {
  providedSecret: string | null;
  configuredSecret: string | null;
  tag?: string | null;
  path?: string | null;
  now?: number;
}): RevalidateDecision {
  if (!secretsMatch(input.providedSecret, input.configuredSecret)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  const tag = input.tag?.trim() || `${NEWS_CACHE.feedTag}, ${NEWS_CACHE.articleTag}`;
  const path = input.path?.trim() || NEWS_CACHE.paths.join(", ");
  return { status: 200, body: { revalidated: true, tag, path, now: input.now ?? Date.now() } };
}

/** Tags and paths the default purge clears, including the discovery inventory tag. */
export function defaultRevalidateTargets(): { tags: string[]; paths: string[] } {
  return {
    tags: [NEWS_CACHE.feedTag, NEWS_CACHE.articleTag, NEWS_CACHE.inventoryTag],
    paths: [...NEWS_CACHE.paths],
  };
}
