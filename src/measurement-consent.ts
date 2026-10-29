/** The server enforces the same explicit consent gate as the browser. */
export type ConsentPreferences = {
  essential: true;
  functional: boolean;
  performance: boolean;
  advertising: boolean;
};

/**
 * The reader's current consent record from the request cookies, or null when
 * there is none, it is malformed, stale, or Do Not Track / Global Privacy
 * Control is asserted. Shared by `measurementConsent` and the ads tier.
 */
export function readConsentRecord(
  headers: Pick<Headers, "get">,
  now = Date.now(),
): ConsentPreferences | null {
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1")
    return null;
  const cookies =
    headers
      .get("cookie")
      ?.split(";")
      .map((value) => value.trim()) ?? [];
  // A malformed primary choice must not resurrect a permissive backup.
  const cookie =
    cookies.find((value) => value.startsWith("sm_cookie_consent_v1=")) ??
    cookies.find((value) => value.startsWith("napsite_cookie_consent_v1="));
  if (!cookie) return null;
  try {
    const record = JSON.parse(
      decodeURIComponent(cookie.substring(cookie.indexOf("=") + 1)),
    );
    const date = Date.parse(record.timestamp);
    const p = record.preferences;
    if (
      record.version === 1 &&
      p?.essential === true &&
      typeof p?.functional === "boolean" &&
      typeof p?.advertising === "boolean" &&
      typeof p?.performance === "boolean" &&
      Number.isFinite(date) &&
      date <= now + 300000 &&
      now - date < 365 * 86400000
    ) {
      return {
        essential: true,
        functional: p.functional,
        performance: p.performance,
        advertising: p.advertising,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function measurementConsent(
  headers: Pick<Headers, "get">,
  sponsorship = false,
  now = Date.now(),
): boolean {
  const record = readConsentRecord(headers, now);
  if (!record) return false;
  return record.performance === true && (!sponsorship || record.advertising === true);
}
