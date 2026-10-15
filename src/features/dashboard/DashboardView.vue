<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { Bar } from 'vue-chartjs'
import { IT_DOMAINS, IT_DOMAIN_LABELS, type HskLevel } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'
import { getStorage, type CardState } from '@/lib/storage'
import { addDays, localDay } from '@/lib/srs'
import { dailyCounts, estimateGoal, groupProgress, newCardsPerDayRate, summarize } from '@/lib/stats'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'
import ProgressRing from '@/components/ProgressRing.vue'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const settings = useSettingsStore()
const content = useContentStore()

const cards = ref<CardState[]>([])
const log = ref<Awaited<ReturnType<Awaited<ReturnType<typeof getStorage>>['reviewsBetween']>>>([])
const groupOfRef = ref(new Map<string, string>())
const totals = ref<Record<string, number>>({})
const ready = ref(false)
const themeTick = ref(0)
const today = localDay()
let observer: MutationObserver | undefined

onMounted(async () => {
  const storage = await getStorage()
  cards.value = await storage.allCards()
  log.value = await storage.reviewsBetween(addDays(today, -120), today)

  const map = new Map<string, string>()
  const tot: Record<string, number> = {}
  for (const lv of [1, 2, 3, 4, 5, 6] as HskLevel[]) {
    const words = await content.loadHsk(lv)
    tot[`HSK ${lv}`] = words.length
    for (const w of words) map.set(`hsk:${w.id}`, `HSK ${lv}`)
  }
  for (const t of await content.loadItTerms()) {
    const g = IT_DOMAIN_LABELS[t.domain]
    map.set(`it:${t.id}`, g)
    tot[g] = (tot[g] ?? 0) + 1
  }
  groupOfRef.value = map
  totals.value = tot
  ready.value = true

  // Vẽ lại biểu đồ khi đổi sáng/tối
  observer = new MutationObserver(() => themeTick.value++)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => observer?.disconnect())

const sum = computed(() => summarize(cards.value, log.value, today))
const groups = computed(() => groupProgress(cards.value, (r) => groupOfRef.value.get(r)))

// --- Mục tiêu ---
const goalOptions = computed(() => [
  { value: 'it:all', label: 'Học hết thuật ngữ IT', group: 'Tiếng Trung IT' },
  ...(settings.s.mode === 'full'
    ? [1, 2, 3, 4, 5, 6].map((l) => ({ value: `hsk:${l}`, label: `Học hết HSK ${l}`, group: 'Nền tảng HSK' }))
    : []),
])
const goalRefs = (g: string) => {
  const [kind, arg] = g.split(':')
  const prefix = kind === 'it' ? 'it:' : `hsk:hsk${arg}-`
  return { prefix, total: kind === 'it' ? [...groupOfRef.value.keys()].filter((r) => r.startsWith('it:')).length : (totals.value[`HSK ${arg}`] ?? 0) }
}
const goal = computed(() => {
  const g = goalRefs(settings.s.goal)
  const learned = cards.value.filter((c) => c.ref.startsWith(g.prefix)).length
  const rate = newCardsPerDayRate(cards.value, today)
  return {
    total: g.total,
    learned,
    rate,
    current: estimateGoal(g.total, learned, rate, today),
    planned: estimateGoal(g.total, learned, settings.s.newCardsPerDay, today),
  }
})
const fmtDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '')

// --- Biểu đồ ---
function css(name: string, alpha = 1) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(' ').join(',')
  return `rgb(${v} / ${alpha})`.replace(/,/g, ' ')
}
const baseScales = (stacked = false, horizontal = false) => {
  void themeTick.value
  const grid = { color: css('--c-line', 0.7) }
  const ticks = { color: css('--c-ink2') }
  return {
    x: { stacked, grid: horizontal ? grid : { display: false }, ticks: { ...ticks, maxRotation: 0, autoSkip: true } },
    y: { stacked, beginAtZero: true, grid: horizontal ? { display: false } : grid, ticks: { ...ticks, precision: 0 } },
  }
}

