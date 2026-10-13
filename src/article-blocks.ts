/**
 * Canonical structured article document model and block parser.
 *
 * Provides shared representation for visual journalism, photo essays,
 * community features, and art reviews. Consumed by both the public article
 * renderer and the private review renderer for absolute layout parity.
 */

export interface StructuredMedia {
  kind?: "image" | "video";
  contribution_id: string;
  file_id: string;
  caption: string;
  credit: string;
  alt: string;
  position: "hero" | "inline" | "gallery" | "attachment" | string;
  artist_name?: string;
  artwork_title?: string;
  artwork_date?: string;
  medium?: string;
  photographer?: string;
  source?: string;
  rights_status?: string;
}

export type ContentBlock =
  | { type: "paragraph"; html: string }
  | { type: "heading"; level: number; html: string }
  | { type: "inline_media"; media_id: string; placement: "inline" }
  | { type: "quote"; html: string; attribution?: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "divider" }
  | { type: "embed"; kind: string; id: string };

export interface StructuredDocument {
  title: string;
  subtitle?: string;
  content_markdown: string;
  section: string;
  community?: string;
  media: StructuredMedia[];
  blocks?: ContentBlock[];
}

function normalizeUuid(id: string): string {
  const clean = id.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (clean.length === 32) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  return id.trim().toLowerCase();
}

/**
 * Escapes unsafe characters for HTML text, preventing injection while allowing clean formatting.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts basic inline markdown emphasis and links to sanitized HTML without allowing script/image injection.
 */
