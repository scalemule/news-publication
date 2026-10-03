import type {
  CardType,
  VerifiedCard,
  VerifiedCardAction,
  VerifiedCardFact,
  VerifiedCardImage,
} from "./types";
import { CURATED_COMMUNITY_CARDS } from "./curated-cards";

const ALLOWED_CARD_TYPES = new Set<CardType>([
  "PLACE",
  "ACTIVITY",
  "EVENT",
  "ORGANIZATION",
  "PRODUCT",
]);

/**
 * Truncate characters safely for unicode and emoji strings.
 */
function clip(val: unknown, maxChars: number): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return Array.from(trimmed).slice(0, maxChars).join("");
}

/**
 * Validate that an action link is safe for readers.
 * Rejects javascript:, data:, blob:, credentials, and loopback/internal hosts.
 */
export function isSafeActionUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return false;

  // Safe phone/email protocol
  if (trimmed.startsWith("tel:") || trimmed.startsWith("mailto:")) {
    return /^tel:\+?[\d\-().\s]+$/.test(trimmed) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local") ||
      hostname === "127.0.0.1" ||
      hostname === "169.254.169.254"
    ) {
      return false;
    }

    // Reject URLs with authorization / credential parameters
    for (const [key] of url.searchParams.entries()) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (
        cleanKey === "token" ||
        cleanKey === "apikey" ||
        cleanKey === "accesstoken" ||
        cleanKey === "secret" ||
        cleanKey === "clientsecret" ||
        cleanKey === "authorization" ||
        cleanKey === "signature" ||
        cleanKey === "password" ||
        cleanKey === "xamzsignature" ||
        cleanKey === "xamzsecuritytoken"
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Internal parser for raw card objects.
 */
function parseRawCards(rawCards: unknown[]): VerifiedCard[] {
  const cards: VerifiedCard[] = [];

  for (const item of rawCards) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;

    const id = clip(c.id, 64);
    const title = clip(c.title, 300);
    if (!id || !title) continue;

    const rawType = (typeof c.card_type === "string" ? c.card_type : c.cardType) as CardType;
    const cardType: CardType = ALLOWED_CARD_TYPES.has(rawType) ? rawType : "PLACE";

    const kicker = clip(c.kicker, 120) || (
      cardType === "PLACE" ? "LOCAL VENUE · VERIFIED DIRECTORY" :
      cardType === "EVENT" ? "COMMUNITY EVENT · VERIFIED FACTSHEET" :
      cardType === "ACTIVITY" ? "COMMUNITY ACTIVITY · VERIFIED FACTSHEET" :
      cardType === "ORGANIZATION" ? "COMMUNITY ORGANIZATION · DIRECTORY" :
      "VERIFIED FACTSHEET"
    );

    const subtitle = clip(c.subtitle, 300);
    const summary = clip(c.summary, 1000);
    const badge = clip(c.badge, 64);

    const facts: VerifiedCardFact[] = [];

    // Support pre-built facts array if provided
    if (Array.isArray(c.facts)) {
      for (const f of c.facts) {
        if (!f || typeof f !== "object") continue;
        const label = clip((f as Record<string, unknown>).label, 80);
        const value = clip((f as Record<string, unknown>).value, 500);
        if (!label || !value) continue;

        let href: string | undefined = undefined;
        const rawHref = (f as Record<string, unknown>).href;
        if (typeof rawHref === "string" && isSafeActionUrl(rawHref)) {
          href = rawHref;
        }

        facts.push({ label, value, href });
      }
    } else {
      // Extract from standard properties
      const timeframe = clip(c.timeframe, 200);
      if (timeframe) facts.push({ label: "Timeframe", value: timeframe });

      const address = clip(c.address, 300);
      if (address) {
        facts.push({
          label: "Address",
          value: address,
          href: `https://maps.google.com/?q=${encodeURIComponent(address)}`,
        });
      }

      const hours = clip(c.hours, 300);
      if (hours) facts.push({ label: "Hours", value: hours });

      const phone = clip(c.phone, 80);
      if (phone) {
        facts.push({
          label: "Phone",
          value: phone,
          href: `tel:${phone.replace(/[^+\d]/g, "")}`,
        });
      }

      const cost = clip(c.cost, 120);
      if (cost) facts.push({ label: "Cost", value: cost });
    }

    const actions: VerifiedCardAction[] = [];
    if (Array.isArray(c.actions)) {
      for (const act of c.actions) {
        if (!act || typeof act !== "object") continue;
        const actObj = act as Record<string, unknown>;
        const label = clip(actObj.label, 80);
        const url = typeof actObj.url === "string" ? actObj.url.trim() : "";
        if (!label || !url || !isSafeActionUrl(url)) continue;

        actions.push({
          label,
          url,
          primary: Boolean(actObj.primary),
        });
        if (actions.length >= 5) break;
      }
    }

    let image: VerifiedCardImage | undefined = undefined;
    if (c.image && typeof c.image === "object") {
      const img = c.image as Record<string, unknown>;
      const masterUrl = typeof img.master_url === "string" && isSafeActionUrl(img.master_url) ? img.master_url : undefined;
      const url = typeof img.url === "string" && isSafeActionUrl(img.url) ? img.url : masterUrl;

      if (url) {
        image = {
          file_id: clip(img.file_id, 64),
          master_url: masterUrl,
          url,
          width: typeof img.width === "number" ? img.width : undefined,
          height: typeof img.height === "number" ? img.height : undefined,
          alt: clip(img.alt, 500),
          caption: clip(img.caption, 1000),
          attribution: clip(img.attribution, 500),
          label: clip(img.label, 100),
          ai_generated: Boolean(img.ai_generated),
        };
      }
    }

    const verificationNote =
      clip(c.verification_note || c.verificationNote, 300) ||
      "Verified by publication reporting staff";
    const verifiedAt =
      clip(c.verified_at || c.verifiedAt, 100) || "October 2026";

    let rating: number | string | undefined = undefined;
    if (typeof c.rating === "number" || typeof c.rating === "string") {
      rating = c.rating;
    }

    cards.push({
      id,
      cardType,
      kicker,
      title,
      subtitle,
      summary,
      badge,
      facts,
      actions,
      verificationNote,
      verifiedAt,
      image,
      rating,
    });

    if (cards.length >= 10) break;
  }

  return cards;
}

