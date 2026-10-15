<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/lib/auth.instance'
import { AuthError, userDbName, type Role } from '@/lib/auth'
import type { PublicUser } from '@/lib/auth.service'
import { summarize } from '@/lib/stats'
import { addDays, localDay } from '@/lib/srs'
import { downloadText } from '@/lib/download'
import Icon from '@/components/Icon.vue'

interface Row { user: PublicUser; learned: number; mature: number; streak: number; today: number }

const auth = useAuthStore()
const me = computed(() => auth.user!)
const rows = ref<Row[]>([])
const open = ref(true)
const msg = ref('')
const err = ref('')
const loading = ref(true)

const form = ref({ username: '', displayName: '', password: '', role: 'learner' as Role })
const resetting = ref<string | null>(null)
const newPw = ref('')
const deleting = ref<string | null>(null)
const confirmName = ref('')

const say = (m: string) => ((msg.value = m), (err.value = ''))
const fail = (e: unknown) => ((err.value = e instanceof AuthError ? e.message : 'Có lỗi: ' + (e as Error).message), (msg.value = ''))

/** Đọc nhanh tiến độ của một người dùng từ kho riêng của họ (chỉ đọc, đóng kết nối ngay). */
async function progressOf(u: PublicUser): Promise<Omit<Row, 'user'>> {
  if (authService.progressSummary) {
    const r = await authService.progressSummary(u.id, localDay())
    return { learned: r.learned, mature: r.mature, streak: r.streak, today: r.reviewedToday }
  }
  const { DexieStorage } = await import('@/lib/storage.dexie')
  const st = new DexieStorage(userDbName(u.id))
  try {
    const today = localDay()
    const s = summarize(await st.allCards(), await st.reviewsBetween(addDays(today, -120), today), today)
    return { learned: s.learned, mature: s.mature, streak: s.streak, today: s.reviewedToday }
  } finally {
    st.db.close()
  }
}

