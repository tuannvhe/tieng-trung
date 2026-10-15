<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ExamResult, HskLevel } from '@/types'
import { useContentStore } from '@/stores/content'
import { getStorage } from '@/lib/storage'
import { loadDialogues } from '@/lib/data'
import { formatClock } from '@/lib/exam'
import { downloadText } from '@/lib/download'
import { PAPER_TEMPLATE, parsePaper, MAX_SAVED_PAPERS, type SavedPaperMeta } from '@/lib/mock-paper'
import { useSpeech } from '@/composables/useSpeech'
import {
  adviceFor, buildMockExam, gradeMock, hasHanOptions, isRight, MOCK_SPECS, SKILL_LABEL, sectionCount,
  type MockAnswer, type MockExam, type MockLevel, type MockResult,
} from '@/lib/mock'
import ProgressRing from '@/components/ProgressRing.vue'
import Icon from '@/components/Icon.vue'

const content = useContentStore()
const { speak } = useSpeech()
const LEVELS: MockLevel[] = [1, 2, 3, 4, 5, 6]
const LETTER = ['A', 'B', 'C', 'D']
const MAX_PLAYS = 2

const phase = ref<'lobby' | 'running' | 'result'>('lobby')
const exam = ref<MockExam | null>(null)
const answers = ref<MockAnswer[]>([])
const plays = ref<number[]>([])
const sec = ref(0)
const cur = ref(0)
const secondsLeft = ref(0)
const confirmEnd = ref(false)
const result = ref<MockResult | null>(null)
const history = ref<ExamResult[]>([])
const busy = ref(false)
const error = ref('')
let timer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  await refreshHistory()
  await refreshPapers()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearInterval(timer)
})

async function refreshHistory() {
  try {
    history.value = (await (await getStorage()).examResults()).filter((r) => r.kind === 'mock').reverse().slice(0, 6)
  } catch (e) {
    error.value = 'Không đọc được lịch sử thi: ' + (e as Error).message
  }
}

/** Bắt đầu làm một đề đã dựng sẵn (đề tự dựng hoặc đề nạp từ file). */
function launch(e: MockExam) {
  exam.value = e
  answers.value = e.questions.map(() => null)
  plays.value = e.questions.map(() => 0)
  result.value = null
  beginSection(0)
  phase.value = 'running'
}

const paperErrors = ref<string[]>([])
async function onPaperFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  paperErrors.value = []
  if (!file) return
  if (file.size > 2_000_000) return void (paperErrors.value = ['File quá lớn (tối đa 2 MB).'])
  const raw = await file.text()
  const r = parsePaper(raw)
  if (r.errors.length) return void (paperErrors.value = r.errors.slice(0, 12))
  if (saveIt.value) {
    try {
      const lv = r.exam!.level
      await (await getStorage()).savePaper({ id: crypto.randomUUID(), title: r.title!.slice(0, 120), level: lv, savedAt: Date.now(), json: raw })
      await refreshPapers()
    } catch (e) {
      paperErrors.value = ['Không lưu được đề: ' + (e as Error).message + ' (vẫn làm bài được)']
    }
  }
  launch(r.exam!)
}

// File mp3 chọn kèm đề: chỉ giữ trong phiên (không lưu vào tài khoản vì dung lượng lớn)
const mp3Urls = ref<Record<string, string>>({})
const MAX_MP3_TOTAL = 80_000_000
function onMp3Files(ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = [...(input.files ?? [])].filter((f) => /\.mp3$/i.test(f.name))
  input.value = ''
  Object.values(mp3Urls.value).forEach((u) => URL.revokeObjectURL(u))
  mp3Urls.value = {}
  paperErrors.value = []
  let total = 0
  for (const f of files) {
    total += f.size
    if (total > MAX_MP3_TOTAL) return void (paperErrors.value = ['Tổng dung lượng mp3 quá lớn (tối đa 80 MB).'])
    mp3Urls.value[f.name.toLowerCase()] = URL.createObjectURL(f)
  }
}
const mp3Count = computed(() => Object.keys(mp3Urls.value).length)

