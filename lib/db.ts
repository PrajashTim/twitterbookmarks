import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/app/generated/prisma/client'

// The placeholder lets build/test imports initialize without opening a connection.
const dbUrl =
  process.env.DATABASE_POSTGRES_URL ??
  process.env.DATABASE_URL ??
  'postgresql://unused:unused@localhost:5432/unused'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
