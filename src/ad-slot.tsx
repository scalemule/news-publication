import React, { type CSSProperties } from "react";
import {
  AD_ABOUT_SENTENCE,
  AD_EDITORIAL_INDEPENDENCE_SENTENCE,
  AD_LABELS,
  AD_REPORT_REASONS,
  DEFAULT_AD_BRAND,
  footerPalette,
  type AdArtworkKey,
  type AdBrand,
  type AdCreativeContent,
  type AdCreativeMode,
  type AdDelivery,
  type AdFormatKey,
  type AdImage,
  type AdPlacementKey,
  type AdPlan,
} from "./ads";

/**
 * One advertising unit, server-renderable (ADR sections 5 and 11).
 *
 * Every unit is drawn in the advertiser's own brand kit (surface, ink, accent,
 * wordmark, eyebrow, context line, secondary link) inside the paper's
 * typography, in one of three modes: typographic, photo, or finished artwork.
 * The whole creative is a single link to the property's own `/go/{delivery}`
 * route; the destination never appears in the page. The secondary link is a
 * second, separately signed `/go/{delivery}?…&direct=1` anchor. Every unit
 * carries its label, an "About this ad" disclosure, a no-JavaScript "Report
 * this ad" form, and a "Hide on this page" control that `<AdsMetrics>` wires
 * up by event delegation. Load `@scalemule/news-publication/ads.css`.
 *
 * Colors are written as inline custom properties on the unit root and read by
 * high-specificity rules on every text element, so no publication stylesheet
 * (or theme) can recolor the creative.
 */
export const AD_SLOT_LABELS = AD_LABELS;

export const AD_LOGO_BOX = { desktop: 64, mobile: 48 } as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The inline palette for a unit: brand colors, or the footer variant of them. */
export function adBrandStyle(brand: AdBrand | undefined, format: AdFormatKey): CSSProperties {
  const kit = brand ?? DEFAULT_AD_BRAND;
  const footer = format === "partner_footer" ? footerPalette(kit) : null;
  const bg = footer ? footer.surface : kit.surface;
  const [r, g, b] = hexToRgb(bg);
  const vars: Record<string, string> = {
    "--sm-ad-bg": bg,
    "--sm-ad-fg": footer ? footer.ink : kit.ink,
    "--sm-ad-fg-muted": footer ? footer.ink_muted : kit.ink_muted,
    "--sm-ad-accent": kit.accent,
    "--sm-ad-cta-bg": footer ? kit.surface : kit.accent,
    "--sm-ad-cta-fg": footer ? kit.ink : kit.on_accent,
    "--sm-ad-focus": footer ? kit.surface : kit.accent,
    "--sm-ad-rule": footer ? kit.surface : kit.accent,
    "--sm-ad-scrim": `rgba(${r}, ${g}, ${b}, 0.94)`,
    "--sm-ad-scrim-clear": `rgba(${r}, ${g}, ${b}, 0)`,
  };
  return vars as CSSProperties;
}

