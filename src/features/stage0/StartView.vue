<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import stage0 from '@/data/stage0.json'
import type { HskLevel, HskWord } from '@/types'
import { useContentStore } from '@/stores/content'
import { SPEECH_RATES, useSpeech } from '@/composables/useSpeech'
import { buildRadicalQuiz, buildSandhiQuiz, buildToneQuiz, radicalExamples, type RadicalDef } from '@/lib/stage0'
import Icon from '@/components/Icon.vue'
import OptionQuiz from '@/components/OptionQuiz.vue'
import PinyinText from '@/components/PinyinText.vue'
import StrokeDemo from '@/components/StrokeDemo.vue'

const content = useContentStore()
const { speak } = useSpeech()

type Tab = 'pinyin' | 'tone' | 'stroke' | 'radical' | 'chars'
const tab = ref<Tab>('pinyin')
const TABS: Array<{ v: Tab; l: string; n: string }> = [
  { v: 'pinyin', l: 'Pinyin', n: '1' }, { v: 'tone', l: 'Thanh điệu', n: '2' }, { v: 'stroke', l: 'Nét chữ', n: '3' },
  { v: 'radical', l: '30 bộ thủ', n: '4' }, { v: 'chars', l: '30 chữ đầu', n: '5' },
]

// --- Pinyin ---
interface Pick { label: string; hanzi: string; py: string; tip?: string }
const picked = ref<Pick | null>(null)
function pick(label: string, hanzi: string, py: string, tip?: string) {
  picked.value = { label, hanzi, py, tip }
  speak(hanzi)
}

// --- Thanh điệu ---
const TONE_MARK = ['ā', 'á', 'ǎ', 'à']
const contourPoints = (c: number[]) => c.map((lv, k) => `${6 + (k * 48) / Math.max(1, c.length - 1)},${34 - (lv - 1) * 7}`).join(' ')
const toneQs = ref(buildToneQuiz(stage0.toneDrill, 10))
const toneItems = computed(() => toneQs.value.map((q) => ({ ...q, options: ['1', '2', '3', '4'], answer: q.answer - 1 })))
const sandhiQs = ref(buildSandhiQuiz(stage0.sandhiQuiz, 8))

// --- Bộ thủ ---
const words = ref<HskWord[]>([])
const radicalQs = ref<ReturnType<typeof buildRadicalQuiz>>([])
const radicals = stage0.radicals as RadicalDef[]
const viOf = (w: HskWord) => content.viOnly(w)
const examples = computed(() => Object.fromEntries(radicals.map((r) => [r.r, radicalExamples(words.value, r.r, 4, viOf)])))
const hvOf = (g: string) => radicals.find((r) => r.r === g)
function newRadicalQuiz() {
  radicalQs.value = buildRadicalQuiz(words.value, radicals, 10, viOf)
}

onMounted(async () => {
  const all: HskWord[] = []
  for (const lv of [1, 2, 3, 4, 5] as HskLevel[]) all.push(...(await content.loadHsk(lv)))
  words.value = all
  newRadicalQuiz()
})

