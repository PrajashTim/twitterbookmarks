import { describe, expect, it } from 'vitest'
import { parseSearchQuery, scoreCandidates, termRegex, type SearchCandidate } from '@/lib/search'

function candidate(id: string, text: string, extra: Partial<SearchCandidate> = {}): SearchCandidate {
  return {
    id,
    text,
    authorName: 'Someone',
    authorHandle: 'someone',
    semanticTags: null,
    tweetCreatedAt: new Date('2026-01-01'),
    importedAt: new Date('2026-01-01'),
    categoryNames: [],
    ...extra,
  }
}

describe('parseSearchQuery', () => {
  it('splits words, phrases, authors and excludes', () => {
    const q = parseSearchQuery('cold email "front-end offer" @AaronxShepherd -linkedin')
    expect(q.terms).toEqual(['cold', 'email'])
    expect(q.phrases).toEqual(['front-end offer'])
    expect(q.authors).toEqual(['aaronxshepherd'])
    expect(q.excludes).toEqual(['linkedin'])
  })

  it('drops stop words but keeps a query made only of them', () => {
    expect(parseSearchQuery('how to get clients').terms).toEqual(['get', 'clients'])
    expect(parseSearchQuery('the').terms).toEqual(['the'])
  })
})

describe('termRegex', () => {
  it('matches short terms as whole words only', () => {
    expect(termRegex('ai').test('new AI agent')).toBe(true)
    expect(termRegex('ai').test('he said it again')).toBe(false)
  })

  it('matches common word endings but not unrelated longer words', () => {
    expect(termRegex('agencies').test('first agency attempt')).toBe(true)
    expect(termRegex('lighting').test('cinematic light setup')).toBe(true)
    expect(termRegex('lighting').test('Lightreel launched')).toBe(false)
  })
})

describe('scoreCandidates', () => {
  const items = [
    candidate('a', 'first agency attempt: did zero outreach, failed'),
    candidate('b', 'outreach tips for founders'),
    candidate('c', 'my agency grew fast'),
  ]

  it('requires every word in "all" mode', () => {
    const ids = scoreCandidates(items, parseSearchQuery('agency outreach'), 'all').map((r) => r.id)
    expect(ids).toEqual(['a'])
  })

  it('ranks closest matches first in "any" mode', () => {
    const ids = scoreCandidates(items, parseSearchQuery('agency outreach zebra'), 'any').map((r) => r.id)
    expect(ids[0]).toBe('a')
    expect(ids).toHaveLength(3)
  })

  it('honours excludes and author filters', () => {
    const q = parseSearchQuery('agency -outreach')
    expect(scoreCandidates(items, q, 'all').map((r) => r.id)).toEqual(['c'])
    const byAuthor = scoreCandidates(
      [...items, candidate('d', 'agency life', { authorHandle: 'TheRealGame' })],
      parseSearchQuery('agency @therealgame'),
      'all',
    )
    expect(byAuthor.map((r) => r.id)).toEqual(['d'])
  })
})
