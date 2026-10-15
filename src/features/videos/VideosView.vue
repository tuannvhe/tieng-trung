<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getStorage } from '@/lib/storage'
import { embedUrl, fetchTitle, parseYtMessage, YT_ORIGIN, ytCommand, ytListening, formatStart, MAX_MARKS, parseClock, parseYoutube, thumbnailUrl, watchUrl, type SavedVideo } from '@/lib/youtube'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'

const videos = ref<SavedVideo[]>([])
const loading = ref(true)
const playing = ref<SavedVideo | null>(null)
const filter = ref('all')
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

const form = ref({ url: '', title: '', note: '', level: '0' })
const error = ref('')
const busy = ref(false)
const message = ref('')

const HIDE_KEY = 'hoc-trung-video-hidden'
const hideVideo = ref(false)
try { hideVideo.value = localStorage.getItem(HIDE_KEY) === '1' } catch { /* bỏ qua */ }
function toggleVideo() {
  hideVideo.value = !hideVideo.value
  try { localStorage.setItem(HIDE_KEY, hideVideo.value ? '1' : '0') } catch { /* bỏ qua */ }
}

// Điều khiển và theo dõi tiến độ qua khung YouTube
const frame = ref<HTMLIFrameElement | null>(null)
const curTime = ref(0)
const duration = ref(0)
const ytState = ref(-1)
const ready = ref(false)
let hello: ReturnType<typeof setInterval> | undefined
const isPlaying = computed(() => ytState.value === 1 || ytState.value === 3)
const percent = computed(() => (duration.value > 0 ? Math.min(100, (curTime.value / duration.value) * 100) : 0))
const send = (msg: string) => frame.value?.contentWindow?.postMessage(msg, YT_ORIGIN)
function onFrameLoad() {
  ready.value = false
  curTime.value = 0
  duration.value = 0
  ytState.value = -1
  handshake()
}
function handshake() {
  clearInterval(hello)
  let n = 0
  send(ytListening())
  hello = setInterval(() => {
    if (ready.value || ++n > 120) return clearInterval(hello)
    send(ytListening())
  }, 500)
}
let pending: 'playVideo' | 'pauseVideo' | null = null
function onYtMessage(e: MessageEvent) {
  if (e.origin !== YT_ORIGIN || e.source !== frame.value?.contentWindow) return
  const p = parseYtMessage(e.data)
  if (!p) return
  const first = !ready.value
  ready.value = true
  if (first && pending) {
    send(ytCommand(pending))
    pending = null
  }
  if (p.time !== undefined) curTime.value = p.time
  if (p.duration !== undefined) duration.value = p.duration
  if (p.state !== undefined) ytState.value = p.state
}
function togglePlay() {
  const cmd = isPlaying.value ? 'pauseVideo' : 'playVideo'
  if (ready.value) return send(ytCommand(cmd))
  pending = cmd // chưa kết nối xong: nhớ lệnh và kết nối lại ngay
  handshake()
}
function jump(to: number) {
  const t = Math.max(0, duration.value ? Math.min(duration.value, to) : to)
  if (ready.value) {
    send(ytCommand('seekTo', [t, true]))
    curTime.value = t
  } else {
    seek(t)
  }
}
/** Lưu vị trí đang xem để lần sau xem tiếp. Xem hết video thì quay về đầu. */
function saveProgress() {
  const v = playing.value
  if (!v || !ready.value || duration.value <= 0) return
  const dur = Math.floor(duration.value)
  const pos = curTime.value >= duration.value - 5 ? 0 : Math.floor(curTime.value)
  if (Math.abs(pos - (v.position ?? 0)) < 3 && dur === (v.duration ?? 0)) return
  void persist({ ...v, position: pos, duration: dur }).catch(() => undefined)
}
let saver: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  window.addEventListener('message', onYtMessage)
  window.addEventListener('pagehide', saveProgress)
  saver = setInterval(() => { if (isPlaying.value) saveProgress() }, 5000)
})
onBeforeUnmount(() => {
  saveProgress()
  window.removeEventListener('message', onYtMessage)
  window.removeEventListener('pagehide', saveProgress)
  clearInterval(hello)
  clearInterval(saver)
})
watch(ytState, (st) => { if (st === 2 || st === 0) saveProgress() })
const resumeAt = (v: SavedVideo) => ((v.position ?? 0) > 5 ? (v.position as number) : v.start)
const watchedPct = (v: SavedVideo) => (v.duration && v.position ? Math.min(100, Math.round((v.position / v.duration) * 100)) : 0)
function closePlayer() {
  saveProgress()
  playing.value = null
}
watch(() => playing.value?.id, () => {
  pending = null
  ready.value = false
  curTime.value = 0
  duration.value = 0
  ytState.value = -1
})

