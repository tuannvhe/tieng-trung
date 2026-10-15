import { computed, type Ref } from 'vue'
import { hasToneInfo, numericToMarks, sentenceMatches } from '@/lib/pinyin'

/**
 * Hỗ trợ ô gõ pinyin: hiện ngay dạng có dấu khi người học gõ số thanh ("ni3 hao3" → "nǐ hǎo")
 * và chấm theo mọi cách gõ được chấp nhận (có dấu, số thanh, không dấu).
 */
export function usePinyinInput(raw: Ref<string>) {
  const display = computed(() => numericToMarks(raw.value).replace(/\s+/g, ' ').trim())
  /** Chỉ hiện dòng xem trước khi nó khác thứ người học đã gõ. */
  const showPreview = computed(() => display.value !== '' && display.value !== raw.value.trim() && hasToneInfo(raw.value))
  const check = (expected: string) => raw.value.trim() !== '' && sentenceMatches(raw.value, expected)
  return { display, showPreview, check }
}