export function sanitizeInlineMarkdown(raw: string): string {
  let text = raw.trim();
  // Strip dangerous event handler attributes and javascript: schemes
  text = text.replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, "");
  text = text.replace(/javascript\s*:/gi, "");
  text = escapeHtml(text);
  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic: *text* or _text_
  text = text.replace(/\*([^*]+?)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_]+?)_/g, "<em>$1</em>");
  // Code: `code`
  text = text.replace(/`([^`]+?)`/g, "<code>$1</code>");
  // Links: [label](url) - only http, https, mailto
  text = text.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g, (_m, label, url) => {
    return `<a href="${escapeHtml(url)}" rel="noopener noreferrer nofollow">${label}</a>`;
  });
  return text;
}

/**
 * Parses a structured document or markdown content into an ordered list of content blocks.
 * Inline media placement is explicit and deterministic, resolving against known media items.
 */
export function parseDocumentBlocks(doc: {
  content_markdown?: string;
  media?: StructuredMedia[];
  blocks?: ContentBlock[];
}): ContentBlock[] {
  const mediaList = doc.media || [];
  const mediaMap = new Map<string, StructuredMedia>();
  for (const m of mediaList) {
    mediaMap.set(normalizeUuid(m.file_id), m);
    if (m.contribution_id) {
      mediaMap.set(normalizeUuid(m.contribution_id), m);
    }
  }

  // 1. If explicit blocks were provided in the document, validate and return them.
  if (Array.isArray(doc.blocks) && doc.blocks.length > 0) {
    const validated: ContentBlock[] = [];
    for (const b of doc.blocks) {
      if (b.type === "inline_media") {
        const norm = normalizeUuid(b.media_id);
        const resolved = mediaMap.get(norm);
        if (resolved) {
          validated.push({
            type: "inline_media",
            media_id: resolved.file_id,
            placement: "inline",
          });
        }
      } else {
        validated.push(b);
      }
    }
    return validated;
  }

  // 2. Parse from content_markdown deterministically.
  const md = (doc.content_markdown || "").trim();
  if (!md) return [];

  const rawParagraphs = md.split(/\n{2,}/);
  const blocks: ContentBlock[] = [];

  for (let i = 0; i < rawParagraphs.length; i++) {
    const p = rawParagraphs[i].trim();
    if (!p) continue;

    // A. Check for explicit inline media directives:
    // Format 1: ::inline_media{id="<uuid>"}
    // Format 2: <!-- inline_media:<uuid> -->
    // Format 3: ![alt](media:<uuid>) or ![alt](https://.../<uuid>/...)
    let matchedMediaId: string | null = null;

    const directiveMatch =
      p.match(/^::inline_media\{id=["']?([0-9a-f-]{32,36})["']?\}/i) ||
      p.match(/^<!--\s*inline_media:([0-9a-f-]{32,36})\s*-->/i);

    if (directiveMatch) {
      matchedMediaId = normalizeUuid(directiveMatch[1]);
      if (!mediaMap.has(matchedMediaId)) {
        // Unauthorized or missing media referenced in directive - ignore safely
        continue;
      }
    } else {
      // Check for standalone markdown image with UUID
      const imgMatch = p.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        const src = imgMatch[2];
        const uuidMatch = src.match(/(?:media:|\/)([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}|[0-9a-f]{32})(?:\/|$|\?)/i);
        if (uuidMatch) {
          const norm = normalizeUuid(uuidMatch[1]);
          if (mediaMap.has(norm)) {
            matchedMediaId = norm;
          }
        }
      }
    }

    if (matchedMediaId && mediaMap.has(matchedMediaId)) {
      const mediaItem = mediaMap.get(matchedMediaId)!;
      blocks.push({
        type: "inline_media",
        media_id: mediaItem.file_id,
        placement: "inline",
      });

      // If the paragraph also contained an italicized caption line or if the very next
      // paragraph is a redundant caption matching the media title/caption, inspect it:
      const lines = p.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length > 1 && !lines[0].startsWith("::") && !lines[0].startsWith("<!--")) {
        // Line 0 was the image embed. Check line 1.
        const remaining = lines.slice(1).join("\n").trim();
        // If remaining is just an italicized caption that echoes the artwork title or artist,
        // it is already captured in the structured media caption/title.
        const isEcho = mediaItem.artwork_title && remaining.toLowerCase().includes(mediaItem.artwork_title.toLowerCase());
        if (!isEcho && remaining) {
          blocks.push({
            type: "paragraph",
            html: sanitizeInlineMarkdown(remaining),
          });
        }
      }
      continue;
    }

    // B. Check for headings: # H1, ## H2, ### H3, #### H4, ##### H5, ###### H6
    const headingMatch = p.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        html: sanitizeInlineMarkdown(headingMatch[2]),
      });
      continue;
    }

    // C. Check for horizontal divider: --- or ***
    if (/^(\*{3,}|-{3,})$/.test(p)) {
      blocks.push({ type: "divider" });
      continue;
    }

    // D. Check for blockquote: > Quote
    if (p.startsWith(">")) {
      const quoteText = p
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join(" ");
      blocks.push({
        type: "quote",
        html: sanitizeInlineMarkdown(quoteText),
      });
      continue;
    }

    // E. Check for list: - or * or 1.
    const lines = p.split("\n");
    const isUnordered = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const isOrdered = lines.every((l) => /^\s*\d+\.\s+/.test(l));
    if ((isUnordered || isOrdered) && lines.length > 0) {
      const items = lines.map((l) =>
        sanitizeInlineMarkdown(l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ""))
      );
      blocks.push({
        type: "list",
        ordered: isOrdered,
        items,
      });
      continue;
    }

    // F. Regular paragraph
    blocks.push({
      type: "paragraph",
      html: sanitizeInlineMarkdown(p),
    });
  }

  return blocks;
}

/**
 * Formats structured caption and credit information into clean editorial strings.
 */
export function formatArtworkCaption(media: StructuredMedia): {
  title?: string;
  artist?: string;
  mediumAndDate?: string;
  credit?: string;
  source?: string;
  captionText?: string;
} {
  let title = media.artwork_title ? media.artwork_title.trim() : undefined;
  let artist = media.artist_name ? media.artist_name.trim() : undefined;

  let mediumAndDate: string | undefined;
  if (media.medium && media.artwork_date) {
    mediumAndDate = `${media.medium} (${media.artwork_date})`;
  } else if (media.medium) {
    mediumAndDate = media.medium;
  } else if (media.artwork_date) {
    mediumAndDate = media.artwork_date;
  }

  let credit: string | undefined;
  if (media.photographer) {
    credit = `Photo: ${media.photographer}`;
  } else if (media.credit) {
    credit = media.credit.startsWith("Photo:") ? media.credit : `Photo: ${media.credit}`;
  }

  let source = media.source ? `Source: ${media.source}` : undefined;
  let captionText = !title && media.caption ? media.caption : undefined;

  // Fallback: If title or artist are not separate properties, parse structured lines from caption
  if (!title && media.caption) {
    const lines = media.caption.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && (lines[0].startsWith("“") || lines[0].startsWith('"'))) {
      title = lines[0].replace(/^[“"']|[”"']$/g, "").trim();
      artist = lines[1];
      if (lines[2] && !lines[2].startsWith("Source:")) {
        mediumAndDate = lines[2];
      }
      for (const line of lines) {
        if (line.startsWith("Source:")) {
          source = line;
        }
      }
      captionText = undefined;
    }
  }

  return {
    title,
    artist,
    mediumAndDate,
    credit,
    source,
    captionText,
  };
}

/**
 * Renders structured content blocks to public HTML, matching the reading sequence
 * and visual presentation of the review page.
 */
export function renderArticleBlocksToHtml(
  blocks: ContentBlock[],
  mediaMap: Map<string, StructuredMedia>,
  options?: { publicMediaUrlPrefix?: string }
): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        parts.push(`<p>${block.html}</p>`);
        break;
      case "heading":
        parts.push(`<h${block.level}>${block.html}</h${block.level}>`);
        break;
      case "quote":
        parts.push(`<blockquote><p>${block.html}</p>${block.attribution ? `<cite>${escapeHtml(block.attribution)}</cite>` : ""}</blockquote>`);
        break;
      case "list":
        if (block.ordered) {
          parts.push(`<ol>${block.items.map((it) => `<li>${it}</li>`).join("")}</ol>`);
        } else {
          parts.push(`<ul>${block.items.map((it) => `<li>${it}</li>`).join("")}</ul>`);
        }
        break;
      case "divider":
        parts.push("<hr />");
        break;
      case "inline_media": {
        const media = mediaMap.get(normalizeUuid(block.media_id));
        if (!media) break;
        const info = formatArtworkCaption(media);
        const prefix = options?.publicMediaUrlPrefix || "";
        const cleanFileId = normalizeUuid(media.file_id).replace(/-/g, "");
        const src = prefix ? `${prefix}/${cleanFileId}/full_display.webp` : `/api/media/${media.file_id}`;

        let captionHtml = '<figcaption class="sm-article-caption">';
        if (info.title) captionHtml += `<strong class="sm-article-artwork-title">“${escapeHtml(info.title)}”</strong> `;
        if (info.artist) captionHtml += `<span class="sm-article-artist-name">${escapeHtml(info.artist)}</span> `;
        if (info.mediumAndDate) captionHtml += `<span class="sm-article-artwork-medium">${escapeHtml(info.mediumAndDate)}</span> `;
        if (info.captionText) captionHtml += `<span class="sm-article-caption-text">${escapeHtml(info.captionText)}</span> `;
        if (info.credit) captionHtml += `<span class="sm-article-photo-credit">${escapeHtml(info.credit)}</span>`;
        captionHtml += "</figcaption>";

        parts.push(
          `<figure class="sm-article-figure sm-inline-media" data-media-id="${escapeHtml(media.file_id)}">` +
            `<img src="${escapeHtml(src)}" alt="${escapeHtml(media.alt || info.title || "Article artwork")}" loading="lazy" decoding="async" />` +
            captionHtml +
          `</figure>`
        );
        break;
      }
      default:
        break;
    }
  }

  return parts.join("\n");
}
