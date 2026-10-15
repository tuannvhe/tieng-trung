<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { HskWord } from '@/types'
import { useContentStore } from '@/stores/content'
import { getStorage } from '@/lib/storage'
import { localDay } from '@/lib/srs'
import { SPEECH_RATES, useSpeech } from '@/composables/useSpeech'
import {
  addLessonToCards, buildHskIndex, buildLessonQuiz, lessonProgress, quizId, resolveVocab, stepKey, STEPS,
  type CourseData, type CourseFile, type QuizQuestion, type StepId,
} from '@/lib/course'
import PinyinText from '@/components/PinyinText.vue'
import ProgressRing from '@/components/ProgressRing.vue'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()
const content = useContentStore()
const { speak } = useSpeech()

const data = ref<CourseData | null>(null)
const hskIdx = ref(new Map<string, HskWord>())
const quizBest = ref<Record<string, number>>({})
const loading = ref(true)
const error = ref('')
const message = ref('')

onMounted(async () => {
  try {
    const [course, ...levels] = await Promise.all([import('@/data/course-hsk1.json'), ...[1, 2, 3, 4, 5, 6].map((l) => content.loadHsk(l as 1))])
    data.value = course.default as unknown as CourseData
    hskIdx.value = buildHskIndex(levels.flat())
    await loadQuizBest()
  } catch (e) {
    error.value = 'Không tải được giáo trình: ' + (e as Error).message
  } finally {
    loading.value = false
  }
})

async function loadQuizBest() {
  const rows = await (await getStorage()).dialogueProgress()
  quizBest.value = Object.fromEntries(rows.filter((r) => r.id.startsWith('course:')).map((r) => [r.id, r.best]))
}

const flags = computed(() => Object.fromEntries(Object.entries(content.overrides).filter(([k]) => k.startsWith('course:')).map(([k, o]) => [k, o.reviewed])))
const progress = (n: number) => lessonProgress(flags.value, n, quizBest.value[quizId(n)] ?? 0)

const lessons = computed(() => data.value?.lessons ?? [])
const current = computed(() => {
  const n = Number(route.params.n)
  return lessons.value.find((l) => l.n === n) ?? lessons.value.find((l) => !l.missing && progress(l.n).percent < 100) ?? lessons.value[0]
})
const words = computed(() => (current.value ? resolveVocab(current.value.vocab, hskIdx.value, content.viMeaning) : []))
const overall = computed(() => {
  const real = lessons.value.filter((l) => !l.missing)
  return real.length ? Math.round(real.reduce((s, l) => s + progress(l.n).percent, 0) / real.length) : 0
})

function open(n: number) {
  quiz.value = null
  message.value = ''
  void router.push(`/course/${n}`)
}
watch(() => route.params.n, () => ((quiz.value = null), (message.value = '')))

async function toggle(step: StepId) {
  if (!current.value) return
  const key = stepKey(current.value.n, step)
  try {
    await content.saveOverride({ key, reviewed: !flags.value[key] })
  } catch (e) {
    error.value = 'Không lưu được: ' + (e as Error).message
  }
}

async function addCards() {
  try {
    const r = await addLessonToCards(await getStorage(), words.value, localDay())
    message.value = r.added
      ? `Đã thêm ${r.added} thẻ vào lịch ôn hôm nay${r.skipped ? `, ${r.skipped} từ đã có thẻ` : ''}.`
      : r.skipped
        ? 'Các từ của bài này đã có thẻ ôn.'
        : 'Chưa có từ nào của bài này trong bộ từ HSK để tạo thẻ.'
    if (r.noCard) message.value += ` ${r.noCard} từ chưa có trong bộ từ HSK nên chưa tạo được thẻ.`
    if (r.added && !flags.value[stepKey(current.value!.n, 'vocab')]) await toggle('vocab')
  } catch (e) {
    error.value = 'Không thêm được thẻ: ' + (e as Error).message
  }
}

