/** The stored article path is authoritative; never derive it from the headline. */
export function readableArticlePath(value: unknown): value is string {
  return typeof value === 'string' && /^\/news\/[a-z0-9][a-z0-9-]{0,399}$/.test(value);
}

/** Move an existing capability to its server-resolved path without replacing it. */
export function permanentReviewUrl(address: string, path: unknown, origin: string, session: string): string | undefined {
  if (!readableArticlePath(path)) return undefined;
  try {
    const url = new URL(address, origin);
    if (url.origin !== origin || url.username || url.password) return undefined;
    const existingSession = url.searchParams.get('review');
    if (existingSession && existingSession !== session) return undefined;
    const fragmentKey = /^[a-f0-9]{64}$/.test(url.hash.slice(1)) ? url.hash.slice(1) : undefined;
    const key = url.searchParams.get('key') || fragmentKey;
    if (!key || !/^[a-f0-9]{64}$/.test(key)) return undefined;
    url.pathname = path;
    url.searchParams.set('review', session);
    url.searchParams.set('key', key);
    if (fragmentKey) url.hash = '';
    return url.href;
  } catch { return undefined; }
}
