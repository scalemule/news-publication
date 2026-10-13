/** The server enforces the same explicit consent gate as the browser. */
export function measurementConsent(
  headers: Pick<Headers, "get">,
  sponsorship = false,
  now = Date.now(),
): boolean {
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1")
    return false;
  const cookies =
    headers
      .get("cookie")
      ?.split(";")
      .map((value) => value.trim()) ?? [];
  // A malformed primary choice must not resurrect a permissive backup.
  const cookie =
    cookies.find((value) => value.startsWith("sm_cookie_consent_v1=")) ??
    cookies.find((value) => value.startsWith("napsite_cookie_consent_v1="));
  if (!cookie) return false;
  try {
    const record = JSON.parse(
      decodeURIComponent(cookie.substring(cookie.indexOf("=") + 1)),
    );
    const date = Date.parse(record.timestamp);
    return (
      record.version === 1 &&
      record.preferences?.essential === true &&
      record.preferences?.performance === true &&
      (!sponsorship || record.preferences?.advertising === true) &&
      Number.isFinite(date) &&
      date <= now + 300000 &&
      now - date < 365 * 86400000
    );
  } catch {
    return false;
  }
}
