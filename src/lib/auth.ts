/** Mật mã và kiểm tra đầu vào cho tài khoản. Chỉ dùng Web Crypto chuẩn, chạy được cả trong trình duyệt và Node. */

export const PBKDF2_ITERATIONS = 210_000
const enc = new TextEncoder()

export type Role = 'admin' | 'learner'

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'locked'
  | 'disabled'
  | 'username-taken'
  | 'invalid-input'
  | 'forbidden'
  | 'not-found'
  | 'registration-closed'
  | 'last-admin'

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    /** Số giây phải chờ khi bị khóa tạm thời */
    public retryAfter?: number,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export interface Credential {
  salt: string
  hash: string
  iterations: number
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function fromB64(b64: string): Uint8Array {
  const s = atob(b64)
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return new Uint8Array(bits)
}

/** Tạo muối ngẫu nhiên riêng cho từng mật khẩu và băm bằng PBKDF2-SHA256. */
export async function createCredential(password: string, iterations = PBKDF2_ITERATIONS): Promise<Credential> {
  const salt = randomBytes(16)
  return { salt: toB64(salt), hash: toB64(await derive(password, salt, iterations)), iterations }
}

/** So sánh thời gian không đổi để không lộ độ dài phần khớp. */
function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifyPassword(password: string, cred: Credential): Promise<boolean> {
  const got = await derive(password, fromB64(cred.salt), cred.iterations)
  return safeEqual(got, fromB64(cred.hash))
}

export const normalizeUsername = (u: string) => u.trim().toLowerCase()

/** Trả về thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ. */
export function validateUsername(username: string): string | null {
  const u = normalizeUsername(username)
  if (u.length < 3 || u.length > 32) return 'Tên đăng nhập dài từ 3 đến 32 ký tự.'
  if (!/^[a-z0-9._-]+$/.test(u)) return 'Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới và gạch ngang.'
  return null
}

export function validatePassword(password: string, username = ''): string | null {
  if (password.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.'
  if (password.length > 128) return 'Mật khẩu tối đa 128 ký tự.'
  if (username && password.toLowerCase() === normalizeUsername(username)) return 'Mật khẩu không được trùng tên đăng nhập.'
  if (/^(.)\1+$/.test(password)) return 'Mật khẩu không được lặp một ký tự.'
  if (/^(12345678|123456789|password|matkhau123|11111111)$/i.test(password)) return 'Mật khẩu này quá dễ đoán.'
  return null
}

export function validateDisplayName(name: string): string | null {
  const n = name.trim()
  if (n.length < 1 || n.length > 40) return 'Tên hiển thị dài từ 1 đến 40 ký tự.'
  return null
}

/** Thời gian khóa tạm sau nhiều lần nhập sai: 5 lần đầu tự do, sau đó 30 giây nhân đôi mỗi lần, tối đa 15 phút. */
export function lockSeconds(failedAttempts: number): number {
  if (failedAttempts < 5) return 0
  return Math.min(900, 30 * 2 ** (failedAttempts - 5))
}

/** Kho tiến độ riêng của từng người dùng. */
export const userDbName = (userId: string) => `hoc-trung-it-u-${userId}`
