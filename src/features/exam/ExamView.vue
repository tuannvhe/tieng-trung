<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ExamResult, HskLevel, HskWord } from '@/types'
import { useContentStore } from '@/stores/content'
import { getStorage } from '@/lib/storage'
import { localDay } from '@/lib/srs'
import { scheduleMissed, buildQuestions, formatClock, gradeExam, PASS_PERCENT, placementLevel, unlockedLevels, type Graded, type Question } from '@/lib/exam'
import ProgressRing from '@/components/ProgressRing.vue'
import Icon from '@/components/Icon.vue'

const content = useContentStore()
const LEVELS = [1, 2, 3, 4, 5, 6] as HskLevel[]
/** Thi xếp lớp chỉ trải đều cấp 1-5 (người mới chưa nên bị hỏi từ cấp 6). */
const PLACEMENT_LEVELS = [1, 2, 3, 4, 5] as HskLevel[]
const KIND_LABEL = { meaning: 'Chọn nghĩa đúng', pinyin: 'Chọn pinyin đúng', reverse: 'Chọn chữ Hán đúng' }
const LETTER = ['A', 'B', 'C', 'D']

const phase = ref<'lobby' | 'running' | 'result'>('lobby')
const results = ref<ExamResult[]>([])
const examKind = ref<'level' | 'placement'>('level')
const examLevel = ref<HskLevel>(1)
const qs = ref<Question[]>([])
const answers = ref<Array<number | null>>([])
const cur = ref(0)
const secondsLeft = ref(0)
const graded = ref<Graded | null>(null)
const recommended = ref<HskLevel>(1)
const confirmSubmit = ref(false)
const queued = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  results.value = await (await getStorage()).examResults()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('keydown', onKey)
})

const unlocked = computed(() => unlockedLevels(results.value))
const best = (lv: HskLevel) => Math.max(0, ...results.value.filter((r) => r.kind === 'level' && r.level === lv).map((r) => r.percent))
const passed = (lv: HskLevel) => results.value.some((r) => r.kind === 'level' && r.level === lv && r.passed)
const answered = computed(() => answers.value.filter((a) => a !== null).length)
const urgent = computed(() => secondsLeft.value <= 120)
const history = computed(() => [...results.value].reverse().slice(0, 5))
const wrongList = computed(() => qs.value.map((q, i) => ({ q, i, mine: answers.value[i] })).filter((x) => x.mine !== x.q.answer))

const viOf = (w: HskWord) => content.viOnly(w)

async function startLevel(lv: HskLevel) {
  const words = await content.loadHsk(lv)
  begin(buildQuestions(words, 30, viOf), 'level', lv, 30 * 40)
}
async function startPlacement() {
  const per = await Promise.all(PLACEMENT_LEVELS.map(async (lv) => buildQuestions(await content.loadHsk(lv), 5, viOf)))
  begin(per.flat(), 'placement', 1, 15 * 60)
}
function begin(questions: Question[], kind: 'level' | 'placement', lv: HskLevel, seconds: number) {
  qs.value = questions
  answers.value = questions.map(() => null)
  cur.value = 0
  examKind.value = kind
  examLevel.value = lv
  secondsLeft.value = seconds
  confirmSubmit.value = false
  phase.value = 'running'
  clearInterval(timer)
  timer = setInterval(() => {
    if (--secondsLeft.value <= 0) submit()
  }, 1000)
}

function choose(n: number) {
  answers.value[cur.value] = n
}
function go(d: number) {
  cur.value = Math.min(qs.value.length - 1, Math.max(0, cur.value + d))
}
function onKey(e: KeyboardEvent) {
  if (phase.value !== 'running') return
  const el = e.target instanceof HTMLElement ? e.target : null
  if (el?.matches('input,textarea,select')) return
  if (['1', '2', '3', '4'].includes(e.key)) choose(Number(e.key) - 1)
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
}

function trySubmit() {
  if (answered.value < qs.value.length && !confirmSubmit.value) return (confirmSubmit.value = true)
  submit()
}
async function submit() {
  clearInterval(timer)
  const g = gradeExam(qs.value, answers.value)
  graded.value = g
  const kind = examKind.value
  recommended.value = placementLevel(g.byLevel)
  const level = kind === 'placement' ? recommended.value : examLevel.value
  const rec: ExamResult = { kind, level, correct: g.correct, total: g.total, percent: g.percent, passed: kind === 'placement' ? true : g.passed, at: Date.now() }
  const storage = await getStorage()
  await storage.addExamResult(rec)
  results.value = await storage.examResults()
  queued.value = null
  phase.value = 'result'
}
async function queueMissed() {
  queued.value = await scheduleMissed(await getStorage(), wrongList.value.map((w) => w.q.ref), localDay())
}
function backToLobby() {
  phase.value = 'lobby'
  graded.value = null
}
const optText = (q: Question, n: number | null | undefined) => (n == null ? 'Bỏ trống' : q.options[n])
</script>

