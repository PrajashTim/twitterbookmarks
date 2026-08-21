type QueryMode = 'raw' | 'run'

interface ProxyResponse {
  columns?: string[]
  rows?: unknown[][]
  meta?: Record<string, unknown>
  error?: string
}

export class RemoteD1Database {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  prepare(sql: string) {
    return new RemoteD1Statement(this.url, this.token, sql)
  }
}

class RemoteD1Statement {
  private readonly params: unknown[]

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly sql: string,
    params: unknown[] = [],
  ) {
    this.params = params
  }

  bind(...params: unknown[]) {
    return new RemoteD1Statement(this.url, this.token, this.sql, params)
  }

  async raw(options?: { columnNames?: boolean }): Promise<unknown[][]> {
    const response = await this.execute('raw')
    const rows = response.rows ?? []
    return options?.columnNames ? [response.columns ?? [], ...rows] : rows
  }

  async run(): Promise<{ meta: Record<string, unknown> }> {
    const response = await this.execute('run')
    return { meta: response.meta ?? {} }
  }

  private async execute(mode: QueryMode): Promise<ProxyResponse> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: this.sql, params: this.params, mode }),
      cache: 'no-store',
    })
    const body = await response.json() as ProxyResponse
    if (!response.ok) {
      throw new Error(body.error ?? `D1 proxy returned HTTP ${response.status}`)
    }
    return body
  }
}
