import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildQuestions, formatClock, gradeExam, placementLevel, shortMeaning, unlockedLevels } from '@/lib/exam'
import { isCorrectOrder, shuffleTokens } from '@/lib/grammar'
import { validateGrammar } from '@/lib/schema'
import { DexieStorage } from '@/lib/storage.dexie'
import type { ExamResult, GrammarPoint, HskWord } from '@/types'

const hsk1: HskWord[] = JSON.parse(readFileSync('src/data/hsk1.json', 'utf8'))
const grammar: GrammarPoint[] = JSON.parse(readFileSync('src/data/it/grammar.json', 'utf8'))
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }
const res = (p: Partial<ExamResult>): ExamResult => ({ kind: 'level', level: 1, correct: 0, total: 30, percent: 0, passed: false, at: 1, ...p })

describe('tạo đề từ từ vựng HSK thật', () => {
  const qs = buildQuestions(hsk1, 30, () => '', seq([0.3, 0.7, 0.1, 0.9, 0.5]))
  it('đủ 30 câu, mỗi câu có đáp án đúng nằm trong lựa chọn và không trùng lựa chọn', () => {
    expect(qs).toHaveLength(30)
    for (const q of qs) {
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.options[q.answer]).toBeTruthy()
    }
  })
  it('đáp án đúng khớp từ gốc (pinyin, chữ Hán, nghĩa)', () => {
    const byRef = new Map(hsk1.map((w) => [`hsk:${w.id}`, w]))
    for (const q of qs) {
      const w = byRef.get(q.ref)!
      const expected = q.kind === 'pinyin' ? w.pinyin : q.kind === 'reverse' ? w.hanzi : shortMeaning(w)
      expect(q.options[q.answer]).toBe(expected)
    }
  })
  it('ưu tiên nghĩa tiếng Việt đã nhập', () => {
    expect(shortMeaning(hsk1[0], 'của')).toBe('của')
    expect(shortMeaning(hsk1[0])).not.toMatch(/\(/)
  })
})

describe('chấm bài và mở khóa', () => {
  const qs = buildQuestions(hsk1, 10, () => '', seq([0.2, 0.8]))
  it('chấm đúng, câu bỏ trống tính sai, ngưỡng 80%', () => {
    const all = qs.map((q) => q.answer)
    expect(gradeExam(qs, all)).toMatchObject({ correct: 10, percent: 100, passed: true })
    const eight = all.map((a, i) => (i < 8 ? a : null))
    expect(gradeExam(qs, eight)).toMatchObject({ correct: 8, percent: 80, passed: true })
    expect(gradeExam(qs, all.map((a, i) => (i < 7 ? a : null)))).toMatchObject({ percent: 70, passed: false })
  })
  it('cấp 1 luôn mở; đạt cấp n mở cấp n+1; trượt thì không mở', () => {
    expect(unlockedLevels([])).toEqual([1])
    expect(unlockedLevels([res({ level: 1, passed: false, percent: 60 })])).toEqual([1])
    expect(unlockedLevels([res({ level: 1, passed: true, percent: 90 })])).toEqual([1, 2])
    expect(unlockedLevels([res({ level: 5, passed: true })])).toEqual([1, 2, 3, 4, 5, 6])
    expect(unlockedLevels([res({ level: 6, passed: true })])).toEqual([1, 2, 3, 4, 5, 6])
  })
  it('thi xếp lớp mở khóa tới cấp đề xuất', () => {
    expect(unlockedLevels([res({ kind: 'placement', level: 3, passed: true })])).toEqual([1, 2, 3])
  })
  it('placementLevel: cấp đầu tiên chưa đạt 70%', () => {
    const ok = { correct: 4, total: 5 }
    const bad = { correct: 2, total: 5 }
    expect(placementLevel({ 1: ok, 2: ok, 3: bad, 4: bad, 5: bad })).toBe(3)
    expect(placementLevel({ 1: bad })).toBe(1)
    expect(placementLevel({ 1: ok, 2: ok, 3: ok, 4: ok, 5: ok })).toBe(5)
  })
  it('đồng hồ', () => {
    expect([formatClock(1200), formatClock(59), formatClock(-3)]).toEqual(['20:00', '00:59', '00:00'])
  })
})

describe('ngữ pháp', () => {
  it('dữ liệu hợp lệ và có ít nhất 10 mẫu, 12 bài sắp xếp', () => {
    expect(grammar.length).toBeGreaterThanOrEqual(10)
    expect(grammar.flatMap((g) => g.exercises).length).toBeGreaterThanOrEqual(12)
    for (const g of grammar) expect(validateGrammar(g, g.id)).toEqual([])
  })
  it('xáo trộn luôn khác thứ tự đúng nhưng giữ đủ mảnh', () => {
    for (const g of grammar) for (const e of g.exercises) {
      const s = shuffleTokens(e.tokens)
      expect([...s].sort()).toEqual([...e.tokens].sort())
      expect(isCorrectOrder(s, e.tokens)).toBe(false)
    }
  })
  it('chấm thứ tự', () => {
    expect(isCorrectOrder(['请', '先'], ['请', '先'])).toBe(true)
    expect(isCorrectOrder(['先', '请'], ['请', '先'])).toBe(false)
    expect(isCorrectOrder(['请'], ['请', '先'])).toBe(false)
  })
})

describe('lưu kết quả thi', () => {
  it('lưu, đọc theo thời gian, xuất rồi nhập lại', async () => {
    const a = new DexieStorage('t-exam-a')
    await a.saveSettings({ mode: 'full', theme: 'system', zhFontSize: 28, showPinyin: true, newCardsPerDay: 15, weeklyDays: 5, goal: 'it:all' })
    await a.addExamResult(res({ level: 1, passed: true, percent: 90, at: 2 }))
    await a.addExamResult(res({ level: 2, passed: false, percent: 50, at: 1 }))
    expect((await a.examResults()).map((r) => r.at)).toEqual([1, 2])
    const b = new DexieStorage('t-exam-b')
    await b.importAll(await a.exportAll())
    expect(unlockedLevels(await b.examResults())).toEqual([1, 2])
  })
})

describe('scheduleMissed', () => {
  it('tạo thẻ mới, kéo thẻ chưa đến hạn về hôm nay, bỏ qua thẻ đã đến hạn và ref trùng', async () => {
    const { scheduleMissed } = await import('@/lib/exam')
    const { newCard } = await import('@/lib/srs')
    const cards = new Map<string, any>([
      ['hsk:a', { ...newCard('hsk:a', '2026-01-01'), due: '2026-02-01' }],
      ['hsk:b', { ...newCard('hsk:b', '2026-01-01'), due: '2026-01-05' }],
    ])
    const store = {
      getCard: async (r: string) => cards.get(r),
      createCardIfAbsent: async (c: any) => (cards.has(c.ref) ? false : (cards.set(c.ref, c), true)),
      saveCard: async (c: any) => void cards.set(c.ref, c),
    }
    const n = await scheduleMissed(store, ['hsk:a', 'hsk:b', 'hsk:c', 'hsk:c'], '2026-01-10')
    expect(n).toBe(2)
    expect(cards.get('hsk:a').due).toBe('2026-01-10')
    expect(cards.get('hsk:b').due).toBe('2026-01-05')
    expect(cards.get('hsk:c').due).toBe('2026-01-10')
  })
})
