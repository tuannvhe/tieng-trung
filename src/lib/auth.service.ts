import Dexie, { type Table } from 'dexie'
import {
  AuthError, createCredential, lockSeconds, normalizeUsername, userDbName, validateDisplayName, validatePassword, validateUsername, verifyPassword,
  PBKDF2_ITERATIONS, type Credential, type Role,
} from './auth'

/** Người dùng đưa ra giao diện: không bao giờ chứa muối hay mã băm. */
export interface PublicUser {
  id: string
  username: string
  displayName: string
  role: Role
  disabled: boolean
  createdAt: number
  lastLoginAt?: number
}

interface UserRecord extends PublicUser, Credential {
  failed: number
  lockedUntil: number
}

/**
 * Giao diện dịch vụ tài khoản. Bản `LocalAuthService` lưu trên trình duyệt; sau này có thể viết
 * một bản gọi API ASP.NET Core + SQL Server cùng giao diện này mà không sửa giao diện người dùng.
 */
export interface AuthService {
  hasUsers(): Promise<boolean>
  registrationOpen(): Promise<boolean>
  setRegistrationOpen(actorId: string, open: boolean): Promise<void>
  register(input: { username: string; displayName: string; password: string }, remember?: boolean): Promise<PublicUser>
  login(username: string, password: string, remember?: boolean): Promise<PublicUser>
  getUser(id: string): Promise<PublicUser | undefined>
  listUsers(actorId: string): Promise<PublicUser[]>
  createUser(actorId: string, input: { username: string; displayName: string; password: string; role: Role }): Promise<PublicUser>
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>
  resetPassword(actorId: string, userId: string, newPassword: string): Promise<void>
  updateDisplayName(userId: string, displayName: string): Promise<PublicUser>
  setRole(actorId: string, userId: string, role: Role): Promise<void>
  setDisabled(actorId: string, userId: string, disabled: boolean): Promise<void>
  deleteUser(actorId: string, userId: string): Promise<void>
  /** Chỉ bản gọi máy chủ: xóa token khi đăng xuất. */
  signOut?(): void
  /** Chỉ bản gọi máy chủ: tóm tắt/xuất tiến độ của một người dùng cho quản trị viên. */
  progressSummary?(userId: string, today: string): Promise<{ learned: number; mature: number; due: number; reviewedToday: number; streak: number }>
  exportProgress?(userId: string): Promise<unknown>
}

class AuthDb extends Dexie {
  users!: Table<UserRecord, string>
  meta!: Table<{ key: string; value: string }, string>
  constructor(name: string) {
    super(name)
    this.version(1).stores({ users: 'id, &username, createdAt', meta: 'key' })
  }
}

const pub = ({ salt: _s, hash: _h, iterations: _i, failed: _f, lockedUntil: _l, ...rest }: UserRecord): PublicUser => rest
const GENERIC = 'Sai tên đăng nhập hoặc mật khẩu.'

export class LocalAuthService implements AuthService {
  private db: AuthDb

  constructor(
    dbName = 'hoc-trung-it-auth',
    private iterations = PBKDF2_ITERATIONS,
    private now: () => number = Date.now,
  ) {
    this.db = new AuthDb(dbName)
  }

  async hasUsers() {
    return (await this.db.users.count()) > 0
  }

  async registrationOpen() {
    if (!(await this.hasUsers())) return true
    return ((await this.db.meta.get('registrationOpen'))?.value ?? 'true') === 'true'
  }

  async setRegistrationOpen(actorId: string, open: boolean) {
    await this.requireAdmin(actorId)
    await this.db.meta.put({ key: 'registrationOpen', value: String(open) })
  }

  /** Người đăng ký đầu tiên tự động là quản trị viên; các lần sau là học viên và cần đăng ký đang mở. */
  async register(input: { username: string; displayName: string; password: string }): Promise<PublicUser> {
    return this.insert(input, 'register')
  }

  async createUser(actorId: string, input: { username: string; displayName: string; password: string; role: Role }): Promise<PublicUser> {
    await this.requireAdmin(actorId)
    return this.insert(input, input.role)
  }

  /**
   * Thêm người dùng. `'register'` = tự đăng ký (người đầu tiên là quản trị viên, các lần sau cần đăng ký đang mở).
   * Băm mật khẩu làm TRƯỚC khi mở transaction vì Web Crypto không thuộc IndexedDB, nếu để trong transaction
   * thì transaction tự đóng sớm.
   */
  private async insert(input: { username: string; displayName: string; password: string }, kind: 'register' | Role): Promise<PublicUser> {
    const bad = validateUsername(input.username) ?? validateDisplayName(input.displayName) ?? validatePassword(input.password, input.username)
    if (bad) throw new AuthError('invalid-input', bad)
    const username = normalizeUsername(input.username)
    const cred = await createCredential(input.password, this.iterations)
    return this.db.transaction('rw', this.db.users, this.db.meta, async () => {
      let role: Role
      if (kind === 'register') {
        const first = (await this.db.users.count()) === 0
        if (!first && !(await this.registrationOpen())) throw new AuthError('registration-closed', 'Quản trị viên đã tắt đăng ký tự do. Hãy nhờ quản trị viên tạo tài khoản.')
        role = first ? 'admin' : 'learner'
      } else role = kind
      if (await this.db.users.where('username').equals(username).first()) throw new AuthError('username-taken', 'Tên đăng nhập này đã có người dùng.')
      const rec: UserRecord = { id: crypto.randomUUID(), username, displayName: input.displayName.trim(), role, disabled: false, createdAt: this.now(), ...(kind === 'register' ? { lastLoginAt: this.now() } : {}), ...cred, failed: 0, lockedUntil: 0 }
      await this.db.users.add(rec)
      return pub(rec)
    })
  }