/**
 * Sanitize and project raw API metadata cards into strictly validated `VerifiedCard[]`.
 * If rawCards is empty or absent and a slug is provided, checks the curated community cards registry.
 */
export function getArticleCards(rawCards?: unknown, slug?: string): VerifiedCard[] {
  if (Array.isArray(rawCards) && rawCards.length > 0) {
    const fromRaw = parseRawCards(rawCards);
    if (fromRaw.length > 0) return fromRaw;
  }

  if (slug && CURATED_COMMUNITY_CARDS[slug]) {
    return parseRawCards(CURATED_COMMUNITY_CARDS[slug]);
  }

  return [];
}

export function VerifiedCardComponent({
  card,
  className,
}: {
  card: VerifiedCard;
  className?: string;
}) {
  return (
    <aside
      className={`article-verified-card ${className || ""}`.trim()}
      aria-label={`Verified Factsheet: ${card.title}`}
    >
      <div className="article-verified-card__header">
        <span className="article-verified-card__kicker">{card.kicker}</span>
        {card.badge && (
          <span className="article-verified-card__badge">{card.badge}</span>
        )}
      </div>

      <h2 className="article-verified-card__title">{card.title}</h2>
      {card.subtitle && (
        <p className="article-verified-card__subtitle">{card.subtitle}</p>
      )}
      {card.summary && (
        <p className="article-verified-card__summary">{card.summary}</p>
      )}

      {card.facts.length > 0 && (
        <dl className="article-verified-card__fact-grid">
          {card.facts.map((fact, i) => (
            <div key={i} className="article-verified-card__fact-row">
              <dt className="article-verified-card__fact-label">{fact.label}</dt>
              <dd className="article-verified-card__fact-value">
                {fact.href ? (
                  <a
                    className="article-verified-card__fact-link"
                    href={fact.href}
                    rel="noopener noreferrer"
                    target={fact.href.startsWith("http") ? "_blank" : undefined}
                  >
                    {fact.value}
                  </a>
                ) : (
                  fact.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {card.actions.length > 0 && (
        <div className="article-verified-card__actions">
          {card.actions.map((act, i) => (
            <a
              key={i}
              className={`article-verified-card__action ${
                act.primary
                  ? "article-verified-card__action--primary"
                  : "article-verified-card__action--secondary"
              }`}
              href={act.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{act.label}</span>
              <span aria-hidden="true" className="article-verified-card__action-icon">
                ↗
              </span>
            </a>
          ))}
        </div>
      )}

      <footer className="article-verified-card__footer">
        <div className="article-verified-card__seal">
          <span className="article-verified-card__seal-check" aria-hidden="true">
            ✓
          </span>
          <span>{card.verificationNote}</span>
        </div>
        <span className="article-verified-card__date">{card.verifiedAt}</span>
      </footer>
    </aside>
  );
}

export function VerifiedCardSection({
  cards,
  className,
}: {
  cards?: VerifiedCard[];
  className?: string;
}) {
  if (!cards || cards.length === 0) return null;
  return (
    <section
      className={`article-verified-card-section ${className || ""}`.trim()}
      aria-label="Verified Community Information"
    >
      {cards.map((card) => (
        <VerifiedCardComponent key={card.id} card={card} />
      ))}
    </section>
  );
}
