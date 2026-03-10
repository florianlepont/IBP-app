export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type ApiRequestOptions = {
  baseUrl: string;
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  token?: string;
  body?: BodyInit | null;
  json?: unknown;
  headers?: Record<string, string>;
  expectJson?: boolean;
};

type JsonLike = Record<string, unknown>;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessageForStatus(status: number, parsedBody: unknown): string {
  if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
    const body = parsedBody as JsonLike;
    if (typeof body.message === 'string' && body.message.trim().length > 0) {
      return body.message;
    }
  }
  return `HTTP ${status}`;
}

export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: BodyInit | null | undefined = options.body;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  const response = await fetch(`${baseUrl}${options.path}`, {
    method,
    headers,
    body
  });

  const parsedBody = await parseResponseBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, errorMessageForStatus(response.status, parsedBody), parsedBody);
  }

  if (options.expectJson === false) {
    return undefined as T;
  }

  return parsedBody as T;
}
