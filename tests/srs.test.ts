import { describe, it, expect } from 'vitest'
import { addDays, buildQueue, localDay, MIN_EASE, newCard, review } from '@/lib/srs'
import type { CardState } from '@/lib/storage'

const T = '2026-10-14'

describe('SM-2', () => {
  it('chuỗi Được: 1 → 6 → ~15 ngày', () => {
    let c = newCard('x', T)
    c = review(c, 2, T)
    expect([c.interval, c.repetitions, c.due]).toEqual([1, 1, '2026-10-15'])
    c = review(c, 2, '2026-10-15')
    expect(c.interval).toBe(6)
    c = review(c, 2, '2026-10-21')
    expect(c.interval).toBe(Math.round(6 * c.ease) === 15 ? 15 : c.interval)
    expect(c.interval).toBeGreaterThan(6)
  })
  it('Quên reset lượt, tăng lapses, giảm ease nhưng không dưới sàn', () => {
    let c: CardState = { ...newCard('x', T), repetitions: 5, interval: 40, ease: 1.35 }
    c = review(c, 0, T)
    expect([c.repetitions, c.interval, c.lapses, c.due]).toEqual([0, 1, 1, '2026-10-15'])
    expect(c.ease).toBe(MIN_EASE)
  })
  it('Dễ tăng ease, Khó giảm ease, Được giữ nguyên', () => {
    const base: CardState = { ...newCard('x', T), repetitions: 2, interval: 6 }
    expect(review(base, 3, T).ease).toBeCloseTo(2.6)
    expect(review(base, 2, T).ease).toBeCloseTo(2.5)
    expect(review(base, 1, T).ease).toBeCloseTo(2.36)
  })
  it('Dễ cho khoảng cách dài hơn Khó; không sửa object gốc', () => {
    const base: CardState = { ...newCard('x', T), repetitions: 3, interval: 10 }
    expect(review(base, 3, T).interval).toBeGreaterThan(review(base, 1, T).interval)
    expect(base.interval).toBe(10)
  })
})

describe('ngày địa phương', () => {
  it('localDay dùng giờ địa phương, addDays qua tháng/năm', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('buildQueue', () => {
  const cards = new Map<string, CardState>([
    ['a', { ...newCard('a', T), due: '2026-10-10' }],
    ['b', { ...newCard('b', T), due: '2026-10-20' }],
    ['c', { ...newCard('c', T), due: T }],
  ])
  const refs = ['a', 'b', 'c', 'n1', 'n2', 'n3']
  it('thẻ đến hạn cũ nhất trước, thẻ chưa đến hạn bị loại', () => {
    expect(buildQueue({ refs, cards, today: T, newLimit: 0, newToday: 0 }).due).toEqual(['a', 'c'])
  })
  it('giới hạn thẻ mới theo số đã học hôm nay', () => {
    expect(buildQueue({ refs, cards, today: T, newLimit: 2, newToday: 0 }).fresh).toEqual(['n1', 'n2'])
    expect(buildQueue({ refs, cards, today: T, newLimit: 2, newToday: 1 }).fresh).toEqual(['n1'])
    expect(buildQueue({ refs, cards, today: T, newLimit: 2, newToday: 5 }).fresh).toEqual([])
  })
})
