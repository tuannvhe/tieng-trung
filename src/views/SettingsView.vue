<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/lib/auth.instance'
import { AuthError } from '@/lib/auth'
import { computed } from 'vue'
import { getStorage, type ProgressExport } from '@/lib/storage'
import { localDay } from '@/lib/srs'
import { useContentStore } from '@/stores/content'
import { prefetchStrokes, uniqueHan } from '@/lib/strokes'
import { offlineReady } from '@/lib/pwa'

const { s } = useSettingsStore()
const msg = ref('')
const auth = useAuthStore()
const name = ref(auth.user?.displayName ?? '')
const pw = ref({ old: '', next: '', again: '' })
const accMsg = ref('')
const accErr = ref('')
const nameChanged = computed(() => name.value.trim() !== '' && name.value.trim() !== auth.user?.displayName)
const ok = (m: string) => ((accMsg.value = m), (accErr.value = ''))
const bad = (e: unknown) => ((accErr.value = e instanceof AuthError ? e.message : 'Có lỗi: ' + (e as Error).message), (accMsg.value = ''))
async function saveName() {
  try {
    await auth.updateDisplayName(name.value)
    ok('Đã đổi tên hiển thị.')
  } catch (e) {
    bad(e)
  }
}
async function changePw() {
  if (pw.value.next !== pw.value.again) return bad(new Error('Hai lần nhập mật khẩu mới chưa giống nhau.'))
  try {
    await authService.changePassword(auth.user!.id, pw.value.old, pw.value.next)
    pw.value = { old: '', next: '', again: '' }
    ok('Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.')
  } catch (e) {
    bad(e)
  }
}
const content = useContentStore()
const strokeBusy = ref(false)
const strokeProgress = ref({ done: 0, total: 0 })
const strokeMsg = ref('')

async function downloadStrokes(all: boolean) {
  strokeBusy.value = true
  strokeMsg.value = ''
  try {
    const texts = (await content.loadItTerms()).map((t) => t.hanzi_sc)
    for (const lv of all ? [1, 2, 3, 4, 5, 6] as const : [1] as const) texts.push(...(await content.loadHsk(lv)).map((w) => w.hanzi))
    const chars = uniqueHan(texts)
    strokeProgress.value = { done: 0, total: chars.length }
    const r = await prefetchStrokes(chars, (done, total) => (strokeProgress.value = { done, total }))
    strokeMsg.value = r.failed
      ? `Đã tải ${r.ok} chữ, ${r.failed} chữ lỗi. Kiểm tra mạng rồi bấm tải lại.`
      : `Đã tải ${r.ok} chữ. Tập viết dùng được khi không có mạng.`
  } finally {
    strokeBusy.value = false
  }
}

const themes = [
  { v: 'system', l: 'Theo máy' },
  { v: 'light', l: 'Sáng' },
  { v: 'dark', l: 'Tối' },
] as const

