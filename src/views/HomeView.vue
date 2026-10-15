<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'
import { getStorage } from '@/lib/storage'
import { addDays, localDay } from '@/lib/srs'
import { summarize, weekProgress } from '@/lib/stats'
import { unlockedLevels } from '@/lib/exam'
import { loadDialogues } from '@/lib/data'
import { examplesFor } from '@/lib/examples'
import { useSpeech } from '@/composables/useSpeech'
import type { HskLevel, HskWord } from '@/types'
import PinyinText from '@/components/PinyinText.vue'
import ProgressRing from '@/components/ProgressRing.vue'
import Icon from '@/components/Icon.vue'

interface DayWord { hanzi: string; pinyin: string; vi: string; en: string; level: number; exSc?: string; exPy?: string; exVi?: string }

const settings = useSettingsStore()
const content = useContentStore()
const { speak } = useSpeech()

const word = ref<DayWord>()
const itTotal = ref(0)
const sum = ref({ learned: 0, mature: 0, due: 0, reviewedToday: 0, streak: 0 })
const itLearned = ref(0)
const hskLearned = ref(0)
const studied = ref(new Set<string>())
const maxLevel = ref(1)

onMounted(async () => {
  const storage = await getStorage()
  const today = localDay()
  const [cards, log, exams] = await Promise.all([storage.allCards(), storage.reviewsBetween(addDays(today, -120), today), storage.examResults()])
  sum.value = summarize(cards, log, today)
  studied.value = new Set(log.map((l) => l.day))
  itLearned.value = cards.filter((c) => c.ref.startsWith('it:')).length
  hskLearned.value = cards.filter((c) => c.ref.startsWith('hsk:')).length
  const unlocked = unlockedLevels(exams)
  maxLevel.value = Math.max(...unlocked)
  itTotal.value = (await content.loadItTerms()).length

  // Từ của ngày: cùng một từ cả ngày, chọn trong các cấp HSK đã mở, ưu tiên từ có câu ví dụ trong nhà máy
  const pool: HskWord[] = []
  for (const lv of unlocked as HskLevel[]) pool.push(...(await content.loadHsk(lv)))
  const [y, m, d] = today.split('-').map(Number)
  const start = Math.floor(Date.UTC(y, m - 1, d) / 86400000) % pool.length
  const candidates = Array.from({ length: 40 }, (_, k) => pool[(start + k) % pool.length])
  const ex = examplesFor(candidates.map((w) => w.hanzi), (await loadDialogues()).items)
  const w = candidates.find((c) => ex.has(c.hanzi)) ?? candidates[0]
  const e = ex.get(w.hanzi)
  word.value = { hanzi: w.hanzi, pinyin: w.pinyin, vi: content.viMeaning(w), en: w.meanings_en[0] ?? '', level: w.level, exSc: e?.sc, exPy: e?.py, exVi: e?.vi }
})

const DAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const goalDays = computed(() => Math.min(7, Math.max(1, Math.round(Number(settings.s.weeklyDays) || 5))))
const wk = computed(() => weekProgress(studied.value, localDay(), goalDays.value))
const week = computed(() => {
  const today = localDay()
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6)
    const [y, m, d] = day.split('-').map(Number)
    return { day, label: DAY[new Date(y, m - 1, d).getDay()], on: studied.value.has(day), today: day === today }
  })
})

const hour = new Date().getHours()
const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
const hskTotal = 2491
const cta = computed(() => {
  const n = sum.value.due
  return n > 0 ? `Ôn ${n} thẻ đến hạn` : sum.value.learned ? 'Học thêm thẻ mới' : 'Bắt đầu thẻ đầu tiên'
})
const decor = ['学', '汉', '语', '词', '字', '听']
</script>

