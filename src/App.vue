<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'
import { useAuthStore } from '@/stores/auth'
import { seedLocalDb } from '@/lib/seed'
import { getStorage } from '@/lib/storage'
import { offlineReady } from '@/lib/pwa'
import { IDLE_MS } from '@/lib/session'

const settings = useSettingsStore()
const content = useContentStore()
const auth = useAuthStore()
const dbInfo = ref('')
const router = useRouter()

// Nạp dữ liệu của người dùng ngay khi đăng nhập (hoặc khôi phục phiên)
watch(
  () => auth.user?.id,
  async (id) => {
    if (!id) return
    await settings.load()
    await content.loadOverrides()
    try {
      await seedLocalDb()
      const c = await (await getStorage()).contentCounts()
      dbInfo.value = `Lưu trên máy: ${c.hsk} từ HSK, ${c.it} thuật ngữ IT`
    } catch (e) {
      dbInfo.value = 'Không ghi được DB cục bộ: ' + (e as Error).message
    }
  },
  { immediate: true },
)

// Phím tắt toàn cục
function onShortcut(e: KeyboardEvent) {
  if (!auth.user) return
  const el = e.target instanceof HTMLElement ? e.target : null
  if (el?.matches('input,textarea,select,[contenteditable],[role=combobox]') || e.ctrlKey || e.metaKey) return
  if (e.key === '/' && !e.altKey) {
    e.preventDefault()
    router.push('/search')
  } else if (e.altKey && /^[1-5]$/.test(e.key)) {
    e.preventDefault()
    router.push(main[Number(e.key) - 1].to)
  }
}

// Máy dùng chung: nếu không chọn "ghi nhớ" thì tự đăng xuất sau 30 phút không thao tác
let lastActive = Date.now()
let idleTimer: ReturnType<typeof setInterval> | undefined
const touch = () => (lastActive = Date.now())
onMounted(() => {
  window.addEventListener('keydown', onShortcut)
  for (const ev of ['pointerdown', 'keydown', 'scroll']) window.addEventListener(ev, touch, { passive: true })
  idleTimer = setInterval(() => {
    if (auth.user && !auth.remembered && Date.now() - lastActive > IDLE_MS) auth.logout('idle')
  }, 30_000)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onShortcut)
  for (const ev of ['pointerdown', 'keydown', 'scroll']) window.removeEventListener(ev, touch)
  clearInterval(idleTimer)
})

const main = [
  { to: '/', label: 'Hôm nay', icon: 'sun' },
  { to: '/flashcard', label: 'Ôn thẻ', icon: 'cards' },
  { to: '/practice', label: 'Luyện tập', icon: 'brush' },
  { to: '/scenarios', label: 'Hội thoại', icon: 'chat' },
  { to: '/search', label: 'Tra cứu', icon: 'search' },
]
const talk = [
  { to: '/start', label: 'Nhập môn', icon: 'star' },
  { to: '/mock', label: 'Thi thử HSK', icon: 'clock' },
  { to: '/it', label: 'Tiếng Trung IT', icon: 'chip' },
  { to: '/videos', label: 'Video của tôi', icon: 'play' },
  { to: '/templates', label: 'Mẫu tin nhắn', icon: 'mail' },
  { to: '/review', label: 'Kiểm duyệt', icon: 'check' },
]
const more = computed(() => [
  { to: '/dashboard', label: 'Tiến độ', icon: 'chart' },
  ...(auth.user?.role === 'admin' ? [{ to: '/admin', label: 'Quản lý tài khoản', icon: 'users' }] : []),
  { to: '/settings', label: 'Cài đặt', icon: 'gear' },
])
// Thu gọn thanh bên (chỉ còn biểu tượng), nhớ lựa chọn trên máy này
const SIDEBAR_KEY = 'hoc-trung-sidebar'
const collapsed = ref(false)
try {
  collapsed.value = localStorage.getItem(SIDEBAR_KEY) === '1'
} catch {
  /* trình duyệt chặn lưu trữ: dùng mặc định mở rộng */
}
function toggleSidebar() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed.value ? '1' : '0')
  } catch {
    /* không lưu được thì chỉ áp dụng cho phiên này */
  }
}
const initial = computed(() => (auth.user?.displayName ?? '?').trim().charAt(0).toUpperCase())
</script>