const origin = typeof location === 'undefined' || !/^https?:/.test(location.origin) ? '' : location.origin
const playStart = ref(0)
const markTime = ref('')
const markNote = ref('')
const sortedMarks = computed(() => [...(playing.value?.marks ?? [])].sort((a, b) => a.t - b.t))
const editNote = ref('')
const editing = ref(false)
const confirmDelete = ref<string | null>(null)

const LEVEL_OPTIONS = [
  { value: '0', label: 'Chưa gán cấp' },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `HSK ${n}` })),
]
const FILTERS = [{ value: 'all', label: 'Tất cả' }, ...LEVEL_OPTIONS.slice(1), { value: '0', label: 'Chưa gán cấp' }]

const shown = computed(() => (filter.value === 'all' ? videos.value : videos.value.filter((v) => String(v.level) === filter.value)))

onMounted(async () => {
  window.addEventListener('online', () => (online.value = true))
  window.addEventListener('offline', () => (online.value = false))
  try {
    videos.value = await (await getStorage()).listVideos()
  } catch (e) {
    error.value = 'Không đọc được danh sách video: ' + (e as Error).message
  } finally {
    loading.value = false
  }
})

async function add() {
  error.value = ''
  message.value = ''
  const p = parseYoutube(form.value.url)
  if (!p) return void (error.value = 'Đây không phải link video YouTube. Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…')
  const dup = videos.value.find((v) => v.videoId === p.videoId && v.start === p.start)
  if (dup) {
    message.value = 'Video này đã có trong danh sách của bạn.'
    return void open(dup)
  }
  busy.value = true
  try {
    let title = form.value.title.trim()
    if (!title) title = await fetchTitle(p.videoId)
    const v: SavedVideo = {
      id: crypto.randomUUID(),
      videoId: p.videoId,
      title: title || `Video ${p.videoId}`,
      note: form.value.note.trim().slice(0, 2000),
      level: Number(form.value.level) as SavedVideo['level'],
      start: p.start,
      createdAt: Date.now(),
    }
    await (await getStorage()).saveVideo(v)
    videos.value = [v, ...videos.value]
    form.value = { url: '', title: '', note: '', level: form.value.level }
    message.value = 'Đã lưu video.'
    open(v)
  } catch (e) {
    error.value = 'Không lưu được: ' + (e as Error).message
  } finally {
    busy.value = false
  }
}

async function persist(v: SavedVideo) {
  await (await getStorage()).saveVideo(v)
  const i = videos.value.findIndex((x) => x.id === v.id)
  if (i >= 0) videos.value[i] = v
  if (playing.value?.id === v.id) playing.value = v
}

