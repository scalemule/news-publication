/**
 * Click-fallback signing (ADR section 7.5.2 deviation, agreed in review).
 *
 * The page never carries a bare destination. When the ads service cannot
 * answer a click, the property's `/go` route may still send the reader to the
 * creative's destination, but only if the destination it finds in the link
 * was signed by this property's own server at render time:
 *
 *   K = HMAC-SHA256(key = apiKey, msg = "scalemule-ads-click-fallback-v1")
 *   s = HMAC-SHA256(key = K,      msg = delivery_id + "\n" + destination_url)
 *
 * `K` never leaves the server and the API key is never used directly. Web
 * Crypto only, so the same code runs in Node and edge runtimes.
 */
export const CLICK_FALLBACK_CONTEXT = "scalemule-ads-click-fallback-v1";

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmac(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, message as BufferSource));
}

export async function clickFallbackKey(apiKey: string): Promise<Uint8Array> {
  return hmac(encoder.encode(apiKey), encoder.encode(CLICK_FALLBACK_CONTEXT));
}

export async function signClickFallback(apiKey: string, deliveryId: string, destination: string): Promise<string> {
  const key = await clickFallbackKey(apiKey);
  return base64url(await hmac(key, encoder.encode(`${deliveryId}\n${destination}`)));
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** The signed fallback destination, or null when anything about it is wrong. */
export async function verifyClickFallback(
  apiKey: string,
  deliveryId: string,
  to: string | null,
  s: string | null,
): Promise<string | null> {
  if (!to || !s) return null;
  const destinationBytes = base64urlDecode(to);
  const signature = base64urlDecode(s);
  if (!destinationBytes || !signature || signature.length !== 32) return null;
  let destination: string;
  try {
    destination = new TextDecoder("utf-8", { fatal: true }).decode(destinationBytes);
  } catch {
    return null;
  }
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const key = await clickFallbackKey(apiKey);
  const expected = await hmac(key, encoder.encode(`${deliveryId}\n${destination}`));
  return timingSafeEqual(expected, signature) ? destination : null;
}
