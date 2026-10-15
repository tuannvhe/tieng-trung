<script setup lang="ts">
import { computed, ref } from 'vue'
import { IT_DOMAINS, IT_DOMAIN_LABELS, type HskLevel } from '@/types'
import { useContentStore } from '@/stores/content'
import { SPEECH_RATES, useSpeech } from '@/composables/useSpeech'
import { buildChoices, scoreSession, shuffle } from '@/lib/exercise'
import { sentenceMatches } from '@/lib/pinyin'
import { usePinyinInput } from '@/composables/usePinyinInput'
import { shortMeaning } from '@/lib/exam'
import { loadDialogues } from '@/lib/data'
import PinyinText from '@/components/PinyinText.vue'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'

interface Unit { sc: string; pinyin: string; vi: string }
interface Q extends Unit { choices: string[]; answerIndex: number }

const content = useContentStore()
const { speak, supported } = useSpeech()

const source = ref('hsk:1')
const itUnit = ref<'sentence' | 'word'>('sentence')
const mode = ref<'type' | 'choose'>('type')
const phase = ref<'setup' | 'play' | 'end'>('setup')

const qs = ref<Q[]>([])
const i = ref(0)
const typed = ref('')
const { display, showPreview } = usePinyinInput(typed)
const picked = ref<number | null>(null)
const answered = ref(false)
const results = ref<boolean[]>([])
const wrong = ref(false)

const sourceOptions = [
  ...[1, 2, 3, 4, 5, 6].map((l) => ({ value: `hsk:${l}`, label: `Từ vựng HSK ${l}`, group: 'HSK, nghe từng từ' })),
  ...[1, 2, 3, 4, 5].map((l) => ({ value: `dlg:${l}`, label: `Hội thoại nhà máy HSK ${l}`, group: 'HSK, nghe cả câu' })),
  { value: 'it:all', label: 'Thuật ngữ IT, tất cả', group: 'Tiếng Trung IT' },
  ...IT_DOMAINS.map((d) => ({ value: `it:${d}`, label: IT_DOMAIN_LABELS[d], group: 'Tiếng Trung IT' })),
]
const isIt = computed(() => source.value.startsWith('it:'))
const sourceLabel = computed(() => sourceOptions.find((o) => o.value === source.value)?.label ?? '')
const cur = computed(() => qs.value[i.value])
const summary = computed(() => scoreSession(results.value))
const correct = computed(() => results.value[i.value])

async function buildPool(): Promise<Unit[]> {
  const [kind, arg] = source.value.split(':')
  if (kind === 'hsk') {
    return (await content.loadHsk(Number(arg) as HskLevel)).map((w) => ({
      sc: w.hanzi, pinyin: w.pinyin, vi: shortMeaning(w, content.viOnly(w)),
    }))
  }
  if (kind === 'dlg') {
    const lv = Number(arg)
    return (await loadDialogues()).items.filter((d) => d.level === lv).flatMap((d) => d.lines.map((l) => ({ sc: l.sc, pinyin: l.py, vi: l.vi })))
  }
  const all = await content.loadItTerms()
  const terms = arg === 'all' ? all : all.filter((t) => t.domain === arg)
  return terms.map((t) =>
    itUnit.value === 'sentence' ? { sc: t.example_sc, pinyin: t.example_pinyin, vi: t.example_vi } : { sc: t.hanzi_sc, pinyin: t.pinyin, vi: t.vi },
  )
}

