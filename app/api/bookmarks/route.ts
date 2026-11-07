import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { orderIdsBySeed, pickRandomOffset } from '@/lib/random'
import { avatarFromRaw } from '@/lib/avatar'
import { hasSearch, parseSearchQuery, scoreCandidates, sqlVariants, type SearchCandidate } from '@/lib/search'

const BOOKMARK_INCLUDE = {
  mediaItems: true,
  categories: {
    include: {
      category: { select: { id: true, name: true, slug: true, color: true } },
    },
  },
} as const

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

function parseIntParam(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) || parsed < 1 ? defaultValue : parsed
}

export async function DELETE(): Promise<NextResponse> {
  try {
    // Delete media items and category links first (cascade), then bookmarks
    await prisma.$transaction([
      prisma.bookmarkCategory.deleteMany({}),
      prisma.mediaItem.deleteMany({}),
      prisma.bookmark.deleteMany({}),
      prisma.category.deleteMany({}),
    ])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Clear bookmarks error:', err)
    return NextResponse.json(
      { error: `Failed to clear bookmarks: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)

  const q = searchParams.get('q')?.trim() ?? ''
  const source = searchParams.get('source')?.trim() ?? ''
  const categorySlug = searchParams.get('category')?.trim() ?? ''
  const mediaType = searchParams.get('mediaType')?.trim() ?? ''
  const uncategorized = searchParams.get('uncategorized') === 'true'
  const sortParam = searchParams.get('sort')?.trim() ?? 'newest'
  const randomSeed = searchParams.get('seed')?.slice(0, 64) ?? ''
  const random = searchParams.get('random') === 'true'
  const page = parseIntParam(searchParams.get('page'), DEFAULT_PAGE)
  const limit = Math.min(parseIntParam(searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT)
  const skip = (page - 1) * limit
  const orderDir = sortParam === 'oldest' ? 'asc' : 'desc'

  const where: Record<string, unknown> = {}

  if (source === 'bookmark' || source === 'like') {
    where.source = source
  }

  const parsed = parseSearchQuery(q)
  const searching = hasSearch(parsed)

  if (uncategorized) {
    where.categories = { none: {} }
  } else if (categorySlug) {
    where.categories = {
      some: {
        category: { slug: categorySlug },
      },
    }
  }

  if (mediaType === 'photo' || mediaType === 'video') {
    where.mediaItems = {
      some: { type: mediaType },
    }
  }

  try {
    if (searching && !random && sortParam !== 'random') {
      return NextResponse.json(await runSearch(where, parsed, sortParam, skip, limit))
    }

    if (searching) {
      // Random pick / shuffle within a search: use a simple superset filter.
      where.AND = parsed.terms.map((term) => ({
        OR: sqlVariants(term).flatMap((v) => [{ text: { contains: v } }, { authorHandle: { contains: v } }]),
      }))
    }

    if (random) {
      const total = await prisma.bookmark.count({ where })
      if (total === 0) {
        return NextResponse.json({ bookmarks: [], total, page: 1, limit: 1 })
      }

      const bookmark = await prisma.bookmark.findFirst({
        where,
        skip: pickRandomOffset(total),
        include: {
          mediaItems: true,
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                },
              },
            },
          },
        },
      })

      if (!bookmark) {
        return NextResponse.json({ bookmarks: [], total, page: 1, limit: 1 })
      }

      return NextResponse.json({
        bookmarks: [formatBookmark(bookmark)],
        total,
        page: 1,
        limit: 1,
      })
    }

    if (sortParam === 'random') {
      const [idRows, total] = await Promise.all([
        prisma.bookmark.findMany({ where, select: { id: true } }),
        prisma.bookmark.count({ where }),
      ])
      const pageIds = orderIdsBySeed(idRows.map((row) => row.id), randomSeed)
        .slice(skip, skip + limit)

      const pageBookmarks = pageIds.length === 0
        ? []
        : await prisma.bookmark.findMany({
            where: { ...where, id: { in: pageIds } },
            include: {
              mediaItems: true,
              categories: {
                include: {
                  category: {
                    select: { id: true, name: true, slug: true, color: true },
                  },
                },
              },
            },
          })
      const bookmarkById = new Map(pageBookmarks.map((bookmark) => [bookmark.id, bookmark]))

      return NextResponse.json({
        bookmarks: pageIds
          .map((id) => bookmarkById.get(id))
          .filter((bookmark): bookmark is NonNullable<typeof bookmark> => Boolean(bookmark))
          .map(formatBookmark),
        total,
        page,
        limit,
      })
    }

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ tweetCreatedAt: orderDir }, { importedAt: orderDir }],
        include: {
          mediaItems: true,
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                },
              },
            },
          },
        },
      }),
      prisma.bookmark.count({ where }),
    ])

    const formatted = bookmarks.map(formatBookmark)

    return NextResponse.json({
      bookmarks: formatted,
      total,
      page,
      limit,
    })
  } catch (err) {
    console.error('Bookmarks fetch error:', err)
    return NextResponse.json(
      { error: `Failed to fetch bookmarks: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

type SearchFilter = Record<string, unknown>

async function runSearch(
  baseWhere: SearchFilter,
  parsed: ReturnType<typeof parseSearchQuery>,
  sortParam: string,
  skip: number,
  limit: number,
) {
  // SQL prefilter: a cheap superset (LIKE on stems + synonyms). Exact matching and
  // ranking happen in JS so short words like "ai" don't match "said".
  const termFilter = (term: string) => ({
    OR: sqlVariants(term).flatMap((v) => [
      { text: { contains: v } },
      { authorName: { contains: v } },
      { authorHandle: { contains: v } },
      { semanticTags: { contains: v } },
      { categories: { some: { category: { name: { contains: v } } } } },
    ]),
  })

  const and: SearchFilter[] = []
  for (const phrase of parsed.phrases) and.push({ text: { contains: phrase } })
  if (parsed.authors.length > 0) {
    and.push({ OR: parsed.authors.map((a) => ({ authorHandle: { contains: a } })) })
  }

  const select = {
    id: true,
    text: true,
    authorName: true,
    authorHandle: true,
    semanticTags: true,
    tweetCreatedAt: true,
    importedAt: true,
    categories: { select: { category: { select: { name: true } } } },
  } as const

  async function candidatesFor(mode: 'all' | 'any') {
    const termClauses = parsed.terms.map(termFilter)
    const where = {
      ...baseWhere,
      AND: [
        ...and,
        ...(termClauses.length === 0 ? [] : mode === 'all' ? termClauses : [{ OR: termClauses }]),
      ],
    }
    const rows = await prisma.bookmark.findMany({ where, select })
    const candidates: SearchCandidate[] = rows.map((row) => ({
      ...row,
      categoryNames: row.categories.map((c) => c.category.name),
    }))
    return scoreCandidates(candidates, parsed, mode)
  }

  let matchMode: 'all' | 'any' = 'all'
  let scored = await candidatesFor('all')
  if (scored.length === 0 && parsed.terms.length > 1) {
    matchMode = 'any'
    scored = await candidatesFor('any')
  }

  if (sortParam === 'newest' || sortParam === 'oldest') {
    // Explicit date sort requested: keep matches, order by date.
    const rows = await prisma.bookmark.findMany({
      where: { id: { in: scored.map((s) => s.id) } },
      select: { id: true, tweetCreatedAt: true, importedAt: true },
    })
    const dir = sortParam === 'oldest' ? 1 : -1
    rows.sort((a, b) => dir * (((a.tweetCreatedAt ?? a.importedAt).getTime()) - ((b.tweetCreatedAt ?? b.importedAt).getTime())))
    scored = rows.map((r) => ({ id: r.id, score: 0, matchedTerms: 0 }))
  }

  const pageIds = scored.slice(skip, skip + limit).map((s) => s.id)
  const pageRows = pageIds.length === 0
    ? []
    : await prisma.bookmark.findMany({ where: { id: { in: pageIds } }, include: BOOKMARK_INCLUDE })
  const byId = new Map(pageRows.map((row) => [row.id, row]))

  return {
    bookmarks: pageIds.map((id) => byId.get(id)).filter((b): b is NonNullable<typeof b> => Boolean(b)).map(formatBookmark),
    total: scored.length,
    page: Math.floor(skip / limit) + 1,
    limit,
    matchMode,
    highlight: parsed.highlight,
  }
}

interface BookmarkRecord {
  id: string
  tweetId: string
  text: string
  authorHandle: string
  authorName: string
  source: string
  tweetCreatedAt: Date | null
  importedAt: Date
  rawJson?: string
  mediaItems: { id: string; type: string; url: string; thumbnailUrl: string | null }[]
  categories: {
    confidence: number
    category: { id: string; name: string; slug: string; color: string }
  }[]
}

function formatBookmark(bookmark: BookmarkRecord) {
  return {
    avatarUrl: avatarFromRaw(bookmark.rawJson),
    id: bookmark.id,
    tweetId: bookmark.tweetId,
    text: bookmark.text,
    authorHandle: bookmark.authorHandle,
    authorName: bookmark.authorName,
    source: bookmark.source,
    tweetCreatedAt: bookmark.tweetCreatedAt?.toISOString() ?? null,
    importedAt: bookmark.importedAt.toISOString(),
    mediaItems: bookmark.mediaItems.map((media) => ({
      id: media.id,
      type: media.type,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
    })),
    categories: bookmark.categories.map((bookmarkCategory) => ({
      id: bookmarkCategory.category.id,
      name: bookmarkCategory.category.name,
      slug: bookmarkCategory.category.slug,
      color: bookmarkCategory.category.color,
      confidence: bookmarkCategory.confidence,
    })),
  }
}
