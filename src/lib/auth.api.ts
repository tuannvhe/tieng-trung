import { api, clearToken, saveToken } from './api'
import type { AuthService, PublicUser } from './auth.service'
import type { Role } from './auth'

interface AuthResult {
  token: string
  expires: number
  user: PublicUser
}

export interface ProgressSummary {
  learned: number
  mature: number
  due: number
  reviewedToday: number
  streak: number
}

/** Dịch vụ tài khoản gọi máy chủ ASP.NET Core. Máy chủ giữ mật khẩu đã băm, kiểm tra quyền và thu hồi phiên. */
export class ApiAuthService implements AuthService {
  hasUsers = async () => (await api<{ hasUsers: boolean }>('GET', '/auth/status', undefined, { auth: false })).hasUsers
  registrationOpen = async () => (await api<{ registrationOpen: boolean }>('GET', '/auth/status', undefined, { auth: false })).registrationOpen
  setRegistrationOpen = (_actor: string, open: boolean) => api('PUT', '/admin/registration', { open })

  async register(input: { username: string; displayName: string; password: string }, remember = false) {
    const r = await api<AuthResult>('POST', '/auth/register', { ...input, remember }, { auth: false })
    saveToken(r.token, remember)
    return r.user
  }

  async login(username: string, password: string, remember = false) {
    const r = await api<AuthResult>('POST', '/auth/login', { username, password, remember }, { auth: false })
    saveToken(r.token, remember)
    return r.user
  }

  /** Người dùng của phiên hiện tại (theo token). Id khác với id yêu cầu thì coi như không có. */
  async getUser(id: string) {
    try {
      const u = await api<PublicUser>('GET', '/auth/me')
      return u.id === id ? u : undefined
    } catch {
      return undefined
    }
  }

  listUsers = (_actor: string) => api<PublicUser[]>('GET', '/admin/users')
  createUser = (_actor: string, input: { username: string; displayName: string; password: string; role: Role }) => api<PublicUser>('POST', '/admin/users', input)

  async changePassword(_userId: string, oldPassword: string, newPassword: string) {
    // Máy chủ thu hồi token cũ và trả token mới để phiên hiện tại không bị đăng xuất
    const r = await api<AuthResult>('POST', '/auth/password', { oldPassword, newPassword })
    saveToken(r.token, localStorage.getItem('hoc-trung-token') !== null)
  }

  resetPassword = (_actor: string, userId: string, password: string) => api('POST', `/admin/users/${userId}/password`, { password })
  updateDisplayName = (_userId: string, displayName: string) => api<PublicUser>('PUT', '/auth/profile', { displayName })
  setRole = (_actor: string, userId: string, role: Role) => api('PUT', `/admin/users/${userId}/role`, { role })
  setDisabled = (_actor: string, userId: string, disabled: boolean) => api('PUT', `/admin/users/${userId}/disabled`, { disabled })
  deleteUser = (_actor: string, userId: string) => api('DELETE', `/admin/users/${userId}`)

  signOut() {
    clearToken()
  }
  progressSummary = (userId: string, today: string) => api<ProgressSummary>('GET', `/admin/users/${userId}/summary?today=${today}`)
  exportProgress = (userId: string) => api<unknown>('GET', `/admin/users/${userId}/export`)
}