async function load() {
  loading.value = true
  try {
    const users = await authService.listUsers(me.value.id)
    rows.value = await Promise.all(users.map(async (user) => ({ user, ...(await progressOf(user)) })))
    open.value = await authService.registrationOpen()
  } catch (e) {
    fail(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function create() {
  try {
    await authService.createUser(me.value.id, { ...form.value })
    say(`Đã tạo tài khoản "${form.value.username.trim().toLowerCase()}". Hãy báo mật khẩu tạm cho người dùng và nhờ họ đổi ở mục Cài đặt.`)
    form.value = { username: '', displayName: '', password: '', role: 'learner' }
    await load()
  } catch (e) {
    fail(e)
  }
}
async function toggleOpen() {
  try {
    await authService.setRegistrationOpen(me.value.id, !open.value)
    open.value = !open.value
    say(open.value ? 'Đã mở đăng ký tự do.' : 'Đã tắt đăng ký tự do. Chỉ quản trị viên tạo được tài khoản mới.')
  } catch (e) {
    fail(e)
  }
}
async function doReset(r: Row) {
  try {
    await authService.resetPassword(me.value.id, r.user.id, newPw.value)
    say(`Đã đặt lại mật khẩu cho "${r.user.username}". Báo mật khẩu mới cho họ rồi nhờ đổi ngay.`)
    resetting.value = null
    newPw.value = ''
    await load()
  } catch (e) {
    fail(e)
  }
}
async function toggleDisabled(r: Row) {
  try {
    await authService.setDisabled(me.value.id, r.user.id, !r.user.disabled)
    say(r.user.disabled ? `Đã kích hoạt lại "${r.user.username}".` : `Đã vô hiệu hóa "${r.user.username}".`)
    await load()
  } catch (e) {
    fail(e)
  }
}
async function toggleRole(r: Row) {
  try {
    await authService.setRole(me.value.id, r.user.id, r.user.role === 'admin' ? 'learner' : 'admin')
    say(`Đã đổi vai trò của "${r.user.username}".`)
    await load()
  } catch (e) {
    fail(e)
  }
}
async function doDelete(r: Row) {
  try {
    await authService.deleteUser(me.value.id, r.user.id)
    say(`Đã xóa tài khoản "${r.user.username}" cùng toàn bộ tiến độ của họ.`)
    deleting.value = null
    confirmName.value = ''
    await load()
  } catch (e) {
    fail(e)
  }
}
async function exportProgress(r: Row) {
  if (authService.exportProgress) {
    downloadText(`tien-do-${r.user.username}-${localDay()}.json`, JSON.stringify(await authService.exportProgress(r.user.id), null, 1), 'application/json')
    return say(`Đã xuất tiến độ của "${r.user.username}".`)
  }
  const { DexieStorage } = await import('@/lib/storage.dexie')
  const st = new DexieStorage(userDbName(r.user.id))
  try {
    downloadText(`tien-do-${r.user.username}-${localDay()}.json`, JSON.stringify(await st.exportAll(), null, 1), 'application/json')
    say(`Đã xuất tiến độ của "${r.user.username}".`)
  } finally {
    st.db.close()
  }
}
const fmt = (t?: number) => (t ? new Date(t).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'chưa đăng nhập')
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Quản lý tài khoản</h1>
      <p class="text-ink2">Tạo tài khoản cho nhân viên dùng chung máy, đặt lại mật khẩu, theo dõi tiến độ từng người. Mỗi người có kho tiến độ riêng trên máy này.</p>
    </div>

    <p v-if="msg" class="rounded-2xl bg-jade/10 p-3 text-sm text-jade" role="status">{{ msg }}</p>
    <p v-if="err" class="rounded-2xl bg-seal/10 p-3 text-sm text-seal" role="alert">{{ err }}</p>

    <div class="grid gap-5 xl:grid-cols-[22rem_1fr]">
      <aside class="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <form class="surface space-y-3 p-5" @submit.prevent="create">
          <h2 class="font-bold">Tạo tài khoản mới</h2>
          <label class="block text-sm font-semibold">Tên đăng nhập<input v-model="form.username" class="field mt-1 !py-2" autocomplete="off" autocapitalize="off" required /></label>
          <label class="block text-sm font-semibold">Tên hiển thị<input v-model="form.displayName" class="field mt-1 !py-2" maxlength="40" required /></label>
          <label class="block text-sm font-semibold">Mật khẩu tạm<input v-model="form.password" type="text" class="field mt-1 !py-2" autocomplete="off" required /></label>
          <div class="seg w-full" role="radiogroup" aria-label="Vai trò">
            <button type="button" role="radio" :aria-checked="form.role === 'learner'" @click="form.role = 'learner'">Học viên</button>
            <button type="button" role="radio" :aria-checked="form.role === 'admin'" @click="form.role = 'admin'">Quản trị viên</button>
          </div>
          <button type="submit" class="btn-primary w-full">Tạo tài khoản</button>
        </form>
        <section class="surface space-y-3 p-5">
          <div class="flex items-center justify-between gap-3">
            <div><div class="font-semibold">Đăng ký tự do</div><div class="text-xs text-ink2">{{ open ? 'Ai cũng tự tạo được tài khoản học viên ở trang đăng nhập.' : 'Chỉ quản trị viên tạo được tài khoản.' }}</div></div>
            <button type="button" class="btn-ghost shrink-0" role="switch" :aria-checked="open" @click="toggleOpen">{{ open ? 'Đang mở' : 'Đang tắt' }}</button>
          </div>
        </section>
      </aside>

      <section class="min-w-0 space-y-4">
        <p v-if="loading" class="surface p-8 text-center text-ink2">Đang tải danh sách…</p>
        <article v-for="r in rows" :key="r.user.id" class="surface space-y-3 p-5" :class="r.user.disabled && 'opacity-70'">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-seal text-lg font-bold text-white dark:text-paper">{{ r.user.displayName.charAt(0).toUpperCase() }}</span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2"><span class="truncate font-bold">{{ r.user.displayName }}</span>
                  <span class="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" :class="r.user.role === 'admin' ? 'bg-sky/15 text-sky' : 'bg-paper text-ink2'">{{ r.user.role === 'admin' ? 'Quản trị viên' : 'Học viên' }}</span>
                  <span v-if="r.user.disabled" class="rounded-md bg-seal/15 px-1.5 py-0.5 text-[11px] font-semibold text-seal">đã vô hiệu hóa</span>
                  <span v-if="r.user.id === me.id" class="rounded-md bg-jade/15 px-1.5 py-0.5 text-[11px] font-semibold text-jade">bạn</span></div>
                <div class="text-sm text-ink2">@{{ r.user.username }} · đăng nhập gần nhất: {{ fmt(r.user.lastLoginAt) }}</div>
              </div>
            </div>
            <dl class="grid grid-cols-4 gap-4 text-center text-sm">
              <div><dd class="text-lg font-bold tabular-nums">{{ r.learned }}</dd><dt class="text-xs text-ink2">thẻ đã học</dt></div>
              <div><dd class="text-lg font-bold tabular-nums text-jade">{{ r.mature }}</dd><dt class="text-xs text-ink2">đã thuộc</dt></div>
              <div><dd class="text-lg font-bold tabular-nums text-sky">{{ r.today }}</dd><dt class="text-xs text-ink2">ôn hôm nay</dt></div>
              <div><dd class="flex items-center justify-center gap-1 text-lg font-bold tabular-nums"><Icon name="flame" :size="15" class="text-seal" />{{ r.streak }}</dd><dt class="text-xs text-ink2">ngày liên tiếp</dt></div>
            </dl>
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-ghost !px-3 !py-1.5 !text-xs" @click="resetting = resetting === r.user.id ? null : r.user.id; newPw = ''">Đặt lại mật khẩu</button>
            <button type="button" class="btn-ghost !px-3 !py-1.5 !text-xs" @click="exportProgress(r)"><Icon name="download" :size="13" />Xuất tiến độ</button>
            <template v-if="r.user.id !== me.id">
              <button type="button" class="btn-ghost !px-3 !py-1.5 !text-xs" @click="toggleRole(r)">{{ r.user.role === 'admin' ? 'Hạ xuống học viên' : 'Nâng lên quản trị viên' }}</button>
              <button type="button" class="btn-ghost !px-3 !py-1.5 !text-xs" @click="toggleDisabled(r)">{{ r.user.disabled ? 'Kích hoạt lại' : 'Vô hiệu hóa' }}</button>
              <button type="button" class="btn-ghost !px-3 !py-1.5 !text-xs !text-seal" @click="deleting = deleting === r.user.id ? null : r.user.id; confirmName = ''">Xóa tài khoản</button>
            </template>
          </div>

          <form v-if="resetting === r.user.id" class="pop flex flex-wrap items-end gap-2 rounded-2xl bg-paper p-3" @submit.prevent="doReset(r)">
            <label class="min-w-[12rem] flex-1 text-sm font-semibold">Mật khẩu mới<input v-model="newPw" type="text" class="field mt-1 !py-2" autocomplete="off" required /></label>
            <button type="submit" class="btn-primary !py-2">Đặt lại</button>
          </form>
          <form v-if="deleting === r.user.id" class="pop space-y-2 rounded-2xl bg-seal/10 p-3" @submit.prevent="doDelete(r)">
            <p class="text-sm"><b>Không hoàn tác được.</b> Xóa tài khoản sẽ xóa luôn toàn bộ thẻ, điểm thi và tiến độ của <b>{{ r.user.displayName }}</b> trên máy này. Gõ <b>{{ r.user.username }}</b> để xác nhận.</p>
            <div class="flex flex-wrap gap-2"><input v-model="confirmName" class="field min-w-[12rem] flex-1 !py-2" autocomplete="off" :aria-label="`Gõ ${r.user.username} để xác nhận xóa`" /><button type="submit" class="btn-primary !py-2" :disabled="confirmName !== r.user.username">Xóa vĩnh viễn</button></div>
          </form>
        </article>
      </section>
    </div>
  </div>
</template>
