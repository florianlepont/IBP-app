export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

type ApiRequestOptions = {
  baseUrl: string
  path: string
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  token?: string
  body?: BodyInit | null
  json?: unknown
  headers?: Record<string, string>
  expectJson?: boolean
  timeoutMs?: number
}

type JsonLike = Record<string, unknown>
const DEFAULT_API_TIMEOUT_MS = 15000

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "")
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function errorMessageForStatus(status: number, parsedBody: unknown): string {
  if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
    const body = parsedBody as JsonLike
    if (typeof body.message === "string" && body.message.trim().length > 0) {
      return body.message
    }
  }
  return `HTTP ${status}`
}

function resolveTimeoutMs(timeoutMs?: number): number {
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs
  }

  const fromEnv = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? "")
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv
  }

  return DEFAULT_API_TIMEOUT_MS
}

export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  const method = options.method ?? "GET"
  const headers: Record<string, string> = { ...(options.headers ?? {}) }
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const timeoutMs = resolveTimeoutMs(options.timeoutMs)

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let body: BodyInit | null | undefined = options.body
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(options.json)
  }

  const controller = new AbortController()
  // The timeout must cover reading the response body too (D-07/D-15): a
  // stalled body read (e.g. a connection that accepted the request but
  // never finishes streaming the response) would otherwise hang past
  // `timeoutMs` because `clearTimeout` used to run right after `fetch`
  // resolved, before the body was ever read. One timer spans the whole
  // request+parse window and is only cleared once, in the outer `finally`.
  let timeoutId!: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new ApiError(408, `Request timeout after ${timeoutMs}ms`, null))
    }, timeoutMs)
  })

  async function run(): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${options.path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      })
    } catch (error) {
      const errorName = (error as { name?: string } | null)?.name
      if (errorName === "AbortError") {
        throw new ApiError(408, `Request timeout after ${timeoutMs}ms`, null)
      }
      throw error
    }

    const parsedBody = await parseResponseBody(response)

    if (!response.ok) {
      throw new ApiError(
        response.status,
        errorMessageForStatus(response.status, parsedBody),
        parsedBody,
      )
    }

    if (options.expectJson === false) {
      return undefined as T
    }

    return parsedBody as T
  }

  try {
    return await Promise.race([run(), timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
}
