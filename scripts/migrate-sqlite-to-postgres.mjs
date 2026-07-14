import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sqlite = new Database(path.join(projectRoot, 'prisma', 'dev.db'), { readonly: true })
const token = process.env.MIGRATION_TOKEN
const migrationUrl = process.env.MIGRATION_URL ?? 'https://twitterbookmarks.vercel.app/api/admin/migrate'

if (!token) throw new Error('MIGRATION_TOKEN is required')

const tables = [
  ['categories', sqlite.prepare('SELECT * FROM Category').all()],
  ['bookmarks', sqlite.prepare('SELECT * FROM Bookmark').all()],
  ['mediaItems', sqlite.prepare('SELECT * FROM MediaItem').all()],
  ['bookmarkCategories', sqlite.prepare('SELECT * FROM BookmarkCategory').all()],
]

async function upload(table, rows = []) {
  const response = await fetch(migrationUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ table, rows }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${table}: ${result.error ?? response.statusText}`)
  return result
}

const summary = {}
try {
  await upload('schema')
  for (const [table, rows] of tables) {
    let migrated = 0
    for (let start = 0; start < rows.length; start += 100) {
      const result = await upload(table, rows.slice(start, start + 100))
      migrated += result.migrated ?? 0
    }
    summary[table] = { source: rows.length, migrated }
  }
  console.log(JSON.stringify(summary, null, 2))
} finally {
  sqlite.close()
}