// --- Bài kiểm tra từ mới ---
const quiz = ref<{ qs: QuizQuestion[]; i: number; answers: Array<number | null> } | null>(null)
const result = ref<{ correct: number; total: number; percent: number } | null>(null)

function startQuiz() {
  const pool = lessons.value.filter((l) => !l.missing && l.n <= (current.value?.n ?? 0)).flatMap((l) => resolveVocab(l.vocab, hskIdx.value, content.viMeaning))
  const qs = buildLessonQuiz(words.value, pool, 10)
  if (qs.length < 4) return void (message.value = 'Bài này chưa đủ từ có nghĩa để làm bài kiểm tra.')
  result.value = null
  quiz.value = { qs, i: 0, answers: qs.map(() => null) }
}
async function answer(k: number) {
  const q = quiz.value
  if (!q || q.answers[q.i] !== null) return
  q.answers[q.i] = k
  if (q.i < q.qs.length - 1) {
    setTimeout(() => quiz.value && quiz.value.i < quiz.value.qs.length - 1 && quiz.value.answers[quiz.value.i] !== null && quiz.value.i++, 700)
    return
  }
  const correct = q.qs.filter((x, i) => q.answers[i] === x.answer).length
  const percent = Math.round((correct / q.qs.length) * 100)
  result.value = { correct, total: q.qs.length, percent }
  try {
    await (await getStorage()).recordDialogue(quizId(current.value!.n), percent)
    await loadQuizBest()
  } catch (e) {
    error.value = 'Không lưu được điểm: ' + (e as Error).message
  }
}
const closeQuiz = () => ((quiz.value = null), (result.value = null))

