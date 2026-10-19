/**
 * Reader sign-in telemetry registry (ADR-2026-10-19 section 8). Isomorphic on
 * purpose: a site's analytics schema is shared with its browser bundle, so this
 * fragment must not import anything server-only.
 */
export type ReaderSsoEventName =
  | "reader_signin_started"
  | "reader_signin_completed"
  | "reader_signin_failed"
  | "reader_sso_check"
  | "reader_signed_out"
  | "reader_account_linked";

export type ReaderSsoEventDefinition = { category: "navigation" | "engagement" | "content" | "conversion" | "system"; source: "server" };

/** Merge into the site's EVENTS registry: `{ ...EVENTS, ...READER_SSO_EVENTS }`. Server-recorded only. */
export const READER_SSO_EVENTS: Record<ReaderSsoEventName, ReaderSsoEventDefinition> = {
  reader_signin_started: { category: "engagement", source: "server" },
  reader_signin_completed: { category: "conversion", source: "server" },
  reader_signin_failed: { category: "system", source: "server" },
  reader_sso_check: { category: "system", source: "server" },
  reader_signed_out: { category: "engagement", source: "server" },
  reader_account_linked: { category: "conversion", source: "server" },
};

/** Property keys the site's analytics sanitizer must allow for these events (bounded short tokens). */
export const READER_SSO_PROPERTY_KEYS = ["method", "mode", "is_new", "reason", "outcome", "transaction"] as const;
