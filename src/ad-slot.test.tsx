// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdSlot, AdUnit } from "./ad-slot";
import { AD_FORMAT_KEYS, AD_ABOUT_SENTENCE, type AdDelivery, type AdFormatKey, type AdPlan } from "./ads";
import { observeAdUnits } from "./ads-observe";

const DELIVERY = "0192f8a0-1234-7abc-8def-0123456789ab";
const DESTINATION = "https://mergeyard.com/?utm_source=paper";
function delivery(format: AdFormatKey, image = true): AdDelivery {
  return {
    delivery_id: DELIVERY,
    flight_id: "f1",
    creative_id: "c1",
    revision: 3,
    format,
    label: format === "partner_footer" ? "sponsored" : "advertisement",
    href: `/go/${DELIVERY}`,
    about: { advertiser: "MergeYard" },
    content: {
      advertiser: "MergeYard",
      headline: "Support that lives inside Zendesk & Slack",
      description: "Shared inboxes, SLAs and reporting for teams who answer customers all day long.",
      cta: "See MergeYard",
      link_label: "Built on napsite.com",
      logo: { url: "https://cdn.example.com/logo.png", width: 128, height: 128 },
      image: image
        ? { url: "https://cdn.example.com/pic.jpg", width: 900, height: 600, alt: "Product screenshot" }
        : null,
    },
  };
}
const plan: AdPlan = {
  plan_id: "p",
  policy_snapshot_at: "2026-10-29T00:00:00Z",
  deliveries: { leaderboard: delivery("band") },
  empty: ["sidebar"],
};

describe("AdSlot", () => {
  it("renders nothing for an empty or missing placement", () => {
    expect(renderToStaticMarkup(<AdSlot plan={plan} placement="sidebar" />)).toBe("");
    expect(renderToStaticMarkup(<AdSlot plan={null} placement="leaderboard" />)).toBe("");
  });
  it.each(AD_FORMAT_KEYS)("renders %s with and without an image, labeled, via /go only", (format) => {
    for (const withImage of [true, false]) {
      const html = renderToStaticMarkup(<AdUnit delivery={delivery(format, withImage)} placement="leaderboard" />);
      expect(html).toContain(`class="sm-ad sm-ad--${format}`);
      expect(html).toContain(`data-ad-delivery="${DELIVERY}"`);
      expect(html).toContain(`data-ad-format="${format}"`);
      expect(html).toContain(`aria-label="${format === "partner_footer" ? "Sponsored" : "Advertisement"}: MergeYard"`);
      expect(html).toContain(format === "partner_footer" ? ">Sponsored<" : ">Advertisement<");
      expect(html).toContain(`href="/go/${DELIVERY}"`);
      expect(html).not.toContain(DESTINATION);
      expect(html).not.toContain("mergeyard.com");
      expect(html).toContain('rel="sponsored noopener"');
      expect(html).toContain('referrerPolicy="no-referrer"');
      expect(html).toContain(AD_ABOUT_SENTENCE.replace("'", "&#x27;"));
      expect(html).toContain('action="/api/ads/report"');
      expect(html).toContain(`name="delivery_id" value="${DELIVERY}"`);
      expect(html).toContain(`data-ad-hide="${DELIVERY}"`);
      const showsImage = withImage && !["partner_footer", "credit_line"].includes(format);
      expect(html.includes("sm-ad-image")).toBe(showsImage);
      if (showsImage) expect(html).toContain('width="900" height="600"');
      expect(html.includes("sm-ad--typographic")).toBe(!showsImage);
    }
  });
  it("uses a typographic mark when there is no logo and marks wide logos", () => {
    const d = delivery("band", false);
    d.content.logo = null;
    expect(renderToStaticMarkup(<AdUnit delivery={d} placement="x" />)).toContain('sm-ad-logo sm-ad-logo--mark');
    d.content.logo = { url: "https://cdn.example.com/w.png", width: 400, height: 100 };
    expect(renderToStaticMarkup(<AdUnit delivery={d} placement="x" />)).toContain("sm-ad-logo--wide");
  });
  it("escapes creative text", () => {
    const d = delivery("band");
    d.content.headline = '<img src=x onerror=alert(1)> "quoted"';
    const html = renderToStaticMarkup(<AdUnit delivery={d} placement="x" />);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
});

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  elements = new Set<Element>();
  constructor(public callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) { this.elements.add(el); }
  unobserve(el: Element) { this.elements.delete(el); }
  disconnect() { this.elements.clear(); }
  emit(el: Element, ratio: number) {
    this.callback(
      [{ target: el, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

describe("ad measurement", () => {
  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    FakeIntersectionObserver.instances = [];
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.body.innerHTML = renderToStaticMarkup(<AdUnit delivery={delivery("band")} placement="leaderboard" />);
  });
  afterEach(() => {
    stop?.();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });
  it("emits one impression on attach and one view after a continuous visible second", () => {
    const track = vi.fn();
    stop = observeAdUnits(track);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][0]).toEqual({
      event_name: "ad_impression",
      properties: { delivery_id: DELIVERY, placement: "leaderboard", format: "band", measurement_version: 2, measurable: true },
    });
    const io = FakeIntersectionObserver.instances[0];
    const unit = document.querySelector("[data-ad-delivery]")!;
    io.emit(unit, 0.6);
    vi.advanceTimersByTime(600);
    io.emit(unit, 0.2);
    vi.advanceTimersByTime(1000);
    expect(track).toHaveBeenCalledTimes(1);
    io.emit(unit, 0.9);
    vi.advanceTimersByTime(999);
    expect(track).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(track).toHaveBeenCalledTimes(2);
    expect(track.mock.calls[1][0].event_name).toBe("ad_viewed");
    io.emit(unit, 0.2);
    io.emit(unit, 0.9);
    vi.advanceTimersByTime(1500);
    expect(track).toHaveBeenCalledTimes(2);
  });
  it("marks impressions unmeasurable and never emits a view without an IntersectionObserver", () => {
    delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    const track = vi.fn();
    stop = observeAdUnits(track);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][0].properties.measurable).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(track).toHaveBeenCalledTimes(1);
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });
  it("does not count a hidden tab and removes a unit on hide", () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    const track = vi.fn();
    stop = observeAdUnits(track);
    expect(track).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(track).toHaveBeenCalledTimes(1);
    (document.querySelector("[data-ad-hide]") as HTMLButtonElement).click();
    expect(document.querySelector("[data-ad-delivery]")).toBeNull();
  });
});