const KIND = { pdf: 'PDF', video: 'Video', image: 'Ảnh', doc: 'Tài liệu' } as const
const kindIcon = (f: CourseFile) => (f.k === 'video' ? 'play' : 'book')
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">Giáo trình HSK1</h1>
        <p class="max-w-2xl text-ink2">Học theo từng bài của giáo trình trong thư mục của bạn: từ mới, bài kiểm tra, đánh dấu tiến độ. Tài liệu PDF và video vẫn xem ở thư mục gốc trên máy bạn.</p>
      </div>
      <div v-if="data" class="flex items-center gap-3">
        <ProgressRing :value="overall" :max="100" :size="64"><span class="text-sm font-bold">{{ overall }}%</span></ProgressRing>
        <div class="text-sm text-ink2">tiến độ giáo trình<br />(bài 6, 7, 8 chưa có tài liệu)</div>
      </div>
    </div>

    <p v-if="error" class="rounded-2xl bg-seal/10 p-3 text-sm text-seal" role="alert">{{ error }}</p>
    <p v-if="loading" class="surface p-8 text-center text-ink2">Đang tải…</p>

    <div v-else-if="data && current" class="grid gap-5 xl:grid-cols-[20rem_1fr]">
      <nav class="grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-1" aria-label="Danh sách bài">
        <button v-for="l in lessons" :key="l.n" type="button" class="surface flex items-center gap-3 p-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          :class="current.n === l.n && 'ring-2 ring-seal'" :disabled="l.missing" :aria-current="current.n === l.n ? 'true' : undefined" @click="open(l.n)">
          <ProgressRing :value="l.missing ? 0 : progress(l.n).percent" :max="100" :size="44"><span class="text-sm font-bold">{{ l.n }}</span></ProgressRing>
          <span class="min-w-0 flex-1">
            <span v-if="!l.missing" class="block truncate font-semibold"><span class="font-zh">{{ l.zh }}</span></span>
            <span v-else class="block font-semibold text-ink2">Bài {{ l.n }}</span>
            <span class="block truncate text-xs text-ink2">{{ l.missing ? 'Chưa có tài liệu trong thư mục' : l.vi }}</span>
          </span>
        </button>
      </nav>

      <section class="min-w-0 space-y-5">
        <article class="surface space-y-4 p-5 md:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-sm text-ink2">Bài {{ current.n }}<span v-if="current.days"> · ngày {{ current.days }}</span></div>
              <h2 class="font-zh text-3xl font-bold">{{ current.zh }}</h2>
              <p class="text-lg text-ink2">{{ current.vi }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-primary" @click="addCards"><Icon name="cards" :size="16" />Thêm từ vào thẻ ôn</button>
              <button type="button" class="btn-ghost" @click="startQuiz"><Icon name="check" :size="16" />Kiểm tra từ mới</button>
            </div>
          </div>

          <p v-if="message" class="rounded-2xl bg-jade/10 p-3 text-sm text-jade" role="status">{{ message }}</p>

          <fieldset class="space-y-2">
            <legend class="font-semibold">Tiến độ bài này</legend>
            <div class="flex flex-wrap gap-2">
              <label v-for="s in STEPS" :key="s.id" class="chip cursor-pointer select-none gap-2" :class="flags[stepKey(current.n, s.id)] && '!bg-jade/15 !text-jade'">
                <input type="checkbox" class="h-4 w-4 accent-[rgb(var(--c-jade))]" :checked="!!flags[stepKey(current.n, s.id)]" @change="toggle(s.id)" />{{ s.label }}
              </label>
              <span class="chip" :class="progress(current.n).quizPassed && '!bg-jade/15 !text-jade'">
                <Icon v-if="progress(current.n).quizPassed" name="check" :size="13" />Kiểm tra từ mới: {{ quizBest[quizId(current.n)] ?? 0 }}% (đạt từ 80%)
              </span>
            </div>
          </fieldset>
        </article>

        <!-- Bài kiểm tra -->
        <article v-if="quiz" class="surface space-y-4 p-5 md:p-6" aria-live="polite">
          <template v-if="!result">
            <div class="flex items-center justify-between text-sm text-ink2"><span>Câu {{ quiz.i + 1 }}/{{ quiz.qs.length }}</span><button type="button" class="underline" @click="closeQuiz">Thoát</button></div>
            <div class="py-3 text-center">
              <div class="text-sm text-ink2">{{ quiz.qs[quiz.i].kind === 'meaning' ? 'Chọn nghĩa đúng' : 'Chọn chữ Hán đúng' }}</div>
              <div class="font-zh text-5xl leading-tight" :class="quiz.qs[quiz.i].kind === 'hanzi' && '!font-sans !text-2xl'">{{ quiz.qs[quiz.i].prompt }}</div>
              <div v-if="quiz.qs[quiz.i].sub" class="text-lg"><PinyinText :text="quiz.qs[quiz.i].sub" /></div>
            </div>
            <div class="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
              <button v-for="(o, k) in quiz.qs[quiz.i].options" :key="k" type="button" class="rounded-2xl border-2 px-4 py-3 text-left text-lg transition"
                :class="quiz.answers[quiz.i] === null ? 'border-line bg-surface hover:border-sky/60' : k === quiz.qs[quiz.i].answer ? 'border-jade bg-jade/10' : quiz.answers[quiz.i] === k ? 'border-seal bg-seal/10' : 'border-line opacity-60'"
                :disabled="quiz.answers[quiz.i] !== null" @click="answer(k)"><span :class="quiz.qs[quiz.i].kind === 'hanzi' && 'font-zh'">{{ o }}</span></button>
            </div>
          </template>
          <div v-else class="space-y-3 py-4 text-center">
            <ProgressRing :value="result.percent" :max="100" :size="110" class="mx-auto"><span class="text-2xl font-bold">{{ result.percent }}%</span></ProgressRing>
            <div class="text-xl font-bold">{{ result.correct }}/{{ result.total }} câu đúng</div>
            <p :class="result.percent >= 80 ? 'font-semibold text-jade' : 'text-ink2'">{{ result.percent >= 80 ? 'Đạt. Bài này được tính hoàn thành phần kiểm tra.' : 'Chưa đạt 80%. Ôn lại từ mới rồi thử lại.' }}</p>
            <div class="flex justify-center gap-2"><button type="button" class="btn-primary" @click="startQuiz">Làm lại</button><button type="button" class="btn-ghost" @click="closeQuiz">Đóng</button></div>
          </div>
        </article>

        <!-- Từ mới -->
        <article class="surface p-5 md:p-6">
          <h3 class="mb-3 font-semibold">Từ mới ({{ words.length }})</h3>
          <ul class="divide-y divide-line">
            <li v-for="w in words" :key="w.h" class="flex items-center gap-3 py-2">
              <span class="font-zh w-28 shrink-0 text-2xl">{{ w.h }}</span>
              <span class="w-32 shrink-0 text-sm"><PinyinText :text="w.py" /></span>
              <span class="min-w-0 flex-1 break-words text-sm text-ink2">
                {{ w.meaning || 'Chưa có nghĩa' }}
                <span v-if="!w.word" class="ml-1 rounded bg-paper px-1 text-[11px]" title="Từ này chưa có trong bộ từ HSK của ứng dụng nên chưa tạo được thẻ ôn">chưa có thẻ</span>
              </span>
              <button type="button" class="btn-icon h-9 w-9 text-ink2 hover:text-sky" :aria-label="`Nghe ${w.h}`" @click="speak(w.h)" @dblclick.prevent="speak(w.h, SPEECH_RATES.slow)"><Icon name="play" :size="14" /></button>
            </li>
          </ul>
        </article>

        <!-- Ngữ pháp -->
        <article v-if="current.grammar?.length" class="surface space-y-4 p-5 md:p-6">
          <h3 class="font-semibold">Ngữ pháp ({{ current.grammar.length }})</h3>
          <section v-for="(g, gi) in current.grammar" :key="g.t" class="space-y-2 rounded-2xl bg-paper p-4">
            <h4 class="font-semibold"><span class="text-ink2">{{ gi + 1 }}.</span> {{ g.t }}</h4>
            <p class="text-sm text-ink2">{{ g.rule }}</p>
            <ul class="space-y-1">
              <li v-for="e in g.ex" :key="e.zh" class="flex items-start gap-2">
                <button type="button" class="btn-icon mt-0.5 h-8 w-8 shrink-0 text-ink2 hover:text-sky" :aria-label="`Nghe ${e.zh}`" @click="speak(e.zh)"><Icon name="play" :size="12" /></button>
                <span><span class="font-zh text-lg">{{ e.zh }}</span><span class="block text-sm text-ink2">{{ e.vi }}</span></span>
              </li>
            </ul>
          </section>
        </article>

        <!-- Tài liệu -->
        <article class="surface space-y-3 p-5 md:p-6">
          <h3 class="font-semibold">Tài liệu của bài trong thư mục giáo trình</h3>
          <ul v-if="current.files.length" class="grid gap-2 sm:grid-cols-2">
            <li v-for="f in current.files" :key="f.t" class="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
              <Icon :name="kindIcon(f)" :size="14" class="shrink-0 text-ink2" /><span class="min-w-0 flex-1 break-words">{{ f.t }}</span><span class="chip shrink-0 !text-[11px]">{{ KIND[f.k] }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-ink2">Không có tài liệu.</p>
          <p class="text-xs text-ink2">Ứng dụng không chứa các file này (khoảng 1,5 GB). Mở chúng trong thư mục gốc, hoặc lưu link video gốc ở mục <RouterLink to="/videos" class="underline">Video của tôi</RouterLink> để xem ngay trong ứng dụng.</p>
        </article>

        <article class="surface space-y-3 p-5 md:p-6">
          <h3 class="font-semibold">Tài liệu ôn tập chung</h3>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="f in data.review" :key="f.t" class="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
              <Icon :name="kindIcon(f)" :size="14" class="shrink-0 text-ink2" /><span class="min-w-0 flex-1 break-words">{{ f.t }}</span><span class="chip shrink-0 !text-[11px]">{{ KIND[f.k] }}</span>
            </li>
          </ul>
        </article>
      </section>
    </div>
  </div>
</template>