async function start() {
  const pool = await buildPool()
  const picks = shuffle(pool).slice(0, 10)
  const allVi = pool.map((u) => u.vi)
  qs.value = picks.map((u) => {
    const { options, index } = buildChoices(u.vi, allVi)
    return { ...u, choices: options, answerIndex: index }
  })
  i.value = 0
  results.value = []
  reset()
  phase.value = 'play'
  setTimeout(() => speak(cur.value.sc), 150)
}
function reset() {
  typed.value = ''
  picked.value = null
  answered.value = false
  wrong.value = false
}
function check() {
  if (answered.value) return
  const ok = mode.value === 'type' ? sentenceMatches(typed.value, cur.value.pinyin) : picked.value === cur.value.answerIndex
  results.value[i.value] = ok
  answered.value = true
  wrong.value = !ok
}
function choose(n: number) {
  if (answered.value) return
  picked.value = n
  check()
}
function next() {
  if (i.value >= qs.value.length - 1) return (phase.value = 'end')
  i.value++
  reset()
  setTimeout(() => speak(cur.value.sc), 150)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Nghe và gõ</h1>
      <p class="text-ink2">Nghe một từ hoặc một câu rồi gõ pinyin, hoặc chọn nghĩa đúng. Chọn cấp HSK bạn đang học.</p>
    </div>
    <p v-if="!supported" class="surface border-lantern p-4 text-sm" role="alert">Trình duyệt này chưa có giọng đọc tiếng Trung. Hãy thử Chrome hoặc Edge.</p>

    <div class="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <section v-if="phase === 'setup'" class="surface space-y-6 p-6 md:p-8">
        <div class="space-y-2"><label class="text-sm font-semibold">Nội dung nghe</label><Select v-model="source" :options="sourceOptions" label="Nội dung nghe" /></div>
        <div class="grid gap-6 md:grid-cols-2">
          <div v-if="isIt">
            <div class="mb-2 text-sm font-semibold">Nghe gì</div>
            <div class="seg w-full" role="radiogroup" aria-label="Nghe gì">
              <button type="button" role="radio" :aria-checked="itUnit === 'sentence'" @click="itUnit = 'sentence'">Cả câu</button>
              <button type="button" role="radio" :aria-checked="itUnit === 'word'" @click="itUnit = 'word'">Một từ</button>
            </div>
          </div>
          <div :class="!isIt && 'md:col-span-2'">
            <div class="mb-2 text-sm font-semibold">Trả lời bằng cách</div>
            <div class="seg w-full" role="radiogroup" aria-label="Cách trả lời">
              <button type="button" role="radio" :aria-checked="mode === 'type'" @click="mode = 'type'">Gõ pinyin</button>
              <button type="button" role="radio" :aria-checked="mode === 'choose'" @click="mode = 'choose'">Chọn nghĩa</button>
            </div>
          </div>
        </div>
        <p v-if="mode === 'type'" class="text-sm text-ink2">Gõ có dấu, số thanh (ni3 hao3) hoặc không dấu đều được. Biến điệu 一 và 不 gõ dạng nào cũng đúng.</p>
        <button type="button" class="btn-primary btn-lg w-full" @click="start">Bắt đầu 10 câu: {{ sourceLabel }}<Icon name="next" :size="18" /></button>
      </section>

      <section v-else-if="phase === 'play' && cur" class="aurora surface space-y-6 p-6 md:p-8">
        <div class="flex items-center justify-between text-sm text-ink2"><span>Câu {{ i + 1 }}/{{ qs.length }}</span><span>Đúng {{ results.filter(Boolean).length }}</span></div>
        <div class="h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-seal transition-all duration-500" :style="{ width: (i / qs.length) * 100 + '%' }" /></div>

        <div class="flex justify-center gap-4 py-2">
          <button type="button" class="btn-primary btn-icon h-24 w-24" aria-label="Nghe" @click="speak(cur.sc)"><Icon name="play" :size="38" /></button>
          <button type="button" class="btn-ghost btn-icon h-24 w-24" aria-label="Nghe chậm" @click="speak(cur.sc, SPEECH_RATES.slow)"><Icon name="turtle" :size="32" /></button>
        </div>

        <form v-if="mode === 'type'" class="space-y-3" @submit.prevent="answered ? next() : check()">
          <input v-model="typed" :disabled="answered" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ pinyin bạn nghe được" class="field text-lg" :class="answered && wrong && 'shake !border-seal'" aria-label="Pinyin" />
          <p v-if="showPreview" class="text-sm text-ink2" aria-live="polite">Dạng có dấu: <PinyinText :text="display" /></p>
          <button v-if="!answered" type="submit" class="btn-primary w-full" :disabled="!typed.trim()">Kiểm tra</button>
        </form>
        <div v-else class="grid gap-2">
          <button v-for="(c, n) in cur.choices" :key="n" type="button" :disabled="answered" class="rounded-2xl border-2 px-4 py-3.5 text-left transition hover:-translate-y-0.5"
            :class="answered ? (n === cur.answerIndex ? 'border-jade bg-jade/10' : n === picked ? 'shake border-seal bg-seal/10' : 'border-line opacity-60') : 'border-line hover:border-sky'" @click="choose(n)">{{ c }}</button>
        </div>

        <div v-if="answered" class="pop space-y-3 border-t border-dashed border-line pt-5" role="status">
          <p class="text-lg font-bold" :class="correct ? 'text-jade' : 'text-seal'">{{ correct ? 'Chính xác' : 'Chưa đúng' }}</p>
          <div class="han text-3xl">{{ cur.sc }}</div>
          <div class="text-lg"><PinyinText :text="cur.pinyin" /></div>
          <div class="text-ink2">{{ cur.vi }}</div>
          <button type="button" class="btn-primary btn-lg w-full" @click="next">{{ i >= qs.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo' }}</button>
        </div>
      </section>

      <section v-else class="aurora surface space-y-4 p-10 text-center">
        <span class="seal stamp mx-auto h-20 w-20 text-4xl">{{ summary.percent >= 80 ? '优' : '加' }}</span>
        <div class="text-5xl font-bold tabular-nums">{{ summary.correct }}/{{ summary.total }}</div>
        <p class="mx-auto max-w-sm text-ink2">{{ summary.percent >= 80 ? 'Tai bạn đang quen dần với giọng đọc.' : 'Nghe lại bằng nút chậm để bắt từng âm tiết, rồi thử thêm một lượt.' }}</p>
        <div class="flex justify-center gap-2">
          <button type="button" class="btn-primary btn-lg" @click="start">Chơi lại</button>
          <button type="button" class="btn-ghost btn-lg" @click="phase = 'setup'">Đổi nội dung</button>
        </div>
      </section>

      <aside class="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <section class="surface p-5">
          <div class="mb-3 font-bold">Lượt chơi này</div>
          <p v-if="!results.length" class="text-sm text-ink2">Kết quả từng câu sẽ hiện ở đây.</p>
          <ol v-else class="space-y-1.5">
            <li v-for="(ok, n) in results" :key="n" class="flex items-center gap-2 text-sm">
              <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white" :class="ok ? 'bg-jade' : 'bg-seal'"><Icon :name="ok ? 'check' : 'x'" :size="13" /></span>
              <span class="truncate font-zh">{{ qs[n]?.sc }}</span>
            </li>
          </ol>
        </section>
        <section class="tile acc-sky"><p class="relative text-sm"><span class="font-bold">Mẹo:</span> nghe chậm trước để bắt âm tiết, rồi nghe thường để quen tốc độ thật của đồng nghiệp.</p></section>
      </aside>
    </div>
  </div>
</template>
