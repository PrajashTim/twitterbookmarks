import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from '@/app/generated/prisma/client'
import { RemoteD1Database } from '@/lib/remote-d1'

type D1AdapterDatabase = ConstructorParameters<typeof PrismaD1>[0]
type PrismaGlobal = typeof globalThis & { __bookmarkPrisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const url = process.env.BOOKMARKS_D1_PROXY_URL
  const token = process.env.BOOKMARKS_D1_PROXY_TOKEN

  if (!url || !token) {
    throw new Error('Cloudflare D1 proxy environment variables are not configured')
  }

  const database = new RemoteD1Database(url, token) as unknown as D1AdapterDatabase
  return new PrismaClient({ adapter: new PrismaD1(database) })
}

function getPrismaClient(): PrismaClient {
  const global = globalThis as PrismaGlobal
  global.__bookmarkPrisma ??= createPrismaClient()
  return global.__bookmarkPrisma
}

// Delay environment validation until the first database call so static builds do
// not require production-only secrets.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    return Reflect.get(getPrismaClient(), property)
  },
})

export default prisma
