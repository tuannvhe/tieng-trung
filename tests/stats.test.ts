import { describe, it, expect } from 'vitest'
import { dailyCounts, estimateGoal, groupProgress, newCardsPerDayRate } from '@/lib/stats'
import { newCard } from '@/lib/srs'
import type { CardState } from '@/lib/storage'

const T = '2026-10-14'
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const card = (ref: string, interval = 0, createdAt = at(2026, 10, 14)): CardState => ({ ...newCard(ref, T), interval, createdAt })

describe('dailyCounts', () => {
  it('đủ n ngày, cũ nhất trước, ngày nghỉ = 0, gộp nhiều lượt cùng ngày', () => {
    const log = [
      { ref: 'a', grade: 2 as const, day: '2026-10-14', at: 1 },
      { ref: 'b', grade: 2 as const, day: '2026-10-14', at: 2 },
      { ref: 'c', grade: 1 as const, day: '2026-10-12', at: 3 },
    ]
    const r = dailyCounts(log, T, 5)
    expect(r.map((x) => x.day)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'])
    expect(r.map((x) => x.count)).toEqual([0, 0, 1, 0, 2])
  })
  it('qua ranh giới tháng', () => {
    expect(dailyCounts([], '2026-11-02', 3).map((x) => x.day)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02'])
  })
})

describe('groupProgress', () => {
  it('đếm đã học và đã thuộc theo nhóm, bỏ qua thẻ không có nhóm', () => {
    const cards = [card('hsk:hsk1-1', 30), card('hsk:hsk1-2', 3), card('hsk:hsk2-1', 21), card('it:x', 99), card('lạ', 5)]
    const group = (ref: string) => (ref.startsWith('hsk:hsk1') ? 'HSK 1' : ref.startsWith('hsk:hsk2') ? 'HSK 2' : ref === 'it:x' ? 'IT' : undefined)
    expect(groupProgress(cards, group)).toEqual({
      'HSK 1': { learned: 2, mature: 1 },
      'HSK 2': { learned: 1, mature: 1 },
      IT: { learned: 1, mature: 1 },
    })
  })
})

describe('nhịp học và ước tính mục tiêu', () => {
  it('nhịp = số thẻ mới trong cửa sổ chia số ngày, thẻ cũ hơn cửa sổ không tính', () => {
    const cards = [card('a', 0, at(2026, 10, 14)), card('b', 0, at(2026, 10, 1)), card('c', 0, at(2026, 9, 1))]
    expect(newCardsPerDayRate(cards, T, 14)).toBeCloseTo(2 / 14)
  })
  it('nhịp dùng ngày địa phương: 23:59 vẫn thuộc ngày đó', () => {
    expect(newCardsPerDayRate([card('a', 0, at(2026, 10, 14, 23))], T, 7)).toBeCloseTo(1 / 7)
  })
  it('ước tính ngày: làm tròn lên và cộng ngày đúng', () => {
    expect(estimateGoal(100, 40, 4, T)).toEqual({ remaining: 60, done: false, days: 15, date: '2026-10-29' })
    expect(estimateGoal(10, 3, 3, T)).toMatchObject({ days: 3, date: '2026-10-17' })
  })
  it('đã xong và nhịp bằng 0', () => {
    expect(estimateGoal(50, 50, 0, T)).toMatchObject({ done: true, remaining: 0, days: 0 })
    expect(estimateGoal(50, 60, 5, T).done).toBe(true)
    expect(estimateGoal(50, 10, 0, T)).toEqual({ remaining: 40, done: false, days: null, date: null })
  })
})

describe('weekProgress', () => {
  // 2026-01-14 là thứ Tư; tuần bắt đầu thứ Hai 2026-01-12
  it('chỉ đếm ngày trong tuần hiện tại và tính số ngày còn lại', async () => {
    const { weekProgress } = await import('@/lib/stats')
    const r = weekProgress(['2026-01-11', '2026-01-12', '2026-01-13'], '2026-01-14', 5)
    expect(r).toMatchObject({ done: 2, reached: false, needed: 3, remainingDays: 5 })
    const r2 = weekProgress(['2026-01-12', '2026-01-13', '2026-01-14'], '2026-01-14', 3)
    expect(r2).toMatchObject({ done: 3, reached: true, remainingDays: 4 })
    expect(weekProgress([], '2026-01-18', 7).remainingDays).toBe(1)
  })
})