function open(v: SavedVideo) {
  saveProgress()
  playing.value = v
  playStart.value = resumeAt(v)
  markTime.value = ''
  markNote.value = ''
  editing.value = false
  editNote.value = v.note
  confirmDelete.value = null
  void persist({ ...v, lastWatchedAt: Date.now() }).catch(() => undefined)
  requestAnimationFrame(() => document.getElementById('player')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

async function saveNote() {
  if (!playing.value) return
  try {
    await persist({ ...playing.value, note: editNote.value.trim().slice(0, 2000) })
    editing.value = false
  } catch (e) {
    error.value = 'Không lưu được ghi chú: ' + (e as Error).message
  }
}
async function addMark() {
  const v = playing.value
  if (!v) return
  const t = parseClock(markTime.value)
  if (t === null || t > 172800) return void (error.value = 'Mốc thời gian không đúng. Gõ dạng 1:15 hoặc 1:02:03.')
  if ((v.marks?.length ?? 0) >= MAX_MARKS) return void (error.value = `Mỗi video tối đa ${MAX_MARKS} mốc.`)
  error.value = ''
  try {
    await persist({ ...v, marks: [...(v.marks ?? []), { t, note: markNote.value.trim().slice(0, 200) }] })
    markTime.value = ''
    markNote.value = ''
  } catch (e) {
    error.value = 'Không lưu được mốc: ' + (e as Error).message
  }
}
async function removeMark(i: number) {
  const v = playing.value
  if (!v) return
  const target = sortedMarks.value[i]
  try {
    await persist({ ...v, marks: (v.marks ?? []).filter((m) => m !== target && !(m.t === target.t && m.note === target.note)) })
  } catch (e) {
    error.value = 'Không xóa được mốc: ' + (e as Error).message
  }
}
function seek(t: number) {
  playStart.value = t
  document.getElementById('player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function setLevel(v: SavedVideo, level: string) {
  try {
    await persist({ ...v, level: Number(level) as SavedVideo['level'] })
  } catch (e) {
    error.value = 'Không đổi được cấp: ' + (e as Error).message
  }
}
async function remove(v: SavedVideo) {
  try {
    await (await getStorage()).deleteVideo(v.id)
    videos.value = videos.value.filter((x) => x.id !== v.id)
    if (playing.value?.id === v.id) playing.value = null
    confirmDelete.value = null
    message.value = 'Đã xóa video khỏi danh sách của bạn.'
  } catch (e) {
    error.value = 'Không xóa được: ' + (e as Error).message
  }
}
const levelLabel = (l: number) => (l ? `HSK ${l}` : 'Chưa gán cấp')
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Video của tôi</h1>
      <p class="text-ink2">Lưu link YouTube bạn muốn học, xem ngay trong ứng dụng và ghi chú lại. Danh sách này chỉ của riêng tài khoản của bạn.</p>
    </div>

    <p v-if="message" class="rounded-2xl bg-jade/10 p-3 text-sm text-jade" role="status">{{ message }}</p>
    <p v-if="error" class="rounded-2xl bg-seal/10 p-3 text-sm text-seal" role="alert">{{ error }}</p>

    <div class="grid gap-5 xl:grid-cols-[22rem_1fr]">
      <form class="surface space-y-3 p-5 xl:sticky xl:top-8 xl:self-start" novalidate @submit.prevent="add">
        <h2 class="font-bold">Thêm video</h2>
        <label class="block text-sm font-semibold">Link YouTube
          <input v-model="form.url" class="field mt-1 !py-2" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://www.youtube.com/watch?v=…" required />
        </label>
        <label class="block text-sm font-semibold">Tên video <span class="font-normal text-ink2">(để trống thì tự lấy từ YouTube)</span>
          <input v-model="form.title" class="field mt-1 !py-2" maxlength="200" />
        </label>
        <div class="space-y-1"><span class="text-sm font-semibold">Cấp HSK</span><Select v-model="form.level" :options="LEVEL_OPTIONS" label="Cấp HSK" /></div>
        <label class="block text-sm font-semibold">Ghi chú
          <textarea v-model="form.note" class="field mt-1 !py-2" rows="3" maxlength="2000" placeholder="Phút nào đáng nghe lại, từ mới học được…" />
        </label>
        <button type="submit" class="btn-primary w-full" :disabled="busy || !form.url.trim()"><Icon name="plus" :size="16" />{{ busy ? 'Đang lưu…' : 'Lưu video' }}</button>
        <p class="text-xs text-ink2">Link có kèm mốc thời gian (&amp;t=90) sẽ phát từ mốc đó. Chỉ nhận link video YouTube.</p>
      </form>

      <section class="min-w-0 space-y-5">
        <article v-if="playing" id="player" class="surface space-y-4 overflow-hidden p-4 md:p-5">
          <div v-if="online" :class="hideVideo ? 'pointer-events-none fixed -left-[9999px] top-0 w-[480px]' : 'w-full'" class="aspect-video overflow-hidden rounded-2xl bg-ink" :aria-hidden="hideVideo">
            <iframe
              :key="playing.id + ':' + playStart"
              class="h-full w-full"
              ref="frame"
              :src="embedUrl(playing.videoId, playStart, origin)"
              @load="onFrameLoad"
              :title="playing.title"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen
            />
          </div>
          <div v-if="online" class="flex items-center gap-2 rounded-2xl bg-paper px-3 py-2" role="group" aria-label="Điều khiển video">
            <button type="button" class="btn-icon h-9 w-9" :aria-label="isPlaying ? 'Tạm dừng' : 'Phát'" @click="togglePlay"><Icon :name="isPlaying ? 'pause' : 'play'" :size="16" /></button>
            <button type="button" class="btn-ghost !px-2 !py-1 text-xs" :disabled="!ready" aria-label="Lùi 10 giây" @click="jump(curTime - 10)">-10s</button>
            <input type="range" class="min-w-0 flex-1" min="0" :max="Math.max(1, Math.floor(duration))" :value="Math.floor(curTime)" :disabled="!ready || !duration" aria-label="Tiến độ video" @change="jump(Number(($event.target as HTMLInputElement).value))" />
            <button type="button" class="btn-ghost !px-2 !py-1 text-xs" :disabled="!ready" aria-label="Tiến 10 giây" @click="jump(curTime + 10)">+10s</button>
            <span class="w-28 shrink-0 text-right text-xs tabular-nums text-ink2">{{ formatStart(curTime) }} / {{ duration ? formatStart(duration) : '--:--' }}<span v-if="duration" class="sr-only">, đã xem {{ Math.round(percent) }}%</span></span>
          </div>
          <p v-if="online && hideVideo" class="rounded-2xl bg-paper px-4 py-2 text-sm text-ink2">Đã ẩn hình, video vẫn chạy và nghe được. Bấm "Hiện video" để xem lại.</p>
          <p v-else-if="!online" class="rounded-2xl bg-paper p-8 text-center text-ink2">Đang offline. Video YouTube cần có mạng để xem; danh sách và ghi chú của bạn vẫn dùng được.</p>

          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="break-words text-xl font-bold">{{ playing.title }}</h2>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink2">
                <span class="chip">{{ levelLabel(playing.level) }}</span>
                <span v-if="playing.start">bắt đầu từ {{ formatStart(playing.start) }}</span>
                <a :href="watchUrl(playing.videoId, playing.start)" target="_blank" rel="noopener noreferrer" class="underline hover:text-sky">Mở trên YouTube</a>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <div class="w-40"><Select :model-value="String(playing.level)" :options="LEVEL_OPTIONS" label="Đổi cấp HSK" @update:model-value="setLevel(playing!, $event)" /></div>
              <button v-if="online" type="button" class="btn-ghost" :aria-pressed="hideVideo" @click="toggleVideo">{{ hideVideo ? 'Hiện video' : 'Ẩn video' }}</button>
              <button type="button" class="btn-ghost" @click="closePlayer">Đóng</button>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between"><h3 class="font-semibold">Ghi chú</h3>
              <button v-if="!editing" type="button" class="btn-ghost !px-3 !py-1.5 !text-xs" @click="editing = true; editNote = playing.note">Sửa ghi chú</button></div>
            <template v-if="editing">
              <textarea v-model="editNote" class="field !py-2" rows="4" maxlength="2000" aria-label="Ghi chú" />
              <div class="flex gap-2"><button type="button" class="btn-primary !py-2" @click="saveNote">Lưu ghi chú</button><button type="button" class="btn-ghost !py-2" @click="editing = false">Hủy</button></div>
            </template>
            <p v-else class="whitespace-pre-wrap break-words text-ink2">{{ playing.note || 'Chưa có ghi chú.' }}</p>
          </div>

          <div class="space-y-2">
            <h3 class="font-semibold">Mốc cần nghe lại <span class="font-normal text-ink2">({{ sortedMarks.length }})</span></h3>
            <ul v-if="sortedMarks.length" class="divide-y divide-line rounded-2xl bg-paper">
              <li v-for="(m, i) in sortedMarks" :key="m.t + ':' + i" class="flex items-center gap-3 px-3 py-2">
                <button type="button" class="btn-ghost !px-3 !py-1 font-mono text-sm tabular-nums" :aria-label="`Phát từ ${formatStart(m.t)}`" @click="seek(m.t)"><Icon name="play" :size="11" />{{ formatStart(m.t) }}</button>
                <span class="min-w-0 flex-1 break-words text-sm">{{ m.note || 'Không có ghi chú' }}</span>
                <button type="button" class="btn-icon h-8 w-8 text-ink2 hover:text-seal" :aria-label="`Xóa mốc ${formatStart(m.t)}`" @click="removeMark(i)"><Icon name="trash" :size="15" /></button>
              </li>
            </ul>
            <form class="flex flex-wrap items-end gap-2" novalidate @submit.prevent="addMark">
              <label class="w-28 text-sm font-semibold">Mốc<input v-model="markTime" class="field mt-1 !py-2 font-mono" inputmode="numeric" placeholder="1:15" autocomplete="off" /></label>
              <label class="min-w-[12rem] flex-1 text-sm font-semibold">Ghi chú mốc<input v-model="markNote" class="field mt-1 !py-2" maxlength="200" placeholder="Câu cần luyện nghe lại…" autocomplete="off" /></label>
              <button type="submit" class="btn-ghost !py-2" :disabled="!markTime.trim()"><Icon name="plus" :size="15" />Thêm mốc</button>
            </form>
            <p class="text-xs text-ink2">Xem đến đâu cần nhớ thì gõ mốc thời gian hiện trên khung phát. Bấm nút mốc để phát lại từ đó.</p>
          </div>

          <div class="border-t border-line pt-3">
            <button v-if="confirmDelete !== playing.id" type="button" class="btn-ghost !text-seal" @click="confirmDelete = playing.id"><Icon name="trash" :size="16" />Xóa khỏi danh sách</button>
            <div v-else class="pop flex flex-wrap items-center gap-2 rounded-2xl bg-seal/10 p-3 text-sm">
              Xóa video này khỏi danh sách của bạn? Không ảnh hưởng đến YouTube.
              <button type="button" class="btn-primary !py-1.5" @click="remove(playing)">Xóa</button>
              <button type="button" class="btn-ghost !py-1.5" @click="confirmDelete = null">Giữ lại</button>
            </div>
          </div>
        </article>

        <div class="flex flex-wrap items-center gap-3">
          <div class="seg flex-wrap" role="radiogroup" aria-label="Lọc theo cấp">
            <button v-for="f in FILTERS" :key="f.value" type="button" role="radio" :aria-checked="filter === f.value" @click="filter = f.value">{{ f.label }}</button>
          </div>
          <span class="text-sm text-ink2">{{ shown.length }} video</span>
        </div>

        <p v-if="loading" class="surface p-8 text-center text-ink2">Đang tải…</p>
        <div v-else-if="!shown.length" class="surface space-y-1 p-8 text-center">
          <div class="font-semibold">{{ videos.length ? 'Không có video nào ở cấp này' : 'Bạn chưa lưu video nào' }}</div>
          <p class="text-ink2">{{ videos.length ? 'Chọn "Tất cả" để xem toàn bộ.' : 'Dán link YouTube vào ô bên cạnh để bắt đầu.' }}</p>
        </div>
        <ul v-else class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <li v-for="v in shown" :key="v.id">
            <button type="button" class="tile group block w-full overflow-hidden !p-0 text-left" :class="playing?.id === v.id && 'ring-2 ring-seal'" @click="open(v)">
              <span class="relative block aspect-video w-full overflow-hidden bg-paper">
                <img :src="thumbnailUrl(v.videoId)" alt="" loading="lazy" referrerpolicy="no-referrer" class="h-full w-full object-cover transition group-hover:scale-105" />
                <span class="absolute inset-0 grid place-items-center bg-ink/0 text-white opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100"><Icon name="play" :size="40" /></span>
              </span>
              <span class="block space-y-1 p-4">
                <span class="line-clamp-2 block font-semibold">{{ v.title }}</span>
                <span class="flex flex-wrap items-center gap-2 text-xs text-ink2"><span class="chip">{{ levelLabel(v.level) }}</span><span v-if="v.start">từ {{ formatStart(v.start) }}</span><span v-if="watchedPct(v)">đã xem {{ watchedPct(v) }}%</span></span>
                <span v-if="watchedPct(v)" class="block h-1 overflow-hidden rounded-full bg-paper" aria-hidden="true"><span class="block h-full bg-seal" :style="{ width: watchedPct(v) + '%' }" /></span>
                <span v-if="v.note" class="line-clamp-2 block text-sm text-ink2">{{ v.note }}</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
