/**
 * The three-valued measurement tier for advertising (ADR section 7.1).
 *
 * `cookieless`: no record, malformed or stale record, DNT or GPC, or the
 * performance category off. `performance`: performance on, advertising off.
 * `advertising`: both on. The tier is computed by the property's server from
 * the reader's current cookie, at page render and again at click time.
 */
import { readConsentRecord } from "./measurement-consent";
import type { AdMeasurementTier } from "./ads";

export function measurementTier(
  headers: Pick<Headers, "get">,
  now = Date.now(),
): AdMeasurementTier {
  const record = readConsentRecord(headers, now);
  if (!record || record.performance !== true) return "cookieless";
  return record.advertising === true ? "advertising" : "performance";
}