<template>
  <div class="grid gap-5 xl:grid-cols-12">
    <!-- Hero -->
    <section class="aurora surface relative overflow-hidden p-6 md:p-10 xl:col-span-8">
      <span v-for="(c, i) in decor" :key="c" class="drift pointer-events-none absolute select-none font-han font-bold text-ink/[.06]" aria-hidden="true"
        :style="{ fontSize: 5 + (i % 3) * 2 + 'rem', left: 8 + i * 16 + '%', top: (i % 2 ? 58 : 6) + '%', animationDelay: i * -2.3 + 's' }">{{ c }}</span>

      <div class="relative">
        <p class="text-sm font-medium text-ink2">{{ greeting }}. Từ HSK hôm nay:</p>

        <div v-if="word" class="mt-4">
          <div class="flex items-start gap-3">
            <div class="ink-in han text-[clamp(4.5rem,13vw,11rem)] leading-none">{{ word.hanzi }}</div>
            <span class="seal mt-2 h-12 w-12 text-sm leading-none">HSK{{ word.level }}</span>
          </div>
          <div class="mt-4 text-3xl font-semibold"><PinyinText :text="word.pinyin" /></div>
          <div class="mt-1 text-xl">{{ word.vi }}</div>
          <div v-if="word.exSc" class="glass mt-5 max-w-xl p-4">
            <div class="mb-1 text-xs font-semibold text-ink2">Ví dụ trong nhà máy</div>
            <div class="font-zh text-lg">{{ word.exSc }}</div>
            <div><PinyinText :text="word.exPy!" /></div>
            <div class="text-sm text-ink2">{{ word.exVi }}</div>
          </div>
        </div>
        <div v-else class="mt-6 h-56" />

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <RouterLink to="/flashcard" class="btn-primary btn-lg">{{ cta }}<Icon name="next" :size="18" /></RouterLink>
          <button v-if="word" type="button" class="btn-ghost btn-lg" @click="speak(word.exSc ?? word.hanzi)"><Icon name="play" :size="16" />{{ word.exSc ? 'Nghe cả câu' : 'Nghe từ' }}</button>
        </div>
      </div>
    </section>

    <!-- Cột phải -->
    <div class="grid content-start gap-5 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
      <section class="tile acc-lantern rise" style="--i: 1">
        <div class="relative flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-medium text-ink2">Chuỗi ngày học</div>
            <div class="mt-1 flex items-baseline gap-2"><span class="text-5xl font-bold tabular-nums">{{ sum.streak }}</span><span class="text-ink2">ngày</span></div>
          </div>
          <span class="tile-ico !h-16 !w-16"><Icon name="flame" :size="34" /></span>
        </div>
        <div class="relative mt-4 grid grid-cols-7 gap-1.5 text-center" aria-label="Bảy ngày gần nhất">
          <div v-for="d in week" :key="d.day">
            <div class="mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition"
              :class="d.on ? 'bg-lantern text-ink shadow-lift' : d.today ? 'border-2 border-dashed border-lantern text-ink2' : 'bg-paper text-ink2'">
              <Icon v-if="d.on" name="check" :size="14" />
            </div>
            <div class="mt-1 text-[11px] text-ink2">{{ d.label }}</div>
          </div>
        </div>
        <p class="relative mt-3 text-sm" :class="wk.reached ? 'font-semibold text-jade' : 'text-ink2'">
          {{ wk.reached ? `Đủ mục tiêu tuần: ${wk.done}/${wk.goal} ngày.` : `Tuần này ${wk.done}/${wk.goal} ngày${wk.needed > wk.remainingDays ? ', khó kịp mục tiêu, thử giảm mục tiêu trong Cài đặt' : `, còn ${wk.needed} ngày nữa là đủ`}.` }}
        </p>
        <p v-if="!sum.reviewedToday" class="relative mt-1 text-sm text-ink2">Ôn một thẻ hôm nay để giữ chuỗi.</p>
      </section>

      <section class="surface grid grid-cols-3 divide-x divide-line text-center rise" style="--i: 2">
        <div class="p-5"><div class="text-3xl font-bold tabular-nums">{{ sum.learned }}</div><div class="text-xs text-ink2">thẻ đã học</div></div>
        <div class="p-5"><div class="text-3xl font-bold tabular-nums text-jade">{{ sum.mature }}</div><div class="text-xs text-ink2">đã thuộc lâu</div></div>
        <div class="p-5"><div class="text-3xl font-bold tabular-nums text-sky">{{ sum.reviewedToday }}</div><div class="text-xs text-ink2">ôn hôm nay</div></div>
      </section>
    </div>

    <RouterLink v-if="sum.learned < 10" to="/start" class="tile acc-jade rise flex flex-wrap items-center gap-4 xl:col-span-12" style="--i: 2">
      <span class="tile-ico !h-14 !w-14"><Icon name="star" :size="28" /></span>
      <span class="relative min-w-0 flex-1"><span class="block text-lg font-bold">Mới bắt đầu? Học Giai đoạn 0 trước</span><span class="block text-sm text-ink2">Pinyin, bốn thanh điệu, thứ tự nét, 30 bộ thủ và 30 chữ đầu tiên, khoảng một tuần là xong.</span></span>
      <span class="btn-primary relative">Bắt đầu</span>
    </RouterLink>

    <!-- Ô tính năng -->
    <section class="grid gap-5 sm:grid-cols-2 xl:col-span-12 xl:grid-cols-4">
      <RouterLink v-if="settings.s.mode === 'full'" to="/flashcard" class="tile acc-sky rise flex items-center gap-4" style="--i: 3">
        <ProgressRing :value="hskLearned" :max="hskTotal" :size="72" />
        <span class="relative"><span class="block text-lg font-bold">Từ vựng HSK 1–5</span><span class="block text-sm text-ink2">Đang mở đến HSK {{ maxLevel }}. Thẻ kèm câu ví dụ.</span></span>
      </RouterLink>
      <RouterLink to="/scenarios" class="tile acc-plum rise flex items-center gap-4" style="--i: 4">
        <span class="tile-ico !h-[72px] !w-[72px] !rounded-full"><Icon name="chat" :size="28" /></span>
        <span class="relative"><span class="block text-lg font-bold">Hội thoại nhà máy</span><span class="block text-sm text-ink2">Hơn 560 đoạn, xếp theo cấp HSK.</span></span>
      </RouterLink>
      <RouterLink to="/practice" class="tile acc-jade rise flex items-center gap-4" style="--i: 5">
        <span class="tile-ico !h-[72px] !w-[72px] !rounded-full"><Icon name="brush" :size="28" /></span>
        <span class="relative"><span class="block text-lg font-bold">Luyện tập</span><span class="block text-sm text-ink2">Viết, nghe gõ, đọc, ngữ pháp, thi thử.</span></span>
      </RouterLink>
      <RouterLink to="/it" class="tile acc-seal rise flex items-center gap-4" style="--i: 6">
        <ProgressRing :value="itLearned" :max="itTotal || 1" :size="72" />
        <span class="relative"><span class="block text-lg font-bold">Tiếng Trung IT</span><span class="block text-sm text-ink2">Thuật ngữ máy tính trong xưởng.</span></span>
      </RouterLink>
    </section>

    <label class="flex items-center gap-2 text-sm text-ink2 xl:col-span-12">
      <input type="checkbox" class="h-4 w-4" :checked="settings.s.mode === 'it-only'"
        @change="settings.s.mode = ($event.target as HTMLInputElement).checked ? 'it-only' : 'full'" />
      Chỉ học tiếng Trung IT, bỏ qua lộ trình HSK
    </label>
  </div>
</template>