// Đề đã lưu trong tài khoản
const saveIt = ref(true)
const papers = ref<SavedPaperMeta[]>([])
async function refreshPapers() {
  try {
    papers.value = await (await getStorage()).listPapers()
  } catch (e) {
    paperErrors.value = ['Không đọc được danh sách đề đã lưu: ' + (e as Error).message]
  }
}
async function takePaper(id: string) {
  paperErrors.value = []
  try {
    const p = await (await getStorage()).getPaper(id)
    if (!p) return void (paperErrors.value = ['Không tìm thấy đề này nữa.'])
    const r = parsePaper(p.json)
    if (r.errors.length) return void (paperErrors.value = r.errors.slice(0, 12))
    launch(r.exam!)
  } catch (e) {
    paperErrors.value = ['Không mở được đề: ' + (e as Error).message]
  }
}
async function removePaper(p: SavedPaperMeta) {
  if (!window.confirm('Xóa đề "' + p.title + '" khỏi tài khoản?')) return
  try {
    await (await getStorage()).deletePaper(p.id)
    await refreshPapers()
  } catch (e) {
    paperErrors.value = ['Không xóa được: ' + (e as Error).message]
  }
}
const downloadTemplate = () => downloadText('de-mau-thi-thu.json', JSON.stringify(PAPER_TEMPLATE, null, 2), 'application/json')