const days = computed(() => dailyCounts(log.value, today, 30))
const reviewChart = computed(() => {
  void themeTick.value
  return {
    data: {
      labels: days.value.map((d) => d.day.slice(8) + '/' + d.day.slice(5, 7)),
      datasets: [{ label: 'Lượt ôn', data: days.value.map((d) => d.count), backgroundColor: css('--c-seal', 0.85), borderRadius: 6, maxBarThickness: 18 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: baseScales() },
  }
})

function stackedChart(names: string[]) {
  void themeTick.value
  const g = (n: string) => groups.value[n] ?? { learned: 0, mature: 0 }
  return {
    data: {
      labels: names,
      datasets: [
        { label: 'Đã thuộc', data: names.map((n) => g(n).mature), backgroundColor: css('--c-jade', 0.9), borderRadius: 4 },
        { label: 'Đang học', data: names.map((n) => g(n).learned - g(n).mature), backgroundColor: css('--c-sky', 0.85), borderRadius: 4 },
        { label: 'Chưa học', data: names.map((n) => Math.max(0, (totals.value[n] ?? 0) - g(n).learned)), backgroundColor: css('--c-line', 1), borderRadius: 4 },
      ],
    },
    options: {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' as const, labels: { color: css('--c-ink2'), usePointStyle: true, boxWidth: 8 } } },
      scales: baseScales(true, true),
    },
  }
}
const hskNames = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5']
const hskChart = computed(() => stackedChart(hskNames))
const itNames = computed(() => IT_DOMAINS.filter((d) => totals.value[IT_DOMAIN_LABELS[d]]).map((d) => IT_DOMAIN_LABELS[d]))
const itChart = computed(() => stackedChart(itNames.value))
const hasHistory = computed(() => days.value.some((d) => d.count > 0))
const monthTotal = computed(() => days.value.reduce((n, d) => n + d.count, 0))
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Tiến độ</h1>
      <p class="text-ink2">Nhìn lại những gì bạn đã học và biết khi nào chạm mục tiêu.</p>
    </div>

    <section class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <div class="tile acc-lantern"><div class="relative flex items-center justify-between"><div><div class="text-sm text-ink2">Chuỗi ngày học</div><div class="text-4xl font-bold tabular-nums">{{ sum.streak }}</div></div><span class="tile-ico"><Icon name="flame" :size="26" /></span></div></div>
      <div class="tile acc-sky"><div class="relative flex items-center justify-between"><div><div class="text-sm text-ink2">Thẻ đã học</div><div class="text-4xl font-bold tabular-nums">{{ sum.learned }}</div></div><span class="tile-ico"><Icon name="cards" :size="26" /></span></div></div>
      <div class="tile acc-jade"><div class="relative flex items-center justify-between"><div><div class="text-sm text-ink2">Đã thuộc lâu</div><div class="text-4xl font-bold tabular-nums">{{ sum.mature }}</div></div><span class="tile-ico"><Icon name="check" :size="26" /></span></div></div>
      <div class="tile acc-seal"><div class="relative flex items-center justify-between"><div><div class="text-sm text-ink2">Đến hạn hôm nay</div><div class="text-4xl font-bold tabular-nums">{{ sum.due }}</div></div><span class="tile-ico"><Icon name="clock" :size="26" /></span></div></div>
    </section>

    <div class="grid gap-5 xl:grid-cols-3">
      <section class="surface p-5 xl:col-span-2">
        <div class="mb-3 flex items-baseline justify-between"><h2 class="text-lg font-bold">Lượt ôn 30 ngày qua</h2><span class="text-sm text-ink2">{{ monthTotal }} lượt</span></div>
        <div class="h-64" role="img" :aria-label="`Biểu đồ cột số lượt ôn mỗi ngày trong 30 ngày qua, tổng ${monthTotal} lượt`">
          <Bar v-if="ready" :key="themeTick" :data="reviewChart.data" :options="reviewChart.options" />
        </div>
        <p v-if="ready && !hasHistory" class="mt-2 text-sm text-ink2">Chưa có lượt ôn nào. Ôn vài thẻ, biểu đồ sẽ bắt đầu hiện.</p>
      </section>

      <section class="tile acc-plum space-y-4">
        <h2 class="relative text-lg font-bold">Mục tiêu và ngày dự kiến</h2>
        <Select class="relative" :model-value="settings.s.goal" :options="goalOptions" label="Chọn mục tiêu" @update:model-value="settings.s.goal = $event" />
        <div class="relative flex items-center gap-4">
          <ProgressRing :value="goal.learned" :max="goal.total || 1" :size="88" :label="`Đã học ${goal.learned} trên ${goal.total}`"><span class="text-base font-bold">{{ goal.total ? Math.round((goal.learned / goal.total) * 100) : 0 }}%</span></ProgressRing>
          <div class="text-sm"><div class="text-lg font-bold tabular-nums">{{ goal.learned }}/{{ goal.total }} thẻ</div><div class="text-ink2">còn {{ goal.current.remaining }} thẻ mới</div></div>
        </div>
        <div v-if="goal.current.done" class="relative rounded-2xl bg-jade/15 p-3 font-semibold text-jade">Bạn đã học hết mục tiêu này.</div>
        <dl v-else class="relative space-y-2 text-sm">
          <div class="rounded-2xl bg-surface/70 p-3">
            <dt class="text-ink2">Theo nhịp 14 ngày qua ({{ goal.rate.toFixed(1) }} thẻ mới/ngày)</dt>
            <dd class="font-bold">{{ goal.current.date ? `${fmtDate(goal.current.date)} (khoảng ${goal.current.days} ngày)` : 'Chưa đủ dữ liệu để ước tính' }}</dd>
          </div>
          <div class="rounded-2xl bg-surface/70 p-3">
            <dt class="text-ink2">Nếu học đủ {{ settings.s.newCardsPerDay }} thẻ mới mỗi ngày</dt>
            <dd class="font-bold">{{ goal.planned.date ? `${fmtDate(goal.planned.date)} (khoảng ${goal.planned.days} ngày)` : 'Hãy đặt số thẻ mới mỗi ngày trong Cài đặt' }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <div class="grid gap-5 xl:grid-cols-2">
      <section v-if="settings.s.mode === 'full'" class="surface p-5">
        <h2 class="mb-3 text-lg font-bold">Số từ đã thuộc theo cấp HSK</h2>
        <div class="h-64" role="img" aria-label="Biểu đồ thanh ngang tiến độ từng cấp HSK: đã thuộc, đang học, chưa học"><Bar v-if="ready" :key="themeTick" :data="hskChart.data" :options="hskChart.options" /></div>
        <ul class="mt-3 grid grid-cols-5 gap-2 text-center text-xs text-ink2"><li v-for="n in hskNames" :key="n"><b class="block text-sm text-ink tabular-nums">{{ groups[n]?.mature ?? 0 }}/{{ totals[n] ?? 0 }}</b>{{ n }}</li></ul>
      </section>
      <section class="surface p-5" :class="settings.s.mode !== 'full' && 'xl:col-span-2'">
        <h2 class="mb-3 text-lg font-bold">Số thuật ngữ đã thuộc theo nhóm IT</h2>
        <div class="h-64" role="img" aria-label="Biểu đồ thanh ngang tiến độ từng nhóm thuật ngữ IT: đã thuộc, đang học, chưa học"><Bar v-if="ready" :key="themeTick" :data="itChart.data" :options="itChart.options" /></div>
        <ul class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink2 sm:grid-cols-3"><li v-for="n in itNames" :key="n" class="flex justify-between"><span class="truncate">{{ n }}</span><b class="text-ink tabular-nums">{{ groups[n]?.mature ?? 0 }}/{{ totals[n] ?? 0 }}</b></li></ul>
      </section>
    </div>
    <p class="text-xs text-ink2">"Đã thuộc" nghĩa là khoảng ôn kế tiếp từ 21 ngày trở lên. "Đang học" là thẻ đã bắt đầu học nhưng chưa tới mức đó.</p>
  </div>
</template>
