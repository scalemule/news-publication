import React from "react";
import {
  AD_ABOUT_SENTENCE,
  AD_LABELS,
  AD_REPORT_REASONS,
  type AdDelivery,
  type AdFormatKey,
  type AdImage,
  type AdPlacementKey,
  type AdPlan,
} from "./ads";

/**
 * One advertising unit, server-renderable (ADR sections 5 and 11).
 *
 * The whole creative is a single link to the property's own `/go/{delivery}`
 * route; the destination never appears in the page. Every unit carries its
 * label, an "About this ad" disclosure, a no-JavaScript "Report this ad"
 * form, and a "Hide on this page" control that `<AdsMetrics>` wires up by
 * event delegation (nothing is stored). Load `@scalemule/news-publication/ads.css`.
 */
export const AD_SLOT_LABELS = AD_LABELS;

export const AD_LOGO_BOX = { desktop: 64, mobile: 48 } as const;

function Logo({ logo, advertiser, format }: { logo?: AdImage | null; advertiser: string; format: AdFormatKey }) {
  if (!logo?.url) {
    return (
      <span className="sm-ad-logo sm-ad-logo--mark" aria-hidden="true">
        {Array.from(advertiser.trim())[0] ?? ""}
      </span>
    );
  }
  const wide = logo.width > 0 && logo.height > 0 && logo.width / logo.height > 3;
  return (
    <span className={`sm-ad-logo${wide ? " sm-ad-logo--wide" : ""}`}>
      <img
        src={logo.url}
        alt={logo.alt ?? `${advertiser} logo`}
        width={format === "credit_line" ? 20 : AD_LOGO_BOX.desktop}
        height={format === "credit_line" ? 20 : AD_LOGO_BOX.desktop}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

function Picture({ image, eager }: { image?: AdImage | null; eager: boolean }) {
  if (!image?.url || !(image.width > 0) || !(image.height > 0)) return null;
  return (
    <span className="sm-ad-image" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
      <img
        src={image.url}
        alt={image.alt ?? ""}
        width={image.width}
        height={image.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
      />
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
  return (
    <div className="sm-ad-bar">
      <span className="sm-ad-label">{label}</span>
      <span className="sm-ad-links">
        <details className="sm-ad-about">
          <summary aria-label="About this ad">About</summary>
          <p className="sm-ad-panel">
            <strong>{delivery.about.advertiser}</strong>. {AD_ABOUT_SENTENCE}{" "}
            <a href={policy}>Advertising policy</a>
          </p>
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
  const { content, format } = delivery;
  const label = AD_LABELS[delivery.label] ?? AD_LABELS.advertisement;
  const href = `/go/${delivery.delivery_id}`;
  const hasImage = Boolean(content.image?.url) && format !== "partner_footer" && format !== "credit_line";
  const classes = [
    "sm-ad",
    `sm-ad--${format}`,
    hasImage ? "sm-ad--with-image" : "sm-ad--typographic",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const common = {
    className: classes,
    "data-ad-delivery": delivery.delivery_id,
    "data-ad-placement": placement,
    "data-ad-format": format,
    "aria-label": `${label}: ${content.advertiser}`,
  };

  if (format === "credit_line") {
    return (
      <aside {...common}>
        <AdControls delivery={delivery} label={label} />
        <a className="sm-ad-creative" href={href} rel="sponsored noopener" referrerPolicy="no-referrer">
          {content.logo?.url && <Logo logo={content.logo} advertiser={content.advertiser} format={format} />}
          <span className="sm-ad-credit">
            {content.link_label || content.headline || content.advertiser}
          </span>
        </a>
      </aside>
    );
  }

  return (
    <aside {...common}>
      <AdControls delivery={delivery} label={label} />
      <a className="sm-ad-creative" href={href} rel="sponsored noopener" referrerPolicy="no-referrer">
        <span className="sm-ad-brand">
          <Logo logo={content.logo} advertiser={content.advertiser} format={format} />
          <span className="sm-ad-advertiser">{content.advertiser}</span>
        </span>
        <span className="sm-ad-copy">
          <span className="sm-ad-headline">{content.headline}</span>
          <span className="sm-ad-description">{content.description}</span>
        </span>
        {hasImage && <Picture image={content.image} eager={eager} />}
        <span className="sm-ad-cta">{content.cta}</span>
      </a>
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
