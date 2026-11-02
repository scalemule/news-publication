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
  status: "ok",
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
      expect(html.includes("sm-ad--with-image")).toBe(showsImage);
      // Without a brand kit the unit is typographic in the default (NapSite) palette, written inline.
      expect(html).toContain("sm-ad--typographic");
      // The footer is the light variant of the same kit: light field, brand surface as ink.
      expect(html).toContain(format === "partner_footer" ? "--sm-ad-bg:#edf1ed;--sm-ad-fg:#173d32" : "--sm-ad-bg:#173d32;--sm-ad-fg:#ffffff");
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

describe("brand kit rendering", () => {
  const kit = {
    surface: "#0b1d33", ink: "#ffffff", ink_muted: "#c9d3e3", accent: "#f4ecdf", on_accent: "#0b1d33",
    wordmark: { text: "MergeYard", mark: "." }, eyebrow: "Customer support", context: "Lazy Tensor readers get 30 days free",
  };
  const sealedSecondary = { label: "See pricing", href: `/go/${DELIVERY}?to=aHR0cHM6Ly9tZXJnZXlhcmQuY29tL3ByaWNpbmc&s=c2ln&direct=1` };
  const render = (d: AdDelivery) => renderToStaticMarkup(<AdUnit delivery={d} placement="leaderboard" />);
  it("draws the wordmark, eyebrow with a 24px mark, context and the inline palette", () => {
    const html = render({ ...delivery("band", false), brand: kit });
    expect(html).toContain("sm-ad--wordmark");
    expect(html).toContain('class="sm-ad-wordmark">MergeYard<span class="sm-ad-wordmark-mark">.</span>');
    expect(html).toContain('class="sm-ad-eyebrow"');
    expect(html).toContain('width="24" height="24"');
    expect(html).toContain(">Customer support<");
    expect(html).toContain(">Lazy Tensor readers get 30 days free<");
    expect(html).not.toContain("sm-ad-logo--tile");
    expect(html).toContain("--sm-ad-bg:#0b1d33;--sm-ad-fg:#ffffff;--sm-ad-fg-muted:#c9d3e3;--sm-ad-accent:#f4ecdf;--sm-ad-cta-bg:#f4ecdf;--sm-ad-cta-fg:#0b1d33");
    expect(html).toContain("--sm-ad-scrim:rgba(11, 29, 51, 0.94)");
  });
  it("uses the light footer palette for partner_footer: brand surface as ink, accent CTA inverted", () => {
    const html = render({ ...delivery("partner_footer", false), brand: kit });
    expect(html).toContain("--sm-ad-bg:#edf1ed;--sm-ad-fg:#0b1d33;");
    expect(html).toContain("--sm-ad-cta-bg:#0b1d33;--sm-ad-cta-fg:#ffffff");
  });
  it("renders the secondary link only as the sealed direct route, never a raw URL", () => {
    const html = render({ ...delivery("band", false), brand: { ...kit, secondary: sealedSecondary } });
    expect(html).toContain(`class="sm-ad-secondary" href="/go/${DELIVERY}?to=aHR0cHM6Ly9tZXJnZXlhcmQuY29tL3ByaWNpbmc&amp;s=c2ln&amp;direct=1"`);
    expect(html).toContain(">See pricing</a>");
    expect(html).not.toContain("mergeyard.com");
    expect(render({ ...delivery("band", false), brand: { ...kit, secondary: { label: "See pricing", url: "https://mergeyard.com/pricing" } } })).not.toContain("sm-ad-secondary");
    expect(render({ ...delivery("band", false), brand: { ...kit, secondary: { label: "See pricing", href: `/go/${DELIVERY}?to=x&s=y` } } })).not.toContain("sm-ad-secondary");
    expect(render({ ...delivery("band", false), brand: { ...kit, secondary: { label: "See pricing", href: "https://evil.example/" } } })).not.toContain("sm-ad-secondary");
  });
  it("falls back to the logo tile and advertiser name without a wordmark", () => {
    const html = render({ ...delivery("band", false), brand: { ...kit, wordmark: null } });
    expect(html).toContain("sm-ad--logo");
    expect(html).toContain("sm-ad-logo--tile");
    expect(html).toContain('class="sm-ad-advertiser">MergeYard<');
  });
  it("renders two-level ownership disclosure inside the About panel for house advertisements", () => {
    const html = render({
      ...delivery("column", false),
      about: {
        advertiser: "ScaleMule",
        kind: "house",
        disclosure: "This is a house advertisement for ScaleMule, which shares common ownership with Lazy Tensor.",
      },
      brand: {
        surface: "#0f172a",
        ink: "#ffffff",
        ink_muted: "#cbd5e1",
        accent: "#f59e0b",
        on_accent: "#0f172a",
        wordmark: { text: "ScaleMule" },
        eyebrow: "Production AI Infrastructure",
      },
    });
    expect(html).toContain("<strong>About this advertisement</strong>");
    expect(html).toContain("This is a house advertisement for ScaleMule, which shares common ownership with Lazy Tensor.");
    expect(html).toContain("Advertising and editorial content are managed separately. This placement does not represent an editorial endorsement.");
    expect(html).toContain("Advertising &amp; editorial independence");
  });
});

