<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IT_DOMAIN_LABELS } from '@/types'
import { useContentStore } from '@/stores/content'
import { buildIndex, search, type SearchEntry } from '@/lib/search'
import { useSpeech } from '@/composables/useSpeech'
import PinyinText from '@/components/PinyinText.vue'
import Icon from '@/components/Icon.vue'

const content = useContentStore()
const { speak } = useSpeech()
const q = ref('')
const index = ref<ReturnType<typeof buildIndex>>([])
const ready = ref(false)
const input = ref<HTMLInputElement>()

onMounted(async () => {
  input.value?.focus()
  const entries: SearchEntry[] = []
  for (const t of await content.loadItTerms()) {
    entries.push({ kind: 'it', id: t.id, hanzi: t.hanzi_sc, traditional: t.hanzi_tc, pinyin: t.pinyin, vi: t.vi, en: t.en, tag: IT_DOMAIN_LABELS[t.domain] })
  }
  for (const lv of [1, 2, 3, 4, 5, 6] as const) {
    for (const w of await content.loadHsk(lv)) {
      entries.push({
        kind: 'hsk', id: w.id, hanzi: w.hanzi, traditional: w.traditional !== w.hanzi ? w.traditional : undefined,
        pinyin: w.pinyin, vi: content.viMeaning(w) === w.meanings_en[0] ? '' : content.viMeaning(w),
        en: w.meanings_en.slice(0, 3).join('; '), tag: `HSK ${lv}`,
      })
    }
  }
  index.value = buildIndex(entries)
  ready.value = true
})

const results = computed(() => search(index.value, q.value))
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-3xl font-bold">Tra cứu</h1>
    <div class="relative">
      <Icon name="search" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink2" />
      <input ref="input" v-model="q" type="search" autocomplete="off" aria-label="Tìm từ"
        placeholder="Chữ Hán, pinyin không dấu, tiếng Việt hoặc tiếng Anh"
        class="field !py-4 !pl-12 text-lg shadow-lift" />
    </div>

    <p v-if="!ready" class="text-sm text-ink2">Đang nạp từ điển…</p>
    <p v-else-if="!q.trim()" class="text-sm text-ink2">Thử gõ <button type="button" class="underline" @click="q = 'may chu'">may chu</button>, <button type="button" class="underline" @click="q = 'RFID'">RFID</button> hoặc <button type="button" class="underline" @click="q = '伺服器'">伺服器</button>.</p>
    <p v-else-if="!results.length" class="text-ink2">Không có kết quả cho "{{ q }}". Thử gõ pinyin không dấu hoặc từ khóa ngắn hơn.</p>

    <ul class="grid gap-4 xl:grid-cols-2">
      <li v-for="r in results" :key="r.kind + r.id" class="tile flex items-start gap-4" :class="r.kind === 'it' ? 'acc-seal' : 'acc-sky'">
        <div class="relative w-28 shrink-0">
          <div class="han text-2xl leading-tight">{{ r.hanzi }}</div>
          <div v-if="r.traditional" class="font-han text-xs text-ink2">phồn {{ r.traditional }}</div>
        </div>
        <div class="relative min-w-0 flex-1">
          <div class="font-medium"><PinyinText :text="r.pinyin" /></div>
          <div v-if="r.vi">{{ r.vi }}</div>
          <div class="truncate text-sm text-ink2">{{ r.en }}</div>
          <span class="mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium" :class="r.kind === 'it' ? 'bg-seal/10 text-seal' : 'bg-paper text-ink2'">{{ r.tag }}</span>
        </div>
        <button type="button" class="btn-ghost btn-icon relative h-10 w-10 shrink-0" aria-label="Nghe" @click="speak(r.hanzi)"><Icon name="play" :size="14" /></button>
      </li>
    </ul>
  </div>
</template>
