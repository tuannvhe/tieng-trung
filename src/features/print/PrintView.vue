<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { HskLevel } from '@/types'
import { useContentStore } from '@/stores/content'
import { useDeck } from '@/composables/useDeck'
import { boxesPerRow, charsFromText, charsFromWords, paginate, rowsPerPage, type PrintChar, type PrintWord } from '@/lib/print'
import { localDay } from '@/lib/srs'
import stage0 from '@/data/stage0.json'
import Select from '@/components/Select.vue'
import StrokeOrder from '@/components/StrokeOrder.vue'
import Icon from '@/components/Icon.vue'

const content = useContentStore()
const route = useRoute()
const { deckOptions } = useDeck()

const source = ref<'deck' | 'custom'>('deck')
const deck = ref(typeof route.query.deck === 'string' ? route.query.deck : 'hsk:1')
const start = ref(1)
const count = ref(24)
const custom = ref('')
const grid = ref<'tian' | 'mi' | 'none'>('mi')
const box = ref(15)
const trace = ref(3)
const showStrokes = ref(true)
const showInfo = ref(true)
const showName = ref(true)
const title = ref('')
const strokeFailed = ref(new Set<string>())

const words = ref<PrintWord[]>([])
const loading = ref(false)

const deckSelect = computed(() =>
  deckOptions.value.map((o) => ({ value: o.key, label: o.label, disabled: o.disabled, group: o.key.startsWith('p0') ? 'Nhập môn' : o.key.startsWith('hsk') ? 'Từ vựng HSK' : 'Thuật ngữ IT' })),
)

async function loadWords() {
  loading.value = true
  const [kind, arg] = deck.value.split(':')
  if (kind === 'p0') {
    words.value = stage0.firstChars.flatMap((l) => l.items).map((c) => ({ hanzi: c.hanzi, pinyin: c.py, vi: c.vi }))
  } else if (kind === 'hsk') {
    words.value = (await content.loadHsk(Number(arg) as HskLevel)).map((w) => ({ hanzi: w.hanzi, pinyin: w.pinyin, vi: content.viMeaning(w) }))
  } else {
    const all = await content.loadItTerms(arg === 'all' ? undefined : (arg as never))
    words.value = all.map((t) => ({ hanzi: t.hanzi_sc, pinyin: t.pinyin, vi: t.vi }))
  }
  loading.value = false
}
onMounted(loadWords)
watch(deck, () => {
  start.value = 1
  loadWords()
})

const allChars = computed<PrintChar[]>(() => (source.value === 'custom' ? charsFromText(custom.value) : charsFromWords(words.value)))
const chars = computed(() => (source.value === 'custom' ? allChars.value : allChars.value.slice(Math.max(0, start.value - 1), Math.max(0, start.value - 1) + Math.max(1, count.value))))

const perRow = computed(() => boxesPerRow(box.value))
const perPage = computed(() => rowsPerPage(box.value, showStrokes.value))
const pages = computed(() => paginate(chars.value, perPage.value))
const sheetTitle = computed(() => title.value.trim() || (source.value === 'custom' ? 'Phiếu tập viết chữ Hán' : `Phiếu tập viết: ${deckSelect.value.find((o) => o.value === deck.value)?.label ?? ''}`))
const traceCount = computed(() => Math.min(Math.max(0, trace.value), perRow.value - 1))

const gridBg = computed(() => {
  const line = '#cfcfcf'
  const cross = `linear-gradient(to right, transparent calc(50% - .4px), ${line} calc(50% - .4px), ${line} calc(50% + .4px), transparent calc(50% + .4px)), linear-gradient(to bottom, transparent calc(50% - .4px), ${line} calc(50% - .4px), ${line} calc(50% + .4px), transparent calc(50% + .4px))`
  const diag = `linear-gradient(to top right, transparent calc(50% - .4px), ${line} calc(50% - .4px), ${line} calc(50% + .4px), transparent calc(50% + .4px)), linear-gradient(to bottom right, transparent calc(50% - .4px), ${line} calc(50% - .4px), ${line} calc(50% + .4px), transparent calc(50% + .4px))`
  return grid.value === 'none' ? 'none' : grid.value === 'tian' ? cross : `${cross}, ${diag}`
})