  async login(username: string, password: string): Promise<PublicUser> {
    const rec = await this.db.users.where('username').equals(normalizeUsername(username)).first()
    if (!rec) {
      // Vẫn băm một lần để thời gian phản hồi không tiết lộ tên đăng nhập có tồn tại hay không
      await createCredential(password, this.iterations)
      throw new AuthError('invalid-credentials', GENERIC)
    }
    const wait = Math.ceil((rec.lockedUntil - this.now()) / 1000)
    if (wait > 0) throw new AuthError('locked', `Nhập sai nhiều lần. Thử lại sau ${wait} giây.`, wait)
    if (!(await verifyPassword(password, rec))) {
      const failed = rec.failed + 1
      const lock = lockSeconds(failed)
      await this.db.users.update(rec.id, { failed, lockedUntil: lock ? this.now() + lock * 1000 : 0 })
      throw lock ? new AuthError('locked', `Nhập sai nhiều lần. Thử lại sau ${lock} giây.`, lock) : new AuthError('invalid-credentials', GENERIC)
    }
    if (rec.disabled) throw new AuthError('disabled', 'Tài khoản này đã bị vô hiệu hóa. Hãy liên hệ quản trị viên.')
    await this.db.users.update(rec.id, { failed: 0, lockedUntil: 0, lastLoginAt: this.now() })
    return pub({ ...rec, lastLoginAt: this.now() })
  }

  async getUser(id: string) {
    const rec = await this.db.users.get(id)
    return rec ? pub(rec) : undefined
  }

  async listUsers(actorId: string) {
    await this.requireAdmin(actorId)
    return (await this.db.users.orderBy('createdAt').toArray()).map(pub)
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const rec = await this.db.users.get(userId)
    if (!rec) throw new AuthError('not-found', 'Không tìm thấy tài khoản.')
    if (!(await verifyPassword(oldPassword, rec))) throw new AuthError('invalid-credentials', 'Mật khẩu hiện tại không đúng.')
    const bad = validatePassword(newPassword, rec.username)
    if (bad) throw new AuthError('invalid-input', bad)
    await this.db.users.update(userId, { ...(await createCredential(newPassword, this.iterations)), failed: 0, lockedUntil: 0 })
  }

  async resetPassword(actorId: string, userId: string, newPassword: string) {
    await this.requireAdmin(actorId)
    const rec = await this.db.users.get(userId)
    if (!rec) throw new AuthError('not-found', 'Không tìm thấy tài khoản.')
    const bad = validatePassword(newPassword, rec.username)
    if (bad) throw new AuthError('invalid-input', bad)
    await this.db.users.update(userId, { ...(await createCredential(newPassword, this.iterations)), failed: 0, lockedUntil: 0 })
  }

  async updateDisplayName(userId: string, displayName: string) {
    const bad = validateDisplayName(displayName)
    if (bad) throw new AuthError('invalid-input', bad)
    await this.db.users.update(userId, { displayName: displayName.trim() })
    return (await this.getUser(userId))!
  }

  async setRole(actorId: string, userId: string, role: Role) {
    await this.requireAdmin(actorId)
    const rec = await this.db.users.get(userId)
    if (!rec) throw new AuthError('not-found', 'Không tìm thấy tài khoản.')
    if (rec.role === 'admin' && role !== 'admin') await this.requireAnotherAdmin(userId)
    await this.db.users.update(userId, { role })
  }

  async setDisabled(actorId: string, userId: string, disabled: boolean) {
    await this.requireAdmin(actorId)
    const rec = await this.db.users.get(userId)
    if (!rec) throw new AuthError('not-found', 'Không tìm thấy tài khoản.')
    if (disabled && rec.role === 'admin') await this.requireAnotherAdmin(userId)
    await this.db.users.update(userId, { disabled })
  }

  /** Xóa tài khoản và toàn bộ tiến độ học của tài khoản đó. Không xóa được chính mình hoặc quản trị viên cuối cùng. */
  async deleteUser(actorId: string, userId: string) {
    await this.requireAdmin(actorId)
    if (actorId === userId) throw new AuthError('forbidden', 'Không thể tự xóa tài khoản đang đăng nhập.')
    const rec = await this.db.users.get(userId)
    if (!rec) throw new AuthError('not-found', 'Không tìm thấy tài khoản.')
    if (rec.role === 'admin') await this.requireAnotherAdmin(userId)
    await this.db.users.delete(userId)
    await Dexie.delete(userDbName(userId))
  }

  private async requireAdmin(actorId: string) {
    const a = await this.db.users.get(actorId)
    if (!a || a.role !== 'admin' || a.disabled) throw new AuthError('forbidden', 'Chỉ quản trị viên mới làm được việc này.')
  }

  private async requireAnotherAdmin(exceptId: string) {
    const admins = (await this.db.users.toArray()).filter((u) => u.role === 'admin' && !u.disabled && u.id !== exceptId)
    if (!admins.length) throw new AuthError('last-admin', 'Phải còn ít nhất một quản trị viên đang hoạt động.')
  }
}
