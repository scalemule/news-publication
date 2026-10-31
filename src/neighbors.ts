/**
 * Neighbor & local business nominations, community feed, moderation, and
 * newsroom article-pickup rules.
 *
 * Links are strictly prohibited in reader submissions and flags. Submitters
 * must explicitly agree that the publication may edit, flag, hide, or remove
 * submissions and posts at any time.
 */

export const NEIGHBOR_NOMINEE_KINDS = [
  { value: "neighbor", label: "A neighbor or resident" },
  { value: "business", label: "A local business or shop" },
  { value: "group", label: "A school, team, or community group" },
] as const;

export type NeighborNomineeKind = (typeof NEIGHBOR_NOMINEE_KINDS)[number]["value"];

export const NEIGHBOR_STORY_CATEGORIES = [
  {
    value: "award_milestone",
    label: "Awards & milestones",
    prompt: "Won an award, competition, scholarship, or celebrated a major anniversary.",
  },
  {
    value: "fascinating_neighbor",
    label: "Fascinating neighbors",
    prompt: "Someone with an unusual craft, local history, remarkable hobby, or second act.",
  },
  {
    value: "behind_the_counter",
    label: "Behind the counter",
    prompt: "The positive story behind a local business, how they started, or a milestone they reached.",
  },
  {
    value: "quiet_impact",
    label: "Quiet impact",
    prompt: "Someone who stepped up to help the block, school, or neighborhood without asking for credit.",
  },
] as const;

export type NeighborStoryCategory = (typeof NEIGHBOR_STORY_CATEGORIES)[number]["value"];

export const NEIGHBOR_FLAG_REASONS = [
  { value: "contains_link_or_spam", label: "Contains a link, promotion, or spam" },
  { value: "inaccurate_information", label: "Information is inaccurate" },
  { value: "privacy_or_consent", label: "Nominee or submitter asked to remove this post" },
  { value: "unkind_or_inappropriate", label: "Unkind or inappropriate for the community feed" },
  { value: "other", label: "Something else" },
] as const;

export type NeighborFlagReason = (typeof NEIGHBOR_FLAG_REASONS)[number]["value"];

export const NEIGHBOR_SUBMISSION_TERMS = {
  version: "2026-10-30",
  summary:
    "I confirm this story is truthful and positive, contains no links, and I agree that the publication may edit, flag, or remove this submission or post at any time.",
  rules: [
    "Share positive, factual stories about real neighbors, local businesses, or community groups.",
    "Links, web addresses, and promotional URLs are not allowed.",
    "The publication may edit, decline, flag, hide, or remove any submission or published post at any time.",
  ],
} as const;

export type NeighborNominationStatus =
  | "pending_review"
  | "published"
  | "featured_in_article"
  | "flagged"
  | "removed";

export type NeighborPhotoAttachment = {
  assetId?: string;
  caption: string;
  credit: string;
  rightsConfirmed: true;
};

export type NeighborNominationInput = {
  nomineeName?: unknown;
  nomineeKind?: unknown;
  category?: unknown;
  town?: unknown;
  headline?: unknown;
  story?: unknown;
  submitterName?: unknown;
  submitterEmail?: unknown;
  nomineeContact?: unknown;
  agreedToTerms?: unknown;
  photo?: {
    assetId?: unknown;
    caption?: unknown;
    credit?: unknown;
    rightsConfirmed?: unknown;
  } | null;
};

export type PreparedNeighborNomination = {
  nomineeName: string;
  nomineeKind: NeighborNomineeKind;
  nomineeKindLabel: string;
  category: NeighborStoryCategory;
  categoryLabel: string;
  town: string;
  headline: string;
  story: string;
  submitterName: string;
  submitterEmail: string;
  nomineeContact?: string;
  photo?: NeighborPhotoAttachment;
  agreedToTerms: true;
  termsVersion: string;
  removalPolicyAccepted: true;
  status: NeighborNominationStatus;
  createdAt: string;
};