<template>
  <div class="space-y-6">
    <!-- Sảnh -->
    <template v-if="phase === 'lobby'">
      <div>
        <h1 class="text-3xl font-bold">Kiểm tra HSK</h1>
        <p class="text-ink2">Bài cuối cấp 30 câu trong 20 phút. Đạt từ {{ PASS_PERCENT }}% để mở khóa cấp kế. Chưa biết bắt đầu từ đâu thì thi xếp lớp.</p>
      </div>

      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <article v-for="lv in LEVELS" :key="lv" class="tile flex flex-col gap-3" :class="[passed(lv) ? 'acc-jade' : unlocked.includes(lv) ? 'acc-sky' : 'acc-lantern', !unlocked.includes(lv) && 'opacity-70']">
          <div class="relative flex items-center justify-between">
            <span class="han text-4xl">HSK {{ lv }}</span>
            <Icon v-if="!unlocked.includes(lv)" name="lock" :size="22" class="text-ink2" />
            <span v-else-if="passed(lv)" class="seal h-10 w-10 text-sm leading-none">过</span>
          </div>
          <p class="relative text-sm text-ink2">
            <template v-if="!unlocked.includes(lv)">Đạt {{ PASS_PERCENT }}% bài cuối cấp HSK {{ lv - 1 }} để mở.</template>
            <template v-else-if="best(lv)">Điểm cao nhất {{ best(lv) }}%{{ passed(lv) ? ', đã đạt' : ', chưa đạt' }}.</template>
            <template v-else>Chưa thi.</template>
          </p>
          <button type="button" class="relative mt-auto" :class="unlocked.includes(lv) ? 'btn-primary' : 'btn-ghost'" :disabled="!unlocked.includes(lv)" @click="startLevel(lv)">Thi cuối cấp</button>
        </article>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="tile acc-plum flex flex-col gap-3 sm:flex-row sm:items-center">
          <span class="tile-ico !h-14 !w-14 shrink-0"><Icon name="trophy" :size="28" /></span>
          <div class="relative flex-1"><div class="font-bold">Thi xếp lớp</div><p class="text-sm text-ink2">25 câu trải đều 5 cấp, 15 phút. Kết quả mở khóa tới cấp phù hợp với bạn.</p></div>
          <button type="button" class="btn-primary relative" @click="startPlacement">Bắt đầu</button>
        </section>
        <section class="surface p-5">
          <div class="mb-2 font-bold">Lịch sử gần đây</div>
          <p v-if="!history.length" class="text-sm text-ink2">Chưa có bài thi nào.</p>
          <ul v-else class="space-y-1.5 text-sm">
            <li v-for="r in history" :key="r.at" class="flex items-center justify-between gap-2">
              <span>{{ r.kind === 'placement' ? 'Xếp lớp' : r.kind === 'mock' ? `Thi thử HSK ${r.level}` : `Cuối cấp HSK ${r.level}` }}<span class="text-ink2"> · {{ new Date(r.at).toLocaleDateString('vi-VN') }}</span></span>
              <span class="font-semibold tabular-nums" :class="r.passed ? 'text-jade' : 'text-seal'">{{ r.percent }}%</span>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <!-- Đang thi -->
    <div v-else-if="phase === 'running'" class="grid gap-5 xl:grid-cols-[1fr_20rem]">
      <section class="aurora surface min-w-0 space-y-6 p-6 md:p-8">
        <div class="flex items-center justify-between gap-3">
          <div class="font-bold">{{ examKind === 'placement' ? 'Thi xếp lớp' : `Thi cuối cấp HSK ${examLevel}` }}</div>
          <div class="flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-lg font-bold tabular-nums" :class="urgent ? 'bg-seal text-white' : 'bg-paper'" role="timer" :aria-label="`Còn lại ${formatClock(secondsLeft)}`"><Icon name="clock" :size="18" />{{ formatClock(secondsLeft) }}</div>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-seal transition-all" :style="{ width: ((cur + 1) / qs.length) * 100 + '%' }" /></div>

        <div :key="cur" class="pop text-center">
          <div class="text-sm font-semibold text-ink2">Câu {{ cur + 1 }}/{{ qs.length }} · {{ KIND_LABEL[qs[cur].kind] }}</div>
          <div class="mt-4 break-words leading-tight" :class="qs[cur].kind === 'reverse' ? 'text-3xl font-semibold' : 'han text-7xl md:text-8xl'">{{ qs[cur].prompt }}</div>
        </div>

        <div class="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
          <button v-for="(o, n) in qs[cur].options" :key="n" type="button"
            class="flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-lg transition hover:-translate-y-0.5"
            :class="answers[cur] === n ? 'border-sky bg-sky/10 shadow-lift' : 'border-line bg-surface hover:border-sky/60'"
            :style="qs[cur].kind === 'reverse' ? { fontFamily: 'Noto Sans SC' } : undefined" :aria-pressed="answers[cur] === n" @click="choose(n)">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold" :class="answers[cur] === n ? 'bg-sky text-white' : 'bg-paper text-ink2'">{{ LETTER[n] }}</span>
            <span class="min-w-0 break-words">{{ o }}</span>
          </button>
        </div>

        <div class="flex justify-between gap-2">
          <button type="button" class="btn-ghost" :disabled="cur === 0" @click="go(-1)"><Icon name="back" :size="16" />Câu trước</button>
          <button v-if="cur < qs.length - 1" type="button" class="btn-primary" @click="go(1)">Câu sau<Icon name="next" :size="16" /></button>
          <button v-else type="button" class="btn-primary" @click="trySubmit">Nộp bài</button>
        </div>
        <p class="hidden text-center text-xs text-ink2 md:block">Phím 1–4 chọn đáp án · ← → đổi câu</p>
      </section>

      <aside class="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <section class="surface p-5">
          <div class="mb-3 flex items-center justify-between font-bold">Bảng câu hỏi<span class="text-sm font-normal text-ink2">{{ answered }}/{{ qs.length }} đã trả lời</span></div>
          <div class="grid grid-cols-6 gap-1.5">
            <button v-for="(_, i) in qs" :key="i" type="button" class="grid aspect-square place-items-center rounded-lg text-sm font-semibold transition"
              :class="i === cur ? 'bg-ink text-paper' : answers[i] !== null ? 'bg-sky/20 text-sky' : 'bg-paper text-ink2 hover:bg-line'" :aria-label="`Câu ${i + 1}${answers[i] !== null ? ', đã trả lời' : ''}`" @click="cur = i">{{ i + 1 }}</button>
          </div>
          <button type="button" class="btn-primary mt-4 w-full" @click="trySubmit">Nộp bài</button>
          <p v-if="confirmSubmit" class="pop mt-3 rounded-xl bg-lantern/25 p-3 text-sm" role="alert">Còn {{ qs.length - answered }} câu chưa trả lời, sẽ tính là sai. Bấm "Nộp bài" lần nữa để nộp.</p>
        </section>
      </aside>
    </div>

    <!-- Kết quả -->
    <template v-else-if="graded">
      <section class="aurora surface space-y-4 p-8 text-center md:p-10">
        <ProgressRing :value="graded.percent" :max="100" :size="140" class="mx-auto"><span class="text-3xl font-bold">{{ graded.percent }}%</span></ProgressRing>
        <div class="text-2xl font-bold">{{ graded.correct }}/{{ graded.total }} câu đúng</div>
        <template v-if="examKind === 'level'">
          <span v-if="graded.passed" class="seal stamp mx-auto h-16 w-16 text-3xl">过</span>
          <p class="mx-auto max-w-lg text-lg" :class="graded.passed ? 'font-semibold text-jade' : 'text-ink2'">
            {{ graded.passed ? (examLevel < 6 ? `Đạt. Đã mở khóa HSK ${examLevel + 1}.` : 'Đạt. Bạn đã hoàn thành HSK 6.') : `Chưa đạt ${PASS_PERCENT}%. Ôn lại thẻ HSK ${examLevel} rồi thi lại.` }}
          </p>
        </template>
        <template v-else>
          <span class="seal stamp mx-auto h-16 w-16 text-2xl">HSK{{ recommended }}</span>
          <p class="mx-auto max-w-lg text-lg font-semibold">Gợi ý bắt đầu từ HSK {{ recommended }}. Các cấp đến HSK {{ recommended }} đã được mở khóa.</p>
        </template>
        <div class="flex flex-wrap justify-center gap-2">
          <button type="button" class="btn-primary btn-lg" @click="backToLobby">Về danh sách</button>
          <button v-if="examKind === 'level'" type="button" class="btn-ghost btn-lg" @click="startLevel(examLevel)">Thi lại</button>
        </div>
      </section>

      <section v-if="examKind === 'placement'" class="surface p-5">
        <div class="mb-3 font-bold">Kết quả từng cấp</div>
        <ul class="grid gap-3 sm:grid-cols-5">
          <li v-for="lv in PLACEMENT_LEVELS" :key="lv" class="rounded-2xl bg-paper p-3 text-center">
            <div class="text-sm text-ink2">HSK {{ lv }}</div>
            <div class="text-xl font-bold tabular-nums">{{ graded.byLevel[lv]?.correct ?? 0 }}/{{ graded.byLevel[lv]?.total ?? 0 }}</div>
          </li>
        </ul>
      </section>

      <section v-if="wrongList.length" class="surface p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><span class="font-bold">Xem lại {{ wrongList.length }} câu chưa đúng</span>
          <button v-if="queued === null" type="button" class="btn-ghost" @click="queueMissed">Đưa các từ này vào lịch ôn hôm nay</button>
          <span v-else class="text-sm font-semibold text-jade" role="status">{{ queued ? `Đã thêm ${queued} thẻ vào lịch ôn hôm nay.` : 'Các từ này đã nằm trong lịch ôn.' }}</span></div>
        <ul class="divide-y divide-line">
          <li v-for="w in wrongList" :key="w.i" class="grid gap-1 py-3 text-sm sm:grid-cols-[8rem_1fr_1fr] sm:items-center">
            <span class="han text-xl" :class="w.q.kind === 'reverse' && '!font-sans !text-base'">{{ w.q.prompt }}</span>
            <span class="text-seal">Bạn chọn: {{ optText(w.q, w.mine) }}</span>
            <span class="font-semibold text-jade">Đáp án: {{ w.q.options[w.q.answer] }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
