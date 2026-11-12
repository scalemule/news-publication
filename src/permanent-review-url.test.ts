import { describe, it, expect } from 'vitest';
import { permanentReviewUrl } from './permanent-review-url';
const key = 'a'.repeat(64), origin = 'https://paper.test', path = '/news/reserved-headline';
describe('permanent invitation identity', () => {
  it.each([
    `/news/a/article?review=invitation&key=${key}`,
    `/review/invitation#${key}`,
    `${path}?review=invitation&key=${key}`,
  ])('resolves %s without replacing its capability', address => {
    const result = new URL(permanentReviewUrl(address, path, origin, 'invitation')!);
    expect(result.pathname).toBe(path);
    expect(result.searchParams.get('review')).toBe('invitation');
    expect(result.searchParams.get('key')).toBe(key);
    expect(result.hash).toBe('');
  });
  it.each(['//evil.test/story', '/news/a/article', '/review/invitation', '/news/story?key=other', '/news/../account'])('rejects a noncanonical server path %s', unsafe => {
    expect(permanentReviewUrl(`/review/invitation#${key}`, unsafe, origin, 'invitation')).toBeUndefined();
  });
  it.each([`https://evil.test/news/story?key=${key}`, `https://user@paper.test/news/story?key=${key}`, `/review/invitation?review=other&key=${key}`, '/review/invitation'])('rejects an invalid saved invitation %s', address => {
    expect(permanentReviewUrl(address, path, origin, 'invitation')).toBeUndefined();
  });
});
