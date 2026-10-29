"use client";
/** Mount the ad observers once per page. See ./ads-observe.ts for the rules. */
import { useEffect } from "react";
import { observeAdUnits, type AdsMetricsProps } from "./ads-observe";

export type { AdTrackEvent, AdsMetricsProps } from "./ads-observe";
export { AD_MEASUREMENT_VERSION, AD_VIEW_DWELL_MS, AD_VIEW_THRESHOLD } from "./ads-observe";

export function AdsMetrics({ track, enabled = true }: AdsMetricsProps) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    return observeAdUnits(track);
  }, [track, enabled]);
  return null;
}
