import { AuthError, type AuthErrorCode } from './auth'

/** Địa chỉ máy chủ ASP.NET Core, ví dụ http://localhost:5080. Để trống thì ứng dụng chạy hoàn toàn trên trình duyệt. */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
export const apiEnabled = API_URL !== ''

const TOKEN_KEY = 'hoc-trung-token'
const stores = () => [window.sessionStorage, window.localStorage]

export function loadToken(): string | null {
  for (const st of stores()) {
    try {
      const v = st.getItem(TOKEN_KEY)
      if (v) return v
    } catch {
      /* bị chặn lưu trữ */
    }
  }
  return null
}

/** `remember` = true lưu ở localStorage (sống qua lần đóng trình duyệt), ngược lại chỉ trong tab. */
export function saveToken(token: string, remember: boolean) {
  clearToken()
  try {
    ;(remember ? window.localStorage : window.sessionStorage).setItem(TOKEN_KEY, token)
  } catch {
    /* phiên chỉ còn trong bộ nhớ */
  }
  memory = token
}

export function clearToken() {
  memory = null
  for (const st of stores()) {
    try {
      st.removeItem(TOKEN_KEY)
    } catch {
      /* không làm gì */
    }
  }
}

let memory: string | null = null
const currentToken = () => memory ?? loadToken()

const CODES: Record<string, AuthErrorCode> = {
  'invalid-credentials': 'invalid-credentials',
  locked: 'locked',
  disabled: 'disabled',
  'username-taken': 'username-taken',
  invalid: 'invalid-input',
  'registration-closed': 'registration-closed',
  'last-admin': 'last-admin',
  'not-found': 'not-found',
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Gọi API. Lỗi nghiệp vụ của tài khoản thành AuthError (giao diện đã biết cách hiện); lỗi khác thành ApiError. */
export async function api<T = void>(method: string, path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = currentToken()
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${API_URL}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (res.ok) return data as T
  if (res.status === 401 && token && data?.code === undefined) {
    // Token hết hạn hoặc bị thu hồi (đổi mật khẩu, vô hiệu hóa...): đăng xuất để đăng nhập lại
    clearToken()
    onExpired?.()
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.')
  }
  const msg = typeof data?.message === 'string' ? data.message : `Máy chủ trả lỗi ${res.status}.`
  const code = typeof data?.code === 'string' ? CODES[data.code] : undefined
  if (code) throw new AuthError(code, msg, typeof data?.retryAfter === 'number' ? data.retryAfter : undefined)
  throw new ApiError(res.status, msg)
}

let onExpired: (() => void) | null = null
export function onSessionExpired(fn: () => void) {
  onExpired = fn
}

function safeJson(t: string): Record<string, unknown> | null {
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}
