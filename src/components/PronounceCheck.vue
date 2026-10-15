<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRecognition } from '@/composables/useRecognition'
import { scorePronunciation, type CharVerdict, type PronounceResult } from '@/lib/pronounce'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ text: string }>()
const { supported, listening, error, listen, stop } = useRecognition()
const result = ref<PronounceResult | null>(null)
const nothing = ref(false)

watch(() => props.text, () => ((result.value = null), (nothing.value = false)))

async function start() {
  result.value = null
  nothing.value = false
  const heard = await listen()
  result.value = scorePronunciation(props.text, heard)
  nothing.value = !result.value && !error.value
}
const CLS: Record<CharVerdict, string> = {
  ok: 'text-jade',
  tone: 'text-lantern underline decoration-wavy',
  wrong: 'text-seal',
  missing: 'text-ink2 line-through',
}
const HINT: Record<CharVerdict, string> = { ok: 'đúng', tone: 'đúng âm, sai thanh', wrong: 'sai âm', missing: 'chưa nghe thấy' }
</script>

<template>
  <div class="space-y-2">
    <button v-if="supported" type="button" class="btn-ghost" :class="listening && '!border-seal !text-seal'" :aria-pressed="listening" @click="listening ? stop() : start()">
      <Icon name="mic" :size="16" />{{ listening ? 'Đang nghe… bấm để dừng' : 'Đọc thử' }}
    </button>
    <p v-else class="text-sm text-ink2">Trình duyệt này không hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome hoặc Edge.</p>

    <p v-if="error" class="text-sm text-seal" role="alert">{{ error }}</p>
    <p v-else-if="nothing" class="text-sm text-ink2" role="status">Không nhận ra tiếng Trung nào. Thử đọc to và rõ hơn.</p>
    <div v-if="result" class="pop space-y-1" role="status">
      <div class="font-zh text-2xl leading-snug">
        <span v-for="(c, i) in result.chars" :key="i" :class="CLS[c.verdict]" :title="HINT[c.verdict] + (c.heard ? `, nghe được ${c.heard}` : '')">{{ c.ch }}</span>
      </div>
      <div class="text-sm"><b>{{ result.percent }}%</b> khớp. Máy nghe được: <span class="font-zh">{{ result.heard || '(trống)' }}</span></div>
      <div class="text-xs text-ink2">Xanh lục: đúng · vàng gạch sóng: đúng âm nhưng sai thanh · đỏ: sai âm · xám gạch ngang: chưa nghe thấy. Đây là máy nhận dạng, không phải giáo viên: máy hay đoán đúng từ ngữ cảnh nên điểm có thể cao hơn thực tế. Hãy so với bản đọc mẫu.</div>
    </div>
  </div>
</template>
