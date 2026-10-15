import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ContentOverride, HskWord, ItTerm } from '@/types'
import { loadHsk, loadItTerms } from '@/lib/data'
import { getStorage } from '@/lib/storage'

/** Nội dung HSK/IT gộp với phần người dùng sửa (override). */
export const useContentStore = defineStore('content', () => {
  const overrides = ref<Record<string, ContentOverride>>({})

  async function loadOverrides() {
    const all = await (await getStorage()).allOverrides()
    overrides.value = Object.fromEntries(all.map((o) => [o.key, o]))
  }

  /** Gộp vào override cũ của cùng khóa để sửa nghĩa và kiểm duyệt không đè lên nhau. */
  async function saveOverride(o: Omit<ContentOverride, 'updatedAt'>) {
    const full = { ...overrides.value[o.key], ...o, updatedAt: Date.now() }
    await (await getStorage()).saveOverride(full)
    overrides.value[o.key] = full
  }

  function viMeaning(w: HskWord): string {
    return overrides.value[`hsk:${w.id}`]?.meaning_vi || w.meaning_vi || w.meanings_en[0] || ''
  }
  /** Nghĩa tiếng Việt thuần (đã sửa tay hoặc có trong dữ liệu), rỗng nếu chưa có; không lùi về tiếng Anh. */
  function viOnly(w: HskWord): string {
    return overrides.value[`hsk:${w.id}`]?.meaning_vi || w.meaning_vi || ''
  }
  function isReviewed(t: ItTerm): boolean {
    return overrides.value[`it:${t.id}`]?.reviewed ?? t.reviewed
  }
  /** Trạng thái kiểm duyệt của mọi loại nội dung: override thắng dữ liệu gốc. */
  function isReviewedKey(key: string, original: boolean): boolean {
    return overrides.value[key]?.reviewed ?? original
  }

  return { overrides, loadOverrides, saveOverride, viMeaning, viOnly, isReviewed, isReviewedKey, loadHsk, loadItTerms }
})
