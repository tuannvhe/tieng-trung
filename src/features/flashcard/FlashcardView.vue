<script setup lang="ts">
import PronounceCheck from '@/components/PronounceCheck.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'
import { useSrs } from '@/composables/useSrs'
import { useDeck } from '@/composables/useDeck'
import { SPEECH_RATES, useSpeech } from '@/composables/useSpeech'
import { GRADE_LABELS, type Grade } from '@/lib/srs'
import { formatInterval } from '@/lib/stats'
import { loadHsk30 } from '@/lib/data'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'
import PinyinText from '@/components/PinyinText.vue'
import ProgressRing from '@/components/ProgressRing.vue'

const settings = useSettingsStore()
const content = useContentStore()
const srs = useSrs()
const { deckOptions, buildDeck } = useDeck()
const { speak } = useSpeech()

const route = useRoute()
const deckKey = ref(typeof route.query.deck === 'string' ? route.query.deck : settings.s.mode === 'it-only' ? 'it:all' : 'hsk:1')
const loading = ref(false)
const editing = ref(false)
const draft = ref({ vi: '', hv: '' })

const options = computed(() =>
  deckOptions.value.map((o) => ({ ...o, group: o.key.startsWith('p0') ? 'Nhập môn' : o.key.startsWith('hsk') ? 'Nền tảng HSK' : 'Tiếng Trung IT' })).map((o) => ({ value: o.key, label: o.label, group: o.group, disabled: o.disabled })),
)

async function load() {
  loading.value = true
  await srs.start(await buildDeck(deckKey.value), settings.s.newCardsPerDay)
  loading.value = false
}
onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
watch(deckKey, load)

const cur = srs.current
const isHsk = computed(() => cur.value?.ref.startsWith('hsk:'))
const hsk30 = ref<Record<string, number>>({})
void loadHsk30().then((m) => (hsk30.value = m)).catch(() => undefined)
const level30 = computed(() => (isHsk.value && cur.value ? hsk30.value[cur.value.hanzi] : undefined))
const total = computed(() => srs.stats.value.due + srs.stats.value.fresh)

function onKey(e: KeyboardEvent) {
  const el = e.target instanceof HTMLElement ? e.target : null
  if (editing.value || el?.matches('input,textarea,select,[role=combobox]')) return
  if (!cur.value) return
  if (e.code === 'Space') {
    e.preventDefault()
    srs.flipped.value = !srs.flipped.value
  } else if (srs.flipped.value && ['1', '2', '3', '4'].includes(e.key)) srs.grade((Number(e.key) - 1) as Grade)
  else if (e.key === 'p') speak(cur.value.hanzi)
  else if (e.key === 's') speak(cur.value.hanzi, SPEECH_RATES.slow)
}

function startEdit() {
  if (!cur.value) return
  draft.value = {
    vi: content.overrides[cur.value.ref]?.meaning_vi ?? (cur.value.vi !== cur.value.en ? cur.value.vi : ''),
    hv: content.overrides[cur.value.ref]?.han_viet ?? cur.value.hanViet ?? '',
  }
  editing.value = true
}
async function saveEdit() {
  if (!cur.value) return
  await content.saveOverride({ key: cur.value.ref, meaning_vi: draft.value.vi, han_viet: draft.value.hv })
  if (draft.value.vi) cur.value.vi = draft.value.vi
  editing.value = false
}
const gradeStyle = [
  'border-seal/50 bg-seal/10 text-seal hover:bg-seal hover:text-white',
  'border-lantern/70 bg-lantern/15 text-ink hover:bg-lantern',
  'border-jade/50 bg-jade/10 text-jade hover:bg-jade hover:text-white',
  'border-sky/50 bg-sky/10 text-sky hover:bg-sky hover:text-white',
]
</script>

