<script setup lang="ts">
import PronounceCheck from '@/components/PronounceCheck.vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Dialogue, DialogueData, DialogueProgress } from '@/types'
import { loadDialogues } from '@/lib/data'
import { getStorage } from '@/lib/storage'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'
import { useSpeech } from '@/composables/useSpeech'
import { scoreSession, shuffle } from '@/lib/exercise'
import { sentenceMatches } from '@/lib/pinyin'
import { usePinyinInput } from '@/composables/usePinyinInput'
import { foldVi } from '@/lib/search'
import PinyinText from '@/components/PinyinText.vue'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'

interface Bubble { who: 'o' | 'm'; sc: string; py: string; vi: string; peeked?: boolean }

const PAGE = 24
const LEVEL_ACC: Record<number, string> = { 1: 'acc-jade', 2: 'acc-sky', 3: 'acc-lantern', 4: 'acc-plum', 5: 'acc-seal', 6: 'acc-sky' }

const settings = useSettingsStore()
const content = useContentStore()
const { speak } = useSpeech()

const data = ref<DialogueData>({ topics: [], items: [] })
const progress = ref(new Map<string, DialogueProgress>())
const level = ref(0)
const topic = ref('all')
const query = ref('')
const limit = ref(PAGE)
const sel = ref<Dialogue | null>(null)
const mode = ref<'choose' | 'type' | 'read'>('choose')
const showPy = ref(settings.s.showPinyin)

const step = ref(0)
const bubbles = ref<Bubble[]>([])
const choices = ref<string[]>([])
const answerIdx = ref(0)
const tries = ref(0)
const wrongIdx = ref<number | null>(null)
const typed = ref('')
const { display, showPreview } = usePinyinInput(typed)
const hint = ref(false)
const results = ref<boolean[]>([])
const finished = ref(false)
const chat = ref<HTMLElement>()

onMounted(async () => {
  data.value = await loadDialogues()
  const rows = await (await getStorage()).dialogueProgress()
  progress.value = new Map(rows.map((r) => [r.id, r]))
})
watch([level, topic, query], () => (limit.value = PAGE))

const topicLabel = (id: string) => data.value.topics.find((t) => t.id === id)?.label ?? id
const topicOptions = computed(() => [
  { value: 'all', label: `Tất cả chủ đề (${data.value.items.length})` },
  ...data.value.topics.map((t) => ({ value: t.id, label: `${t.label} (${data.value.items.filter((d) => d.topic === t.id).length})` })),
])
const levelCount = (lv: number) => data.value.items.filter((d) => (lv === 0 ? true : d.level === lv)).length

const filtered = computed(() => {
  const q = query.value.trim()
  const fq = foldVi(q)
  return data.value.items
    .filter((d) => (level.value === 0 || d.level === level.value) && (topic.value === 'all' || d.topic === topic.value))
    .filter((d) => !q || d.title && foldVi(d.title).includes(fq) || d.lines.some((l) => l.sc.includes(q) || foldVi(l.vi).includes(fq)))
    .sort((a, b) => a.level - b.level)
})
const shown = computed(() => filtered.value.slice(0, limit.value))
const doneCount = computed(() => [...progress.value.values()].length)

const line = computed(() => sel.value?.lines[step.value])
const awaiting = computed(() => !finished.value && mode.value !== 'read' && line.value?.who === 'm')
const myCount = computed(() => sel.value?.lines.filter((l) => l.who === 'm').length ?? 0)
const summary = computed(() => scoreSession(results.value))

function scroll() {
  nextTick(() => chat.value?.scrollTo({ top: chat.value.scrollHeight, behavior: 'smooth' }))
}

