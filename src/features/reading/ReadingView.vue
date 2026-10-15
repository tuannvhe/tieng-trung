<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Dialogue, HskLevel, HskWord, ReadingPassage, ReadingToken } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'
import { useSpeech } from '@/composables/useSpeech'
import { loadDialogues } from '@/lib/data'
import { buildWordIndex, segment, type WordIndex } from '@/lib/segment'
import PinyinText from '@/components/PinyinText.vue'
import Icon from '@/components/Icon.vue'

interface Tapped { text: string; py?: string; vi?: string; level?: number }

const settings = useSettingsStore()
const content = useContentStore()
const { speak } = useSpeech()

const source = ref<'dialogue' | 'tech'>('dialogue')
const showAll = ref(false)
const showTranslation = ref(false)
const tapped = ref<Tapped | null>(null)
const seen = ref(new Set<string>())

// Nguồn 1: hội thoại, tự gắn nghĩa theo từ vựng HSK
const dialogues = ref<Dialogue[]>([])
const index = ref<WordIndex>(new Map())
const level = ref(1)
const dSel = ref(0)

// Nguồn 2: đoạn kỹ thuật ngắn (thông báo lỗi, yêu cầu sản xuất)
const passages = ref<ReadingPassage[]>([])
const pSel = ref(0)
const KIND: Record<ReadingPassage['kind'], string> = { error: 'Thông báo lỗi', request: 'Yêu cầu', notice: 'Thông báo', report: 'Báo cáo' }

onMounted(async () => {
  dialogues.value = (await loadDialogues()).items
  const words: HskWord[] = []
  for (const lv of [1, 2, 3, 4, 5, 6] as HskLevel[]) words.push(...(await content.loadHsk(lv)))
  index.value = buildWordIndex(words)
  passages.value = (await import('@/data/it/reading.json')).default as ReadingPassage[]
})

const byLevel = computed(() => dialogues.value.filter((d) => d.level === level.value))
const dlg = computed(() => byLevel.value[dSel.value])
const lines = computed(() => (dlg.value ? dlg.value.lines.map((l) => ({ ...l, tokens: segment(l.sc, index.value) })) : []))
const passage = computed(() => passages.value[pSel.value])
const techWords = computed(() => passage.value?.tokens.filter((t) => t.py).length ?? 0)