<template>
  <div class="grid gap-5 xl:grid-cols-[1fr_22rem]">
    <div class="space-y-4">
      <div v-if="loading" class="surface grid min-h-[28rem] place-items-center text-ink2">Đang chuẩn bị thẻ…</div>

      <div v-else-if="!cur" class="surface grid min-h-[28rem] place-items-center p-10 text-center">
        <div class="space-y-3">
          <span class="seal stamp mx-auto h-20 w-20 text-4xl">完</span>
          <div class="text-2xl font-bold">{{ srs.stats.value.done ? 'Xong phần hôm nay' : 'Chưa có thẻ nào đến hạn' }}</div>
          <p class="mx-auto max-w-sm text-ink2">Chọn bộ thẻ khác, hoặc tăng số thẻ mới mỗi ngày trong Cài đặt.</p>
        </div>
      </div>

      <div v-else :key="cur.ref" class="aurora surface pop relative block min-h-[28rem] w-full overflow-hidden px-5 pb-8 pt-10 text-center md:px-10">
        <span v-if="cur.seal" class="seal absolute right-5 top-5 h-14 w-14 text-lg leading-none" :title="cur.sealLabel">{{ cur.seal }}</span>
        <span v-if="cur.unreviewed" class="badge-unreviewed absolute left-5 top-5">chưa kiểm duyệt</span>

        <div class="han break-words leading-tight" :style="{ fontSize: `clamp(4rem, ${settings.s.zhFontSize * 0.5}vw + 2.5rem, ${settings.s.zhFontSize * 4.4}px)` }">{{ cur.hanzi }}</div>
        <div v-if="cur.hanziTc" class="mt-1 font-han text-ink2">phồn thể {{ cur.hanziTc }}</div>

        <div class="mt-6 flex justify-center gap-2">
          <button type="button" class="btn-ghost" @click="speak(cur.hanzi)"><Icon name="play" :size="16" />Nghe</button>
          <button type="button" class="btn-ghost" @click="speak(cur.hanzi, SPEECH_RATES.slow)"><Icon name="turtle" :size="18" />Nghe chậm</button>
        </div>
        <div class="mx-auto mt-3 max-w-xl"><PronounceCheck :text="cur.hanzi" /></div>

        <div v-if="srs.flipped.value" class="pop mx-auto mt-7 max-w-2xl space-y-2 border-t border-dashed border-line pt-6">
          <div class="text-3xl font-semibold"><PinyinText :text="cur.pinyin" /></div>
          <div class="text-2xl">{{ cur.vi || cur.en }}</div>
          <div v-if="cur.hanViet" class="text-sm text-ink2">Âm Hán Việt: <span class="font-semibold text-ink">{{ cur.hanViet }}</span></div>
          <div v-if="cur.vi && cur.vi !== cur.en" class="text-ink2">{{ cur.en }}</div>
          <div v-if="isHsk" class="text-xs text-ink2" :title="'HSK 2.0 là chuẩn 6 cấp đang dùng phổ biến; HSK 3.0 là chuẩn mới 9 cấp (2021).'">
            HSK 2.0: cấp {{ cur.ref.startsWith('hsk:hsk') ? cur.ref.slice(7, 8) : '' }} · HSK 3.0: {{ level30 ? (level30 === 7 ? 'cấp 7-9' : 'cấp ' + level30) : 'không có trong danh sách' }}
          </div>
          <div v-if="cur.exampleSc" class="glass mx-auto mt-4 p-4 text-left">
            <div class="font-zh text-xl">{{ cur.exampleSc }}</div>
            <div v-if="settings.s.showPinyin"><PinyinText :text="cur.examplePinyin!" /></div>
            <div class="mt-1 text-sm text-ink2">{{ cur.exampleVi }}</div>
          </div>
          <div v-if="isHsk" class="pt-2 text-sm">
            <button v-if="!editing" type="button" class="text-ink2 underline" @click="startEdit">Sửa nghĩa tiếng Việt / âm Hán Việt</button>
            <div v-else class="mx-auto max-w-md space-y-2 text-left">
              <input v-model="draft.vi" placeholder="Nghĩa tiếng Việt" class="field" />
              <input v-model="draft.hv" placeholder="Âm Hán Việt" class="field" />
              <div class="flex gap-2"><button type="button" class="btn-primary" @click="saveEdit">Lưu</button><button type="button" class="btn-ghost" @click="editing = false">Hủy</button></div>
            </div>
          </div>
        </div>
        <div v-else class="mt-8">
          <button type="button" class="btn-primary btn-lg px-12" @click="srs.flipped.value = true">Xem đáp án</button>
          <p class="mt-3 text-sm text-ink2">Nhớ nghĩa trước rồi hãy lật thẻ</p>
        </div>
      </div>

      <div v-if="cur && srs.flipped.value" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button v-for="(label, g) in GRADE_LABELS" :key="g" type="button"
          class="rounded-2xl border-2 py-4 text-center text-lg font-bold transition duration-200 hover:-translate-y-1 active:scale-95" :class="gradeStyle[g]" @click="srs.grade(g as Grade)">
          {{ label }}
          <span class="block text-xs font-medium opacity-80">{{ srs.previews.value[g] != null ? formatInterval(srs.previews.value[g]) : '' }}</span>
        </button>
      </div>
    </div>

    <!-- Bảng bên -->
    <aside class="space-y-4 xl:sticky xl:top-8 xl:self-start">
      <section class="surface space-y-4 p-5">
        <Select v-model="deckKey" :options="options" label="Chọn bộ thẻ" />
        <div class="flex items-center gap-4">
          <ProgressRing :value="srs.stats.value.done" :max="total || 1" :size="84" :label="`Đã ôn ${srs.stats.value.done} trên ${total}`"><span class="text-lg font-bold">{{ srs.stats.value.done }}<span class="text-xs font-normal text-ink2">/{{ total }}</span></span></ProgressRing>
          <dl class="grid flex-1 grid-cols-2 gap-2 text-center text-sm">
            <div class="rounded-xl bg-seal/10 p-2"><dt class="text-xs text-ink2">đến hạn</dt><dd class="text-lg font-bold text-seal tabular-nums">{{ srs.stats.value.due }}</dd></div>
            <div class="rounded-xl bg-sky/10 p-2"><dt class="text-xs text-ink2">thẻ mới</dt><dd class="text-lg font-bold text-sky tabular-nums">{{ srs.stats.value.fresh }}</dd></div>
          </dl>
        </div>
      </section>
      <section class="tile acc-jade hidden xl:block">
        <div class="relative text-sm">
          <div class="mb-2 font-bold">Phím tắt</div>
          <ul class="space-y-1.5 text-ink2">
            <li><kbd class="rounded-md border border-line bg-surface px-1.5">Space</kbd> lật thẻ</li>
            <li><kbd class="rounded-md border border-line bg-surface px-1.5">1</kbd>–<kbd class="rounded-md border border-line bg-surface px-1.5">4</kbd> chấm Quên, Khó, Được, Dễ</li>
            <li><kbd class="rounded-md border border-line bg-surface px-1.5">P</kbd> nghe · <kbd class="rounded-md border border-line bg-surface px-1.5">S</kbd> nghe chậm</li>
          </ul>
        </div>
      </section>
      <section class="tile acc-lantern">
        <p class="relative text-sm"><span class="font-bold">Mẹo:</span> trả lời thành tiếng trước khi lật thẻ. Nhớ ra mới là lúc não ghi lại.</p>
      </section>
    </aside>
  </div>
</template>
