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
/** Requires visible body and actual card asides; serialized page data is not delivery. */
export function articleEditHtmlMatches(
  html: string,
  expected: { title: string; content_html: string; card_titles: string[] },
): boolean {
  const visible = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ");
  const headline = [...visible.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].some(
    (m) => text(m[1]) === plain(expected.title),
  );
  if (!headline) return false;
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
  const titles = [
    ...visible.matchAll(
      /<aside\b[^>]*class=["'][^"']*\barticle-verified-card\b[^"']*["'][^>]*>([\s\S]*?)<\/aside>/giu,
    ),
  ].flatMap((m) =>
    [...m[1].matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/giu)].map((m) => text(m[1])),
  );
  return (
    JSON.stringify(titles.sort()) ===
    JSON.stringify(expected.card_titles.map(plain).sort())
  );
}