export type NeighborFeedPost = {
  id: string;
  nomineeName: string;
  nomineeKind: NeighborNomineeKind;
  category: NeighborStoryCategory;
  town: string;
  headline: string;
  story: string;
  submitterName: string;
  createdAt: string;
  publishedAt?: string | null;
  status: NeighborNominationStatus;
  photoUrl?: string | null;
  photoCaption?: string | null;
  photoCredit?: string | null;
  articleSlug?: string | null;
  articleTitle?: string | null;
  flagCount?: number;
  flaggedHidden?: boolean;
  removedAt?: string | null;
  removalReason?: string | null;
};

export type NeighborFlagInput = {
  postId?: unknown;
  reason?: unknown;
  details?: unknown;
};

export type PreparedNeighborFlag = {
  postId: string;
  reason: NeighborFlagReason;
  reasonLabel: string;
  details: string;
  createdAt: string;
};

export type NeighborModerationAction =
  | { type: "publish"; publishedAt?: string }
  | { type: "pickup_for_article"; articleSlug: string; articleTitle: string }
  | { type: "flag_hide"; reason?: string }
  | { type: "remove"; reason?: string };

const URL_SCHEME_PATTERN = /\b(?:https?:\/\/|ftp:\/\/|mailto:|tel:|www\.)\S+/iu;
const MARKDOWN_OR_HTML_LINK_PATTERN = /\[[^\]]+\]\([^)]+\)|<a\s+[^>]*href=/iu;
const BARE_DOMAIN_PATTERN =
  /(?:^|[\s(])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|co|us|info|biz|me|app|dev|ai|news|shop|store|local|gg|ly|to|xyz| link|page|site|online)(?:\/\S*)?(?=$|[\s),.!?])/iu;

function clipUnicodeChars(value: string, max: number): string {
  const chars = Array.from(value.trim());
  return chars.length <= max ? chars.join("") : chars.slice(0, max).join("");
}

/**
 * Returns true if the text contains any URL scheme, www address, Markdown/HTML
 * link, or bare domain link.
 */
export function containsDisallowedLink(value: string): boolean {
  if (!value) return false;
  return (
    URL_SCHEME_PATTERN.test(value) ||
    MARKDOWN_OR_HTML_LINK_PATTERN.test(value) ||
    BARE_DOMAIN_PATTERN.test(value)
  );
}

/**
 * Screens user-submitted text for length and enforces the no-links policy.
 */
export function screenNeighborText(
  value: unknown,
  fieldLabel: string,
  options: { min?: number; max: number; allowEmpty?: boolean },
): { ok: true; text: string } | { ok: false; reason: string } {
  const raw = typeof value === "string" ? value : "";
  const text = clipUnicodeChars(raw, options.max);
  const length = Array.from(text).length;

  if (length === 0) {
    if (options.allowEmpty) return { ok: true, text: "" };
    return { ok: false, reason: `Please enter the ${fieldLabel}.` };
  }
  if (options.min && length < options.min) {
    return {
      ok: false,
      reason: `Please write at least ${options.min} characters for the ${fieldLabel}.`,
    };
  }
  if (containsDisallowedLink(text)) {
    return {
      ok: false,
      reason: `Links are not allowed in ${fieldLabel}. Please share the story in your own words.`,
    };
  }
  return { ok: true, text };
}

export function isNeighborNomineeKind(value: string): value is NeighborNomineeKind {
  return NEIGHBOR_NOMINEE_KINDS.some(item => item.value === value);
}

export function isNeighborStoryCategory(value: string): value is NeighborStoryCategory {
  return NEIGHBOR_STORY_CATEGORIES.some(item => item.value === value);
}

export function isNeighborFlagReason(value: string): value is NeighborFlagReason {
  return NEIGHBOR_FLAG_REASONS.some(item => item.value === value);
}

export function nomineeKindLabel(value?: string): string {
  return NEIGHBOR_NOMINEE_KINDS.find(item => item.value === value)?.label ?? "";
}

export function neighborCategoryLabel(value?: string): string {
  return NEIGHBOR_STORY_CATEGORIES.find(item => item.value === value)?.label ?? "";
}

