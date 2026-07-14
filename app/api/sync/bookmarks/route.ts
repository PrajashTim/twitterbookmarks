import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { classifyBookmark } from '@/lib/bookmark-classifier'
import { extractMedia, tweetFullText, type TweetResult } from '@/lib/twitter-api'

const MAX_TWEETS_PER_REQUEST = 100

function hasValidToken(request: NextRequest): boolean {
  const expected = process.env.BOOKMARK_SYNC_TOKEN
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || !supplied) return false

  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)
}

function parsedDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasValidToken(request)) {
    return NextResponse.json({ error: 'Invalid sync token' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { tweets?: TweetResult[] } | null
  if (!body || !Array.isArray(body.tweets) || body.tweets.length === 0) {
    return NextResponse.json({ error: 'No tweets provided' }, { status: 400 })
  }
  if (body.tweets.length > MAX_TWEETS_PER_REQUEST) {
    return NextResponse.json({ error: `Maximum ${MAX_TWEETS_PER_REQUEST} tweets per request` }, { status: 413 })
  }

  const categoryRows = await prisma.category.findMany({ select: { id: true, slug: true } })
  const categoryBySlug = new Map(categoryRows.map((category) => [category.slug, category.id]))

  let imported = 0
  let updated = 0
  let skipped = 0

  for (let tweet of body.tweets) {
    if (tweet.__typename === 'TweetWithVisibilityResults' && tweet.tweet) tweet = tweet.tweet
    if (!tweet.rest_id) continue

    const fullText = tweetFullText(tweet).trim()
    const user = tweet.core?.user_results?.result?.legacy ?? {}
    const classificationText = `${fullText}\n${user.name ?? ''}\n${user.screen_name ?? ''}`
    const matches = classifyBookmark(classificationText)
      .map((match) => ({ ...match, categoryId: categoryBySlug.get(match.slug) }))
      .filter((match): match is typeof match & { categoryId: string } => Boolean(match.categoryId))

    const existing = await prisma.bookmark.findUnique({
      where: { tweetId: tweet.rest_id },
      select: { id: true, text: true, categories: { select: { categoryId: true } } },
    })

    if (existing) {
      const hasLongerText = fullText.length > existing.text.length
      const needsCategories = existing.categories.length === 0 && matches.length > 0
      if (hasLongerText || needsCategories) {
        await prisma.bookmark.update({
          where: { id: existing.id },
          data: {
            ...(hasLongerText ? { text: fullText, rawJson: JSON.stringify(tweet) } : {}),
            ...(needsCategories ? {
              enrichedAt: new Date(),
              categories: {
                create: matches.map((match) => ({
                  category: { connect: { id: match.categoryId } },
                  confidence: match.confidence,
                })),
              },
            } : {}),
          },
        })
        updated++
      } else {
        skipped++
      }
      continue
    }

    const media = extractMedia(tweet)
    await prisma.bookmark.create({
      data: {
        tweetId: tweet.rest_id,
        text: fullText,
        authorHandle: user.screen_name ?? 'unknown',
        authorName: user.name ?? 'Unknown',
        tweetCreatedAt: parsedDate(tweet.legacy?.created_at),
        rawJson: JSON.stringify(tweet),
        enrichedAt: new Date(),
        source: 'bookmark',
        mediaItems: media.length > 0 ? {
          create: media.map((item) => ({
            type: item.type,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl ?? null,
          })),
        } : undefined,
        categories: matches.length > 0 ? {
          create: matches.map((match) => ({
            category: { connect: { id: match.categoryId } },
            confidence: match.confidence,
          })),
        } : undefined,
      },
    })
    imported++
  }

  return NextResponse.json({ imported, updated, skipped, received: body.tweets.length })
}