function onStrokeFailed(ch: string) {
  strokeFailed.value = new Set(strokeFailed.value).add(ch)
}
const boxStyle = computed(() => ({ width: box.value + 'mm', height: box.value + 'mm', fontSize: box.value * 0.78 + 'mm', backgroundImage: gridBg.value }))
const today = localDay()
function doPrint() {
  window.print()
}
</script>

<template>
  <div class="space-y-6 print:space-y-0">
    <div class="print:hidden">
      <h1 class="text-3xl font-bold">In phiếu tập viết</h1>
      <p class="text-ink2">Tạo phiếu A4 có chữ mẫu, chữ mờ để tô theo, ô trống và thứ tự nét. Chọn bộ từ hoặc tự nhập chữ, chỉnh kiểu ô rồi bấm In.</p>
    </div>

    <div class="grid gap-5 xl:grid-cols-[22rem_1fr] print:block">
      <!-- Bảng điều khiển -->
      <aside class="space-y-4 xl:sticky xl:top-8 xl:self-start print:hidden">
        <section class="surface space-y-4 p-5">
          <div class="seg w-full" role="radiogroup" aria-label="Nguồn chữ">
            <button type="button" role="radio" :aria-checked="source === 'deck'" @click="source = 'deck'">Theo bộ từ</button>
            <button type="button" role="radio" :aria-checked="source === 'custom'" @click="source = 'custom'">Tự nhập chữ</button>
          </div>

          <template v-if="source === 'deck'">
            <Select v-model="deck" :options="deckSelect" label="Bộ từ" />
            <div class="grid grid-cols-2 gap-3">
              <label class="text-sm font-semibold">Bắt đầu từ chữ thứ<input v-model.number="start" type="number" min="1" :max="allChars.length || 1" class="field mt-1 !py-2" /></label>
              <label class="text-sm font-semibold">Số chữ<input v-model.number="count" type="number" min="1" max="200" class="field mt-1 !py-2" /></label>
            </div>
            <p class="text-xs text-ink2">{{ loading ? 'Đang tải…' : `Bộ này có ${allChars.length} chữ khác nhau.` }}</p>
          </template>
          <label v-else class="block text-sm font-semibold">Chữ muốn luyện
            <textarea v-model="custom" rows="4" class="field mt-1 font-zh" placeholder="Dán hoặc gõ chữ Hán, ví dụ: 服务器重启" />
          </label>

          <div>
            <div class="mb-2 text-sm font-semibold">Kiểu ô</div>
            <div class="seg w-full" role="radiogroup" aria-label="Kiểu ô">
              <button type="button" role="radio" :aria-checked="grid === 'mi'" @click="grid = 'mi'">Mễ 米</button>
              <button type="button" role="radio" :aria-checked="grid === 'tian'" @click="grid = 'tian'">Điền 田</button>
              <button type="button" role="radio" :aria-checked="grid === 'none'" @click="grid = 'none'">Trơn</button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="text-sm font-semibold">Cỡ ô: {{ box }} mm<input v-model.number="box" type="range" min="12" max="22" step="1" class="mt-2 block w-full" /></label>
            <label class="text-sm font-semibold">Ô chữ mờ<input v-model.number="trace" type="number" min="0" max="8" class="field mt-1 !py-2" /></label>
          </div>
          <div class="space-y-2 text-sm">
            <label class="flex items-center justify-between font-semibold">Thứ tự nét dưới mỗi hàng<input v-model="showStrokes" type="checkbox" class="h-5 w-5" /></label>
            <label class="flex items-center justify-between font-semibold">Pinyin và nghĩa<input v-model="showInfo" type="checkbox" class="h-5 w-5" /></label>
            <label class="flex items-center justify-between font-semibold">Dòng họ tên và ngày<input v-model="showName" type="checkbox" class="h-5 w-5" /></label>
          </div>
          <label class="block text-sm font-semibold">Tiêu đề phiếu<input v-model="title" class="field mt-1 !py-2" :placeholder="sheetTitle" /></label>
        </section>

        <section class="tile acc-seal space-y-3">
          <div class="relative text-sm"><b>{{ chars.length }}</b> chữ trên <b>{{ pages.length }}</b> trang A4, mỗi trang {{ perPage }} hàng.</div>
          <button type="button" class="btn-primary relative w-full" :disabled="!chars.length" @click="doPrint"><Icon name="download" :size="16" />In phiếu</button>
          <p class="relative text-xs text-ink2">Trong hộp thoại in: chọn khổ A4, tỉ lệ 100%, tắt "Đầu trang và chân trang". Có thể chọn "Lưu thành PDF".</p>
          <p v-if="showStrokes && strokeFailed.size" class="relative text-xs text-seal" role="alert">Chưa tải được nét của {{ strokeFailed.size }} chữ (cần mạng lần đầu, hoặc tải sẵn trong Cài đặt).</p>
        </section>
      </aside>

      <!-- Bản xem trước và bản in -->
      <div class="min-w-0 overflow-x-auto pb-4 print:overflow-visible print:pb-0">
        <p v-if="!chars.length" class="surface p-10 text-center text-ink2 print:hidden">{{ loading ? 'Đang tải bộ từ…' : 'Chưa có chữ nào để in. Chọn bộ từ hoặc nhập chữ Hán.' }}</p>
        <section v-for="(page, pi) in pages" :key="pi" class="print-sheet mx-auto mb-6 bg-white text-black" :style="{ width: '210mm', minHeight: '297mm', padding: '12mm', boxSizing: 'border-box' }">
          <header class="mb-[4mm] flex items-end justify-between gap-4 border-b border-[#999] pb-[2mm]" style="height: 8mm">
            <div class="text-[11pt] font-bold">{{ sheetTitle }}</div>
            <div v-if="showName" class="flex gap-[6mm] text-[9pt]"><span>Họ tên: ______________</span><span>Ngày: {{ today.split('-').reverse().join('/') }}</span></div>
            <div v-else class="text-[9pt]">Trang {{ pi + 1 }}/{{ pages.length }}</div>
          </header>

          <div v-for="c in page" :key="c.ch" class="break-inside-avoid" style="margin-bottom: 2mm">
            <div class="flex items-baseline gap-[3mm] overflow-hidden whitespace-nowrap text-[9pt]" style="height: 5mm; line-height: 5mm">
              <template v-if="showInfo">
                <span v-if="c.py" class="font-semibold">{{ c.py }}</span>
                <span v-if="c.word && c.word !== c.ch" class="text-[#555]">{{ c.word }}</span>
                <span v-if="c.vi" class="truncate text-[#555]">{{ c.vi }}</span>
              </template>
            </div>
            <div class="flex">
              <div v-for="n in perRow" :key="n" class="shrink-0 border border-[#444] text-center font-kai leading-none" :style="{ ...boxStyle, backgroundRepeat: 'no-repeat', borderLeftWidth: n === 1 ? '0.4mm' : '0.25mm', color: n === 1 ? '#000' : '#c4c4c4', lineHeight: box + 'mm' }">
                <template v-if="n === 1 || n <= traceCount + 1">{{ c.ch }}</template>
              </div>
            </div>
            <div v-if="showStrokes" style="margin-top: 1mm; height: 9mm; overflow: hidden"><StrokeOrder :char="c.ch" :max-width-mm="180" @failed="onStrokeFailed" /></div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-kai { font-family: 'KaiTi', 'Kaiti SC', 'STKaiti', '楷体', 'AR PL UKai CN', 'Noto Serif SC', serif; }
</style>
