/** Check rendered image tags, not a URL mentioned only in serialized page data. */
export function articlePhotoHtmlMatches(html: string, lead: string, social: string): boolean {
  const contains = (tag: string, url: string) => tag.includes(url) || tag.includes(encodeURIComponent(url));
  const image = [...html.matchAll(/<img\b[^>]*>/giu)].some(([tag]) => contains(tag, lead));
  const openGraph = [...html.matchAll(/<meta\b[^>]*>/giu)].some(([tag]) => {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)].map(m => [m[1].toLowerCase(), m[2] ?? m[3]]));
    return (attrs.property ?? attrs.name)?.toLowerCase() === "og:image" && attrs.content === social;
  });
  return image && openGraph;
}
