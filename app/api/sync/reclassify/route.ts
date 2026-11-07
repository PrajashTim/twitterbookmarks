import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import {
  CATEGORY_DEFINITIONS,
  GENERAL_CATEGORY,
  classificationTextFor,
  classifyBookmark,
} from '@/lib/bookmark-classifier'

const MAX_BATCH = 200
// Rule-based matches top out at 0.95; anything at 1.0 was set by hand in the UI and is kept.
const MANUAL_CONFIDENCE = 0.999

function hasValidToken(request: NextRequest): boolean {
  const expected = process.env.BOOKMARK_SYNC_TOKEN
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || !supplied) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(supplied)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Re-run the rule classifier over existing bookmarks.
 * POST /api/sync/reclassify?offset=0&limit=200  (Authorization: Bearer <BOOKMARK_SYNC_TOKEN>)
 * Call repeatedly with the returned `nextOffset` until it is null.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasValidToken(request)) {
    return NextResponse.json({ error: 'Invalid sync token' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)
  const limit = Math.min(MAX_BATCH, Math.max(1, parseInt(searchParams.get('limit') ?? `${MAX_BATCH}`, 10) || MAX_BATCH))
  const dryRun = searchParams.get('dryRun') === 'true'

  // Make sure every category the classifier can emit exists, with current names/colors.
  const definitions = [...CATEGORY_DEFINITIONS, { ...GENERAL_CATEGORY }]
  if (!dryRun && offset === 0) {
    for (const def of definitions) {
      await prisma.category.upsert({
        where: { slug: def.slug },
        update: { name: def.name, color: def.color, description: def.description },
        create: { slug: def.slug, name: def.name, color: def.color, description: def.description },
      })
    }
  }
  const categoryRows = await prisma.category.findMany({ select: { id: true, slug: true } })
  const categoryBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]))

  const [total, bookmarks] = await Promise.all([
    prisma.bookmark.count(),
    prisma.bookmark.findMany({
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        text: true,
        authorName: true,
        authorHandle: true,
        rawJson: true,
        categories: { select: { categoryId: true, confidence: true } },
      },
    }),
  ])

  const changedIds: string[] = []
  const rows: { bookmarkId: string; categoryId: string; confidence: number }[] = []
  let manualKept = 0

  for (const bookmark of bookmarks) {
    if (bookmark.categories.some((c) => c.confidence >= MANUAL_CONFIDENCE)) {
      manualKept++
      continue
    }
    const matches = classifyBookmark(classificationTextFor(bookmark))
      .map((m) => ({ ...m, categoryId: categoryBySlug.get(m.slug) }))
      .filter((m): m is typeof m & { categoryId: string } => Boolean(m.categoryId))

    const before = bookmark.categories.map((c) => c.categoryId).sort().join(',')
    const after = matches.map((m) => m.categoryId).sort().join(',')
    if (before === after) continue

    changedIds.push(bookmark.id)
    for (const m of matches) rows.push({ bookmarkId: bookmark.id, categoryId: m.categoryId, confidence: m.confidence })
  }

  if (!dryRun && changedIds.length > 0) {
    await prisma.bookmarkCategory.deleteMany({ where: { bookmarkId: { in: changedIds } } })
    if (rows.length > 0) await prisma.bookmarkCategory.createMany({ data: rows })
  }

  const nextOffset = offset + bookmarks.length < total ? offset + bookmarks.length : null
  return NextResponse.json({ total, processed: bookmarks.length, changed: changedIds.length, manualKept, dryRun, nextOffset })
}
