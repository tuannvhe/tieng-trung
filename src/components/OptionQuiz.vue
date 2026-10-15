<script setup lang="ts" generic="T extends { options: string[]; answer: number }">
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'

/**
 * Bài trắc nghiệm một lựa chọn dùng chung: mỗi câu hỏi hiện qua slot `prompt`,
 * phản hồi sau khi chọn hiện qua slot `feedback`, nhãn lựa chọn tùy biến qua slot `option`.
 */
const props = defineProps<{ items: T[]; autoplay?: (item: T) => void }>()
const emit = defineEmits<{ done: [correct: number, total: number]; restart: [] }>()

const i = ref(0)
const picked = ref<number | null>(null)
const results = ref<boolean[]>([])
const finished = ref(false)

const cur = computed(() => props.items[i.value])
const answered = computed(() => picked.value !== null)
const correct = computed(() => results.value.filter(Boolean).length)

watch(
  () => props.items,
  () => {
    i.value = 0
    picked.value = null
    results.value = []
    finished.value = false
    if (props.items.length) setTimeout(() => props.autoplay?.(props.items[0]), 200)
  },
  { immediate: true },
)

function choose(n: number) {
  if (answered.value) return
  picked.value = n
  results.value[i.value] = n === cur.value.answer
}
function next() {
  if (i.value >= props.items.length - 1) {
    finished.value = true
    emit('done', correct.value, props.items.length)
    return
  }
  i.value++
  picked.value = null
  setTimeout(() => props.autoplay?.(cur.value), 200)
}
</script>

<template>
  <div v-if="cur && !finished" class="space-y-4">
    <div class="flex items-center justify-between text-sm text-ink2"><span>Câu {{ i + 1 }}/{{ items.length }}</span><span>Đúng {{ correct }}</span></div>
    <div class="h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-seal transition-all duration-500" :style="{ width: (i / items.length) * 100 + '%' }" /></div>
    <div class="py-2 text-center"><slot name="prompt" :item="cur" /></div>
    <div class="grid gap-2" :class="cur.options.length === 2 ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'">
      <button v-for="(o, n) in cur.options" :key="o + n" type="button" :disabled="answered"
        class="rounded-2xl border-2 px-4 py-3.5 text-center text-lg font-semibold transition hover:-translate-y-0.5"
        :class="answered ? (n === cur.answer ? 'border-jade bg-jade/10' : n === picked ? 'shake border-seal bg-seal/10' : 'border-line opacity-60') : 'border-line hover:border-sky'" @click="choose(n)">
        <slot name="option" :opt="o" :index="n">{{ o }}</slot>
      </button>
    </div>
    <div v-if="answered" class="pop space-y-3 border-t border-dashed border-line pt-4 text-center" role="status">
      <p class="font-bold" :class="results[i] ? 'text-jade' : 'text-seal'">{{ results[i] ? 'Chính xác' : 'Chưa đúng' }}</p>
      <slot name="feedback" :item="cur" />
      <button type="button" class="btn-primary" @click="next">{{ i >= items.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo' }}<Icon name="next" :size="16" /></button>
    </div>
  </div>
  <div v-else-if="finished" class="space-y-3 py-6 text-center">
    <span class="seal stamp mx-auto h-16 w-16 text-3xl">{{ correct / items.length >= 0.8 ? '优' : '加' }}</span>
    <div class="text-3xl font-bold tabular-nums">{{ correct }}/{{ items.length }}</div>
    <button type="button" class="btn-primary" @click="emit('restart')">Làm lại</button>
  </div>
</template>
