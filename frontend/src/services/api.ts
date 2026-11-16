export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 0) {
    super(message)
    this.code = code
    this.status = status
  }
}

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

let refreshing: Promise<boolean> | null = null

/** Làm mới access token bằng refresh cookie. Dùng chung một lời gọi cho nhiều request song song. */
function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0)
    })
  return refreshing
}

async function request<T>(path: string, init: RequestInit, retried: boolean): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    })
  } catch {
    throw new ApiError('NETWORK', 'Không kết nối được máy chủ. Vui lòng thử lại sau.')
  }
  let body: Envelope<T> | null = null
  try {
    body = (await res.json()) as Envelope<T>
  } catch {
    /* phản hồi không phải JSON */
  }
  if (res.status === 401 && !retried && !path.startsWith('/auth/') && !path.startsWith('/guest/')) {
    if (await tryRefresh()) return request<T>(path, init, true)
  }
  if (!res.ok || !body?.ok) {
    throw new ApiError(
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? (res.status >= 500 ? 'Máy chủ gặp sự cố, vui lòng thử lại.' : 'Máy chủ phản hồi không hợp lệ.'),
      res.status,
    )
  }
  return body.data as T
}

export function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, false)
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' })
