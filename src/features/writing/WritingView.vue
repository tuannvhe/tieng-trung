<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import HanziWriter from 'hanzi-writer'
import { RouterLink, useRoute } from 'vue-router'
import { useDeck } from '@/composables/useDeck'
import { useSettingsStore } from '@/stores/settings'
import type { DeckItem } from '@/composables/useSrs'
import PinyinText from '@/components/PinyinText.vue'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'

const settings = useSettingsStore()
const { deckOptions, buildDeck } = useDeck()
const opts = computed(() => deckOptions.value.map((o) => ({ value: o.key, label: o.label, disabled: o.disabled, group: o.key.startsWith('p0') ? 'Nhập môn' : o.key.startsWith('hsk') ? 'Nền tảng HSK' : 'Tiếng Trung IT' })))

const route = useRoute()
const deckKey = ref(typeof route.query.deck === 'string' ? route.query.deck : settings.s.mode === 'it-only' ? 'it:devices' : 'hsk:1')
const deck = ref<DeckItem[]>([])
const selected = ref<DeckItem | null>(null)
const charIndex = ref(0)
const box = ref<HTMLElement>()
const mistakes = ref(0)
const status = ref<'idle' | 'quiz' | 'done'>('idle')
const loadError = ref('')
const showOutline = ref(true)
let writer: HanziWriter | null = null

const chars = computed(() => [...(selected.value?.hanzi ?? '')].filter((c) => /[㐀-鿿]/.test(c)))
const currentChar = computed(() => chars.value[charIndex.value])

function css(name: string) {
  return `rgb(${getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(' ').join(',')})`
}

async function mountWriter() {
  await nextTick()
  if (!box.value || !currentChar.value) return
  box.value.innerHTML = ''
  loadError.value = ''
  status.value = 'idle'
  mistakes.value = 0
  const size = Math.min(320, box.value.clientWidth || 300)
  writer = HanziWriter.create(box.value, currentChar.value, {
    width: size,
    height: size,
    padding: 14,
    strokeColor: css('--c-ink'),
    outlineColor: css('--c-line'),
    drawingColor: css('--c-seal'),
    highlightColor: css('--c-jade'),
    showOutline: showOutline.value,
    strokeAnimationSpeed: 1.2,
    delayBetweenStrokes: 180,
    onLoadCharDataError: () => (loadError.value = `Chưa tải được nét của "${currentChar.value}". Kiểm tra kết nối mạng rồi thử lại.`),
  })
}

function animate() {
  status.value = 'idle'
  writer?.cancelQuiz()
  writer?.animateCharacter()
}
function quiz() {
  mistakes.value = 0
  status.value = 'quiz'
  writer?.quiz({
    onMistake: () => mistakes.value++,
    onComplete: () => (status.value = 'done'),
  })
}
function nextChar() {
  if (charIndex.value < chars.value.length - 1) charIndex.value++
}
function pick(item: DeckItem) {
  selected.value = item
  charIndex.value = 0
}
function nextWord() {
  const i = deck.value.findIndex((d) => d.ref === selected.value?.ref)
  if (i >= 0 && i < deck.value.length - 1) pick(deck.value[i + 1])
}

watch([selected, charIndex], mountWriter)
watch(showOutline, (v) => (v ? writer?.showOutline() : writer?.hideOutline()))
watch(deckKey, async () => {
  deck.value = (await buildDeck(deckKey.value)).filter((d) => /[㐀-鿿]/.test(d.hanzi))
  pick(deck.value[0])
})
onMounted(async () => {
  deck.value = (await buildDeck(deckKey.value)).filter((d) => /[㐀-鿿]/.test(d.hanzi))
  if (deck.value.length) pick(deck.value[0])
})
onBeforeUnmount(() => writer?.cancelQuiz())
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-3xl font-bold">Tập viết</h1>
      <p class="text-ink2">Xem một lần, rồi tự viết từng nét. Sai nét sẽ được gợi ý.</p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Select v-model="deckKey" :options="opts" label="Chọn bộ chữ" class="min-w-[16rem] md:w-80" />
      <RouterLink :to="{ path: '/print', query: { deck: deckKey } }" class="btn-ghost"><Icon name="download" :size="16" />In phiếu tập viết bộ này</RouterLink>
    </div>

    <div class="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <section v-if="selected" class="aurora surface p-6 md:p-8">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div class="text-lg font-semibold"><PinyinText :text="selected.pinyin" /></div>
            <div class="text-ink2">{{ selected.vi || selected.en }}</div>
          </div>
          <div class="flex gap-1" v-if="chars.length > 1" role="tablist" aria-label="Chữ trong từ">
            <button v-for="(c, i) in chars" :key="i" type="button" role="tab" :aria-selected="i === charIndex"
              class="han grid h-11 w-11 place-items-center rounded-lg border text-xl" :class="i === charIndex ? 'border-seal bg-seal/10 text-seal' : 'border-line'" @click="charIndex = i">{{ c }}</button>
          </div>
        </div>

        <div class="mx-auto mt-4 aspect-square w-full max-w-sm rounded-2xl border border-dashed border-line bg-paper"
          style="background-image: linear-gradient(to right, transparent 49.7%, rgb(var(--c-line)) 50%, transparent 50.3%), linear-gradient(to bottom, transparent 49.7%, rgb(var(--c-line)) 50%, transparent 50.3%)">
          <div ref="box" class="h-full w-full" />
        </div>
        <p v-if="loadError" class="mt-3 text-sm text-seal" role="alert">{{ loadError }}</p>

        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button type="button" class="btn-ghost" @click="animate"><Icon name="play" :size="16" />Xem thứ tự nét</button>
          <button type="button" class="btn-primary" @click="quiz"><Icon name="pen" :size="16" />Tự viết</button>
          <label class="inline-flex items-center gap-2 text-sm text-ink2"><input v-model="showOutline" type="checkbox" class="h-4 w-4 accent-[rgb(var(--c-seal))]" />Nét mờ gợi ý</label>
        </div>

        <div class="mt-4 min-h-[3rem] text-center" role="status">
          <p v-if="status === 'quiz'" class="text-ink2">Viết từng nét theo thứ tự. Sai nét: {{ mistakes }}</p>
          <div v-else-if="status === 'done'" class="space-y-2">
            <p class="font-semibold text-jade">Xong chữ "{{ currentChar }}"{{ mistakes ? `, sai ${mistakes} nét` : ', không sai nét nào' }}.</p>
            <button v-if="charIndex < chars.length - 1" type="button" class="btn-primary" @click="nextChar">Chữ tiếp theo</button>
            <button v-else type="button" class="btn-primary" @click="nextWord">Từ tiếp theo</button>
          </div>
        </div>
      </section>

      <aside class="surface max-h-[32rem] overflow-y-auto p-2" aria-label="Danh sách từ">
        <button v-for="d in deck.slice(0, 80)" :key="d.ref" type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-paper" :class="d.ref === selected?.ref && 'bg-paper'" @click="pick(d)">
          <span class="han w-20 shrink-0 text-xl">{{ d.hanzi }}</span>
          <span class="truncate text-sm text-ink2">{{ d.vi || d.en }}</span>
        </button>
      </aside>
    </div>
  </div>
</template>
