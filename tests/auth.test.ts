import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect } from 'vitest'
import { AuthError, createCredential, lockSeconds, normalizeUsername, userDbName, validatePassword, validateUsername, verifyPassword } from '@/lib/auth'
import { LocalAuthService } from '@/lib/auth.service'
import { DexieStorage } from '@/lib/storage.dexie'

const FAST = 1000 // số vòng PBKDF2 thấp để test chạy nhanh
let n = 0
const svc = (now?: () => number) => new LocalAuthService(`t-auth-${n++}`, FAST, now)
const rejects = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e)) as AuthError | null
const PW = 'mat-khau-manh-1'

describe('mật mã', () => {
  it('băm và kiểm tra đúng; muối khác nhau cho cùng mật khẩu; sai mật khẩu bị từ chối', async () => {
    const a = await createCredential(PW, FAST)
    const b = await createCredential(PW, FAST)
    expect(a.hash).not.toBe(b.hash)
    expect(a.salt).not.toBe(b.salt)
    expect(await verifyPassword(PW, a)).toBe(true)
    expect(await verifyPassword(PW + 'x', a)).toBe(false)
    expect(a.hash).not.toContain(PW)
  })
  it('chuẩn hóa Unicode: cùng một mật khẩu gõ theo hai dạng vẫn khớp', async () => {
    const c = await createCredential('Mật-khẩu-1234', FAST)
    expect(await verifyPassword('Mật-khẩu-1234'.normalize('NFD'), c)).toBe(true)
  })
  it('kiểm tra tên đăng nhập và mật khẩu', () => {
    expect(validateUsername('ab')).toBeTruthy()
    expect(validateUsername('Nguyen Van A')).toBeTruthy()
    expect(validateUsername('nguyen.van_a-1')).toBeNull()
    expect(normalizeUsername('  AbC ')).toBe('abc')
    expect(validatePassword('1234567')).toBeTruthy()
    expect(validatePassword('abcdefgh', 'ABCDEFGH')).toBeTruthy()
    expect(validatePassword('aaaaaaaa')).toBeTruthy()
    expect(validatePassword('password')).toBeTruthy()
    expect(validatePassword(PW, 'nguoi-dung')).toBeNull()
  })
  it('thời gian khóa tăng dần và có trần', () => {
    expect([0, 4].map(lockSeconds)).toEqual([0, 0])
    expect([5, 6, 7].map(lockSeconds)).toEqual([30, 60, 120])
    expect(lockSeconds(50)).toBe(900)
  })
})

describe('tài khoản', () => {
  it('người đăng ký đầu tiên là quản trị viên, người sau là học viên', async () => {
    const s = svc()
    const a = await s.register({ username: 'Quan.Tri', displayName: 'Quản trị', password: PW })
    const b = await s.register({ username: 'hoc.vien', displayName: 'Học viên', password: PW })
    expect([a.role, b.role]).toEqual(['admin', 'learner'])
    expect(a.username).toBe('quan.tri')
    expect(JSON.stringify(a)).not.toMatch(/hash|salt/)
  })
  it('từ chối tên trùng (không phân biệt hoa thường) và đầu vào sai', async () => {
    const s = svc()
    await s.register({ username: 'abc', displayName: 'A', password: PW })
    expect((await rejects(s.register({ username: 'ABC', displayName: 'B', password: PW })))?.code).toBe('username-taken')
    expect((await rejects(s.register({ username: 'xy', displayName: 'B', password: PW })))?.code).toBe('invalid-input')
    expect((await rejects(s.register({ username: 'okname', displayName: 'B', password: '123' })))?.code).toBe('invalid-input')
  })
  it('đăng nhập đúng, sai mật khẩu và tên lạ cùng một thông báo (không lộ tên có tồn tại)', async () => {
    const s = svc()
    await s.register({ username: 'abc', displayName: 'A', password: PW })
    expect((await s.login('ABC', PW)).username).toBe('abc')
    const wrongPw = await rejects(s.login('abc', 'sai-mat-khau-1'))
    const noUser = await rejects(s.login('khong-co', PW))
    expect(wrongPw?.code).toBe('invalid-credentials')
    expect(noUser?.code).toBe('invalid-credentials')
    expect(wrongPw?.message).toBe(noUser?.message)
  })
  it('khóa tạm sau 5 lần sai, kể cả khi sau đó nhập đúng; hết thời gian thì đăng nhập lại được', async () => {
    let t = 1_000_000
    const s = svc(() => t)
    await s.register({ username: 'abc', displayName: 'A', password: PW })
    for (let i = 0; i < 4; i++) expect((await rejects(s.login('abc', 'sai-sai-sai-1')))?.code).toBe('invalid-credentials')
    const fifth = await rejects(s.login('abc', 'sai-sai-sai-1'))
    expect(fifth?.code).toBe('locked')
    expect(fifth?.retryAfter).toBe(30)
    expect((await rejects(s.login('abc', PW)))?.code).toBe('locked')
    t += 31_000
    expect((await s.login('abc', PW)).username).toBe('abc')
    expect((await rejects(s.login('abc', 'sai-sai-sai-1')))?.code).toBe('invalid-credentials') // bộ đếm đã được đặt lại
  })
  it('đổi mật khẩu cần mật khẩu cũ; mật khẩu cũ hết hiệu lực', async () => {
    const s = svc()
    const u = await s.register({ username: 'abc', displayName: 'A', password: PW })
    expect((await rejects(s.changePassword(u.id, 'sai-mat-khau-1', 'mat-khau-moi-9')))?.code).toBe('invalid-credentials')
    await s.changePassword(u.id, PW, 'mat-khau-moi-9')
    expect((await rejects(s.login('abc', PW)))?.code).toBe('invalid-credentials')
    expect((await s.login('abc', 'mat-khau-moi-9')).id).toBe(u.id)
  })
  it('tài khoản bị vô hiệu hóa không đăng nhập được', async () => {
    const s = svc()
    const admin = await s.register({ username: 'admin1', displayName: 'A', password: PW })
    const u = await s.createUser(admin.id, { username: 'nv1', displayName: 'N', password: PW, role: 'learner' })
    await s.setDisabled(admin.id, u.id, true)
    expect((await rejects(s.login('nv1', PW)))?.code).toBe('disabled')
    await s.setDisabled(admin.id, u.id, false)
    expect((await s.login('nv1', PW)).id).toBe(u.id)
  })
})

