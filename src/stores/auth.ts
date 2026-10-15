import { defineStore } from 'pinia'
import { ref } from 'vue'
import Dexie from 'dexie'
import { authService } from '@/lib/auth.instance'
import type { PublicUser } from '@/lib/auth.service'
import { clearSession, loadSession, saveSession } from '@/lib/session'
import { activateUserStorage, deactivateStorage } from '@/lib/storage'

const LEGACY_DB = 'hoc-trung-it'
const MIGRATED_KEY = 'hoc-trung-legacy-migrated'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<PublicUser | null>(null)
  const remembered = ref(false)

  async function start(u: PublicUser, remember: boolean) {
    saveSession(u.id, remember)
    remembered.value = remember
    await activateUserStorage(u.id)
    user.value = u
  }

  /** Khôi phục phiên đã lưu (nếu còn hạn và tài khoản còn hoạt động). */
  async function restore() {
    const s = loadSession()
    if (!s) return
    try {
      const u = await authService.getUser(s.userId)
      if (!u || u.disabled) return clearSession()
      remembered.value = s.remember
      await activateUserStorage(u.id)
      user.value = u
    } catch {
      clearSession()
    }
  }

  async function login(username: string, password: string, remember: boolean) {
    await start(await authService.login(username, password, remember), remember)
  }

  async function register(input: { username: string; displayName: string; password: string }, remember: boolean, keepLegacy: boolean) {
    const u = await authService.register(input, remember)
    await start(u, remember)
    if (keepLegacy && u.role === 'admin') await importLegacyProgress()
  }

  /** Có dữ liệu học từ bản chưa có tài khoản (DB chung `hoc-trung-it`) chưa được chuyển vào tài khoản nào không? */
  async function hasLegacyProgress(): Promise<boolean> {
    if (localStorage.getItem(MIGRATED_KEY)) return false
    if (!(await Dexie.exists(LEGACY_DB))) return false
    const { DexieStorage } = await import('@/lib/storage.dexie')
    const legacy = new DexieStorage(LEGACY_DB)
    try {
      return (await legacy.allCards()).length > 0 || (await legacy.allOverrides()).length > 0
    } finally {
      legacy.db.close()
    }
  }

  /** Chép tiến độ cũ vào kho của tài khoản đang đăng nhập (chỉ một lần). Kho cũ được giữ nguyên, không bị xóa. */
  async function importLegacyProgress() {
    const [{ DexieStorage }, { getStorage }] = await Promise.all([import('@/lib/storage.dexie'), import('@/lib/storage')])
    const legacy = new DexieStorage(LEGACY_DB)
    try {
      const dump = await legacy.exportAll()
      await (await getStorage()).importAll(dump)
      localStorage.setItem(MIGRATED_KEY, '1')
    } finally {
      legacy.db.close()
    }
  }

  /** Đăng xuất rồi tải lại trang để xóa sạch dữ liệu của người dùng cũ khỏi bộ nhớ (store, bộ nhớ đệm). */
  function logout(reason?: 'idle' | 'expired') {
    clearSession()
    authService.signOut?.()
    deactivateStorage()
    user.value = null
    location.hash = reason === 'idle' ? '#/login?idle=1' : reason === 'expired' ? '#/login?expired=1' : '#/login'
    location.reload()
  }

  async function updateDisplayName(name: string) {
    if (!user.value) return
    user.value = await authService.updateDisplayName(user.value.id, name)
  }

  return { user, remembered, restore, login, register, logout, hasLegacyProgress, importLegacyProgress, updateDisplayName }
})
