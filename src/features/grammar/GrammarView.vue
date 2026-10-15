<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { GrammarPoint, SortExercise as Ex } from '@/types'
import { shuffle, scoreSession } from '@/lib/exercise'
import { useSpeech } from '@/composables/useSpeech'
import { useContentStore } from '@/stores/content'
import SortExercise from '@/components/SortExercise.vue'
import PinyinText from '@/components/PinyinText.vue'
import Icon from '@/components/Icon.vue'

const { speak } = useSpeech()
const content = useContentStore()
const all = ref<GrammarPoint[]>([])
const levelFilter = ref<'all' | 'office' | 1 | 2 | 3 | 4 | 5>(1)
const points = computed(() =>
  all.value.filter((g) => (levelFilter.value === 'all' ? true : levelFilter.value === 'office' ? !g.hsk : g.hsk === levelFilter.value)),
)
const sel = ref(0)
const mode = ref<'learn' | 'all'>('learn')
const filters = [
  { v: 'all', l: 'Tất cả' }, { v: 1, l: 'HSK 1' }, { v: 2, l: 'HSK 2' }, { v: 3, l: 'HSK 3' }, { v: 4, l: 'HSK 4' }, { v: 5, l: 'HSK 5' }, { v: 'office', l: 'Công sở' },
] as const
function setFilter(v: (typeof filters)[number]['v']) {
  levelFilter.value = v
  if (points.value.length) pick(0)
}

// Bộ chạy bài tập: dùng chung cho một mẫu câu hoặc luyện tất cả
const list = ref<Ex[]>([])
const idx = ref(0)
const results = ref<boolean[]>([])
const answered = ref(false)

onMounted(async () => {
  const hskPoints = (await import('@/data/grammar-hsk.json')).default as GrammarPoint[]
  const office = (await import('@/data/it/grammar.json')).default as GrammarPoint[]
  all.value = [...hskPoints, ...office]
  pick(0)
})

const p = computed(() => points.value[sel.value])
const total = computed(() => points.value.reduce((n, g) => n + g.exercises.length, 0))
const ended = computed(() => idx.value >= list.value.length && list.value.length > 0)
const summary = computed(() => scoreSession(results.value))

function startRun(exs: Ex[]) {
  list.value = exs
  idx.value = 0
  results.value = []
  answered.value = false
}
function pick(i: number) {
  sel.value = i
  mode.value = 'learn'
  startRun(points.value[i].exercises)
}
function practiceAll() {
  mode.value = 'all'
  startRun(shuffle(points.value.flatMap((g) => g.exercises)))
}
function onDone(first: boolean) {
  results.value.push(first)
  answered.value = true
}
function next() {
  idx.value++
  answered.value = false
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Ngữ pháp</h1>
      <p class="text-ink2">{{ all.length }} mẫu câu theo cấp HSK 1–5 và câu công sở (nhờ vả, báo cáo, hỏi lại yêu cầu). Mỗi mẫu có lỗi người Việt hay mắc và bài sắp xếp câu.</p>
    </div>
    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      <button v-for="f in filters" :key="String(f.v)" type="button" class="chip shrink-0" :class="levelFilter === f.v && 'chip-on'" @click="setFilter(f.v)">{{ f.l }}</button>
    </div>

    <div class="grid gap-5 xl:grid-cols-[19rem_1fr]">
      <nav class="min-w-0 space-y-2 xl:sticky xl:top-8 xl:self-start" aria-label="Mẫu câu">
        <div class="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
          <button v-for="(g, i) in points" :key="g.id" type="button"
            class="shrink-0 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 xl:shrink"
            :class="mode === 'learn' && sel === i ? 'border-transparent bg-ink text-paper shadow-lift' : 'border-line bg-surface text-ink2 hover:border-sky hover:text-sky'" @click="pick(i)">{{ g.title }}</button>
        </div>
        <button type="button" class="btn-primary w-full" :class="mode === 'all' && 'ring-4 ring-seal/25'" @click="practiceAll"><Icon name="bolt" :size="16" />Luyện tất cả {{ total }} câu</button>
      </nav>

      <section v-if="p" class="min-w-0 space-y-5">
        <template v-if="mode === 'learn'">
          <div class="aurora surface space-y-4 p-6 md:p-8">
            <h2 class="text-2xl font-bold">{{ p.title }}</h2>
            <div class="inline-block rounded-2xl bg-ink px-4 py-2 font-zh text-lg text-paper">{{ p.pattern }}</div>
            <p class="max-w-3xl text-lg leading-relaxed">{{ p.explain }}</p>
            <span v-if="!content.isReviewedKey('gr:' + p.id, p.reviewed)" class="badge-unreviewed">chưa kiểm duyệt</span>
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <div class="tile acc-seal space-y-3">
              <div class="relative font-bold">Lỗi người Việt hay mắc</div>
              <div class="relative flex items-center gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-seal text-white"><Icon name="x" :size="14" /></span><span class="font-zh text-xl text-ink2 line-through decoration-seal">{{ p.mistake.wrong }}</span></div>
              <div class="relative flex items-center gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-jade text-white"><Icon name="check" :size="14" /></span><span class="font-zh text-xl font-semibold">{{ p.mistake.right }}</span></div>
              <p class="relative text-sm text-ink2">{{ p.mistake.why }}</p>
            </div>

            <div class="tile acc-jade space-y-3">
              <div class="relative font-bold">Ví dụ</div>
              <div v-for="e in p.examples" :key="e.sc" class="glass relative p-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="font-zh text-xl">{{ e.sc }}</div>
                    <div class="text-sm"><PinyinText :text="e.py" /></div>
                    <div class="text-sm text-ink2">{{ e.vi }}</div>
                  </div>
                  <button type="button" class="btn-ghost btn-icon h-9 w-9 shrink-0" aria-label="Nghe" @click="speak(e.sc)"><Icon name="play" :size="13" /></button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div class="surface space-y-4 p-6 md:p-8">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-xl font-bold">{{ mode === 'all' ? 'Luyện tất cả' : 'Luyện sắp xếp câu' }}</h3>
            <span v-if="!ended" class="text-sm text-ink2">Câu {{ idx + 1 }}/{{ list.length }}</span>
          </div>

          <template v-if="!ended && list[idx]">
            <SortExercise :key="`${mode}-${sel}-${idx}`" :exercise="list[idx]" @done="onDone" />
            <button v-if="answered" type="button" class="btn-primary btn-lg w-full sm:w-auto" @click="next">{{ idx >= list.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo' }}<Icon name="next" :size="16" /></button>
          </template>

          <div v-else-if="ended" class="space-y-3 py-6 text-center">
            <span class="seal stamp mx-auto h-16 w-16 text-3xl">{{ summary.percent >= 75 ? '优' : '加' }}</span>
            <div class="text-3xl font-bold tabular-nums">{{ summary.correct }}/{{ summary.total }} câu đúng ngay lần đầu</div>
            <div class="flex justify-center gap-2">
              <button type="button" class="btn-primary" @click="startRun(mode === 'all' ? shuffle(points.flatMap((g) => g.exercises)) : p.exercises)">Làm lại</button>
              <button v-if="mode === 'learn' && sel < points.length - 1" type="button" class="btn-ghost" @click="pick(sel + 1)">Mẫu câu tiếp theo</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
