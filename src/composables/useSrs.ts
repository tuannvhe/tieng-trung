import { computed, ref, watch } from 'vue'
import { getStorage, type CardState } from '@/lib/storage'
import { buildQueue, localDay, newCard, review, type Grade } from '@/lib/srs'

/** Một mục hiển thị trên thẻ, đã gộp HSK/IT về cùng dạng. */
export interface DeckItem {
  ref: string // 'hsk:<id>' | 'it:<id>'
  hanzi: string
  hanziTc?: string
  pinyin: string
  vi: string
  /** Âm Hán Việt (nếu có) */
  hanViet?: string
  en: string
  exampleSc?: string
  examplePinyin?: string
  exampleVi?: string
  unreviewed?: boolean
  /** Chữ trên con dấu (一级, 设备...) và nhãn đọc được */
  seal?: string
  sealLabel?: string
}

/** Phiên ôn tập cho một deck. Thẻ mới tạo bằng transaction nên mở nhiều tab không bị trùng. */
export function useSrs() {
  const items = ref<Map<string, DeckItem>>(new Map())
  const queue = ref<string[]>([])
  const stats = ref({ due: 0, fresh: 0, done: 0 })
  const flipped = ref(false)
  const stored = ref<CardState | undefined>()

  const currentRef = computed(() => queue.value[0])
  const current = computed(() => (currentRef.value ? items.value.get(currentRef.value) : undefined))

  watch(currentRef, async (r) => {
    stored.value = r ? await (await getStorage()).getCard(r) : undefined
  })

  /** Khoảng ôn kế tiếp (ngày) cho từng nút chấm, để người học thấy hậu quả của lựa chọn. */
  const previews = computed<number[]>(() => {
    const r = currentRef.value
    if (!r) return []
    const today = localDay()
    const base = stored.value ?? newCard(r, today)
    return ([0, 1, 2, 3] as Grade[]).map((g) => review(base, g, today).interval)
  })

  async function start(deck: DeckItem[], newLimit: number) {
    const storage = await getStorage()
    const today = localDay()
    items.value = new Map(deck.map((d) => [d.ref, d]))
    const all = await storage.allCards()
    const cards = new Map(all.map((c) => [c.ref, c]))
    const newToday = all.filter((c) => localDay(new Date(c.createdAt)) === today).length
    const q = buildQueue({ refs: deck.map((d) => d.ref), cards, today, newLimit, newToday })
    queue.value = [...q.due, ...q.fresh]
    stats.value = { due: q.due.length, fresh: q.fresh.length, done: 0 }
    flipped.value = false
    stored.value = queue.value[0] ? cards.get(queue.value[0]) : undefined
  }

  async function grade(g: Grade) {
    const r = currentRef.value
    if (!r) return
    const storage = await getStorage()
    const today = localDay()
    await storage.createCardIfAbsent(newCard(r, today))
    const card = (await storage.getCard(r)) as CardState
    const next = review(card, g, today)
    await storage.saveCard(next)
    await storage.addReview({ ref: r, grade: g, day: today, at: Date.now() })
    queue.value = queue.value.slice(1)
    if (g === 0) queue.value.push(r) // Quên: gặp lại cuối phiên
    else stats.value.done++
    flipped.value = false
  }

  return { current, queue, stats, flipped, previews, start, grade }
}
