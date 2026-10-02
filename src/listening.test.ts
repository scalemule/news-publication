import { describe, it, expect } from 'vitest'
import { publicationListeningTrack, publicationListeningCandidates } from './listening'
const story = { id: 'one', slug: 'Новости-社区-🎧', title: 'Local story', published_at: '2026-10-02', audio: { url: 'https://media.example/signed?secret=private', duration_ms: 60000 } }
describe('shared publication listening metadata', () => {
  it('deduplicates syndicated copies without leaking signed media or changing tenant identity', () => {
    const a = publicationListeningTrack(story, 'walnut', 'Walnut Creek', 'https://walnutcreektimes.com')
    const b = publicationListeningTrack({ ...story, id: 'two', canonical_url: a.articleUrl }, 'bay', 'Bay Area', 'https://bayareachronicle.com')
    expect(a.storyId).toBe(b.storyId)
    expect(b.publicationId).toBe('bay')
    expect(b.articleUrl).toContain('bayareachronicle.com')
    expect(JSON.stringify(b)).not.toContain('signed')
    expect(b.durationSeconds).toBe(60)
  })
  it('rejects outside canonicals and carries only explicit editorial revisions', () => {
    const a = publicationListeningTrack({ ...story, canonical_url: 'https://attacker.example/news/a' }, 'bay', 'Bay', 'https://bayareachronicle.com')
    expect(a.storyId).toBe(a.articleUrl)
    expect(a.revision).toBeUndefined()
  })
  it('only recommends real available recordings and treats an upstream failure as an error', async () => {
    expect(await publicationListeningCandidates([story], async () => ({ ...story, audio: undefined }), 'bay', 'Bay', 'https://bayareachronicle.com')).toEqual([])
    await expect(publicationListeningCandidates([story], async () => { throw Error('offline') }, 'bay', 'Bay', 'https://bayareachronicle.com')).rejects.toThrow('inventory')
  })
})
