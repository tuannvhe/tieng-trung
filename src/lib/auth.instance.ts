import { LocalAuthService, type AuthService } from './auth.service'
import { ApiAuthService } from './auth.api'
import { apiEnabled } from './api'

/**
 * Dịch vụ tài khoản đang dùng. Mặc định lưu trên trình duyệt; khi có máy chủ ASP.NET Core,
 * gọi `setAuthService(new ApiAuthService(...))` trước khi khởi động ứng dụng.
 */
export let authService: AuthService = apiEnabled ? new ApiAuthService() : new LocalAuthService()

export function setAuthService(s: AuthService) {
  authService = s
}
