const decode = (value: string) =>
  value.replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/giu, (s) => {
    const named: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
      "&#39;": "'",
    };
    if (named[s.toLowerCase()]) return named[s.toLowerCase()];
    const hex = s.toLowerCase().startsWith("&#x");
    const n = parseInt(s.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff
      ? String.fromCodePoint(n)
      : s;
  });
const text = (html: string) =>
  decode(html.replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
const plain = (value: string) => value.replace(/\s+/gu, " ").trim();
/**
 * Requires visible body and actual card asides; serialized page data is not delivery.
 * Cards are recognised by either rendering the papers use: the package's `article-verified-card`
 * aside, or the papers' entity cards (`<aside data-entity-card="venue|event|…">`), each titled by its h2.
 * When the edit carried a search title, the document's `<title>` must show it (a site may append its
 * own name after it).
 */
export function articleEditHtmlMatches(
  html: string,
  expected: { title: string; headline?: string | null; seo_title?: string | null; content_html: string; card_titles: string[]; tags?: { name: string; slug: string }[] },
): boolean {
  const visible = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ");
  // The page's h1 is the display headline when the article carries one, else the title.
  const shown = plain(expected.headline?.trim() || expected.title);
  const headline = [...visible.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].some(
    (m) => text(m[1]) === shown,
  );
  if (!headline) return false;
  const seo = expected.seo_title?.trim();
  if (seo) {
    const pageTitle = text(visible.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? "");
    if (pageTitle !== plain(seo) && !pageTitle.startsWith(plain(seo) + " ")) return false;
  }
  const paragraphs = [
    ...expected.content_html.matchAll(
      /<(p|li|h[2-6]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/giu,
    ),
  ]
    .map((m) => text(m[2]))
    .filter(Boolean);
  const all = text(visible);
  if (!paragraphs.length || !paragraphs.every((p) => all.includes(p)))
    return false;
  if (expected.tags?.length) {
    const links = [...visible.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu)];
    if (!expected.tags.every(tag => links.some(link => {
      try { const url = new URL(decode(link[1]), "https://publication.example"); return url.pathname === "/news" && url.searchParams.get("tag") === tag.slug && text(link[2]).replace(/^#\s*/u, "") === tag.name; }
      catch { return false; }
    }))) return false;
  }
  const titles = [...visible.matchAll(/<aside\b([^>]*)>([\s\S]*?)<\/aside>/giu)]
    .filter((m) => /\bdata-entity-card=["'][^"']+["']/iu.test(m[1]) || /class=["'][^"']*\barticle-verified-card\b/iu.test(m[1]))
    .flatMap((m) => {
      const first = m[2].match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/iu);
      return first ? [text(first[1])] : [];
    });
  return (
    JSON.stringify(titles.sort()) ===
    JSON.stringify(expected.card_titles.map(plain).sort())
  );
}
