<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/lib/auth.instance'
import { AuthError } from '@/lib/auth'
import Icon from '@/components/Icon.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const firstRun = ref(false)
const registrationOpen = ref(true)
const hasLegacy = ref(false)
const keepLegacy = ref(true)
const ready = ref(false)

const username = ref('')
const displayName = ref('')
const password = ref('')
const password2 = ref('')
const remember = ref(false)
const showPw = ref(false)
const busy = ref(false)
const error = ref('')
const wait = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  firstRun.value = !(await authService.hasUsers())
  registrationOpen.value = await authService.registrationOpen()
  if (firstRun.value) {
    mode.value = 'register'
    hasLegacy.value = await auth.hasLegacyProgress()
  }
  ready.value = true
})
onBeforeUnmount(() => clearInterval(timer))

const idle = computed(() => route.query.idle === '1')
const expired = computed(() => route.query.expired === '1')
const canSubmit = computed(() => !busy.value && wait.value === 0 && username.value.trim() !== '' && password.value !== '' && (mode.value === 'login' || (displayName.value.trim() !== '' && password2.value !== '')))

function startCountdown(seconds: number) {
  clearInterval(timer)
  wait.value = seconds
  timer = setInterval(() => {
    wait.value = Math.max(0, wait.value - 1)
    if (wait.value === 0) {
      clearInterval(timer)
      error.value = ''
    }
  }, 1000)
}

async function submit() {
  if (!canSubmit.value) return
  error.value = ''
  if (mode.value === 'register' && password.value !== password2.value) return void (error.value = 'Hai lần nhập mật khẩu chưa giống nhau.')
  busy.value = true
  try {
    if (mode.value === 'login') await auth.login(username.value, password.value, remember.value)
    else await auth.register({ username: username.value, displayName: displayName.value, password: password.value }, remember.value, firstRun.value && hasLegacy.value && keepLegacy.value)
    const to = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
    await router.replace(to)
  } catch (e) {
    if (e instanceof AuthError) {
      error.value = e.message
      if (e.code === 'locked' && e.retryAfter) startCountdown(e.retryAfter)
    } else error.value = 'Có lỗi không mong muốn: ' + (e as Error).message
  } finally {
    busy.value = false
    password.value = ''
    password2.value = ''
  }
}
function switchMode(m: 'login' | 'register') {
  mode.value = m
  error.value = ''
}
</script>

<template>
  <div class="aurora grid min-h-screen place-items-center p-4">
    <div class="w-full max-w-md space-y-5">
      <div class="flex flex-col items-center gap-3 text-center">
        <span class="seal h-16 w-16 text-4xl">学</span>
        <div>
          <h1 class="text-2xl font-bold">Trung văn IT</h1>
          <p class="text-sm text-ink2">Học tiếng Trung cho xưởng và văn phòng</p>
        </div>
      </div>

      <section class="glass p-6 md:p-8">
        <p v-if="idle" class="mb-4 rounded-xl bg-lantern/25 p-3 text-sm" role="status">Bạn đã được đăng xuất vì không thao tác trong 30 phút.</p>

        <p v-if="expired" class="mb-4 rounded-xl bg-lantern/25 p-3 text-sm" role="status">Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Hãy đăng nhập lại.</p>

        <div v-if="ready && !firstRun && registrationOpen" class="seg mb-5 w-full" role="radiogroup" aria-label="Chế độ">
          <button type="button" role="radio" :aria-checked="mode === 'login'" @click="switchMode('login')">Đăng nhập</button>
          <button type="button" role="radio" :aria-checked="mode === 'register'" @click="switchMode('register')">Tạo tài khoản</button>
        </div>
        <div v-else-if="ready" class="mb-5">
          <h2 class="text-xl font-bold">{{ firstRun ? 'Tạo tài khoản quản trị đầu tiên' : 'Đăng nhập' }}</h2>
          <p v-if="firstRun" class="text-sm text-ink2">Chưa có tài khoản nào. Người tạo đầu tiên sẽ là quản trị viên, có thể tạo thêm tài khoản cho nhân viên.</p>
          <p v-else-if="!registrationOpen" class="text-sm text-ink2">Chưa có tài khoản? Nhờ quản trị viên tạo giúp.</p>
        </div>

        <form class="space-y-4" novalidate @submit.prevent="submit">
          <label class="block text-sm font-semibold">Tên đăng nhập
            <input v-model="username" class="field mt-1" autocomplete="username" autocapitalize="off" spellcheck="false" :placeholder="mode === 'register' ? 'ví dụ: nguyen.van.a' : ''" required />
          </label>
          <label v-if="mode === 'register'" class="block text-sm font-semibold">Tên hiển thị
            <input v-model="displayName" class="field mt-1" autocomplete="name" placeholder="Tên hiện trên màn hình" maxlength="40" required />
          </label>
          <label class="block text-sm font-semibold">Mật khẩu
            <span class="relative mt-1 block">
              <input v-model="password" :type="showPw ? 'text' : 'password'" class="field !pr-12" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required />
              <button type="button" class="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink2 hover:text-ink" :aria-label="showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" :aria-pressed="showPw" @click="showPw = !showPw"><Icon name="eye" :size="18" /></button>
            </span>
          </label>
          <template v-if="mode === 'register'">
            <label class="block text-sm font-semibold">Nhập lại mật khẩu
              <input v-model="password2" :type="showPw ? 'text' : 'password'" class="field mt-1" autocomplete="new-password" required />
            </label>
            <p class="text-xs text-ink2">Mật khẩu ít nhất 8 ký tự, không trùng tên đăng nhập.</p>
            <label v-if="firstRun && hasLegacy" class="flex items-start gap-2 rounded-xl bg-sky/10 p-3 text-sm">
              <input v-model="keepLegacy" type="checkbox" class="mt-0.5 h-4 w-4" />
              <span>Giữ tiến độ học đã có trên máy này (thẻ, điểm thi, chỗ bạn đã sửa) và chuyển vào tài khoản mới.</span>
            </label>
          </template>
          <label class="flex items-center gap-2 text-sm"><input v-model="remember" type="checkbox" class="h-4 w-4" />Ghi nhớ trên máy này trong 30 ngày</label>
          <p v-if="!remember" class="-mt-2 text-xs text-ink2">Không ghi nhớ: tự đăng xuất khi đóng tab hoặc sau 30 phút không thao tác. Nên dùng cho máy dùng chung.</p>

          <p v-if="error" class="rounded-xl bg-seal/10 p-3 text-sm text-seal" role="alert">{{ error }}<template v-if="wait"> ({{ wait }}s)</template></p>

          <button type="submit" class="btn-primary btn-lg w-full" :disabled="!canSubmit">
            {{ busy ? 'Đang xử lý…' : wait ? `Thử lại sau ${wait}s` : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản' }}
          </button>
        </form>
      </section>

      <p class="px-4 text-center text-xs text-ink2">Tài khoản và tiến độ học lưu ngay trên máy này, tách riêng cho từng người. Mật khẩu được băm, không lưu dạng chữ thường. Dữ liệu chưa đồng bộ giữa các máy.</p>
    </div>
  </div>
</template>
