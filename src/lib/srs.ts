import type { CardState } from './storage'

export type Grade = 0 | 1 | 2 | 3 // Quên, Khó, Được, Dễ
export const GRADE_LABELS = ['Quên', 'Khó', 'Được', 'Dễ'] as const
/** Chất lượng SM-2 (0-5) tương ứng từng mức. Quên coi như q=2 (lỗi nhớ). */
const QUALITY = [2, 3, 4, 5] as const

export const MIN_EASE = 1.3

/** Ngày theo giờ địa phương, dạng 'YYYY-MM-DD'. */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + n))
}

export function newCard(ref: string, today: string, now = Date.now()): CardState {
  return { ref, ease: 2.5, interval: 0, repetitions: 0, due: today, lapses: 0, createdAt: now }
}

/** SM-2 thuần: trả về trạng thái thẻ mới sau khi chấm, không sửa object đầu vào. */
export function review(card: CardState, grade: Grade, today: string): CardState {
  const q = QUALITY[grade]
  let { ease, interval, repetitions, lapses } = card

  if (grade === 0) {
    repetitions = 0
    interval = 1
    lapses += 1
  } else {
    if (repetitions === 0) interval = 1
    else if (repetitions === 1) interval = grade === 1 ? 3 : 6
    else {
      const factor = grade === 1 ? 1.2 : grade === 3 ? ease * 1.3 : ease
      interval = Math.max(interval + 1, Math.round(interval * factor))
    }
    repetitions += 1
  }
  ease = Math.max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  return { ...card, ease, interval, repetitions, lapses, due: addDays(today, interval) }
}

export interface QueueInput {
  /** Toàn bộ ref trong deck, theo thứ tự học */
  refs: string[]
  cards: Map<string, CardState>
  today: string
  newLimit: number
  /** Số thẻ mới đã bắt đầu hôm nay (mọi deck) */
  newToday: number
}

export interface Queue {
  due: string[]
  fresh: string[]
}

/** Hàng đợi ôn hằng ngày: thẻ đến hạn (cũ nhất trước) rồi thẻ mới trong giới hạn/ngày. */
export function buildQueue({ refs, cards, today, newLimit, newToday }: QueueInput): Queue {
  const due = refs
    .filter((r) => {
      const c = cards.get(r)
      return c !== undefined && c.due <= today
    })
    .sort((a, b) => cards.get(a)!.due.localeCompare(cards.get(b)!.due))
  const room = Math.max(0, newLimit - newToday)
  const fresh = refs.filter((r) => !cards.has(r)).slice(0, room)
  return { due, fresh }
}
