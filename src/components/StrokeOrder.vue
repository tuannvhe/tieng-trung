<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import HanziWriter from 'hanzi-writer'

/**
 * Dải thứ tự nét của một chữ: ô thứ k vẽ k nét đầu, nét mới nhất đậm, các nét trước xám.
 * Màu cố định (không theo giao diện sáng/tối) vì dùng cho bản in.
 */
const props = defineProps<{ char: string; maxWidthMm?: number }>()
const emit = defineEmits<{ failed: [char: string] }>()

const cache = new Map<string, string[] | null>()
const strokes = ref<string[]>([])
const state = ref<'loading' | 'ok' | 'error'>('loading')

async function load() {
  state.value = 'loading'
  const ch = props.char
  if (!cache.has(ch)) {
    try {
      const data = await HanziWriter.loadCharacterData(ch)
      cache.set(ch, data?.strokes ?? null)
    } catch {
      cache.set(ch, null)
    }
  }
  const s = cache.get(ch)
  if (ch !== props.char) return
  if (s) {
    strokes.value = s
    state.value = 'ok'
  } else {
    state.value = 'error'
    emit('failed', ch)
  }
}
onMounted(load)
watch(() => props.char, load)

const sizeMm = () => Math.min(9, (props.maxWidthMm ?? 180) / Math.max(1, strokes.value.length))
</script>

<template>
  <div class="flex items-center gap-[1mm]" :aria-label="`Thứ tự nét của chữ ${char}`">
    <template v-if="state === 'ok'">
      <svg v-for="(_, k) in strokes" :key="k" viewBox="0 0 1024 1024" :style="{ width: sizeMm() + 'mm', height: sizeMm() + 'mm' }" class="shrink-0 border border-[#d6d6d6]">
        <g transform="scale(1, -1) translate(0, -900)">
          <path v-for="(d, j) in strokes.slice(0, k + 1)" :key="j" :d="d" :fill="j === k ? '#111' : '#a8a8a8'" />
        </g>
      </svg>
    </template>
    <span v-else-if="state === 'loading'" class="text-[8pt] text-[#888]">đang tải nét…</span>
    <span v-else class="text-[8pt] text-[#888]">chưa có dữ liệu nét</span>
  </div>
</template>
