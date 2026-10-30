/**
 * Where a reader lands after subscribing through a sign-in round trip. Pure, so the
 * server routes (reader-sso) and the browser bar (newsletter-bar) share one rule.
 */
export const NEWSLETTER_CONFIRMED_HASH = "newsletter-confirmed";

/** Public reading pages a reader can be returned to: the front page, a section, the news index or one story. */
const PUBLIC_READING_PATH = /^\/(?:news(?:\/[A-Za-z0-9%-]{1,240})?|sections\/[A-Za-z0-9-]{1,80})?$/;

export function isPublicReadingPath(path: unknown): path is string {
  return typeof path === "string" && PUBLIC_READING_PATH.test(path) && path !== "/news/unsubscribe";
}

/**
 * After a subscription made from a reading page, send the reader back to that page with the
 * confirmation hash (the NewsletterBar shows "you're in"); otherwise to the newsletter page.
 */
export function newsletterConfirmedLocation(returnTo: string | undefined | null): string {
  return isPublicReadingPath(returnTo) ? `${returnTo}#${NEWSLETTER_CONFIRMED_HASH}` : "/newsletter?subscription=confirmed";
}
