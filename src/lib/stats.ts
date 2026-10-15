import { addDays, localDay } from './srs'
import type { CardState, ReviewLogEntry } from './storage'

/** Chuỗi ngày học liên tiếp. Hôm nay chưa học thì vẫn giữ chuỗi tính đến hôm qua. */
export function computeStreak(days: Iterable<string>, today: string): number {
  const set = new Set(days)
  let d = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

/** Thẻ "đã thuộc" khi khoảng ôn từ 21 ngày trở lên. */
export const MATURE_INTERVAL = 21

export function summarize(cards: CardState[], log: ReviewLogEntry[], today: string) {
  return {
    learned: cards.length,
    mature: cards.filter((c) => c.interval >= MATURE_INTERVAL).length,
    due: cards.filter((c) => c.due <= today).length,
    reviewedToday: log.filter((l) => l.day === today).length,
    streak: computeStreak(log.map((l) => l.day), today),
  }
}

/** "1 ngày", "6 ngày", "3 tuần", "2 tháng" */
export function formatInterval(days: number): string {
  if (days < 7) return `${days} ngày`
  if (days < 30) return `${Math.round(days / 7)} tuần`
  return `${Math.round(days / 30)} tháng`
}

/** Số lượt ôn mỗi ngày trong n ngày gần nhất, cũ nhất trước (kể cả ngày không học = 0). */
export function dailyCounts(log: ReviewLogEntry[], today: string, n = 30): Array<{ day: string; count: number }> {
  const per = new Map<string, number>()
  for (const l of log) per.set(l.day, (per.get(l.day) ?? 0) + 1)
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - (n - 1))
    return { day, count: per.get(day) ?? 0 }
  })
}

/** Tiến độ theo nhóm (cấp HSK, nhóm IT...). Thẻ không thuộc nhóm nào bị bỏ qua. */
export function groupProgress(cards: CardState[], groupOf: (ref: string) => string | undefined) {
  const out: Record<string, { learned: number; mature: number }> = {}
  for (const c of cards) {
    const g = groupOf(c.ref)
    if (!g) continue
    const slot = (out[g] ??= { learned: 0, mature: 0 })
    slot.learned++
    if (c.interval >= MATURE_INTERVAL) slot.mature++
  }
  return out
}

/** Số thẻ mới bắt đầu học mỗi ngày, trung bình trong `windowDays` ngày gần nhất (tính cả ngày nghỉ). */
export function newCardsPerDayRate(cards: CardState[], today: string, windowDays = 14): number {
  const from = addDays(today, -(windowDays - 1))
  const n = cards.filter((c) => {
    const d = localDay(new Date(c.createdAt))
    return d >= from && d <= today
  }).length
  return n / windowDays
}

export interface GoalEstimate {
  remaining: number
  done: boolean
  /** Số ngày cần; null nếu nhịp học bằng 0 */
  days: number | null
  date: string | null
}

/** Ước tính ngày học xong hết thẻ của mục tiêu với nhịp `perDay` thẻ mới mỗi ngày. */
export function estimateGoal(total: number, learned: number, perDay: number, today: string): GoalEstimate {
  const remaining = Math.max(0, total - learned)
  if (remaining === 0) return { remaining, done: true, days: 0, date: today }
  if (!(perDay > 0)) return { remaining, done: false, days: null, date: null }
  const days = Math.ceil(remaining / perDay)
  return { remaining, done: false, days, date: addDays(today, days) }
}

/** Số ngày đã học trong tuần hiện tại (thứ Hai đến Chủ nhật) so với mục tiêu `goal` ngày/tuần. */
export function weekProgress(days: Iterable<string>, today: string, goal: number) {
  const [y, m, d] = today.split('-').map(Number)
  const sinceMonday = (new Date(y, m - 1, d).getDay() + 6) % 7
  const start = addDays(today, -sinceMonday)
  const week = new Set([...days].filter((x) => x >= start && x <= today))
  const done = week.size
  // Ngày còn có thể học: hôm nay (nếu chưa học) và các ngày sau đến hết Chủ nhật
  const remainingDays = 7 - sinceMonday - (week.has(today) ? 1 : 0)
  return { done, goal, reached: done >= goal, remainingDays, needed: Math.max(0, goal - done) }
}
