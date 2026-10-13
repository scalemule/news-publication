/** Community sponsorship contract. Prices are proposals until agreed in writing. */
export type PlacementType =
  | "community_partner"
  | "community_calendar"
  | "daily_briefing"
  | "community_guide";
export type CampaignStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "scheduled"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";
export type Measurement = {
  status: "measured" | "estimated" | "unavailable";
  value: number | null;
  methodology: string;
  from?: string;
  to?: string;
};
export type Creative = {
  name: string;
  description: string;
  logo_url?: string | null;
  destination_url?: string | null;
  link_label?: string;
};
export type SponsorParty = {
  id: string;
  revision: number;
  kind: "sponsor" | "agency";
  name: string;
  website?: string | null;
  logo_url?: string | null;
  description: string;
  contact_name: string;
  contact_email: string;
  billing_account_ref?: string | null;
  agency_ids: string[];
  status: "active" | "archived";
};
export type Placement = {
  id: string;
  revision: number;
  application_id: string;
  publication_id: string;
  placement_type: PlacementType;
  name: string;
  description: string;
  communities: string[];
  product_path: string;
  active: boolean;
  availability: "coming_soon" | "available" | "unavailable";
  max_sponsors: number;
  price_cents: number | null;
  currency: "USD";
  price_interval: "month" | "fixed" | "custom";
  verification_url?: string | null;
  verified_at?: string | null;
  reporting: string[];
  editorial_restrictions: string;
};
export type CampaignTarget = {
  application_id: string;
  publication_id: string;
  placement_id: string;
  communities: string[];
};
export type Campaign = {
  id: string;
  revision: number;
  name: string;
  sponsor_id: string;
  agency_id?: string | null;
  status: CampaignStatus;
  starts_at: string;
  ends_at: string;
  targets: CampaignTarget[];
  creative: Creative;
  approved_revision: number | null;
  archived: boolean;
  price_cents: number | null;
  currency: "USD";
  price_interval: "month" | "fixed" | "custom";
  invoice_ref?: string | null;
  contract_ref?: string | null;
  billing_party: "sponsor" | "agency";
  payment_status: "not_invoiced" | "invoiced" | "paid" | "overdue" | "waived";
  notes: string;
};
export type PublicAcknowledgment = {
  campaign_id: string;
  placement_id: string;
  publication_id: string;
  sponsor_id: string;
  placement_type: PlacementType;
  creative: Creative;
  starts_at: string;
  ends_at: string;
};

export const SPONSORSHIP_POLICY =
  "Sponsors receive clearly identified recognition. Sponsorship does not influence reporting, event selection, factual information, rankings or editorial recommendations.";

export const SPONSORSHIP_OFFERINGS = [
  {
    type: "community_partner",
    name: "Publication Community Partner",
    price_cents: 35000,
    duration: "One calendar month; exact start and end dates in the agreement.",
    deliverables:
      "One acknowledgment on the publication's community partners page and one compact acknowledgment below the community calendar. No article placements.",
    acknowledgments:
      "Two defined web locations; recurring display during the campaign, subject to reader repetition limits.",
    creative:
      "Name, approved logo, up to 140 characters of copy and one HTTPS link.",
    max_sponsors: 2,
    product_path: "/community-partners",
  },
  {
    type: "community_calendar",
    name: "Community Calendar Sponsor",
    price_cents: 25000,
    duration: "One calendar month; exact start and end dates in the agreement.",
    deliverables:
      "One acknowledgment above the independently curated community events calendar.",
    acknowledgments:
      "One web location; recurring display during the campaign, subject to reader repetition limits.",
    creative:
      "Name, approved logo, up to 140 characters of copy and one HTTPS link.",
    max_sponsors: 1,
    product_path: "/this-week",
  },
  {
    type: "daily_briefing",
    name: "Daily Briefing Sponsor",
    price_cents: 30000,
    duration:
      "One calendar month after verified newsletter delivery is operational.",
    deliverables:
      "One acknowledgment per agreed briefing edition. Edition dates and count must be specified in the agreement before booking.",
    acknowledgments:
      "One per contracted edition; no minimum send count is promised before launch.",
    creative:
      "Name, optional logo, up to 140 characters of approved copy and one HTTPS link.",
    max_sponsors: 1,
    product_path: "/newsletter",
  },
  {
    type: "community_guide",
    name: "Community Guide Sponsor",
    price_cents: null,
    duration: "Fixed dates agreed for a named guide.",
    deliverables:
      "One acknowledgment on one named, independently edited community guide; scope and updates agreed in writing.",
    acknowledgments: "One web location per contracted guide.",
    creative:
      "Name, approved logo, up to 140 characters of copy and one HTTPS link.",
    max_sponsors: 1,
    product_path: "/guides",
  },
] as const;

export function safeSponsorUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password)
      return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Never turn a website existence check into a claim of sellable inventory. */
export function placementAvailable(
  placement: Placement,
  now = Date.now(),
): boolean {
  const verified = placement.verified_at && Date.parse(placement.verified_at);
  return (
    placement.placement_type !== "daily_briefing" &&
    placement.active &&
    placement.availability === "available" &&
    Boolean(safeSponsorUrl(placement.verification_url)) &&
    typeof verified === "number" &&
    Number.isFinite(verified) &&
    verified <= now &&
    now - verified <= 90 * 86400000
  );
}