function Logo({
  logo,
  advertiser,
  size,
}: {
  logo?: AdImage | null;
  advertiser: string;
  size: "tile" | "mark" | "credit";
}) {
  const px = size === "tile" ? AD_LOGO_BOX.desktop : size === "mark" ? 24 : 20;
  if (!logo?.url) {
    if (size !== "tile") return null;
    return (
      <span className="sm-ad-logo sm-ad-logo--mark" aria-hidden="true">
        {Array.from(String(advertiser ?? "").trim())[0] ?? ""}
      </span>
    );
  }
  const wide = logo.width > 0 && logo.height > 0 && logo.width / logo.height > 3;
  return (
    <span className={`sm-ad-logo sm-ad-logo--${size}${wide ? " sm-ad-logo--wide" : ""}`}>
      <img
        src={logo.url}
        alt={size === "tile" ? (logo.alt ?? `${advertiser} logo`) : ""}
        aria-hidden={size === "tile" ? undefined : true}
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

function Picture({ image, eager, className, focal }: { image?: AdImage | null; eager: boolean; className: string; focal?: { x: number; y: number } | null }) {
  if (!image?.url || !(image.width > 0) || !(image.height > 0)) return null;
  const style: CSSProperties = { aspectRatio: `${image.width} / ${image.height}` };
  const position = focal ? `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%` : undefined;
  return (
    <span className={className} style={style}>
      <img
        src={image.url}
        alt={image.alt ?? ""}
        width={image.width}
        height={image.height}
        style={position ? { objectPosition: position } : undefined}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

/** The brand block: eyebrow (with a 24px mark when a logo accompanies a wordmark), wordmark or logo tile, context line. */
function Brand({ content, brand }: { content: AdCreativeContent; brand?: AdBrand }) {
  const wordmark = brand?.wordmark ?? null;
  return (
    <span className="sm-ad-brand">
      {brand?.eyebrow && (
        <span className="sm-ad-eyebrow">
          {wordmark && <Logo logo={content.logo} advertiser={content.advertiser} size="mark" />}
          {brand.eyebrow}
        </span>
      )}
      {wordmark ? (
        <span className="sm-ad-wordmark">
          {wordmark.text}
          {wordmark.mark && <span className="sm-ad-wordmark-mark">{wordmark.mark}</span>}
        </span>
      ) : (
        <>
          <Logo logo={content.logo} advertiser={content.advertiser} size="tile" />
          <span className="sm-ad-advertiser">{content.advertiser}</span>
        </>
      )}
      {brand?.context && <span className="sm-ad-context">{brand.context}</span>}
    </span>
  );
}

/**
 * The disclosure row above every creative: the label on the left, then
 * "About · Hide · Report" as small links on the right. The About and Report
 * panels are native `<details>`, collapsed by default, and open as a card
 * beneath the row so the unit's height never changes.
 */
export function AdControls({ delivery, label }: { delivery: AdDelivery; label: string }) {
  const policy = delivery.about.policy_path || "/advertising-policy";
  const disclosure =
    delivery.about.disclosure ||
    (delivery.about.kind === "house"
      ? `This is a house advertisement for ${delivery.about.advertiser}, which shares common ownership with this publication.`
      : undefined);
  return (
    <div className="sm-ad-bar">
      <span className="sm-ad-label">{label}</span>
      <span className="sm-ad-links">
        <details className="sm-ad-about">
          <summary aria-label="About this ad">About</summary>
          {disclosure ? (
            <div className="sm-ad-panel sm-ad-panel--about">
              <p className="sm-ad-panel-heading">
                <strong>About this advertisement</strong>
              </p>
              <p>{disclosure}</p>
              <p>{AD_EDITORIAL_INDEPENDENCE_SENTENCE}</p>
              <p>
                <a href={policy}>Advertising &amp; editorial independence →</a>
              </p>
            </div>
          ) : (
            <p className="sm-ad-panel">
              <strong>{delivery.about.advertiser}</strong>. {AD_ABOUT_SENTENCE}{" "}
              <a href={policy}>Advertising policy</a>
            </p>
          )}
        </details>
        <button type="button" className="sm-ad-hide" data-ad-hide={delivery.delivery_id} aria-label="Hide this ad on this page">
          Hide
        </button>
        <details className="sm-ad-report">
          <summary aria-label="Report this ad">Report</summary>
          <form className="sm-ad-panel" method="post" action="/api/ads/report">
            <input type="hidden" name="delivery_id" value={delivery.delivery_id} />
            <label>
              <span>Reason</span>
              <select name="reason" required defaultValue="">
                <option value="" disabled>
                  Choose a reason
                </option>
                {AD_REPORT_REASONS.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Send report</button>
          </form>
        </details>
      </span>
    </div>
  );
}

/** The property's own click route, with the signed fallback the server attached; never anything else. */
function clickHref(delivery: AdDelivery): string {
  const base = `/go/${delivery.delivery_id}`;
  return typeof delivery.href === "string" && (delivery.href === base || delivery.href.startsWith(base + "?"))
    ? delivery.href
    : base;
}

/** The secondary link only ever renders as the sealed, signed `/go/{id}?…&direct=1` route. */
function secondaryHref(delivery: AdDelivery): string | null {
  const href = delivery.brand?.secondary?.href;
  if (!href || !href.startsWith(`/go/${delivery.delivery_id}?`)) return null;
  const query = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  return query.get("direct") === "1" && query.get("to") && query.get("s") ? href : null;
}

const ART_FOR: Record<AdFormatKey, { desktop: AdArtworkKey | null; mobile: AdArtworkKey | null }> = {
  band: { desktop: "band", mobile: "band_mobile" },
  column: { desktop: "column", mobile: "band_mobile" },
  inline_card: { desktop: "inline_card", mobile: "inline_card_mobile" },
  partner_footer: { desktop: "partner_footer", mobile: "partner_footer_mobile" },
  credit_line: { desktop: null, mobile: null },
  showcase: { desktop: null, mobile: null },
};

/** The photograph a format uses in photo mode: the wide, tall or square/3:2 image. */
function photoFor(content: AdCreativeContent, format: AdFormatKey): AdImage | null {
  if (format === "band" || format === "partner_footer") return content.image_wide ?? content.image ?? content.image_tall ?? null;
  if (format === "column") return content.image_tall ?? content.image ?? content.image_wide ?? null;
  return content.image ?? content.image_wide ?? content.image_tall ?? null;
}

/** The mode this unit is actually drawn in, after the fallbacks (artwork → photo → typographic). */
export function effectiveMode(content: AdCreativeContent, format: AdFormatKey): AdCreativeMode {
  const wanted = content.mode ?? "typographic";
  if (format === "credit_line") return "typographic";
  if (wanted === "artwork") {
    const keys = ART_FOR[format];
    const art = content.artwork;
    if (art && ((keys.desktop && art[keys.desktop]) || (keys.mobile && art[keys.mobile]))) return "artwork";
  }
  if ((wanted === "artwork" || wanted === "photo") && photoFor(content, format)) return "photo";
  return "typographic";
}

function Artwork({ content, format, eager }: { content: AdCreativeContent; format: AdFormatKey; eager: boolean }) {
  const keys = ART_FOR[format];
  const art = content.artwork ?? {};
  const desktop = keys.desktop ? art[keys.desktop] : undefined;
  const mobile = keys.mobile ? art[keys.mobile] : undefined;
  const alt = content.headline;
  const img = (image: AdImage, which: "desktop" | "mobile") => (
    <img
      className={`sm-ad-art sm-ad-art--${which}`}
      src={image.url}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={eager && which === "desktop" ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
  return (
    <span className={`sm-ad-artwork${desktop && mobile ? " sm-ad-artwork--responsive" : ""}`}>
      {desktop ? img(desktop, "desktop") : mobile ? img(mobile, "desktop") : null}
      {desktop && mobile && img(mobile, "mobile")}
    </span>
  );
}

export function AdUnit({
  delivery,
  placement,
  className,
  eager = false,
}: {
  delivery: AdDelivery;
  placement: AdPlacementKey;
  className?: string;
  eager?: boolean;
}) {
  const { content, format, brand } = delivery;
  if (!content || typeof content !== "object" || !delivery.delivery_id) return null;
  const label = AD_LABELS[delivery.label] ?? AD_LABELS.advertisement;
  const href = clickHref(delivery);
  const secondary = secondaryHref(delivery);
  const mode = effectiveMode(content, format);
  const photo = mode === "photo" ? photoFor(content, format) : null;
  const hasImage = mode === "typographic" && Boolean(content.image?.url) && format !== "partner_footer" && format !== "credit_line";
  const style = adBrandStyle(brand, format);
  const classes = [
    "sm-ad",
    `sm-ad--${format}`,
    `sm-ad--${mode}`,
    hasImage ? "sm-ad--with-image" : "",
    brand?.wordmark ? "sm-ad--wordmark" : "sm-ad--logo",
    secondary ? "sm-ad--secondary" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const common = {
    className: classes,
    style,
    "data-ad-delivery": delivery.delivery_id,
    "data-ad-placement": placement,
    "data-ad-format": format,
    "data-ad-mode": mode,
    "aria-label": `${label}: ${content.advertiser}`,
  };
  const rel = "sponsored noopener";

  if (format === "credit_line") {
    return (
      <aside {...common}>
        <AdControls delivery={delivery} label={label} />
        <a className="sm-ad-creative" href={href} rel={rel} referrerPolicy="no-referrer">
          {content.logo?.url && <Logo logo={content.logo} advertiser={content.advertiser} size="credit" />}
          <span className="sm-ad-credit">{content.link_label || content.headline || content.advertiser}</span>
        </a>
      </aside>
    );
  }

  if (mode === "artwork") {
    const strip = content.artwork_cta && content.cta;
    return (
      <aside {...common}>
        <AdControls delivery={delivery} label={label} />
        <div className="sm-ad-box">
          <a className="sm-ad-creative" href={href} rel={rel} referrerPolicy="no-referrer">
            <Artwork content={content} format={format} eager={eager} />
            {strip && <span className="sm-ad-strip">{content.cta}</span>}
          </a>
        </div>
      </aside>
    );
  }

  const copy = (
    <span className="sm-ad-copy">
      <span className="sm-ad-headline">{content.headline}</span>
      {content.description && <span className="sm-ad-description">{content.description}</span>}
    </span>
  );
  const actions = (
    <span className="sm-ad-actions">
      <span className="sm-ad-cta">{content.cta}</span>
    </span>
  );
  const secondaryLink = secondary && brand?.secondary?.label && (
    <a className="sm-ad-secondary" href={secondary} rel={rel} referrerPolicy="no-referrer">
      {brand.secondary.label}
    </a>
  );

  if (mode === "photo" && photo) {
    return (
      <aside {...common}>
        <AdControls delivery={delivery} label={label} />
        <div className="sm-ad-box">
          <a className="sm-ad-creative" href={href} rel={rel} referrerPolicy="no-referrer">
            <Picture image={photo} eager={eager} className="sm-ad-photo" focal={content.focal} />
            <span className="sm-ad-panel-copy">
              <Brand content={content} brand={brand} />
              {copy}
              {actions}
            </span>
          </a>
          {secondaryLink}
        </div>
      </aside>
    );
  }

  return (
    <aside {...common}>
      <AdControls delivery={delivery} label={label} />
      <div className="sm-ad-box">
        <a className="sm-ad-creative" href={href} rel={rel} referrerPolicy="no-referrer">
          <Brand content={content} brand={brand} />
          {copy}
          {hasImage && <Picture image={content.image} eager={eager} className="sm-ad-image" />}
          {actions}
        </a>
        {secondaryLink}
      </div>
    </aside>
  );
}

/** The unit for `placement` from the page's plan, or nothing. */
export function AdSlot({
  plan,
  placement,
  className,
  eager,
}: {
  plan: AdPlan | null | undefined;
  placement: AdPlacementKey;
  className?: string;
  /** Above the fold: load the image eagerly. */
  eager?: boolean;
}) {
  const delivery = plan?.deliveries?.[placement];
  if (!delivery) return null;
  return <AdUnit delivery={delivery} placement={placement} className={className} eager={eager} />;
}
