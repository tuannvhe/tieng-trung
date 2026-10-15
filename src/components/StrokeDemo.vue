<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import HanziWriter from 'hanzi-writer'
import Icon from './Icon.vue'

/** Ô tập viết nhỏ: xem thứ tự nét hoặc tự viết có chấm lỗi. Dùng cho bài nét chữ và 30 chữ đầu tiên. */
const props = defineProps<{ char: string; size?: number }>()

const box = ref<HTMLElement>()
const status = ref<'idle' | 'quiz' | 'done'>('idle')
const mistakes = ref(0)
const error = ref(false)
let writer: HanziWriter | null = null

function css(name: string) {
  return `rgb(${getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(' ').join(',')})`
}

function mount() {
  if (!box.value) return
  box.value.innerHTML = ''
  status.value = 'idle'
  error.value = false
  const s = props.size ?? 150
  writer = HanziWriter.create(box.value, props.char, {
    width: s, height: s, padding: 8,
    strokeColor: css('--c-ink'), outlineColor: css('--c-line'), drawingColor: css('--c-seal'), highlightColor: css('--c-jade'),
    showOutline: true, strokeAnimationSpeed: 1.2, delayBetweenStrokes: 220,
    onLoadCharDataError: () => (error.value = true),
  })
}
onMounted(mount)
watch(() => props.char, mount)
onBeforeUnmount(() => writer?.cancelQuiz())

function animate() {
  writer?.cancelQuiz()
  status.value = 'idle'
  writer?.animateCharacter()
}
function quiz() {
  mistakes.value = 0
  status.value = 'quiz'
  writer?.quiz({ onMistake: () => mistakes.value++, onComplete: () => (status.value = 'done') })
}
</script>

<template>
  <div class="inline-flex flex-col items-center gap-2">
    <div class="rounded-xl border border-dashed border-line bg-paper" :style="{ width: (size ?? 150) + 'px', height: (size ?? 150) + 'px', backgroundImage: 'linear-gradient(to right, transparent 49.5%, rgb(var(--c-line)) 50%, transparent 50.5%), linear-gradient(to bottom, transparent 49.5%, rgb(var(--c-line)) 50%, transparent 50.5%)' }">
      <div ref="box" />
    </div>
    <div class="flex gap-2">
      <button type="button" class="btn-ghost !px-3 !py-1.5 !text-xs" @click="animate"><Icon name="play" :size="12" />Xem nét</button>
      <button type="button" class="btn-soft !px-3 !py-1.5 !text-xs" @click="quiz"><Icon name="pen" :size="12" />Tự viết</button>
    </div>
    <p class="min-h-[1.25rem] text-xs" role="status" :class="status === 'done' ? 'font-semibold text-jade' : 'text-ink2'">
      <template v-if="error">Chưa tải được nét, cần kết nối mạng.</template>
      <template v-else-if="status === 'quiz'">Viết từng nét. Sai: {{ mistakes }}</template>
      <template v-else-if="status === 'done'">Xong{{ mistakes ? `, sai ${mistakes} nét` : ', không sai nét nào' }}</template>
    </p>
  </div>
</template>