const strokeDemo = ref<string>('一')
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Nhập môn: Giai đoạn 0</h1>
      <p class="text-ink2">Nền tảng trước khi học HSK 1: đọc pinyin, nghe đúng thanh điệu, viết đúng thứ tự nét, nhận biết bộ thủ và 30 chữ đầu tiên. Học theo thứ tự các thẻ bên dưới.</p>
    </div>

    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist">
      <button v-for="t in TABS" :key="t.v" type="button" role="tab" :aria-selected="tab === t.v" class="chip shrink-0" :class="tab === t.v && 'chip-on'" @click="tab = t.v">
        <span class="grid h-5 w-5 place-items-center rounded-full bg-paper text-xs font-bold text-ink">{{ t.n }}</span>{{ t.l }}
      </button>
    </div>

    <!-- 1. Pinyin -->
    <div v-if="tab === 'pinyin'" class="grid gap-5 xl:grid-cols-[1fr_20rem]">
      <div class="space-y-5">
        <section class="surface p-5">
          <h2 class="text-xl font-bold">21 thanh mẫu (phụ âm đầu)</h2>
          <p class="mb-4 text-sm text-ink2">Bấm vào ô để nghe chữ ví dụ. Chữ mẫu đã chọn sát âm Quan Thoại nhất có thể, nhưng cách so sánh với tiếng Việt chỉ mang tính gần đúng.</p>
          <div v-for="g in stage0.initials" :key="g.group" class="mb-4 last:mb-0">
            <div class="mb-2 text-sm font-semibold text-ink2">{{ g.group }}</div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button v-for="it in g.items" :key="it.i" type="button" class="tile !p-3 text-left" :class="[picked?.label === it.i ? 'ring-2 ring-seal' : '', 'acc-sky']" @click="pick(it.i, it.hanzi, it.py, it.tip)">
                <span class="relative flex items-baseline gap-2"><span class="text-2xl font-bold">{{ it.i }}</span><span class="font-han text-xl">{{ it.hanzi }}</span></span>
                <span class="relative text-sm"><PinyinText :text="it.py" /></span>
              </button>
            </div>
          </div>
        </section>
        <section class="surface p-5">
          <h2 class="text-xl font-bold">Vận mẫu (vần)</h2>
          <p class="mb-4 text-sm text-ink2">Vần đơn, vần kép và vần mũi. Một số vần viết rút gọn: iu đọc iou, ui đọc uei, un đọc uen.</p>
          <div v-for="g in stage0.finals" :key="g.group" class="mb-4 last:mb-0">
            <div class="mb-2 text-sm font-semibold text-ink2">{{ g.group }}</div>
            <div class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              <button v-for="it in g.items" :key="it.f" type="button" class="tile acc-jade !p-3 text-left" :class="picked?.label === it.f && 'ring-2 ring-seal'" @click="pick(it.f, it.hanzi, it.py, 'tip' in it ? (it as any).tip : undefined)">
                <span class="relative flex items-baseline gap-2"><span class="text-xl font-bold">{{ it.f }}</span><span class="font-han text-lg">{{ it.hanzi }}</span></span>
                <span class="relative text-xs"><PinyinText :text="it.py" /></span>
              </button>
            </div>
          </div>
        </section>
      </div>
      <aside class="xl:sticky xl:top-8 xl:self-start">
        <section class="tile acc-seal space-y-3 text-center">
          <template v-if="picked">
            <div class="relative text-6xl font-bold">{{ picked.label }}</div>
            <div class="relative font-han text-4xl">{{ picked.hanzi }}</div>
            <div class="relative text-xl font-semibold"><PinyinText :text="picked.py" /></div>
            <p v-if="picked.tip" class="relative text-sm text-ink2">Gần giống: {{ picked.tip }}</p>
            <div class="relative flex justify-center gap-2">
              <button type="button" class="btn-primary !py-2" @click="speak(picked.hanzi)"><Icon name="play" :size="14" />Nghe</button>
              <button type="button" class="btn-ghost !py-2" @click="speak(picked.hanzi, SPEECH_RATES.slow)"><Icon name="turtle" :size="16" />Chậm</button>
            </div>
          </template>
          <p v-else class="relative text-ink2">Chọn một thanh mẫu hoặc vận mẫu để nghe và xem cách đọc.</p>
        </section>
      </aside>
    </div>

    <!-- 2. Thanh điệu -->
    <div v-else-if="tab === 'tone'" class="space-y-5">
      <section class="surface p-5">
        <h2 class="text-xl font-bold">Bốn thanh và thanh nhẹ</h2>
        <p class="mb-4 text-sm text-ink2">Cùng một âm "ma" nhưng mỗi thanh là một chữ khác nhau. Đường kẻ cho thấy cao độ giọng đi lên hay xuống.</p>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <button v-for="t in stage0.tones" :key="t.n" type="button" class="tile acc-lantern text-center" @click="speak(t.hanzi)">
            <span class="relative block text-sm font-semibold">{{ t.name }}</span>
            <svg viewBox="0 0 60 40" class="relative mx-auto my-2 h-12 w-20 text-seal" aria-hidden="true"><polyline :points="contourPoints(t.contour)" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span class="relative block font-han text-4xl">{{ t.hanzi }}</span>
            <span class="relative block text-lg font-semibold"><PinyinText :text="t.py" /></span>
            <span class="relative block text-xs text-ink2">{{ t.shape }} · {{ t.vi }}</span>
          </button>
        </div>
      </section>

      <section class="surface p-5">
        <h2 class="mb-1 text-xl font-bold">Nghe và chọn thanh</h2>
        <p class="mb-4 text-sm text-ink2">Nghe một chữ rồi chọn thanh bạn nghe được. Nhiều cặp chỉ khác nhau mỗi thanh điệu.</p>
        <OptionQuiz :items="toneItems" :autoplay="(q) => speak(q.hanzi)" @restart="toneQs = buildToneQuiz(stage0.toneDrill, 10)">
          <template #prompt="{ item }">
            <button type="button" class="btn-primary btn-icon mx-auto h-20 w-20" aria-label="Nghe lại" @click="speak(item.hanzi)"><Icon name="play" :size="30" /></button>
          </template>
          <template #option="{ index }"><span class="text-3xl">{{ TONE_MARK[index] }}</span><span class="block text-xs font-normal text-ink2">thanh {{ index + 1 }}</span></template>
          <template #feedback="{ item }"><div class="font-han text-4xl">{{ item.hanzi }}</div><div class="text-xl"><PinyinText :text="item.py" /></div></template>
        </OptionQuiz>
      </section>

      <section class="surface p-5">
        <h2 class="mb-1 text-xl font-bold">Biến điệu thanh 3, 不 và 一</h2>
        <p class="mb-4 text-sm text-ink2">Khi đứng cạnh nhau, một số thanh đổi cách đọc. Bấm vào ví dụ để nghe.</p>
        <div class="grid gap-4 lg:grid-cols-3">
          <article v-for="rule in stage0.sandhi" :key="rule.rule" class="rounded-2xl bg-paper p-4">
            <h3 class="font-bold">{{ rule.rule }}</h3>
            <p class="mb-3 mt-1 text-xs text-ink2">{{ rule.note }}</p>
            <ul class="space-y-1.5">
              <li v-for="e in rule.examples" :key="e.sc">
                <button type="button" class="flex w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-left hover:ring-1 hover:ring-sky" @click="speak(e.sc)">
                  <span class="font-han text-xl">{{ e.sc }}</span>
                  <span class="text-sm"><span class="text-ink2 line-through">{{ e.written !== e.real ? e.written : '' }}</span> <b>{{ e.real }}</b></span>
                </button>
              </li>
            </ul>
          </article>
        </div>
        <h3 class="mb-2 mt-6 font-bold">Luyện: chọn cách đọc đúng</h3>
        <OptionQuiz :items="sandhiQs" @restart="sandhiQs = buildSandhiQuiz(stage0.sandhiQuiz, 8)">
          <template #prompt="{ item }"><div class="font-han text-6xl">{{ item.sc }}</div></template>
          <template #feedback="{ item }"><button type="button" class="btn-ghost !py-1.5" @click="speak(item.sc)"><Icon name="play" :size="14" />Nghe cách đọc đúng</button></template>
        </OptionQuiz>
      </section>
    </div>

    <!-- 3. Nét chữ -->
    <div v-else-if="tab === 'stroke'" class="space-y-5">
      <section class="surface p-5">
        <h2 class="text-xl font-bold">8 nét cơ bản</h2>
        <p class="mb-4 text-sm text-ink2">Mọi chữ Hán đều ghép từ vài nét này. Bấm "Xem nét" để xem chữ ví dụ được viết từng nét.</p>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article v-for="s in stage0.strokes" :key="s.name" class="tile acc-seal">
            <div class="relative flex items-baseline gap-2"><span class="font-han text-4xl">{{ s.name }}</span><span class="text-lg font-semibold"><PinyinText :text="s.py" /></span></div>
            <div class="relative font-semibold">{{ s.vi }}</div>
            <p class="relative mb-3 text-sm text-ink2">{{ s.tip }}</p>
            <div class="relative flex justify-center"><StrokeDemo :char="s.ex" :size="130" /></div>
            <p class="relative mt-2 text-center text-xs text-ink2">chữ ví dụ: <span class="font-han text-base">{{ s.ex }}</span></p>
          </article>
        </div>
      </section>
      <section class="surface p-5">
        <h2 class="text-xl font-bold">Quy tắc thứ tự nét</h2>
        <p class="mb-4 text-sm text-ink2">Chọn một quy tắc để xem chữ ví dụ.</p>
        <div class="grid gap-5 lg:grid-cols-[1fr_auto]">
          <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="(r, n) in stage0.strokeRules" :key="r.rule">
              <button type="button" class="flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition hover:-translate-y-0.5" :class="strokeDemo === r.ex ? 'border-seal bg-seal/10' : 'border-line'" @click="strokeDemo = r.ex">
                <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper text-sm font-bold">{{ n + 1 }}</span>
                <span class="min-w-0 flex-1 text-sm font-medium">{{ r.rule }}</span><span class="font-han text-2xl">{{ r.ex }}</span>
              </button>
            </li>
          </ul>
          <div class="flex justify-center"><StrokeDemo :char="strokeDemo" :size="180" /></div>
        </div>
      </section>
    </div>

    <!-- 4. Bộ thủ -->
    <div v-else-if="tab === 'radical'" class="space-y-5">
      <section class="surface p-5">
        <h2 class="mb-1 text-xl font-bold">Luyện đoán bộ thủ</h2>
        <p class="mb-4 text-sm text-ink2">Cho một chữ HSK, chọn bộ thủ của nó. Dữ liệu lấy từ từ vựng HSK 1–3.</p>
        <OptionQuiz v-if="radicalQs.length" :items="radicalQs" @restart="newRadicalQuiz">
          <template #prompt="{ item }"><div class="font-han text-7xl">{{ item.hanzi }}</div><div class="mt-1 text-lg"><PinyinText :text="item.pinyin" /></div></template>
          <template #option="{ opt }"><span class="font-han text-3xl">{{ opt }}</span></template>
          <template #feedback="{ item }">
            <p class="text-sm">Bộ <b class="font-han text-xl">{{ item.options[item.answer] }}</b> ({{ hvOf(item.options[item.answer])?.hv }}): {{ hvOf(item.options[item.answer])?.meaning }}. Chữ này nghĩa là "{{ item.meaning }}".</p>
          </template>
        </OptionQuiz>
        <p v-else class="text-ink2">Đang tải từ vựng…</p>
      </section>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article v-for="r in radicals" :key="r.r" class="tile acc-plum">
          <div class="relative flex items-start justify-between gap-3">
            <div><span class="font-han text-5xl">{{ r.r }}</span></div>
            <button type="button" class="btn-ghost btn-icon h-9 w-9" aria-label="Nghe" @click="speak(examples[r.r]?.[0]?.hanzi ?? r.r)"><Icon name="play" :size="13" /></button>
          </div>
          <div class="relative mt-1 font-semibold">{{ r.hv }} · {{ r.meaning }} <span class="font-normal text-ink2">({{ r.py }})</span></div>
          <p class="relative mt-1 text-sm text-ink2">{{ r.hint }}</p>
          <ul class="relative mt-3 flex flex-wrap gap-2">
            <li v-for="e in examples[r.r]" :key="e.hanzi" class="rounded-xl bg-paper px-2.5 py-1.5 text-center"><div class="font-han text-xl">{{ e.hanzi }}</div><div class="text-[11px] text-ink2"><PinyinText :text="e.pinyin" plain /></div></li>
          </ul>
        </article>
      </div>
    </div>

    <!-- 5. 30 chữ đầu -->
    <div v-else class="space-y-5">
      <section class="tile acc-jade flex flex-wrap items-center gap-3">
        <p class="relative flex-1 text-sm">30 chữ đơn giản và thông dụng nhất, chia thành 6 bài. Học xong có thể ôn bằng thẻ nhắc lại ngắt quãng hoặc tập viết từng chữ.</p>
        <RouterLink :to="{ path: '/flashcard', query: { deck: 'p0:chars' } }" class="btn-primary relative"><Icon name="cards" :size="16" />Ôn bằng thẻ</RouterLink>
        <RouterLink :to="{ path: '/writing', query: { deck: 'p0:chars' } }" class="btn-ghost relative"><Icon name="pen" :size="16" />Tập viết</RouterLink>
        <RouterLink :to="{ path: '/print', query: { deck: 'p0:chars' } }" class="btn-ghost relative"><Icon name="download" :size="16" />In phiếu</RouterLink>
      </section>
      <section v-for="l in stage0.firstChars" :key="l.lesson" class="surface p-5">
        <h2 class="mb-3 text-lg font-bold">{{ l.lesson }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <article v-for="c in l.items" :key="c.hanzi" class="rounded-2xl bg-paper p-3 text-center">
            <button type="button" class="block w-full" @click="speak(c.hanzi)" :aria-label="`Nghe chữ ${c.hanzi}`"><span class="font-han text-6xl">{{ c.hanzi }}</span></button>
            <div class="mt-1 text-lg font-semibold"><PinyinText :text="c.py" /></div>
            <div class="text-sm">{{ c.vi }}</div>
            <div class="mt-1 text-xs text-ink2">{{ c.hint }}</div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