<template>
  <div v-if="auth.user" class="min-h-screen print:block md:grid" :class="collapsed ? 'md:grid-cols-[4.75rem_1fr]' : 'md:grid-cols-[16rem_1fr]'">
    <!-- Thanh bên (desktop), có thể thu gọn -->
    <aside class="sticky top-0 hidden h-screen flex-col print:!hidden border-r border-line bg-surface/70 backdrop-blur md:flex" :class="collapsed ? 'p-3' : 'p-5'">
      <div class="mb-6 flex items-center" :class="collapsed ? 'flex-col gap-3' : 'justify-between gap-2'">
        <RouterLink to="/" class="flex min-w-0 items-center gap-3" aria-label="Trung văn IT, trang chủ" :title="collapsed ? 'Trung văn IT' : undefined">
          <span class="seal h-10 w-10 shrink-0 text-xl">学</span>
          <span v-if="!collapsed" class="leading-tight">
            <span class="block text-base font-bold">Trung văn IT</span>
            <span class="block text-xs text-ink2">cho xưởng & văn phòng</span>
          </span>
        </RouterLink>
        <button type="button" class="btn-icon h-9 w-9 shrink-0 text-ink2 hover:text-ink" :aria-label="collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'" :title="collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'" :aria-expanded="!collapsed" @click="toggleSidebar">
          <Icon :name="collapsed ? 'next' : 'back'" :size="18" />
        </button>
      </div>
      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden" aria-label="Chính">
        <RouterLink v-for="l in main" :key="l.to" :to="l.to"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink2 transition hover:bg-paper hover:text-ink"
          :class="collapsed && 'justify-center !px-0'" :title="collapsed ? l.label : undefined" :aria-label="l.label"
          exact-active-class="!bg-ink !text-paper" :active-class="l.to === '/' ? '' : '!bg-ink !text-paper'">
          <Icon :name="l.icon" :size="20" /><span v-if="!collapsed">{{ l.label }}</span>
        </RouterLink>
        <div class="my-3 border-t border-line" />
        <RouterLink v-for="l in talk" :key="l.to" :to="l.to"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink2 transition hover:bg-paper hover:text-ink"
          :class="collapsed && 'justify-center !px-0'" :title="collapsed ? l.label : undefined" :aria-label="l.label"
          active-class="!bg-ink !text-paper">
          <Icon :name="l.icon" :size="20" /><span v-if="!collapsed">{{ l.label }}</span>
        </RouterLink>
        <div class="my-3 border-t border-line" />
        <RouterLink v-for="l in more" :key="l.to" :to="l.to"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink2 transition hover:bg-paper hover:text-ink"
          :class="collapsed && 'justify-center !px-0'" :title="collapsed ? l.label : undefined" :aria-label="l.label"
          active-class="!bg-ink !text-paper">
          <Icon :name="l.icon" :size="20" /><span v-if="!collapsed">{{ l.label }}</span>
        </RouterLink>
      </nav>

      <div class="mt-3 flex items-center rounded-2xl border border-line bg-paper" :class="collapsed ? 'flex-col gap-2 p-2' : 'gap-3 p-2.5'">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-seal font-bold text-white dark:text-paper" :title="collapsed ? auth.user.displayName : undefined">{{ initial }}</span>
        <span v-if="!collapsed" class="min-w-0 flex-1 leading-tight">
          <span class="block truncate text-sm font-semibold">{{ auth.user.displayName }}</span>
          <span class="block truncate text-xs text-ink2">{{ auth.user.role === 'admin' ? 'Quản trị viên' : 'Học viên' }}</span>
        </span>
        <button type="button" class="btn-icon h-9 w-9 text-ink2 hover:text-seal" title="Đăng xuất" aria-label="Đăng xuất" @click="auth.logout()"><Icon name="logout" :size="18" /></button>
      </div>
      <template v-if="!collapsed">
        <p class="mt-3 text-xs text-ink2">{{ dbInfo }}</p>
        <p v-if="offlineReady" class="mt-1 text-xs font-medium text-jade">Đã sẵn sàng dùng offline</p>
        <RouterLink to="/about" class="mt-1 text-xs text-ink2 underline">Giới thiệu & nguồn dữ liệu</RouterLink>
      </template>
    </aside>

    <div class="min-w-0 pb-24 md:pb-10 print:pb-0">
      <!-- Thanh trên (điện thoại) -->
      <header class="flex items-center justify-between px-4 pb-1 pt-4 md:hidden print:hidden">
        <RouterLink to="/" class="flex items-center gap-2 font-bold"><span class="seal h-8 w-8 text-base">学</span>Trung văn IT</RouterLink>
        <div class="flex items-center gap-1 text-ink2">
          <RouterLink to="/dashboard" class="grid h-10 w-10 place-items-center rounded-full" aria-label="Tiến độ"><Icon name="chart" /></RouterLink>
          <RouterLink to="/settings" class="grid h-9 w-9 place-items-center rounded-full bg-seal text-sm font-bold text-white dark:text-paper" :aria-label="`Tài khoản ${auth.user.displayName}`">{{ initial }}</RouterLink>
        </div>
      </header>
      <main class="w-full px-4 py-4 md:px-8 md:py-8 xl:px-12 print:p-0">
        <RouterView v-slot="{ Component, route }"><component :is="Component" :key="route.path" class="page-in" /></RouterView>
      </main>
    </div>

    <!-- Tab dưới (điện thoại) -->
    <nav class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 print:hidden border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Chính">
      <RouterLink v-for="l in main" :key="l.to" :to="l.to"
        class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink2"
        :active-class="l.to === '/' ? '' : '!text-seal'" exact-active-class="!text-seal">
        <Icon :name="l.icon" :size="22" />{{ l.label.replace('Tiếng Trung ', '') }}
      </RouterLink>
    </nav>
  </div>

  <!-- Chưa đăng nhập: chỉ hiện trang đăng nhập -->
  <RouterView v-else />
</template>