describe('quản trị', () => {
  it('chỉ quản trị viên mới liệt kê, tạo, đặt lại mật khẩu, đổi vai trò, xóa', async () => {
    const s = svc()
    const admin = await s.register({ username: 'admin1', displayName: 'A', password: PW })
    const nv = await s.register({ username: 'nv1', displayName: 'N', password: PW })
    for (const act of [
      () => s.listUsers(nv.id),
      () => s.createUser(nv.id, { username: 'x1x', displayName: 'X', password: PW, role: 'learner' }),
      () => s.resetPassword(nv.id, admin.id, 'mat-khau-moi-9'),
      () => s.setRole(nv.id, nv.id, 'admin'),
      () => s.deleteUser(nv.id, admin.id),
      () => s.setRegistrationOpen(nv.id, false),
    ]) expect((await rejects(act()))?.code).toBe('forbidden')
    expect((await s.listUsers(admin.id)).map((u) => u.username)).toEqual(['admin1', 'nv1'])
  })
  it('quản trị viên đặt lại mật khẩu cho học viên', async () => {
    const s = svc()
    const admin = await s.register({ username: 'admin1', displayName: 'A', password: PW })
    const nv = await s.register({ username: 'nv1', displayName: 'N', password: PW })
    await s.resetPassword(admin.id, nv.id, 'tam-thoi-mat-khau-7')
    expect((await rejects(s.login('nv1', PW)))?.code).toBe('invalid-credentials')
    expect((await s.login('nv1', 'tam-thoi-mat-khau-7')).id).toBe(nv.id)
  })
  it('luôn còn ít nhất một quản trị viên: không hạ vai trò, vô hiệu hóa hay xóa người cuối', async () => {
    const s = svc()
    const a1 = await s.register({ username: 'admin1', displayName: 'A', password: PW })
    expect((await rejects(s.setRole(a1.id, a1.id, 'learner')))?.code).toBe('last-admin')
    expect((await rejects(s.setDisabled(a1.id, a1.id, true)))?.code).toBe('last-admin')
    const a2 = await s.createUser(a1.id, { username: 'admin2', displayName: 'B', password: PW, role: 'admin' })
    await s.setRole(a1.id, a2.id, 'learner')
    expect((await rejects(s.deleteUser(a1.id, a1.id)))?.code).toBe('forbidden')
  })
  it('đóng đăng ký tự do: người lạ không tự tạo được tài khoản, quản trị viên vẫn tạo được', async () => {
    const s = svc()
    const admin = await s.register({ username: 'admin1', displayName: 'A', password: PW })
    expect(await s.registrationOpen()).toBe(true)
    await s.setRegistrationOpen(admin.id, false)
    expect(await s.registrationOpen()).toBe(false)
    expect((await rejects(s.register({ username: 'nguoi.la', displayName: 'L', password: PW })))?.code).toBe('registration-closed')
    expect((await s.createUser(admin.id, { username: 'nv2', displayName: 'N', password: PW, role: 'learner' })).role).toBe('learner')
  })
  it('xóa tài khoản xóa luôn kho tiến độ riêng của họ', async () => {
    const s = svc()
    const admin = await s.register({ username: 'admin1', displayName: 'A', password: PW })
    const nv = await s.createUser(admin.id, { username: 'nv1', displayName: 'N', password: PW, role: 'learner' })
    const data = new DexieStorage(userDbName(nv.id))
    await data.saveSettings({ mode: 'full', theme: 'system', zhFontSize: 28, showPinyin: true, newCardsPerDay: 15, weeklyDays: 5, goal: 'it:all' })
    expect(await Dexie.exists(userDbName(nv.id))).toBe(true)
    data.db.close()
    await s.deleteUser(admin.id, nv.id)
    expect(await Dexie.exists(userDbName(nv.id))).toBe(false)
    expect(await s.getUser(nv.id)).toBeUndefined()
  })
  it('kho tiến độ của hai người dùng hoàn toàn tách biệt', async () => {
    const a = new DexieStorage(userDbName('u-a'))
    const b = new DexieStorage(userDbName('u-b'))
    await a.createCardIfAbsent({ ref: 'hsk:1', ease: 2.5, interval: 0, repetitions: 0, due: '2026-10-14', lapses: 0, createdAt: 1 })
    expect(await a.allCards()).toHaveLength(1)
    expect(await b.allCards()).toHaveLength(0)
  })
})

