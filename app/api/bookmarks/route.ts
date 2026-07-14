import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { orderIdsBySeed, pickRandomOffset } from '@/lib/random'

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

  if (q) {
    where.text = { contains: q }
  }

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

interface BookmarkRecord {
  id: string
  tweetId: string
  text: string
  authorHandle: string
  authorName: string
  source: string
  tweetCreatedAt: Date | null
  importedAt: Date
  mediaItems: { id: string; type: string; url: string; thumbnailUrl: string | null }[]
  categories: {
    confidence: number
    category: { id: string; name: string; slug: string; color: string }
  }[]
}

function formatBookmark(bookmark: BookmarkRecord) {
  return {
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
