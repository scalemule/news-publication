import type { NewsArticle, NewsPublication } from "./types";

/** https URL with no userinfo. Anything else is dropped from public markup. */
export function publicHttps(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function articleUrl(canonical: string, slug: string): string {
  return `${canonical.replace(/\/$/, "")}/news/${encodeURIComponent(slug)}`;
}

/** Describe the local edition while retaining the designated reporting source. */
export function newsArticleJsonLd(
  publication: NewsPublication,
  article: NewsArticle,
  canonical: string,
  authorName?: string | null,
) {
  const url = articleUrl(canonical, article.slug);
  const canonicalUrl = publicHttps(article.canonical_url) ?? url;
  const image = publicHttps(article.cover_image_url);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt ?? undefined,
    datePublished: article.published_at,
    // updated_at also changes for media/operational maintenance. A trusted
    // editorial modification timestamp is required before emitting dateModified.
    image: image ? [image] : undefined,
    mainEntityOfPage: url,
    url,
    ...(canonicalUrl !== url ? { isBasedOn: canonicalUrl } : {}),
    articleSection: article.section || undefined,
    // The publication byline is known to be an organization. Do not infer a
    // person's identity or classify an untyped external byline as a newsroom.
    author: { ...(!authorName || authorName === publication.name ? { "@type": "Organization" } : {}), name: authorName || publication.name },
    publisher: { "@type": "NewsMediaOrganization", name: publication.name, url: canonical },
  };
}

export function publicationJsonLd(publication: NewsPublication, canonical: string) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: publication.name,
    url: canonical,
    description: publication.description,
    areaServed: publication.towns,
  };
}

/**
 * Fields a Next.js `generateMetadata` spreads in.
 * Preview hosts pass `indexable: false` and stay out of Google.
 */
export function publicationMeta(publication: NewsPublication, canonical: string, indexable: boolean) {
  const title = `${publication.name} | Local news, business & community`;
  return {
    title,
    description: publication.description,
    canonical,
    indexable,
    openGraph: {
      title: publication.name,
      description: publication.description,
      url: canonical,
      siteName: publication.name,
      type: "website" as const,
    },
  };
}

export function articleMeta(publication: NewsPublication, article: NewsArticle, canonical: string, indexable: boolean) {
  const url = articleUrl(canonical, article.slug);
  const canonicalUrl = publicHttps(article.canonical_url) ?? url;
  const image = publicHttps(article.og_image_url) ?? publicHttps(article.cover_image_url);
  return {
    title: article.title,
    description: article.seo_description ?? article.excerpt ?? publication.description,
    canonical: canonicalUrl,
    indexable: indexable && !article.no_index,
    openGraph: {
      type: "article" as const,
      siteName: publication.name,
      title: article.title,
      description: article.excerpt ?? undefined,
      url,
      publishedTime: article.published_at,
      images: image ? [image] : [],
    },
  };
}

/** One line a paper can serve at /llms.txt. Towns and the article path stay explicit. */
export function llmsText(publication: NewsPublication, canonical: string): string {
  const origin = canonical.replace(/\/$/, "");
  return [
    `# ${publication.name}`,
    publication.description,
    `Towns: ${publication.towns.join(", ")}`,
    `Site: ${origin}`,
    `Latest: ${origin}/news`,
    `Sitemap: ${origin}/sitemap.xml`,
  ].join("\n");
}