function pickLevel(lv: number) {
  level.value = lv
  dSel.value = 0
  reset()
}
function reset() {
  tapped.value = null
  showTranslation.value = false
  seen.value = new Set()
}
function tapWord(key: string, text: string, w?: HskWord) {
  if (!w) return
  tapped.value = { text, py: w.pinyin, vi: content.viMeaning(w), level: w.level }
  seen.value.add(key)
}
function tapTech(t: ReadingToken, key: string) {
  if (!t.py) return
  tapped.value = { text: t.t, py: t.py, vi: t.vi }
  seen.value.add(key)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold">Luyện đọc</h1>
        <p class="text-ink2">Đọc đoạn thoại hoặc thông báo như người Trung viết thật. Bấm vào từ chưa biết để xem pinyin, nghĩa và cấp HSK.</p>
      </div>
      <div class="seg" role="radiogroup" aria-label="Nguồn bài đọc">
        <button type="button" role="radio" :aria-checked="source === 'dialogue'" @click="source = 'dialogue'; reset()">Hội thoại HSK</button>
        <button type="button" role="radio" :aria-checked="source === 'tech'" @click="source = 'tech'; reset()">Thông báo kỹ thuật</button>
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-[1fr_24rem]">
      <!-- Bài đọc hội thoại -->
      <section v-if="source === 'dialogue' && dlg" class="surface p-6 md:p-10">
        <div class="mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded-full bg-sky/15 px-3 py-1 font-semibold">HSK {{ dlg.level }}</span>
          <span class="text-ink2">{{ dlg.title }}</span>
          <span class="ml-auto text-ink2">đã xem {{ seen.size }} từ</span>
        </div>
        <div class="space-y-5">
          <div v-for="(l, li) in lines" :key="li" class="flex gap-3">
            <span class="mt-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold" :class="l.who === 'm' ? 'bg-seal/15 text-seal' : 'bg-paper text-ink2'">{{ l.who === 'm' ? 'B' : 'A' }}</span>
            <div class="min-w-0">
              <p class="font-zh leading-[2.7]" :style="{ fontSize: settings.s.zhFontSize * 0.95 + 'px' }">
                <template v-for="(t, ti) in l.tokens" :key="ti">
                  <button v-if="t.word" type="button" class="mx-px inline-flex flex-col items-center rounded-lg px-0.5 align-bottom transition hover:bg-seal/10"
                    :class="tapped?.text === t.text && tapped?.py === t.word.pinyin ? 'bg-seal/15 ring-2 ring-seal' : seen.has(li + '-' + ti) ? 'text-ink2' : 'border-b-2 border-dotted border-ink2/50'"
                    @click="tapWord(li + '-' + ti, t.text, t.word)">
                    <span v-if="showAll" class="text-[0.4em] leading-none"><PinyinText :text="t.word.pinyin" /></span>
                    <span>{{ t.text }}</span>
                  </button>
                  <span v-else>{{ t.text }}</span>
                </template>
              </p>
              <p v-if="showTranslation" class="pop text-sm text-ink2">{{ l.vi }}</p>
            </div>
          </div>
        </div>
        <div class="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" class="btn-ghost" @click="speak(dlg.lines.map((l) => l.sc).join(''))"><Icon name="play" :size="16" />Nghe cả đoạn</button>
          <label class="inline-flex items-center gap-2 text-sm text-ink2"><input v-model="showAll" type="checkbox" class="h-4 w-4" />Pinyin trên mọi từ</label>
          <button type="button" class="btn-soft ml-auto" @click="showTranslation = !showTranslation"><Icon name="eye" :size="16" />{{ showTranslation ? 'Ẩn bản dịch' : 'Xem bản dịch' }}</button>
        </div>
      </section>

      <!-- Bài đọc kỹ thuật -->
      <section v-else-if="source === 'tech' && passage" class="surface p-6 md:p-10">
        <div class="mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded-full bg-seal/15 px-3 py-1 font-semibold">{{ KIND[passage.kind] }}</span>
          <span v-if="!content.isReviewedKey('rd:' + passage.id, passage.reviewed)" class="badge-unreviewed">chưa kiểm duyệt</span>
          <span class="text-ink2">đã xem {{ seen.size }}/{{ techWords }} từ</span>
        </div>
        <p class="font-zh leading-[2.8] md:leading-[3]" :style="{ fontSize: settings.s.zhFontSize * 1.05 + 'px' }">
          <template v-for="(t, idx) in passage.tokens" :key="idx">
            <button v-if="t.py" type="button" class="mx-px inline-flex flex-col items-center rounded-lg px-1 align-bottom transition hover:bg-seal/10"
              :class="tapped?.text === t.t ? 'bg-seal/15 ring-2 ring-seal' : seen.has('t' + idx) ? 'text-ink2' : 'border-b-2 border-dotted border-ink2/50'" @click="tapTech(t, 't' + idx)">
              <span v-if="showAll" class="text-[0.4em] leading-none"><PinyinText :text="t.py" /></span>
              <span>{{ t.t }}</span>
            </button>
            <span v-else>{{ t.t }}</span>
          </template>
        </p>
        <div class="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" class="btn-ghost" @click="speak(passage.tokens.map((t) => t.t).join(''))"><Icon name="play" :size="16" />Nghe cả đoạn</button>
          <label class="inline-flex items-center gap-2 text-sm text-ink2"><input v-model="showAll" type="checkbox" class="h-4 w-4" />Pinyin trên mọi từ</label>
          <button type="button" class="btn-soft ml-auto" @click="showTranslation = !showTranslation"><Icon name="eye" :size="16" />{{ showTranslation ? 'Ẩn bản dịch' : 'Xem bản dịch' }}</button>
        </div>
        <p v-if="showTranslation" class="pop mt-4 rounded-2xl border border-dashed border-line p-4 text-ink2">{{ passage.translation_vi }}</p>
      </section>

      <aside class="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <section class="tile acc-seal min-h-[9rem]" aria-live="polite">
          <div v-if="tapped" class="relative flex items-start justify-between gap-3">
            <div>
              <span class="han block text-5xl">{{ tapped.text }}</span>
              <div v-if="tapped.py" class="mt-1 text-2xl font-semibold"><PinyinText :text="tapped.py" /></div>
              <div class="mt-1 text-lg">{{ tapped.vi }}</div>
              <span v-if="tapped.level" class="mt-2 inline-block rounded-md bg-sky/15 px-2 py-0.5 text-xs font-semibold">từ HSK {{ tapped.level }}</span>
            </div>
            <button type="button" class="btn-ghost btn-icon h-11 w-11 shrink-0" aria-label="Nghe từ này" @click="speak(tapped.text)"><Icon name="play" :size="16" /></button>
          </div>
          <p v-else class="relative text-ink2">Chọn một từ trong bài để xem nghĩa ở đây. Chữ không gạch chân là chữ ngoài từ vựng HSK 1–5.</p>
        </section>

        <section v-if="source === 'dialogue'" class="surface p-3">
          <div class="flex flex-wrap gap-1.5 p-2">
            <button v-for="lv in [1, 2, 3, 4, 5]" :key="lv" type="button" class="chip !px-3 !py-1" :class="level === lv && 'chip-on'" @click="pickLevel(lv)">HSK {{ lv }}</button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <button v-for="(d, n) in byLevel" :key="d.id" type="button" class="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition hover:bg-paper" :class="dSel === n && 'bg-paper font-semibold'" @click="dSel = n; reset()">
              <span class="w-6 shrink-0 text-xs text-ink2 tabular-nums">{{ n + 1 }}</span><span class="truncate">{{ d.title }}</span>
            </button>
          </div>
        </section>
        <section v-else class="surface p-3">
          <div class="px-2 pb-2 pt-1 text-sm font-semibold">Chọn đoạn đọc</div>
          <button v-for="(x, n) in passages" :key="x.id" type="button" class="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition hover:bg-paper" :class="pSel === n && 'bg-paper font-semibold'" @click="pSel = n; reset()">{{ x.title }}</button>
        </section>
      </aside>
    </div>
  </div>
</template>
