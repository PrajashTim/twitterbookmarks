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

  it('recognises sales, content and sports posts that used to land in General', () => {
    expect(classifyBookmark('first agency attempt: did zero outreach, failed')[0].slug).toBe('sales-outreach')
    expect(classifyBookmark('My easy way to get cinematic lighting for your videos.')[0].slug).toBe('content-creation')
    expect(classifyBookmark("Olise just dropped the coldest Ballon d'Or film.")[0].slug).toBe('sports')
  })

  it('does not treat a lone "her" as a dating post', () => {
    expect(classifyBookmark('Sustainable habits she started at 18').map((m) => m.slug))
      .not.toContain('dating-relationships')
  })

  it('falls back to General', () => {
    expect(classifyBookmark('A quiet afternoon by the window')).toEqual([
      { slug: 'general', confidence: 0.55 },
    ])
  })
})
