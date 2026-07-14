import { describe, expect, it } from 'vitest'
import { classifyBookmark } from '@/lib/bookmark-classifier'

describe('classifyBookmark', () => {
  it('assigns a clear topical category', () => {
    expect(classifyBookmark('A new OpenAI model improves AI agent prompting')[0].slug)
      .toBe('ai-resources')
  })

  it('supports multiple strong topics', () => {
    const slugs = classifyBookmark('Build a React AI product with the OpenAI API and Next.js')
      .map((match) => match.slug)
    expect(slugs).toContain('ai-resources')
    expect(slugs).toContain('dev-tools')
  })

  it('falls back to General', () => {
    expect(classifyBookmark('A quiet afternoon by the window')).toEqual([
      { slug: 'general', confidence: 0.55 },
    ])
  })
})
