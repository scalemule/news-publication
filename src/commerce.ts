import type { CouponOffer, NewsPublication } from "./types";

/**
 * Coupon lookup for a paper. No Stripe call lives here.
 * When `features.coupons` is off, every code resolves to null, including a
 * configured offer. A paper may replace matching with `coupons.resolve`.
 */
export function resolveCoupon(publication: NewsPublication, code: string | null | undefined): CouponOffer | null {
  if (!publication.coupons.enabled) return null;
  const normalized = code?.trim();
  if (!normalized) return null;
  if (publication.coupons.resolve) return publication.coupons.resolve(normalized, publication.coupons.offers);
  return publication.coupons.offers.find(offer => offer.code.localeCompare(normalized, undefined, { sensitivity: "base" }) === 0) ?? null;
}

export function referralCode(publication: NewsPublication, url: string): string | null {
  if (!publication.referrals.enabled) return null;
  try {
    const value = new URL(url).searchParams.get(publication.referrals.queryParam)?.trim() ?? "";
    return /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}