describe("photo and artwork modes", () => {
  const img = (width: number, height: number, name: string) => ({ url: `https://cdn.example.com/${name}`, width, height, alt: "" });
  const photoContent = (format: AdFormatKey) => ({
    ...delivery(format, false),
    content: { ...delivery(format, false).content, mode: "photo" as const, image: img(900, 600, "sq.jpg"), image_wide: img(1200, 420, "wide.jpg"), image_tall: img(300, 400, "tall.jpg"), focal: { x: 0.25, y: 0.8 } },
  });
  const render = (d: AdDelivery, eager = false) => renderToStaticMarkup(<AdUnit delivery={d} placement="leaderboard" eager={eager} />);
  it("photo mode: the format's photograph fills the unit with the focal point, copy on the panel, one link", () => {
    const band = render(photoContent("band"), true);
    expect(band).toContain("sm-ad--photo");
    expect(band).toContain('class="sm-ad-photo"');
    expect(band).toContain("wide.jpg");
    expect(band).toContain('loading="eager"');
    expect(band).toContain("object-position:25% 80%");
    expect(band).toContain("sm-ad-panel-copy");
    expect(band.match(/<a /g)?.length).toBe(2); // the creative and the policy link in the About panel
    expect(render(photoContent("column"))).toContain("tall.jpg");
    expect(render(photoContent("inline_card"))).toContain("sq.jpg");
    const noPhoto = { ...delivery("band", false), content: { ...delivery("band", false).content, mode: "photo" as const } };
    expect(render(noPhoto)).toContain("sm-ad--typographic");
  });
  it("artwork mode: finished art at the box with the headline as alt, a mobile variant, an optional CTA strip, and fallbacks", () => {
    const art = {
      ...delivery("band", false),
      content: {
        ...delivery("band", false).content, mode: "artwork" as const, artwork_cta: true,
        artwork: { band: img(1200, 280, "band.png"), band_mobile: img(360, 360, "band-m.png"), column: img(300, 520, "col.png") },
      },
    };
    const html = render(art, true);
    expect(html).toContain("sm-ad--artwork");
    expect(html).toContain('class="sm-ad-art sm-ad-art--desktop" src="https://cdn.example.com/band.png" alt="Support that lives inside Zendesk &amp; Slack" width="1200" height="280" loading="eager"');
    expect(html).toContain('class="sm-ad-art sm-ad-art--mobile" src="https://cdn.example.com/band-m.png"');
    expect(html).toContain("sm-ad-artwork--responsive");
    expect(html).toContain('class="sm-ad-strip">See MergeYard<');
    expect(html).not.toContain("sm-ad-headline");
    expect(render({ ...art, content: { ...art.content, artwork_cta: false } })).not.toContain("sm-ad-strip");
    // Column has art; inline_card has none and no photo → typographic; with a photo → photo.
    expect(render({ ...art, format: "column" })).toContain("col.png");
    expect(render({ ...art, format: "inline_card" })).toContain("sm-ad--typographic");
    expect(render({ ...art, format: "inline_card", content: { ...art.content, image: img(900, 600, "sq.jpg") } })).toContain("sm-ad--photo");
    expect(render({ ...art, format: "credit_line" })).toContain("sm-ad--typographic");
  });
});