export function neighborCategoryPrompt(value?: string): string {
  return NEIGHBOR_STORY_CATEGORIES.find(item => item.value === value)?.prompt ?? "";
}

export function neighborFlagReasonLabel(value?: string): string {
  return NEIGHBOR_FLAG_REASONS.find(item => item.value === value)?.label ?? "";
}

function isTermsAccepted(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

export function prepareNeighborNomination(
  input: NeighborNominationInput,
  towns: string[],
  now = new Date(),
): PreparedNeighborNomination {
  const kind = typeof input.nomineeKind === "string" ? input.nomineeKind.trim() : "";
  if (!isNeighborNomineeKind(kind)) {
    throw new Error("Please choose who you are nominating.");
  }

  const category = typeof input.category === "string" ? input.category.trim() : "";
  if (!isNeighborStoryCategory(category)) {
    throw new Error("Please choose a story category.");
  }

  const town = clipUnicodeChars(typeof input.town === "string" ? input.town : "", 80);
  if (!towns.includes(town)) {
    throw new Error("Please choose a town this paper covers.");
  }

  const nomineeName = screenNeighborText(input.nomineeName, "nominee name", { min: 2, max: 120 });
  if (!nomineeName.ok) throw new Error(nomineeName.reason);

  const headline = screenNeighborText(input.headline, "headline", { min: 6, max: 140 });
  if (!headline.ok) throw new Error(headline.reason);

  const story = screenNeighborText(input.story, "story", { min: 25, max: 2500 });
  if (!story.ok) throw new Error(story.reason);

  const submitterName = screenNeighborText(input.submitterName, "your name", { min: 2, max: 100 });
  if (!submitterName.ok) throw new Error(submitterName.reason);

  const submitterEmail = clipUnicodeChars(
    typeof input.submitterEmail === "string" ? input.submitterEmail : "",
    254,
  );
  if (!submitterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw new Error("Please enter a valid email address so our editors can verify the story.");
  }

  const nomineeContact = screenNeighborText(input.nomineeContact, "nominee contact info", {
    max: 160,
    allowEmpty: true,
  });
  if (!nomineeContact.ok) throw new Error(nomineeContact.reason);

  let photo: NeighborPhotoAttachment | undefined;
  if (input.photo && typeof input.photo === "object") {
    const caption = screenNeighborText(input.photo.caption, "photo caption", {
      min: 4,
      max: 200,
    });
    if (!caption.ok) throw new Error(caption.reason);

    const credit = screenNeighborText(input.photo.credit, "photo credit", {
      min: 2,
      max: 100,
    });
    if (!credit.ok) throw new Error(credit.reason);

    if (!isTermsAccepted(input.photo.rightsConfirmed)) {
      throw new Error("Please confirm you have permission to share this photo.");
    }

    const assetId =
      typeof input.photo.assetId === "string" && input.photo.assetId.trim()
        ? clipUnicodeChars(input.photo.assetId, 80)
        : undefined;

    photo = {
      ...(assetId ? { assetId } : {}),
      caption: caption.text,
      credit: credit.text,
      rightsConfirmed: true,
    };
  }

  if (!isTermsAccepted(input.agreedToTerms)) {
    throw new Error(
      "Please agree that your submission contains no links and may be removed or moderated if needed.",
    );
  }

  return {
    nomineeName: nomineeName.text,
    nomineeKind: kind,
    nomineeKindLabel: nomineeKindLabel(kind),
    category,
    categoryLabel: neighborCategoryLabel(category),
    town,
    headline: headline.text,
    story: story.text,
    submitterName: submitterName.text,
    submitterEmail,
    ...(nomineeContact.text ? { nomineeContact: nomineeContact.text } : {}),
    ...(photo ? { photo } : {}),
    agreedToTerms: true,
    termsVersion: NEIGHBOR_SUBMISSION_TERMS.version,
    removalPolicyAccepted: true,
    status: "pending_review",
    createdAt: now.toISOString(),
  };
}

export function prepareNeighborFlag(
  input: NeighborFlagInput,
  now = new Date(),
): PreparedNeighborFlag {
  const postId = clipUnicodeChars(typeof input.postId === "string" ? input.postId : "", 120);
  if (!postId) {
    throw new Error("Choose a post to report.");
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!isNeighborFlagReason(reason)) {
    throw new Error("Please choose a reason for flagging this post.");
  }

  const details = screenNeighborText(input.details, "report note", {
    max: 500,
    allowEmpty: true,
  });
  if (!details.ok) throw new Error(details.reason);

  return {
    postId,
    reason,
    reasonLabel: neighborFlagReasonLabel(reason),
    details: details.text,
    createdAt: now.toISOString(),
  };
}

/**
 * Only published or article-featured posts that have not been flagged-hidden or
 * removed appear in the public Neighbors feed.
 */
export function visibleInNeighborFeed(post: NeighborFeedPost): boolean {
  if (post.flaggedHidden || post.removedAt) return false;
  return post.status === "published" || post.status === "featured_in_article";
}

export function filterNeighborFeed(
  posts: NeighborFeedPost[],
  filters: {
    town?: string;
    category?: string;
    followedTowns?: string[];
    onlyArticlePickups?: boolean;
  } = {},
): NeighborFeedPost[] {
  const town = filters.town?.trim() || "";
  const category = filters.category?.trim() || "";
  const followed = filters.followedTowns?.filter(Boolean) ?? [];

  return posts.filter(post => {
    if (!visibleInNeighborFeed(post)) return false;
    if (town && post.town !== town) return false;
    if (category && post.category !== category) return false;
    if (followed.length > 0 && !followed.includes(post.town)) return false;
    if (filters.onlyArticlePickups && post.status !== "featured_in_article") return false;
    return true;
  });
}

export function applyNeighborModeration(
  post: NeighborFeedPost,
  action: NeighborModerationAction,
  now = new Date(),
): NeighborFeedPost {
  switch (action.type) {
    case "publish":
      return {
        ...post,
        status: "published",
        publishedAt: action.publishedAt ?? post.publishedAt ?? now.toISOString(),
        flaggedHidden: false,
        removedAt: null,
        removalReason: null,
      };
    case "pickup_for_article":
      return {
        ...post,
        status: "featured_in_article",
        publishedAt: post.publishedAt ?? now.toISOString(),
        articleSlug: clipUnicodeChars(action.articleSlug, 200),
        articleTitle: clipUnicodeChars(action.articleTitle, 200),
        flaggedHidden: false,
        removedAt: null,
      };
    case "flag_hide":
      return {
        ...post,
        status: "flagged",
        flaggedHidden: true,
        flagCount: (post.flagCount ?? 0) + 1,
        removalReason: action.reason ? clipUnicodeChars(action.reason, 240) : post.removalReason ?? null,
      };
    case "remove":
      return {
        ...post,
        status: "removed",
        flaggedHidden: true,
        removedAt: now.toISOString(),
        removalReason: action.reason ? clipUnicodeChars(action.reason, 240) : "Removed by publication",
      };
  }
}

/**
 * Converts a neighbor or local business nomination into an initial Newsroom
 * draft structure when editors pick up a community post for a full article.
 */
export function nominationToArticleDraft(
  nomination: Pick<
    PreparedNeighborNomination,
    "nomineeName" | "nomineeKind" | "category" | "town" | "headline" | "story" | "submitterName"
  >,
): {
  title: string;
  section: string;
  community: string;
  body: string;
} {
  const section = nomination.nomineeKind === "business" ? "Local businesses" : "Community";
  const categoryName = neighborCategoryLabel(nomination.category) || "Community Spotlight";
  const title = `${nomination.nomineeName}: ${nomination.headline}`;
  const body = [
    `## ${categoryName} in ${nomination.town}`,
    "",
    nomination.story,
    "",
    `---`,
    `*Editorial intake note: Nominated by ${nomination.submitterName} (${nomineeKindLabel(nomination.nomineeKind)} in ${nomination.town}). Verify facts and subject consent before publication.*`,
  ].join("\n");

  return {
    title: clipUnicodeChars(title, 160),
    section,
    community: nomination.town,
    body,
  };
}
