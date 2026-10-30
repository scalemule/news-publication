/**
 * Browser measurement for advertising units (ADR section 7.3) and the
 * "Hide on this page" control. Pure DOM helpers; `<AdsMetrics>` mounts them.
 *
 * `ad_impression`: the unit is attached and the page has been visible at
 * least once. `ad_viewed`: at least 50% of the unit visible for one continuous
 * second in a visible tab. Both once per delivery. Clicks are recorded by the
 * server redirect, never from here. Nothing is stored on the device.
 */

export const AD_MEASUREMENT_VERSION = 2;
export const AD_VIEW_THRESHOLD = 0.5;
export const AD_VIEW_DWELL_MS = 1000;

export type AdTrackEvent = {
  event_name: "ad_impression" | "ad_viewed";
  properties: {
    delivery_id: string;
    placement: string | null;
    format: string | null;
    measurement_version: number;
    /** Viewability could be observed: IntersectionObserver exists and the unit is in a visible document. */
    measurable: boolean;
  };
};

export type AdsMetricsProps = {
  /** The paper's own `trackEvent`; it decides tier, transport and consent. */
  track: (event: AdTrackEvent) => unknown;
  /** Skip observation entirely (for example when measurement is off). */
  enabled?: boolean;
};

export function adUnitProperties(element: Element, measurable: boolean): AdTrackEvent["properties"] {
  return {
    delivery_id: element.getAttribute("data-ad-delivery") || "",
    placement: element.getAttribute("data-ad-placement"),
    format: element.getAttribute("data-ad-format"),
    measurement_version: AD_MEASUREMENT_VERSION,
    measurable,
  };
}

export function observeAdUnits(
  track: AdsMetricsProps["track"],
  root: Document = document,
): () => void {
  const impressed = new Set<string>();
  const viewed = new Set<string>();
  const visible = new Set<Element>();
  const timers = new Map<Element, number>();
  const observed = new Set<Element>();

  const id = (el: Element) => el.getAttribute("data-ad-delivery") || "";
  const hasObserver = "IntersectionObserver" in window;
  const measurable = (el: Element) => hasObserver && el.isConnected && root.visibilityState === "visible";

  function impression(el: Element) {
    const key = id(el);
    if (!key || impressed.has(key) || root.visibilityState !== "visible") return;
    impressed.add(key);
    void track({ event_name: "ad_impression", properties: adUnitProperties(el, measurable(el)) });
  }
  function cancel(el: Element) {
    const timer = timers.get(el);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.delete(el);
  }
  function start(el: Element) {
    const key = id(el);
    if (!key || viewed.has(key) || timers.has(el) || root.visibilityState !== "visible") return;
    timers.set(
      el,
      window.setTimeout(() => {
        timers.delete(el);
        if (visible.has(el) && measurable(el) && !viewed.has(key)) {
          viewed.add(key);
          void track({ event_name: "ad_viewed", properties: adUnitProperties(el, true) });
        }
      }, AD_VIEW_DWELL_MS),
    );
  }

  const io =
    hasObserver
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting && entry.intersectionRatio >= AD_VIEW_THRESHOLD) {
                visible.add(entry.target);
                start(entry.target);
              } else {
                visible.delete(entry.target);
                cancel(entry.target);
              }
            }
          },
          { threshold: [0, AD_VIEW_THRESHOLD] },
        )
      : null;

  function observe() {
    root.querySelectorAll("[data-ad-delivery]").forEach((el) => {
      impression(el);
      if (io && !observed.has(el)) {
        observed.add(el);
        io.observe(el);
      }
    });
  }
  function onVisibility() {
    if (root.visibilityState === "visible") {
      observe();
      visible.forEach(start);
    } else {
      timers.forEach((_, el) => cancel(el));
    }
  }
  function onClick(event: Event) {
    const target = event.target as Element | null;
    const button = target?.closest?.("[data-ad-hide]");
    if (!button) return;
    const unit = button.closest("[data-ad-delivery]");
    if (unit) {
      cancel(unit);
      visible.delete(unit);
      io?.unobserve(unit);
      unit.remove();
    }
  }

  observe();
  const mo = "MutationObserver" in window ? new MutationObserver(observe) : null;
  mo?.observe(root.body, { childList: true, subtree: true });
  root.addEventListener("visibilitychange", onVisibility);
  root.addEventListener("click", onClick);
  return () => {
    mo?.disconnect();
    io?.disconnect();
    timers.forEach((_, el) => cancel(el));
    root.removeEventListener("visibilitychange", onVisibility);
    root.removeEventListener("click", onClick);
  };
}

