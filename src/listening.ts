import { localPublications } from './network'

export interface ListeningArticle {
  id: string; slug: string; title: string; canonical_url?: string | null
  section?: string | null; published_at?: string
  editorial?: { duplicate_url?: string; modified_at?: string } | null
  audio?: { url?: string | null; duration_ms?: number | null }
}
/** Public metadata only. Never cache signed recording URLs in reader history. */
export function publicationListeningTrack(article: ListeningArticle, publicationId: string, publicationName: string, origin: string) {
  const articleUrl = new URL(`/news/${encodeURIComponent(article.slug)}`, origin).href
  let storyId = articleUrl
  if (article.canonical_url) {
    try {
      const canonical = new URL(article.canonical_url)
      if (canonical.protocol === 'https:' && !canonical.username && !canonical.password && /^\/news\/[^/]+\/?$/.test(canonical.pathname)
        && localPublications.some(item => new URL(item.url).hostname === canonical.hostname.replace(/^www\./, ''))) {
        canonical.search = ''; canonical.hash = ''; canonical.hostname = canonical.hostname.replace(/^www\./, '')
        canonical.pathname = canonical.pathname.replace(/\/$/, '')
        storyId = canonical.href
      }
    } catch { /* Invalid canonicals do not join otherwise unrelated stories. */ }
  }
  const revision = article.editorial?.modified_at
  return { id: article.id, publicationId, publicationName, title: article.title, articleUrl, storyId,
    ...(revision && Number.isFinite(Date.parse(revision)) ? { revision } : {}),
    ...(article.audio?.duration_ms && article.audio.duration_ms > 0 ? { durationSeconds: article.audio.duration_ms / 1000 } : {}),
    ...(article.section ? { section: article.section } : {}), ...(article.published_at ? { publishedAt: article.published_at } : {}) }
}

/** Bounded public read fan-out, initiated only when a reader requests a catch-up queue. */
export async function publicationListeningCandidates<T extends ListeningArticle>(items: T[], read: (slug: string) => Promise<ListeningArticle>, publicationId: string, publicationName: string, origin: string) {
  const output: ReturnType<typeof publicationListeningTrack>[] = []
  const recent = items.filter(item => !item.editorial?.duplicate_url).slice(0, 30)
  let failures = 0
  for (let i = 0; i < recent.length; i += 4) {
    const batch = await Promise.allSettled(recent.slice(i, i + 4).map(item => read(item.slug)))
    for (const result of batch) {
      if (result.status === 'rejected') { failures++; continue }
      const article = result.value
      if (!article.editorial?.duplicate_url && article.audio?.url && article.audio.duration_ms && article.audio.duration_ms > 0)
        output.push(publicationListeningTrack(article, publicationId, publicationName, origin))
    }
  }
  // Distinguish a dependency failure from an honest empty audio inventory.
  if (!output.length && failures) throw new Error('Audio inventory could not be loaded')
  return output.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}
