import type { NewsArticle } from './types'

/** A reader projection, never an internal reporting package. */
export function ArticleProvenance({ metadata }: Pick<NewsArticle, 'metadata'>) {
  const origin = metadata?.reporting?.canonical_origin || metadata?.editorial_origin
  const reporting = metadata?.reporting
  const label = origin === 'COMMENTARY' ? 'Commentary' : origin === 'ANALYSIS' ? 'Analysis' : null
  const sources = readerSources(metadata?.citations)
  const related = readerSources(reporting?.related_links?.map(url => ({ url })))
  const credit = reporting?.credit?.trim()
  const byline = reporting?.original_byline?.trim()
  const wire = reporting?.wire_credit?.trim()
  if (!label && !credit && !wire && !sources.length && !related.length) return null
  return <aside aria-label="About this reporting" className="article-provenance">
    {label && <p className="article-provenance__label">{label}</p>}
    {credit && <p>{credit}{byline ? ` · ${byline}` : ''}</p>}
    {wire && <p>{wire}</p>}
    {!!sources.length && <details><summary>Sources</summary><ul>{sources.map(source => <li key={source.url}><a href={source.url} rel="noopener noreferrer" target="_blank">{source.title || source.publisher || new URL(source.url).hostname}</a></li>)}</ul></details>}
    {!!related.length && <details><summary>Related reporting</summary><ul>{related.map(link => <li key={link.url}><a href={link.url} rel="noopener noreferrer">{new URL(link.url).hostname}{new URL(link.url).pathname}</a></li>)}</ul></details>}
  </aside>
}

export function readerSources(input: unknown): { url: string; title?: string; publisher?: string }[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>(); const output: { url: string; title?: string; publisher?: string }[] = []
  for (const value of input) {
    if (!value || typeof value.url !== 'string') continue
    try {
      const url = new URL(value.url)
      if (url.protocol !== 'https:' || url.username || url.password || seen.has(url.href)) continue
      seen.add(url.href)
      output.push({ url: url.href, title: typeof value.title === 'string' ? Array.from(value.title).slice(0, 500).join('') : undefined, publisher: typeof value.publisher === 'string' ? Array.from(value.publisher).slice(0, 255).join('') : undefined })
      if (output.length === 5) break
    } catch { continue }
  }
  return output
}
