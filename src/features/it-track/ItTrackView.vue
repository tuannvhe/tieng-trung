<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { IT_DOMAINS, IT_DOMAIN_LABELS, IT_DOMAIN_ZH, type ItTerm } from '@/types'
import { useContentStore } from '@/stores/content'
import { useSettingsStore } from '@/stores/settings'
import { useSpeech } from '@/composables/useSpeech'
import PinyinText from '@/components/PinyinText.vue'
import Icon from '@/components/Icon.vue'

const content = useContentStore()
const settings = useSettingsStore()
const { speak } = useSpeech()
const terms = ref<ItTerm[]>([])
const domain = ref<string>('all')
onMounted(async () => (terms.value = await content.loadItTerms()))

const shown = computed(() => terms.value.filter((t) => domain.value === 'all' || t.domain === domain.value))
const count = (d: string) => terms.value.filter((t) => t.domain === d).length
const active = computed(() => IT_DOMAINS.filter((d) => count(d) > 0))
const ACC = ['acc-seal', 'acc-sky', 'acc-jade', 'acc-plum', 'acc-lantern']
const acc = (d: string) => ACC[IT_DOMAINS.indexOf(d as (typeof IT_DOMAINS)[number]) % ACC.length]
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Tiếng Trung IT</h1>
      <p class="text-ink2">{{ terms.length }} thuật ngữ nhà máy. Nhãn "cần HSK n" cho biết cấp HSK cao nhất bạn cần để đọc được từ đó.</p>
    </div>

    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      <button type="button" class="chip shrink-0" :class="domain === 'all' && 'chip-on'" @click="domain = 'all'">Tất cả <b>{{ terms.length }}</b></button>
      <button v-for="d in active" :key="d" type="button" class="chip shrink-0" :class="domain === d && 'chip-on'" @click="domain = d">
        {{ IT_DOMAIN_LABELS[d] }} <b>{{ count(d) }}</b>
      </button>
    </div>

    <ul class="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <li v-for="t in shown" :key="t.id" class="tile flex flex-col" :class="acc(t.domain)">
        <span class="seal absolute right-4 top-4 z-10 h-10 w-10 text-sm leading-none" :title="IT_DOMAIN_LABELS[t.domain]">{{ IT_DOMAIN_ZH[t.domain] }}</span>
        <div class="relative flex items-baseline gap-3 pr-12">
          <span class="han text-4xl" :style="{ fontSize: settings.s.zhFontSize * 1.2 + 'px' }">{{ t.hanzi_sc }}</span>
          <span v-if="t.hanzi_tc && t.hanzi_tc !== t.hanzi_sc" class="font-han text-sm text-ink2">{{ t.hanzi_tc }}</span>
        </div>
        <div v-if="settings.s.showPinyin" class="relative mt-1 text-lg font-medium"><PinyinText :text="t.pinyin" /></div>
        <div class="relative mt-0.5">{{ t.vi }} <span class="text-sm text-ink2">({{ t.en }})</span></div>
        <div class="glass relative mt-4 flex-1 p-3 text-sm">
          <div class="font-zh">{{ t.example_sc }}</div>
          <div v-if="settings.s.showPinyin" class="text-xs"><PinyinText :text="t.example_pinyin" /></div>
          <div class="text-xs text-ink2">{{ t.example_vi }}</div>
        </div>
        <div class="relative mt-3 flex flex-wrap items-center gap-2 text-xs text-ink2">
          <button type="button" class="btn-soft !rounded-full !px-3 !py-1.5 !text-xs" @click="speak(t.example_sc)"><Icon name="play" :size="12" />Nghe câu</button>
          <span v-if="t.hsk_max === 6" class="rounded-md bg-lantern/25 px-1.5 py-0.5 text-ink" title="Có chữ nằm ngoài HSK 1–5">có chữ ngoài HSK</span>
          <span v-else class="rounded-md bg-paper px-1.5 py-0.5">cần HSK {{ t.hsk_max }}</span>
          <span v-if="!content.isReviewed(t)" class="badge-unreviewed">chưa kiểm duyệt</span>
        </div>
      </li>
    </ul>
  </div>
</template>
