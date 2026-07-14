import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

const schemaSql = `
CREATE TABLE IF NOT EXISTS "Bookmark" (
  "id" TEXT PRIMARY KEY,
  "tweetId" TEXT NOT NULL UNIQUE,
  "text" TEXT NOT NULL,
  "authorHandle" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "tweetCreatedAt" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawJson" TEXT NOT NULL,
  "semanticTags" TEXT,
  "entities" TEXT,
  "enrichedAt" TIMESTAMP(3),
  "enrichmentMeta" TEXT,
  "source" TEXT NOT NULL DEFAULT 'bookmark'
);
CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "slug" TEXT NOT NULL UNIQUE,
  "color" TEXT NOT NULL DEFAULT '#6366f1',
  "description" TEXT,
  "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "BookmarkCategory" (
  "bookmarkId" TEXT NOT NULL REFERENCES "Bookmark"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  PRIMARY KEY ("bookmarkId", "categoryId")
);
CREATE TABLE IF NOT EXISTS "MediaItem" (
  "id" TEXT PRIMARY KEY,
  "bookmarkId" TEXT NOT NULL REFERENCES "Bookmark"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "localPath" TEXT,
  "imageTags" TEXT
);
CREATE TABLE IF NOT EXISTS "ImportJob" (
  "id" TEXT PRIMARY KEY,
  "filename" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "Setting" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Bookmark_authorHandle_idx" ON "Bookmark"("authorHandle");
CREATE INDEX IF NOT EXISTS "Bookmark_tweetCreatedAt_idx" ON "Bookmark"("tweetCreatedAt");
CREATE INDEX IF NOT EXISTS "Bookmark_enrichedAt_idx" ON "Bookmark"("enrichedAt");
CREATE INDEX IF NOT EXISTS "Bookmark_source_idx" ON "Bookmark"("source");
CREATE INDEX IF NOT EXISTS "MediaItem_bookmarkId_idx" ON "MediaItem"("bookmarkId");
CREATE INDEX IF NOT EXISTS "MediaItem_url_idx" ON "MediaItem"("url");
`

type MigrationBody = {
  table?: 'schema' | 'categories' | 'bookmarks' | 'mediaItems' | 'bookmarkCategories'
  rows?: Record<string, unknown>[]
}

function dateOrNull(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function POST(request: NextRequest) {
  const token = process.env.MIGRATION_TOKEN
  if (!token || request.headers.get('Authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as MigrationBody
  const rows = Array.isArray(body.rows) ? body.rows : []

  try {
    if (body.table === 'schema') {
      await prisma.$executeRawUnsafe(schemaSql)
      return NextResponse.json({ migrated: 'schema' })
    }

    if (body.table === 'categories') {
      const result = await prisma.category.createMany({
        data: rows.map((row) => ({
          id: String(row.id),
          name: String(row.name),
          slug: String(row.slug),
          color: String(row.color ?? '#6366f1'),
          description: row.description == null ? null : String(row.description),
          isAiGenerated: Boolean(row.isAiGenerated),
          createdAt: dateOrNull(row.createdAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
      return NextResponse.json({ migrated: result.count })
    }

    if (body.table === 'bookmarks') {
      const result = await prisma.bookmark.createMany({
        data: rows.map((row) => ({
          id: String(row.id),
          tweetId: String(row.tweetId),
          text: String(row.text ?? ''),
          authorHandle: String(row.authorHandle ?? 'unknown'),
          authorName: String(row.authorName ?? 'Unknown'),
          tweetCreatedAt: dateOrNull(row.tweetCreatedAt),
          importedAt: dateOrNull(row.importedAt) ?? new Date(),
          rawJson: String(row.rawJson ?? '{}'),
          semanticTags: row.semanticTags == null ? null : String(row.semanticTags),
          entities: row.entities == null ? null : String(row.entities),
          enrichedAt: dateOrNull(row.enrichedAt),
          enrichmentMeta: row.enrichmentMeta == null ? null : String(row.enrichmentMeta),
          source: String(row.source ?? 'bookmark'),
        })),
        skipDuplicates: true,
      })
      return NextResponse.json({ migrated: result.count })
    }

    if (body.table === 'mediaItems') {
      const result = await prisma.mediaItem.createMany({
        data: rows.map((row) => ({
          id: String(row.id),
          bookmarkId: String(row.bookmarkId),
          type: String(row.type),
          url: String(row.url),
          thumbnailUrl: row.thumbnailUrl == null ? null : String(row.thumbnailUrl),
          localPath: row.localPath == null ? null : String(row.localPath),
          imageTags: row.imageTags == null ? null : String(row.imageTags),
        })),
        skipDuplicates: true,
      })
      return NextResponse.json({ migrated: result.count })
    }

    if (body.table === 'bookmarkCategories') {
      const result = await prisma.bookmarkCategory.createMany({
        data: rows.map((row) => ({
          bookmarkId: String(row.bookmarkId),
          categoryId: String(row.categoryId),
          confidence: Number(row.confidence ?? 1),
        })),
        skipDuplicates: true,
      })
      return NextResponse.json({ migrated: result.count })
    }

    return NextResponse.json({ error: 'Unknown migration table' }, { status: 400 })
  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 },
    )
  }
}
