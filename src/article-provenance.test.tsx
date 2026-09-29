import { describe, expect, it } from 'vitest'
import { ArticleProvenance, readerSources } from './article-provenance'
describe('reader reporting projection', () => {
  it('caps and deduplicates references while stripping internal records', () => {
    const sources = Array.from({ length: 8 }, (_, i) => ({ url: `https://example.org/${i}`, title: `Document ${i}`, notes: 'PRIVATE', supports: 'PRIVATE', provenance: { artifact_id: 'PRIVATE' } }))
    expect(readerSources([sources[0], ...sources])).toHaveLength(5)
    expect(JSON.stringify(readerSources(sources))).not.toContain('PRIVATE')
    expect(readerSources([{ url: 'javascript:alert(1)' }, { url: 'https://secret@example.org' }])).toEqual([])
  })
  it('labels commentary and preserves network credit without rendering private notes', () => {
    const metadata = { editorial_origin: 'NETWORK_SYNDICATED' as const, reporting: { canonical_origin: 'COMMENTARY', edition_id: 'edition', story_id: 'story', story_revision: 2, originating_publication_id: 'publication', credit: 'Network reporting', original_byline: 'A reporter', related_links: ['https://example.org/news/council'], notes: 'PRIVATE' } }
    const html = JSON.stringify(ArticleProvenance({ metadata }))
    expect(html).toContain('Commentary'); expect(html).toContain('Network reporting'); expect(html).toContain('A reporter'); expect(html).toContain('Related reporting'); expect(html).toContain('https://example.org/news/council'); expect(html).not.toContain('PRIVATE')
    expect(ArticleProvenance({})).toBeNull()
  })
})