async function exportProgress() {
  const data = await (await getStorage()).exportAll()
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `tien-do-hoc-trung-${localDay()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  msg.value = 'Đã xuất file tiến độ.'
}

async function importProgress(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!confirm('Nhập tiến độ sẽ thay thế toàn bộ tiến độ hiện tại trên máy này. Tiếp tục?')) return
  try {
    await (await getStorage()).importAll(JSON.parse(await file.text()) as ProgressExport)
    msg.value = 'Đã nhập tiến độ. Đang tải lại…'
    setTimeout(() => location.reload(), 600)
  } catch (err) {
    msg.value = 'Không nhập được: ' + (err as Error).message
  }
}
</script>

<template>
  <div class="grid gap-5 xl:grid-cols-2">
    <h1 class="text-3xl font-bold xl:col-span-2">Cài đặt</h1>

    <section v-if="auth.user" class="surface space-y-4 p-6 xl:col-span-2">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="grid h-12 w-12 place-items-center rounded-full bg-seal text-xl font-bold text-white dark:text-paper">{{ auth.user.displayName.charAt(0).toUpperCase() }}</span>
          <div><div class="font-bold">{{ auth.user.displayName }}</div><div class="text-sm text-ink2">@{{ auth.user.username }} · {{ auth.user.role === 'admin' ? 'Quản trị viên' : 'Học viên' }}</div></div>
        </div>
        <button type="button" class="btn-ghost" @click="auth.logout()">Đăng xuất</button>
      </div>
      <div class="grid gap-5 lg:grid-cols-2">
        <form class="space-y-3" @submit.prevent="saveName">
          <label class="block text-sm font-semibold">Tên hiển thị<input v-model="name" class="field mt-1 !py-2" maxlength="40" /></label>
          <button type="submit" class="btn-ghost" :disabled="!nameChanged">Lưu tên</button>
        </form>
        <form class="space-y-3" @submit.prevent="changePw">
          <label class="block text-sm font-semibold">Mật khẩu hiện tại<input v-model="pw.old" type="password" class="field mt-1 !py-2" autocomplete="current-password" /></label>
          <label class="block text-sm font-semibold">Mật khẩu mới<input v-model="pw.next" type="password" class="field mt-1 !py-2" autocomplete="new-password" /></label>
          <label class="block text-sm font-semibold">Nhập lại mật khẩu mới<input v-model="pw.again" type="password" class="field mt-1 !py-2" autocomplete="new-password" /></label>
          <button type="submit" class="btn-ghost" :disabled="!pw.old || !pw.next || !pw.again">Đổi mật khẩu</button>
        </form>
      </div>
      <p v-if="accMsg" class="text-sm text-jade" role="status">{{ accMsg }}</p>
      <p v-if="accErr" class="text-sm text-seal" role="alert">{{ accErr }}</p>
    </section>

    <section class="surface space-y-6 p-6">
      <div>
        <div class="mb-2 text-sm font-semibold">Giao diện</div>
        <div class="seg w-full" role="radiogroup" aria-label="Giao diện">
          <button v-for="t in themes" :key="t.v" type="button" role="radio" :aria-checked="s.theme === t.v" @click="s.theme = t.v">{{ t.l }}</button>
        </div>
      </div>
      <label class="block">
        <span class="text-sm font-semibold">Cỡ chữ Hán: {{ s.zhFontSize }}px</span>
        <input v-model.number="s.zhFontSize" type="range" min="18" max="64" class="mt-2 block w-full accent-[rgb(var(--c-seal))]" />
        <span class="han mt-2 block" :style="{ fontSize: s.zhFontSize + 'px' }">服务器重启</span>
      </label>
      <label class="flex items-center justify-between text-sm font-semibold">Hiện pinyin
        <input v-model="s.showPinyin" type="checkbox" class="h-5 w-5 accent-[rgb(var(--c-seal))]" />
      </label>
      <label class="flex items-center justify-between text-sm font-semibold">Thẻ mới mỗi ngày
        <input v-model.number="s.newCardsPerDay" type="number" min="0" max="200" class="field !w-24 !py-2 text-right" />
      </label>
      <label class="flex items-center justify-between text-sm font-semibold">Mục tiêu số ngày học mỗi tuần
        <input v-model.number="s.weeklyDays" type="number" min="1" max="7" class="field !w-24 !py-2 text-right" />
      </label>
      <label class="flex items-center justify-between text-sm font-semibold">Chỉ học tiếng Trung IT
        <input type="checkbox" class="h-5 w-5 accent-[rgb(var(--c-seal))]" :checked="s.mode === 'it-only'" @change="s.mode = ($event.target as HTMLInputElement).checked ? 'it-only' : 'full'" />
      </label>
    </section>

    <section class="surface space-y-3 p-6 xl:self-start">
      <div class="text-sm font-semibold">Tiến độ học</div>
      <p class="text-sm text-ink2">Tiến độ nằm trên trình duyệt này. Xuất file để sao lưu hoặc chuyển sang máy khác.</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-ghost" @click="exportProgress">Xuất file tiến độ</button>
        <label class="btn-ghost cursor-pointer">Nhập từ file<input type="file" accept="application/json" class="sr-only" @change="importProgress" /></label>
      </div>
      <p v-if="msg" class="text-sm text-jade" role="status">{{ msg }}</p>
    </section>

    <section class="surface space-y-3 p-6 xl:col-span-2">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm font-semibold">Dùng khi không có mạng</div>
        <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="offlineReady ? 'bg-jade/15 text-jade' : 'bg-paper text-ink2'">{{ offlineReady ? 'Ứng dụng đã sẵn sàng offline' : 'Mở lại lần sau để lưu offline' }}</span>
      </div>
      <p class="text-sm text-ink2">Từ vựng, thẻ và bài học đã nằm sẵn trong ứng dụng. Riêng nét chữ của phần tập viết tải từ mạng; tải sẵn một lần để dùng ở xưởng không có Wi-Fi.</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-ghost" :disabled="strokeBusy" @click="downloadStrokes(false)">Tải nét chữ IT và HSK 1</button>
        <button v-if="s.mode === 'full'" type="button" class="btn-ghost" :disabled="strokeBusy" @click="downloadStrokes(true)">Tải nét chữ HSK 1–5 (dung lượng lớn hơn)</button>
      </div>
      <div v-if="strokeBusy" class="space-y-1" role="status">
        <div class="h-2 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-seal transition-all" :style="{ width: (strokeProgress.total ? (strokeProgress.done / strokeProgress.total) * 100 : 0) + '%' }" /></div>
        <p class="text-sm text-ink2 tabular-nums">{{ strokeProgress.done }}/{{ strokeProgress.total }} chữ</p>
      </div>
      <p v-else-if="strokeMsg" class="text-sm text-jade" role="status">{{ strokeMsg }}</p>
    </section>
  </div>
</template>
