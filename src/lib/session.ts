/** Phiên đăng nhập phía trình duyệt. Chỉ lưu id người dùng và hạn dùng, không lưu mật khẩu hay mã băm. */

export interface Session {
  userId: string
  /** Mốc hết hạn (ms) */
  expires: number
  /** Ghi nhớ trên máy này (localStorage) hay chỉ trong tab hiện tại (sessionStorage) */
  remember: boolean
}

export interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

export const SESSION_KEY = 'hoc-trung-session'
export const REMEMBER_MS = 30 * 24 * 3600 * 1000
export const TAB_MS = 12 * 3600 * 1000
/** Không thao tác trong ngần này thời gian thì tự đăng xuất (chỉ khi không chọn ghi nhớ). */
export const IDLE_MS = 30 * 60 * 1000

export interface Stores { local: StorageLike; session: StorageLike }

const browserStores = (): Stores => ({ local: window.localStorage, session: window.sessionStorage })

export function saveSession(userId: string, remember: boolean, now = Date.now(), stores: Stores = browserStores()): Session {
  clearSession(stores)
  const s: Session = { userId, remember, expires: now + (remember ? REMEMBER_MS : TAB_MS) }
  try {
    ;(remember ? stores.local : stores.session).setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    // Trình duyệt chặn lưu trữ (chế độ riêng tư): phiên chỉ tồn tại trong bộ nhớ của trang này
  }
  return s
}

export function loadSession(now = Date.now(), stores: Stores = browserStores()): Session | null {
  for (const st of [stores.session, stores.local]) {
    try {
      const raw = st.getItem(SESSION_KEY)
      if (!raw) continue
      const s = JSON.parse(raw) as Session
      if (typeof s.userId === 'string' && typeof s.expires === 'number' && s.expires > now) return s
      st.removeItem(SESSION_KEY)
    } catch {
      /* bỏ qua dữ liệu hỏng */
    }
  }
  return null
}

export function clearSession(stores: Stores = browserStores()) {
  for (const st of [stores.session, stores.local]) {
    try {
      st.removeItem(SESSION_KEY)
    } catch {
      /* không làm gì */
    }
  }
}
