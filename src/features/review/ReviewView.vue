<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { GrammarPoint, MessageTemplate, ReadingPassage } from '@/types'
import { useContentStore } from '@/stores/content'
import { loadDialogues } from '@/lib/data'
import { REVIEW_LABELS, collectReviewItems, exportUnreviewedCsv, parseReviewCsv, stateOf, type ReviewItem, type ReviewType } from '@/lib/review'
import { downloadText } from '@/lib/download'
import { localDay } from '@/lib/srs'
import { foldVi } from '@/lib/search'
import Icon from '@/components/Icon.vue'

const PAGE = 20
const content = useContentStore()

const items = ref<ReviewItem[]>([])
const tab = ref<ReviewType | 'all'>('all')
const onlyOpen = ref(true)
const query = ref('')
const limit = ref(PAGE)
const msg = ref('')
const ready = ref(false)
const drafts = ref<Record<string, string>>({})

onMounted(async () => {
  const [terms, dialogues, readings, gHsk, gOffice, templates] = await Promise.all([
    content.loadItTerms(),
    loadDialogues().then((d) => d.items),
    import('@/data/it/reading.json').then((m) => m.default as ReadingPassage[]),
    import('@/data/grammar-hsk.json').then((m) => m.default as GrammarPoint[]),
    import('@/data/it/grammar.json').then((m) => m.default as GrammarPoint[]),
    import('@/data/it/templates.json').then((m) => m.default as MessageTemplate[]),
  ])
  items.value = collectReviewItems({ terms, dialogues, readings, grammar: [...gHsk, ...gOffice], templates })
  ready.value = true
})
watch([tab, onlyOpen, query], () => (limit.value = PAGE))

const state = (i: ReviewItem) => stateOf(i, content.overrides)
const typeItems = (t: ReviewType | 'all') => items.value.filter((i) => t === 'all' || i.type === t)
const openCount = (t: ReviewType | 'all') => typeItems(t).filter((i) => !state(i).reviewed).length
const total = computed(() => items.value.length)
const doneTotal = computed(() => total.value - openCount('all'))
const percent = computed(() => (total.value ? Math.round((doneTotal.value / total.value) * 100) : 0))

const filtered = computed(() => {
  const q = query.value.trim()
  const fq = foldVi(q)
  return typeItems(tab.value)
    .filter((i) => !onlyOpen.value || !state(i).reviewed)
    .filter((i) => !q || i.zh.includes(q) || i.py.toLowerCase().includes(q.toLowerCase()) || foldVi(i.vi).includes(fq) || i.id.includes(q))
})
const shown = computed(() => filtered.value.slice(0, limit.value))

async function setReviewed(i: ReviewItem, reviewed: boolean) {
  await content.saveOverride({ key: i.key, reviewed })
}
async function saveNote(i: ReviewItem) {
  const note = (drafts.value[i.key] ?? state(i).note).trim()
  if (note === state(i).note) return
  await content.saveOverride({ key: i.key, note })
  msg.value = 'Đã lưu ghi chú.'
}
const noteValue = (i: ReviewItem) => drafts.value[i.key] ?? state(i).note

function exportCsv(only?: ReviewType) {
  const csv = exportUnreviewedCsv(items.value, content.overrides, only)
  const n = csv.split('\r\n').length - 2
  downloadText(`chua-kiem-duyet-${only ?? 'tat-ca'}-${localDay()}.csv`, csv)
  msg.value = `Đã xuất ${n} mục chưa kiểm duyệt. Gửi file này cho đồng nghiệp người Trung điền cột "đã kiểm duyệt" và "ghi chú sửa", rồi nhập lại ở đây.`
}