async function start(level: MockLevel) {
  busy.value = true
  error.value = ''
  try {
    const words = (await Promise.all(Array.from({ length: level }, (_, i) => content.loadHsk((i + 1) as HskLevel)))).flat()
    const data = await loadDialogues()
    launch(buildMockExam(level, { dialogues: data.items, words }))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

const spec = computed(() => exam.value?.spec)
const range = computed(() => {
  const e = exam.value
  if (!e) return { from: 0, to: 0 }
  return { from: e.starts[sec.value], to: e.starts[sec.value + 1] ?? e.questions.length }
})
const idx = computed(() => range.value.from + cur.value)
const q = computed(() => exam.value?.questions[idx.value])
const sectionSpec = computed(() => spec.value?.sections[sec.value])
const count = computed(() => range.value.to - range.value.from)
const answeredInSection = computed(() => answers.value.slice(range.value.from, range.value.to).filter((a) => a !== null && (!Array.isArray(a) || a.length > 0)).length)
const urgent = computed(() => secondsLeft.value <= 60)
const isLastSection = computed(() => !!spec.value && sec.value === spec.value.sections.length - 1)

function beginSection(i: number) {
  sec.value = i
  cur.value = 0
  confirmEnd.value = false
  secondsLeft.value = (exam.value?.spec.sections[i].minutes ?? 0) * 60
  clearInterval(timer)
  timer = setInterval(() => {
    if (--secondsLeft.value <= 0) endSection()
  }, 1000)
}

function choose(n: number) {
  if (q.value && q.value.kind !== 'reorder') answers.value[idx.value] = n
}
function listen() {
  const item = q.value
  if (!item?.audio || plays.value[idx.value] >= MAX_PLAYS) return
  plays.value[idx.value]++
  const url = item.mp3 ? mp3Urls.value[item.mp3.toLowerCase()] : undefined
  if (url) void new Audio(url).play()
  else speak(item.audio)
}

// Dạng sắp xếp từ: bấm từ ở ngân hàng để đưa vào câu, bấm từ trong câu để bỏ ra
const placed = computed<string[]>(() => (Array.isArray(answers.value[idx.value]) ? (answers.value[idx.value] as string[]) : []))
const remaining = computed(() => {
  const bank = [...(q.value?.bank ?? [])]
  for (const p of placed.value) {
    const i = bank.indexOf(p)
    if (i >= 0) bank.splice(i, 1)
  }
  return bank
})
function place(t: string) {
  answers.value[idx.value] = [...placed.value, t]
}
function unplace(i: number) {
  const next = placed.value.filter((_, k) => k !== i)
  answers.value[idx.value] = next.length ? next : null
}

function go(d: number) {
  cur.value = Math.min(count.value - 1, Math.max(0, cur.value + d))
}
function tryEnd() {
  if (answeredInSection.value < count.value && !confirmEnd.value) return (confirmEnd.value = true)
  endSection()
}
async function endSection() {
  clearInterval(timer)
  if (!exam.value) return
  if (!isLastSection.value) return beginSection(sec.value + 1)
  const e = exam.value
  const r = gradeMock(e, answers.value)
  result.value = r
  phase.value = 'result'
  try {
    const rec: ExamResult = {
      kind: 'mock', level: e.level as HskLevel, correct: r.correct, total: r.questions, percent: r.percent, passed: r.passed, at: Date.now(),
      detail: JSON.stringify(r.sections.map((s) => ({ skill: s.skill, score: s.score }))),
    }
    await (await getStorage()).addExamResult(rec)
    await refreshHistory()
  } catch (err) {
    error.value = 'Không lưu được kết quả: ' + (err as Error).message
  }
}
function leave() {
  clearInterval(timer)
  phase.value = 'lobby'
  exam.value = null
}

function onKey(e: KeyboardEvent) {
  if (phase.value !== 'running' || !q.value) return
  const el = e.target instanceof HTMLElement ? e.target : null
  if (el?.matches('input,textarea,select')) return
  if (['1', '2', '3', '4'].includes(e.key)) choose(Number(e.key) - 1)
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'l' || e.key === 'L') listen()
}

const wrong = computed(() => {
  const e = exam.value
  if (!e) return []
  return e.questions.map((item, i) => ({ item, i, mine: answers.value[i] })).filter((x) => !isRight(x.item, x.mine))
})
const mineText = (item: NonNullable<typeof q.value>, a: MockAnswer) => {
  if (a == null || (Array.isArray(a) && !a.length)) return 'Bỏ trống'
  return Array.isArray(a) ? a.join('') : item.options[a]
}
const answerText = (item: NonNullable<typeof q.value>) => (item.kind === 'reorder' ? item.tokens!.join('') : item.options[item.answer])
const advice = computed(() => (result.value ? adviceFor(result.value) : []))
const detailOf = (r: ExamResult): Array<{ skill: keyof typeof SKILL_LABEL; score: number }> => {
  try {
    return r.detail ? JSON.parse(r.detail) : []
  } catch {
    return []
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Thi thử HSK</h1>
      <p class="max-w-3xl text-ink2">Làm bài theo đúng cấu trúc bài thi HSK: có phần nghe, đọc, viết, tính giờ từng phần, thang điểm và ngưỡng đạt như đề thật. Câu hỏi do ứng dụng tự dựng từ kho hội thoại, <b>không phải đề thi thật</b>, nên điểm chỉ để tham khảo.</p>
    </div>

    <p v-if="error" class="rounded-2xl bg-seal/10 p-3 text-sm text-seal" role="alert">{{ error }}</p>

    <!-- Sảnh -->
    <template v-if="phase === 'lobby'">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article v-for="lv in LEVELS" :key="lv" class="tile acc-sky flex flex-col gap-3">
          <div class="relative flex items-center justify-between">
            <h2 class="text-xl font-bold">HSK {{ lv }}</h2>
            <span class="chip">{{ MOCK_SPECS[lv].sections.reduce((n, s) => n + sectionCount(s), 0) }} câu</span>
          </div>
          <ul class="relative space-y-1 text-sm">
            <li v-for="s in MOCK_SPECS[lv].sections" :key="s.skill" class="flex justify-between gap-3"><span>{{ SKILL_LABEL[s.skill] }}</span><span class="text-ink2">{{ sectionCount(s) }} câu · {{ s.minutes }} phút</span></li>
          </ul>
          <p class="relative text-sm text-ink2">Điểm tối đa {{ MOCK_SPECS[lv].max }}, đạt từ {{ MOCK_SPECS[lv].pass }}. Mỗi phần tối đa 100 điểm.</p>
          <p v-if="MOCK_SPECS[lv].note" class="relative rounded-xl bg-lantern/25 p-2 text-xs">{{ MOCK_SPECS[lv].note }}</p>
          <button type="button" class="btn-primary relative mt-auto" :disabled="busy" @click="start(lv)">{{ busy ? 'Đang dựng đề…' : 'Bắt đầu thi thử' }}</button>
        </article>
      </div>
      <section class="surface space-y-1 p-5 text-sm text-ink2">
        <div class="font-semibold text-ink">Lưu ý khi làm bài</div>
        <ul class="list-disc space-y-1 pl-5">
          <li>Phần nghe phát bằng giọng đọc của trình duyệt (hoặc file thu âm nếu bạn đã thêm), mỗi câu nghe tối đa {{ MAX_PLAYS }} lần, phím <kbd>L</kbd> để nghe.</li>
          <li>Hết giờ một phần thì tự chuyển sang phần sau, không quay lại phần đã nộp.</li>
          <li>HSK 1, 2 và 6 gồm nghe và đọc; HSK 3, 4, 5 có thêm phần viết (sắp xếp từ thành câu). Từ HSK 4 có câu nghe và đọc cả đoạn hội thoại rồi chọn tiêu đề phù hợp.</li>
          <li>Từ HSK 4 trở lên đề thật dài và khó hơn nhiều so với câu hỏi dựng từ hội thoại ngắn ở đây, nên điểm cao ở đây chưa chắc là điểm cao ở kỳ thi thật.</li>
        </ul>
      </section>
      <section class="surface space-y-3 p-5">
        <div class="font-bold">Nạp đề từ file</div>
        <p class="text-sm text-ink2">Ứng dụng không kèm đề HSK thật vì đề có bản quyền. Nếu bạn hoặc giáo viên có đề được phép dùng (đề tự soạn, đề mẫu tải từ trang chính thức của kỳ thi cho mục đích học cá nhân), hãy chuyển thành file JSON theo mẫu rồi nạp vào đây để thi với đồng hồ và cách chấm điểm như trên. <b>Chỉ nạp đề bạn có quyền sử dụng.</b> Đề nạp xong có thể lưu vào tài khoản để lần sau không phải nạp lại (tối đa {{ MAX_SAVED_PAPERS }} đề). Câu nghe có thể ghi tên file mp3 trong đề (trường <code>mp3</code>) rồi chọn các file mp3 ở nút bên dưới trước khi nạp đề; file mp3 chỉ giữ trong phiên, lần sau cần chọn lại.</p>
        <div class="flex flex-wrap gap-2">
          <label class="btn-primary cursor-pointer"><Icon name="plus" :size="16" />Chọn file đề (.json)<input type="file" accept="application/json,.json" class="sr-only" @change="onPaperFile" /></label>
          <label class="btn-ghost cursor-pointer"><Icon name="play" :size="16" />Chọn file mp3{{ mp3Count ? ' (' + mp3Count + ')' : '' }}<input type="file" accept="audio/mpeg,.mp3" multiple class="sr-only" @change="onMp3Files" /></label>
          <button type="button" class="btn-ghost" @click="downloadTemplate"><Icon name="download" :size="16" />Tải file mẫu</button>
        </div>
        <label class="flex items-center gap-2 text-sm"><input v-model="saveIt" type="checkbox" />Lưu đề vào tài khoản sau khi nạp</label>
        <div v-if="papers.length">
          <div class="mb-1 text-sm font-bold">Đề đã lưu</div>
          <ul class="divide-y divide-line text-sm">
            <li v-for="p in papers" :key="p.id" class="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{{ p.title }} <span class="text-ink2">· HSK {{ p.level }} · {{ new Date(p.savedAt).toLocaleDateString('vi-VN') }}</span></span>
              <span class="flex gap-2"><button type="button" class="btn-primary" @click="takePaper(p.id)">Làm đề</button><button type="button" class="btn-ghost" :aria-label="'Xóa đề ' + p.title" @click="removePaper(p)">Xóa</button></span>
            </li>
          </ul>
        </div>
        <ul v-if="paperErrors.length" class="space-y-1 rounded-2xl bg-seal/10 p-3 text-sm text-seal" role="alert"><li v-for="e in paperErrors" :key="e">{{ e }}</li></ul>
      </section>
      <section class="surface p-5">
        <div class="mb-3 font-bold">Các lần thi thử gần đây</div>
        <p v-if="!history.length" class="text-sm text-ink2">Chưa có lần nào.</p>
        <ul v-else class="divide-y divide-line text-sm">
          <li v-for="r in history" :key="r.at" class="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>HSK {{ r.level }} <span class="text-ink2">· {{ new Date(r.at).toLocaleDateString('vi-VN') }}</span></span>
            <span class="flex items-center gap-3">
              <span v-for="d in detailOf(r)" :key="d.skill" class="text-ink2">{{ SKILL_LABEL[d.skill] }} {{ d.score }}</span>
              <span class="font-semibold" :class="r.passed ? 'text-jade' : 'text-seal'">{{ r.percent }}% {{ r.passed ? 'đạt' : 'chưa đạt' }}</span>
            </span>
          </li>
        </ul>
      </section>
    </template>

    <!-- Đang thi -->
    <div v-else-if="phase === 'running' && exam && q" class="grid gap-5 xl:grid-cols-[1fr_18rem]">
      <section class="surface space-y-5 p-5 md:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-sm text-ink2">HSK {{ exam.level }} · Phần {{ sec + 1 }}/{{ spec!.sections.length }}</div>
            <div class="text-xl font-bold">{{ SKILL_LABEL[sectionSpec!.skill] }} · câu {{ cur + 1 }}/{{ count }}</div>
          </div>
          <div class="flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-lg font-bold tabular-nums" :class="urgent ? 'bg-seal text-white' : 'bg-paper'" role="timer" :aria-label="`Còn lại ${formatClock(secondsLeft)}`"><Icon name="clock" :size="18" />{{ formatClock(secondsLeft) }}</div>
        </div>

        <p class="text-ink2">{{ q.ask }}</p>

        <div v-if="q.skill === 'listening'" class="flex flex-wrap items-center gap-3 rounded-2xl bg-paper p-4">
          <button type="button" class="btn-primary" :disabled="plays[idx] >= MAX_PLAYS" @click="listen"><Icon name="play" :size="16" />Nghe</button>
          <span class="text-sm text-ink2">Còn {{ MAX_PLAYS - plays[idx] }} lần nghe</span>
        </div>
        <div v-else-if="q.text" class="font-zh whitespace-pre-line rounded-2xl bg-paper p-4 text-2xl leading-relaxed md:text-3xl">{{ q.text }}</div>

        <template v-if="q.kind !== 'reorder'">
          <div class="grid gap-3 sm:grid-cols-2">
            <button v-for="(o, n) in q.options" :key="n" type="button" class="flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition hover:-translate-y-0.5"
              :class="answers[idx] === n ? 'border-sky bg-sky/10 shadow-lift' : 'border-line bg-surface hover:border-sky/60'" :aria-pressed="answers[idx] === n" @click="choose(n)">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold" :class="answers[idx] === n ? 'bg-sky text-white' : 'bg-paper text-ink2'">{{ LETTER[n] }}</span>
              <span class="min-w-0 break-words" :class="hasHanOptions(q.kind) ? 'font-zh text-xl' : ''">{{ o }}</span>
            </button>
          </div>
        </template>
        <template v-else>
          <div class="font-zh flex min-h-[4rem] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-line p-3 text-2xl" aria-label="Câu của bạn">
            <span v-if="!placed.length" class="font-sans text-sm text-ink2">Bấm các từ bên dưới theo đúng thứ tự</span>
            <button v-for="(t, i) in placed" :key="i + t" type="button" class="chip !text-xl" :aria-label="`Bỏ ${t}`" @click="unplace(i)">{{ t }}</button>
          </div>
          <div class="font-zh flex flex-wrap gap-2 text-2xl">
            <button v-for="(t, i) in remaining" :key="i + t" type="button" class="rounded-xl border-2 border-line bg-surface px-4 py-2 transition hover:border-sky/60" @click="place(t)">{{ t }}</button>
          </div>
        </template>

        <div class="flex justify-between gap-2">
          <button type="button" class="btn-ghost" :disabled="cur === 0" @click="go(-1)"><Icon name="back" :size="16" />Câu trước</button>
          <button v-if="cur < count - 1" type="button" class="btn-primary" @click="go(1)">Câu sau<Icon name="next" :size="16" /></button>
          <button v-else type="button" class="btn-primary" @click="tryEnd">{{ isLastSection ? 'Nộp bài' : 'Nộp phần này' }}</button>
        </div>
        <p class="hidden text-center text-xs text-ink2 md:block">Phím 1–4 chọn đáp án · ← → đổi câu · L nghe</p>
      </section>

      <aside class="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <section class="surface p-5">
          <div class="mb-3 flex items-center justify-between font-bold">Bảng câu hỏi<span class="text-sm font-normal text-ink2">{{ answeredInSection }}/{{ count }}</span></div>
          <div class="grid grid-cols-6 gap-1.5">
            <button v-for="(_, i) in count" :key="i" type="button" class="grid aspect-square place-items-center rounded-lg text-sm font-semibold transition"
              :class="i === cur ? 'bg-ink text-paper' : answers[range.from + i] !== null ? 'bg-sky/20 text-sky' : 'bg-paper text-ink2 hover:bg-line'" :aria-label="`Câu ${i + 1}`" @click="cur = i">{{ i + 1 }}</button>
          </div>
          <button type="button" class="btn-primary mt-4 w-full" @click="tryEnd">{{ isLastSection ? 'Nộp bài' : 'Nộp phần này' }}</button>
          <p v-if="confirmEnd" class="pop mt-3 rounded-xl bg-lantern/25 p-3 text-sm" role="alert">Còn {{ count - answeredInSection }} câu chưa trả lời, sẽ tính là sai. Bấm lần nữa để {{ isLastSection ? 'nộp bài' : 'sang phần sau (không quay lại được)' }}.</p>
          <button type="button" class="mt-3 w-full text-center text-xs text-ink2 underline" @click="leave">Bỏ bài thi này</button>
        </section>
      </aside>
    </div>

    <!-- Kết quả -->
    <template v-else-if="phase === 'result' && result && exam">
      <section class="aurora surface space-y-4 p-8 text-center md:p-10">
        <ProgressRing :value="result.total" :max="result.max" :size="140" class="mx-auto"><span class="text-3xl font-bold">{{ result.total }}</span></ProgressRing>
        <div class="text-2xl font-bold">{{ result.total }}/{{ result.max }} điểm · HSK {{ exam.level }}</div>
        <span v-if="result.passed" class="seal stamp mx-auto h-16 w-16 text-3xl">过</span>
        <p class="mx-auto max-w-xl text-lg" :class="result.passed ? 'font-semibold text-jade' : 'text-ink2'">{{ result.passed ? `Đạt (từ ${result.pass} điểm).` : `Chưa đạt, cần ${result.pass} điểm.` }} Đây là điểm thi thử tham khảo, không phải kết quả thi chính thức.</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button v-if="!exam.spec.note?.startsWith('Đề nạp')" type="button" class="btn-primary btn-lg" @click="start(exam.level as MockLevel)">Làm đề khác cùng cấp</button>
          <button type="button" class="btn-ghost btn-lg" @click="leave">Về danh sách</button>
        </div>
      </section>

      <section class="surface p-5">
        <div class="mb-3 font-bold">Điểm từng phần</div>
        <ul class="grid gap-3 sm:grid-cols-3">
          <li v-for="s in result.sections" :key="s.skill" class="rounded-2xl bg-paper p-4 text-center">
            <div class="text-sm text-ink2">{{ SKILL_LABEL[s.skill] }}</div>
            <div class="text-3xl font-bold tabular-nums" :class="s.score >= 60 ? 'text-jade' : 'text-seal'">{{ s.score }}<span class="text-base font-normal text-ink2">/100</span></div>
            <div class="text-xs text-ink2">{{ s.correct }}/{{ s.total }} câu đúng</div>
          </li>
        </ul>
        <ul class="mt-4 space-y-1 text-sm"><li v-for="a in advice" :key="a">{{ a }}</li></ul>
      </section>

      <section v-if="wrong.length" class="surface p-5">
        <div class="mb-3 font-bold">Xem lại {{ wrong.length }} câu chưa đúng</div>
        <ul class="divide-y divide-line">
          <li v-for="w in wrong" :key="w.i" class="space-y-1 py-3 text-sm">
            <div class="text-ink2">Câu {{ w.i + 1 }} · {{ SKILL_LABEL[w.item.skill] }} · {{ w.item.ask }}</div>
            <div v-if="w.item.audio || w.item.text" class="flex items-start gap-2">
              <button v-if="w.item.audio" type="button" class="btn-icon h-8 w-8 text-ink2 hover:text-sky" aria-label="Nghe lại" @click="speak(w.item.audio!)"><Icon name="play" :size="12" /></button>
              <span class="font-zh whitespace-pre-line text-lg">{{ w.item.audio ?? w.item.text }}</span>
            </div>
            <div class="text-seal">Bạn chọn: <span :class="hasHanOptions(w.item.kind) || w.item.kind === 'reorder' ? 'font-zh' : ''">{{ mineText(w.item, w.mine) }}</span></div>
            <div class="font-semibold text-jade">Đáp án: <span :class="hasHanOptions(w.item.kind) || w.item.kind === 'reorder' ? 'font-zh' : ''">{{ answerText(w.item) }}</span></div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