/** Phương án nhiễu: câu của "bạn" ở đoạn khác cùng cấp, độ dài gần câu đúng cho hợp lý. */
function pickDistractors(correct: string, d: Dialogue): string[] {
  const len = [...correct].length
  const pool = data.value.items
    .filter((x) => x.id !== d.id)
    .flatMap((x) => x.lines.filter((l) => l.who === 'm').map((l) => ({ sc: l.sc, lv: x.level, topic: x.topic })))
    .filter((c) => c.sc !== correct)
    .map((c) => ({ ...c, score: Math.abs([...c.sc].length - len) + (c.lv === d.level ? 0 : 4) + (c.topic === d.topic ? -1 : 0) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 12)
  return shuffle(pool).slice(0, 2).map((c) => c.sc)
}

function prepare() {
  tries.value = 0
  wrongIdx.value = null
  typed.value = ''
  hint.value = false
  if (!awaiting.value || !line.value || !sel.value) return
  const options = shuffle([line.value.sc, ...pickDistractors(line.value.sc, sel.value)])
  choices.value = options
  answerIdx.value = options.indexOf(line.value.sc)
}

function advance() {
  const s = sel.value!
  while (step.value < s.lines.length && s.lines[step.value].who === 'o') {
    bubbles.value.push({ ...s.lines[step.value] })
    step.value++
  }
  if (step.value >= s.lines.length) finish()
  prepare()
  scroll()
}

async function finish() {
  finished.value = true
  if (mode.value === 'read' || !sel.value) return
  const pct = scoreSession(results.value).percent
  const storage = await getStorage()
  await storage.recordDialogue(sel.value.id, pct)
  const prev = progress.value.get(sel.value.id)
  progress.value.set(sel.value.id, { id: sel.value.id, best: Math.max(prev?.best ?? 0, pct), attempts: (prev?.attempts ?? 0) + 1, last: Date.now() })
  progress.value = new Map(progress.value)
}

function open(d: Dialogue) {
  sel.value = d
  step.value = 0
  bubbles.value = []
  results.value = []
  finished.value = false
  if (mode.value === 'read') {
    bubbles.value = d.lines.map((l) => ({ ...l }))
    finished.value = true
    return
  }
  advance()
}
function setMode(m: typeof mode.value) {
  mode.value = m
  if (sel.value) open(sel.value)
}
function accept(peeked = false) {
  const l = line.value!
  results.value.push(tries.value === 0 && !peeked)
  bubbles.value.push({ ...l, peeked })
  step.value++
  advance()
}
function pickChoice(i: number) {
  if (!awaiting.value) return
  if (i === answerIdx.value) return accept()
  wrongIdx.value = i
  tries.value++
  setTimeout(() => (wrongIdx.value = null), 500)
  if (tries.value >= 2) accept(true)
}
function submitTyped() {
  if (!typed.value.trim() || !line.value) return
  if (sentenceMatches(typed.value, line.value.py)) return accept()
  tries.value++
  wrongIdx.value = -1
  setTimeout(() => (wrongIdx.value = null), 500)
  if (tries.value >= 2) accept(true)
}
function next() {
  const i = filtered.value.findIndex((d) => d.id === sel.value?.id)
  const n = filtered.value[i + 1]
  if (n) open(n)
}
const hasNext = computed(() => {
  const i = filtered.value.findIndex((d) => d.id === sel.value?.id)
  return i >= 0 && i < filtered.value.length - 1
})
</script>

<template>
  <!-- Danh sách đoạn thoại -->
  <div v-if="!sel" class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Hội thoại nhà máy</h1>
      <p class="text-ink2">{{ data.items.length }} đoạn thoại, xếp theo cấp HSK. Bạn biết mình muốn nói gì bằng tiếng Việt, rồi chọn hoặc gõ đúng câu tiếng Trung. Đã luyện {{ doneCount }} đoạn.</p>
    </div>

    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      <button type="button" class="chip shrink-0" :class="level === 0 && 'chip-on'" @click="level = 0">Tất cả <b>{{ levelCount(0) }}</b></button>
      <button v-for="lv in [1, 2, 3, 4, 5, 6]" :key="lv" type="button" class="chip shrink-0" :class="level === lv && 'chip-on'" @click="level = lv">
        {{ lv === 6 ? 'Khó hơn HSK 5' : 'HSK ' + lv }} <b>{{ levelCount(lv) }}</b>
      </button>
    </div>

    <div class="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
      <Select v-model="topic" :options="topicOptions" label="Chủ đề" />
      <div class="relative">
        <Icon name="search" :size="18" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink2" />
        <input v-model="query" type="search" class="field !pl-11" placeholder="Tìm đoạn thoại" aria-label="Tìm đoạn thoại" />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="seg" role="radiogroup" aria-label="Cách đóng vai">
          <button type="button" role="radio" :aria-checked="mode === 'choose'" @click="mode = 'choose'">Chọn câu</button>
          <button type="button" role="radio" :aria-checked="mode === 'type'" @click="mode = 'type'">Gõ</button>
          <button type="button" role="radio" :aria-checked="mode === 'read'" @click="mode = 'read'">Đọc</button>
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-ink2"><input v-model="showPy" type="checkbox" class="h-4 w-4" />Pinyin</label>
      </div>
    </div>

    <p v-if="!filtered.length" class="surface p-6 text-center text-ink2">Không có đoạn thoại nào khớp. Thử bỏ bớt bộ lọc hoặc đổi từ khóa.</p>
    <ul class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <li v-for="d in shown" :key="d.id">
        <button type="button" class="tile block h-full w-full text-left hover:-translate-y-1" :class="LEVEL_ACC[d.level]" @click="open(d)">
          <span class="relative flex items-center justify-between gap-2">
            <span class="rounded-md px-2 py-0.5 text-xs font-bold text-ink" style="background: rgb(var(--acc) / .25)">{{ d.level === 6 ? 'trên HSK 5' : 'HSK ' + d.level }}</span>
            <span v-if="progress.get(d.id)" class="inline-flex items-center gap-1 text-xs font-semibold text-jade"><Icon name="check" :size="13" />{{ progress.get(d.id)!.best }}%</span>
          </span>
          <span class="relative mt-3 block text-lg font-bold leading-snug">{{ d.title || d.lines[0].vi }}</span>
          <span class="relative mt-1 block font-zh text-sm text-ink2">{{ d.lines[0].sc }}</span>
          <span class="relative mt-3 flex flex-wrap gap-2 text-xs text-ink2"><span class="rounded-md bg-paper px-1.5 py-0.5">{{ topicLabel(d.topic) }}</span><span class="rounded-md bg-paper px-1.5 py-0.5">{{ d.lines.length }} câu</span><span v-if="!content.isReviewedKey('dl:' + d.id, d.reviewed)" class="badge-unreviewed">chưa kiểm duyệt</span></span>
        </button>
      </li>
    </ul>
    <div v-if="filtered.length > limit" class="text-center">
      <button type="button" class="btn-ghost btn-lg" @click="limit += PAGE">Xem thêm {{ Math.min(PAGE, filtered.length - limit) }} đoạn <span class="text-ink2">(còn {{ filtered.length - limit }})</span></button>
    </div>
  </div>

  <!-- Đóng vai -->
  <div v-else class="grid gap-5 xl:grid-cols-[1fr_22rem]">
    <section class="surface flex min-h-[32rem] flex-col overflow-hidden">
      <header class="flex items-center gap-3 border-b border-line p-4">
        <button type="button" class="btn-ghost !px-3" aria-label="Chọn đoạn khác" @click="sel = null"><Icon name="back" :size="18" /></button>
        <div class="min-w-0 flex-1"><div class="truncate font-bold">{{ sel.title }}</div><div class="text-sm text-ink2">{{ topicLabel(sel.topic) }} · {{ sel.level === 6 ? 'trên HSK 5' : 'HSK ' + sel.level }}</div></div>
      </header>

      <div ref="chat" class="flex-1 space-y-4 overflow-y-auto bg-paper/60 p-4 md:p-6" style="max-height: 60vh" aria-live="polite">
        <div v-for="(b, i) in bubbles" :key="i" class="pop flex" :class="b.who === 'm' ? 'justify-end' : 'justify-start'">
          <div class="max-w-[85%] rounded-3xl px-5 py-3 md:max-w-[70%]" :class="b.who === 'm' ? 'rounded-br-md bg-seal/12 ring-1 ring-seal/30' : 'rounded-bl-md bg-surface ring-1 ring-line'">
            <div class="mb-1 flex items-center gap-2 text-xs text-ink2">{{ b.who === 'm' ? 'Bạn' : 'Đồng nghiệp' }}<span v-if="b.peeked" class="rounded bg-lantern/30 px-1 text-ink">xem đáp án</span></div>
            <div class="font-zh text-xl leading-snug">{{ b.sc }}</div>
            <div v-if="showPy" class="text-sm"><PinyinText :text="b.py" /></div>
            <div class="mt-1 text-sm text-ink2">{{ b.vi }}</div>
            <button type="button" class="mt-2 inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-ink2 hover:text-sky" @click="speak(b.sc)"><Icon name="play" :size="11" />Nghe</button>
            <PronounceCheck v-if="b.who === 'm'" :text="b.sc" class="mt-2" />
          </div>
        </div>

        <div v-if="finished && mode !== 'read'" class="pop mx-auto max-w-sm space-y-2 py-4 text-center">
          <span class="seal stamp mx-auto h-16 w-16 text-3xl">{{ summary.percent >= 75 ? '优' : '加' }}</span>
          <div class="text-2xl font-bold tabular-nums">{{ summary.correct }}/{{ myCount }} câu đúng ngay lần đầu</div>
          <p class="text-sm text-ink2">{{ summary.percent >= 75 ? 'Bạn xử lý đoạn này khá tự tin.' : 'Chơi lại một lượt, lần này nhớ cả cấu trúc câu.' }}</p>
        </div>
      </div>

      <footer v-if="awaiting && line" class="border-t border-line bg-surface p-4 md:p-5">
        <div class="mb-3 rounded-2xl bg-seal/8 p-3 text-sm"><span class="font-semibold text-seal">Bạn muốn nói:</span> {{ line.vi }}</div>
        <div v-if="mode === 'choose'" class="grid gap-2">
          <button v-for="(c, i) in choices" :key="c" type="button" class="rounded-2xl border-2 px-4 py-3 text-left font-zh text-lg transition hover:-translate-y-0.5 hover:border-sky" :class="wrongIdx === i ? 'shake border-seal bg-seal/10' : 'border-line'" @click="pickChoice(i)">{{ c }}</button>
        </div>
        <form v-else class="space-y-3" @submit.prevent="submitTyped">
          <input v-model="typed" class="field" :class="wrongIdx === -1 && 'shake !border-seal'" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ pinyin câu tiếng Trung bạn sẽ nói" aria-label="Pinyin" />
          <p v-if="showPreview" class="text-sm text-ink2" aria-live="polite">Dạng có dấu: <PinyinText :text="display" /></p>
          <p v-if="hint" class="font-zh text-lg">{{ line.sc }}</p>
          <div class="flex flex-wrap gap-2">
            <button type="submit" class="btn-primary" :disabled="!typed.trim()">Kiểm tra</button>
            <button v-if="!hint" type="button" class="btn-ghost" @click="hint = true">Gợi ý chữ Hán</button>
            <button type="button" class="btn-ghost" @click="accept(true)">Xem đáp án</button>
          </div>
        </form>
        <p v-if="tries === 1" class="mt-2 text-sm text-seal" role="alert">Chưa đúng. Thử một lần nữa.</p>
      </footer>
    </section>

    <aside class="space-y-4 xl:sticky xl:top-8 xl:self-start">
      <section class="surface space-y-4 p-5">
        <div>
          <div class="mb-2 text-sm font-semibold">Cách đóng vai</div>
          <div class="seg w-full" role="radiogroup" aria-label="Cách đóng vai">
            <button type="button" role="radio" :aria-checked="mode === 'choose'" @click="setMode('choose')">Chọn</button>
            <button type="button" role="radio" :aria-checked="mode === 'type'" @click="setMode('type')">Gõ</button>
            <button type="button" role="radio" :aria-checked="mode === 'read'" @click="setMode('read')">Đọc</button>
          </div>
        </div>
        <label class="flex items-center justify-between text-sm font-semibold">Hiện pinyin<input v-model="showPy" type="checkbox" class="h-5 w-5" /></label>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn-ghost" @click="open(sel)">Làm lại</button>
          <button type="button" class="btn-ghost" @click="sel = null">Danh sách</button>
        </div>
        <button v-if="hasNext" type="button" class="btn-primary w-full" @click="next">Đoạn tiếp theo<Icon name="next" :size="16" /></button>
      </section>
      <section class="tile acc-plum"><p class="relative text-sm"><span class="font-bold">Mẹo:</span> đọc to câu của đồng nghiệp trước khi trả lời. Nghe và nói cùng lúc giúp nhớ gấp đôi.</p></section>
    </aside>
  </div>
</template>