async function importCsv(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    const { updates, skipped } = parseReviewCsv(await file.text(), new Set(items.value.map((i) => i.key)))
    for (const u of updates) await content.saveOverride({ key: u.key, reviewed: u.reviewed, ...(u.note ? { note: u.note } : {}) })
    msg.value = `Đã nhập ${updates.length} mục (${updates.filter((u) => u.reviewed).length} đã kiểm duyệt)${skipped ? `, bỏ qua ${skipped} dòng không nhận ra` : ''}.`
  } catch (err) {
    msg.value = 'Không nhập được: ' + (err as Error).message
  }
}
const tabs = computed(() => [{ v: 'all' as const, l: 'Tất cả' }, ...(Object.keys(REVIEW_LABELS) as ReviewType[]).map((v) => ({ v, l: REVIEW_LABELS[v] }))])
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Kiểm duyệt nội dung</h1>
      <p class="text-ink2">Thuật ngữ, hội thoại, bài đọc, ngữ pháp và mẫu tin nhắn do AI soạn nên cần người Trung xác nhận. Xuất danh sách chưa kiểm duyệt, nhờ đồng nghiệp điền, rồi nhập lại.</p>
    </div>

    <section class="surface space-y-3 p-5">
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span class="font-semibold">Đã kiểm duyệt {{ doneTotal }}/{{ total }} mục</span><span class="tabular-nums text-ink2">{{ percent }}%</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-line" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100"><div class="h-full rounded-full bg-jade transition-all duration-500" :style="{ width: percent + '%' }" /></div>
      <div class="flex flex-wrap gap-2 pt-1">
        <button type="button" class="btn-primary" :disabled="!ready" @click="exportCsv()"><Icon name="download" :size="16" />Xuất CSV chưa kiểm duyệt ({{ openCount('all') }})</button>
        <button v-if="tab !== 'all'" type="button" class="btn-ghost" @click="exportCsv(tab)">Chỉ mục {{ REVIEW_LABELS[tab].toLowerCase() }} ({{ openCount(tab) }})</button>
        <label class="btn-ghost cursor-pointer">Nhập CSV đã điền<input type="file" accept=".csv,text/csv" class="sr-only" @change="importCsv" /></label>
      </div>
      <p v-if="msg" class="text-sm text-jade" role="status">{{ msg }}</p>
    </section>

    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      <button v-for="t in tabs" :key="t.v" type="button" class="chip shrink-0" :class="tab === t.v && 'chip-on'" @click="tab = t.v">{{ t.l }} <b>{{ openCount(t.v) }}</b></button>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-[16rem] flex-1 md:max-w-md">
        <Icon name="search" :size="18" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink2" />
        <input v-model="query" type="search" class="field !pl-11" placeholder="Tìm trong danh sách" aria-label="Tìm trong danh sách" />
      </div>
      <label class="inline-flex items-center gap-2 text-sm"><input v-model="onlyOpen" type="checkbox" class="h-4 w-4" />Chỉ hiện mục chưa kiểm duyệt</label>
      <span class="text-sm text-ink2">{{ filtered.length }} mục</span>
    </div>

    <p v-if="ready && !filtered.length" class="surface p-8 text-center text-ink2">{{ onlyOpen ? 'Không còn mục nào chưa kiểm duyệt ở đây.' : 'Không có mục nào khớp.' }}</p>
    <ul class="grid gap-4 xl:grid-cols-2">
      <li v-for="i in shown" :key="i.key" class="surface flex flex-col gap-3 p-5" :class="state(i).reviewed && 'opacity-80'">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 text-xs text-ink2"><span class="rounded-md bg-paper px-1.5 py-0.5 font-semibold">{{ REVIEW_LABELS[i.type] }}</span><span>{{ i.id }}</span></div>
            <div class="mt-1 font-bold">{{ i.title }}</div>
          </div>
          <label class="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition" :class="state(i).reviewed ? 'border-jade bg-jade/10 text-jade' : 'border-line text-ink2'">
            <input type="checkbox" class="h-4 w-4" :checked="state(i).reviewed" @change="setReviewed(i, ($event.target as HTMLInputElement).checked)" />Đã kiểm duyệt
          </label>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper p-3 font-zh text-sm leading-relaxed">{{ i.zh }}</div>
          <div class="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper p-3 text-sm leading-relaxed text-ink2">{{ i.py ? i.py + '\n\n' : '' }}{{ i.vi }}</div>
        </div>
        <textarea :value="noteValue(i)" rows="2" class="field !py-2 text-sm" placeholder="Ghi chú sửa: ví dụ đổi 伺服器 thành 服务器, thanh sai ở chữ…" :aria-label="`Ghi chú cho ${i.title}`"
          @input="drafts[i.key] = ($event.target as HTMLTextAreaElement).value" @blur="saveNote(i)" />
      </li>
    </ul>
    <div v-if="filtered.length > limit" class="text-center"><button type="button" class="btn-ghost btn-lg" @click="limit += PAGE">Xem thêm {{ Math.min(PAGE, filtered.length - limit) }} mục</button></div>
  </div>
</template>
