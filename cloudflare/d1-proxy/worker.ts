export interface Env {
  BOOKMARKS_DB: D1Database
  D1_PROXY_TOKEN: string
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  raw(options?: { columnNames?: boolean }): Promise<unknown[][]>
  run(): Promise<{ meta: Record<string, unknown> }>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface QueryRequest {
  sql?: unknown
  params?: unknown
  mode?: unknown
}

function isAuthorized(request: Request, env: Env): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return Boolean(token && env.D1_PROXY_TOKEN && token === env.D1_PROXY_TOKEN)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/query') {
      return new Response('Not found', { status: 404 })
    }

    if (!isAuthorized(request, env)) {
      return new Response('Unauthorized', { status: 401 })
    }

    let body: QueryRequest
    try {
      body = await request.json() as QueryRequest
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof body.sql !== 'string' || !Array.isArray(body.params)) {
      return Response.json({ error: 'A SQL string and parameter array are required' }, { status: 400 })
    }

    try {
      const statement = env.BOOKMARKS_DB.prepare(body.sql).bind(...body.params)
      if (body.mode === 'run') {
        const result = await statement.run()
        return Response.json({ meta: result.meta })
      }

      const rows = await statement.raw({ columnNames: true })
      return Response.json({ columns: rows[0] ?? [], rows: rows.slice(1) })
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Database query failed' },
        { status: 400 },
      )
    }
  },
}
