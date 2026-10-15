<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { SortExercise } from '@/types'
import { isCorrectOrder, shuffleTokens } from '@/lib/grammar'
import { useSpeech } from '@/composables/useSpeech'
import PinyinText from './PinyinText.vue'
import Icon from './Icon.vue'

interface Chip { k: number; t: string }

const props = defineProps<{ exercise: SortExercise }>()
/** Báo kết quả một lần: đúng ngay lần đầu hay không (xem đáp án cũng tính là chưa đúng). */
const emit = defineEmits<{ done: [firstTry: boolean] }>()

const { speak } = useSpeech()
const bank = ref<Chip[]>([])
const answer = ref<Chip[]>([])
const status = ref<'idle' | 'wrong' | 'right' | 'revealed'>('idle')
const tries = ref(0)

function reset() {
  const t = props.exercise.tokens
  bank.value = shuffleTokens(t.map((_, k) => String(k))).map((k) => ({ k: Number(k), t: t[Number(k)] }))
  answer.value = []
  status.value = 'idle'
  tries.value = 0
}
watch(() => props.exercise, reset, { immediate: true })

const finished = computed(() => status.value === 'right' || status.value === 'revealed')
const sentence = computed(() => props.exercise.tokens.join(''))

function toAnswer(c: Chip) {
  if (finished.value) return
  bank.value = bank.value.filter((x) => x.k !== c.k)
  answer.value.push(c)
  status.value = 'idle'
}
function toBank(c: Chip) {
  if (finished.value) return
  answer.value = answer.value.filter((x) => x.k !== c.k)
  bank.value.push(c)
  status.value = 'idle'
}
function clear() {
  if (finished.value) return
  bank.value.push(...answer.value)
  answer.value = []
  status.value = 'idle'
}
function check() {
  if (isCorrectOrder(answer.value.map((c) => c.t), props.exercise.tokens)) {
    status.value = 'right'
    emit('done', tries.value === 0)
    return
  }
  tries.value++
  status.value = 'wrong'
  setTimeout(() => status.value === 'wrong' && (status.value = 'idle'), 600)
}
function reveal() {
  const t = props.exercise.tokens
  answer.value = t.map((x, k) => ({ k, t: x }))
  bank.value = []
  status.value = 'revealed'
  emit('done', false)
}
</script>

<template>
  <div class="space-y-4">
    <p class="rounded-2xl bg-sky/10 p-3 text-sm"><span class="font-semibold text-sky">Sắp xếp thành câu:</span> {{ exercise.vi }}</p>

    <div>
      <div class="mb-1.5 text-xs font-semibold text-ink2">Câu của bạn (kéo hoặc bấm để thêm, bấm để bỏ ra)</div>
      <VueDraggable v-model="answer" group="sort" :animation="160" :disabled="finished" ghost-class="opacity-40"
        class="flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors"
        :class="[status === 'wrong' && 'shake border-seal bg-seal/5', finished ? 'border-jade bg-jade/5' : 'border-line bg-paper/60']">
        <button v-for="c in answer" :key="c.k" type="button" class="chip-token" :class="finished && '!cursor-default'" @click="toBank(c)">{{ c.t }}</button>
        <span v-if="!answer.length" class="text-sm text-ink2">Chưa có mảnh nào</span>
      </VueDraggable>
    </div>

    <div>
      <div class="mb-1.5 text-xs font-semibold text-ink2">Các mảnh còn lại</div>
      <VueDraggable v-model="bank" group="sort" :animation="160" :disabled="finished" ghost-class="opacity-40"
        class="flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
        <button v-for="c in bank" :key="c.k" type="button" class="chip-token" @click="toAnswer(c)">{{ c.t }}</button>
        <span v-if="!bank.length" class="text-sm text-ink2">Đã dùng hết</span>
      </VueDraggable>
    </div>

    <div v-if="!finished" class="flex flex-wrap gap-2">
      <button type="button" class="btn-primary" :disabled="bank.length > 0" @click="check">Kiểm tra</button>
      <button type="button" class="btn-ghost" :disabled="!answer.length" @click="clear">Xóa hết</button>
      <button v-if="tries >= 2" type="button" class="btn-ghost" @click="reveal">Xem đáp án</button>
    </div>
    <p v-if="status === 'wrong'" class="text-sm text-seal" role="alert">Chưa đúng. Đọc lại nghĩa tiếng Việt và thử sắp xếp lại.</p>

    <div v-if="finished" class="pop space-y-1 rounded-2xl border border-jade/40 bg-jade/10 p-4" role="status">
      <p class="font-bold text-jade">{{ status === 'right' ? 'Chính xác' : 'Đáp án' }}</p>
      <div class="font-zh text-2xl">{{ sentence }}</div>
      <div><PinyinText :text="exercise.py" /></div>
      <button type="button" class="btn-soft mt-2 !py-1.5" @click="speak(sentence)"><Icon name="play" :size="14" />Nghe</button>
    </div>
  </div>
</template>

<style scoped>
.chip-token {
  cursor: grab;
  border-radius: 0.9rem;
  border: 1px solid rgb(var(--c-line));
  background: rgb(var(--c-surface));
  padding: 0.55rem 0.95rem;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 1.25rem;
  box-shadow: 0 2px 6px -2px rgb(var(--c-ink) / 0.25);
  transition: transform 0.15s, border-color 0.15s;
}
.chip-token:hover { transform: translateY(-2px); border-color: rgb(var(--c-sky)); }
.chip-token:active { cursor: grabbing; }
</style>