import { clearSession, IDLE_MS, loadSession, REMEMBER_MS, saveSession, SESSION_KEY, TAB_MS, type StorageLike } from '@/lib/session'

const mem = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

describe('phiên đăng nhập', () => {
  it('ghi nhớ lưu vào localStorage 30 ngày; không ghi nhớ lưu vào sessionStorage 12 giờ', () => {
    const st = { local: mem(), session: mem() }
    const a = saveSession('u1', true, 1000, st)
    expect(st.local.data.has(SESSION_KEY)).toBe(true)
    expect(st.session.data.has(SESSION_KEY)).toBe(false)
    expect(a.expires).toBe(1000 + REMEMBER_MS)
    const b = saveSession('u2', false, 1000, st)
    expect(st.session.data.has(SESSION_KEY)).toBe(true)
    expect(st.local.data.has(SESSION_KEY)).toBe(false) // phiên cũ bị xóa
    expect(b.expires).toBe(1000 + TAB_MS)
  })
  it('đọc lại đúng người, bỏ phiên hết hạn và dữ liệu hỏng', () => {
    const st = { local: mem(), session: mem() }
    saveSession('u1', true, 1000, st)
    expect(loadSession(2000, st)?.userId).toBe('u1')
    expect(loadSession(1000 + REMEMBER_MS + 1, st)).toBeNull()
    expect(st.local.data.has(SESSION_KEY)).toBe(false)
    st.local.setItem(SESSION_KEY, '{không phải json')
    expect(loadSession(2000, st)).toBeNull()
  })
  it('đăng xuất xóa cả hai nơi lưu; phiên không chứa mật khẩu hay mã băm; hạn nhàn rỗi là 30 phút', () => {
    const st = { local: mem(), session: mem() }
    saveSession('u1', true, 1, st)
    expect(st.local.data.get(SESSION_KEY)).not.toMatch(/pass|hash|salt/i)
    clearSession(st)
    expect(loadSession(2, st)).toBeNull()
    expect(IDLE_MS).toBe(30 * 60 * 1000)
  })
})

describe('lần đăng nhập gần nhất', () => {
  it('tự đăng ký tính là vừa đăng nhập; quản trị viên tạo hộ thì chưa; đăng nhập thật cập nhật mốc', async () => {
    let t = 5000
    const s = svc(() => t)
    const admin = await s.register({ username: 'admin1', displayName: 'A', password: PW })
    expect(admin.lastLoginAt).toBe(5000)
    const nv = await s.createUser(admin.id, { username: 'nv1', displayName: 'N', password: PW, role: 'learner' })
    expect(nv.lastLoginAt).toBeUndefined()
    t = 9000
    expect((await s.login('nv1', PW)).lastLoginAt).toBe(9000)
    expect((await s.getUser(nv.id))?.lastLoginAt).toBe(9000)
  })
})
