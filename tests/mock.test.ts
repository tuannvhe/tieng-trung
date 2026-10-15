import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adviceFor, buildMockExam, gradeMock, isRight, MOCK_SPECS, sectionCount, type MockAnswer, type MockLevel } from '@/lib/mock'
import type { DialogueData, HskWord } from '@/types'

const dialogues = (JSON.parse(readFileSync('src/data/dialogues.json', 'utf8')) as DialogueData).items
const wordsUpTo = (n: number): HskWord[] => [1, 2, 3, 4, 5, 6].slice(0, n).flatMap((l) => JSON.parse(readFileSync(`src/data/hsk${l}.json`, 'utf8')))
const seeded = (seed = 7) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)

describe('cấu trúc đề', () => {
  it('số câu và thang điểm đúng cấu trúc HSK 2.0 đã công bố', () => {
    const n = (l: MockLevel) => MOCK_SPECS[l].sections.map(sectionCount)
    expect(n(1)).toEqual([20, 20])
    expect(n(2)).toEqual([35, 25])
    expect(n(3)).toEqual([40, 30, 10])
    expect(n(4)).toEqual([45, 40, 15])
    expect(n(5)).toEqual([45, 45, 10])
    expect(n(6)).toEqual([50, 50])
    expect([MOCK_SPECS[1].max, MOCK_SPECS[1].pass]).toEqual([200, 120])
    expect([MOCK_SPECS[3].max, MOCK_SPECS[3].pass]).toEqual([300, 180])
    expect([MOCK_SPECS[4].max, MOCK_SPECS[4].pass, MOCK_SPECS[5].max, MOCK_SPECS[5].pass]).toEqual([300, 180, 300, 180])
    // HSK 6 không có phần viết chấm tự động được: thang 200, đạt 60%
    expect([MOCK_SPECS[6].max, MOCK_SPECS[6].pass, MOCK_SPECS[6].note]).toEqual([200, 120, expect.any(String)])
    for (const l of [1, 2, 3, 4, 5, 6] as MockLevel[]) expect(MOCK_SPECS[l].max).toBe(MOCK_SPECS[l].sections.length * 100)
  })
})

describe.each([1, 2, 3, 4, 5, 6] as MockLevel[])('dựng đề HSK %i', (level) => {
  const exam = buildMockExam(level, { dialogues, words: wordsUpTo(level) }, seeded(level))

  it('đủ số câu, các phần liên tiếp và đúng kỹ năng', () => {
    const spec = MOCK_SPECS[level]
    expect(exam.questions).toHaveLength(spec.sections.reduce((a, s) => a + sectionCount(s), 0))
    spec.sections.forEach((s, i) => {
      const from = exam.starts[i]
      const to = exam.starts[i + 1] ?? exam.questions.length
      expect(to - from).toBe(sectionCount(s))
      for (let k = from; k < to; k++) expect(exam.questions[k].skill).toBe(s.skill)
    })
  })

  it('mỗi câu trắc nghiệm có đáp án đúng nằm trong các lựa chọn khác nhau; phần nghe có âm thanh', () => {
    for (const q of exam.questions) {
      if (q.kind === 'reorder') continue
      expect(q.options.length, q.ask).toBeGreaterThanOrEqual(3)
      if (q.kind === 'hear-passage') expect(q.text).toBeUndefined()
      if (q.kind === 'read-passage') expect(q.text).toContain('\n')
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.options[q.answer]).toBeTruthy()
      if (q.skill === 'listening') expect(q.audio).toBeTruthy()
      else expect(q.text).toBeTruthy()
    }
  })

  it('không lặp câu giữa các câu hỏi', () => {
    const keys = exam.questions.map((q) => (q.audio ?? q.text ?? q.tokens?.join('')) as string)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('câu điền từ có chỗ trống và câu sắp xếp có 4-8 từ (4-9 từ cấp 4 trở lên) xáo trộn', () => {
    for (const q of exam.questions) {
      if (q.kind === 'fill-blank') expect(q.text).toContain('____')
      if (q.kind === 'reorder') {
        expect(q.tokens!.length).toBeGreaterThanOrEqual(4)
        expect(q.tokens!.length).toBeLessThanOrEqual(level >= 4 ? 9 : 8)
        expect([...q.bank!].sort()).toEqual([...q.tokens!].sort())
      }
    }
  })

  it('làm đúng hết được điểm tối đa và đạt; bỏ trống hết được 0 và không đạt', () => {
    const all: MockAnswer[] = exam.questions.map((q) => (q.kind === 'reorder' ? [...q.tokens!] : q.answer))
    const full = gradeMock(exam, all)
    expect(full.total).toBe(exam.spec.max)
    expect(full.passed).toBe(true)
    expect(full.percent).toBe(100)
    const none = gradeMock(exam, exam.questions.map(() => null))
    expect(none.total).toBe(0)
    expect(none.passed).toBe(false)
  })
})

describe('chấm điểm', () => {
  const exam = buildMockExam(1, { dialogues, words: wordsUpTo(1) }, seeded(3))
  it('điểm từng phần quy về 100 và cộng lại; ngưỡng đạt đúng 120/200', () => {
    // đúng nửa phần nghe (10/20) và 15/20 phần đọc: 50 + 75 = 125 >= 120
    const ans: MockAnswer[] = exam.questions.map((q, i) => {
      const inListening = i < exam.starts[1]
      const right = inListening ? i < 10 : i - exam.starts[1] < 15
      return right ? q.answer : (q.answer + 1) % q.options.length
    })
    const r = gradeMock(exam, ans)
    expect(r.sections.map((s) => s.score)).toEqual([50, 75])
    expect(r.total).toBe(125)
    expect(r.passed).toBe(true)
    const worse = ans.map((a, i) => (i < 10 ? a : (exam.questions[i].answer + 1) % exam.questions[i].options.length))
    expect(gradeMock(exam, worse).passed).toBe(false)
  })
  it('sắp xếp sai thứ tự hoặc thiếu từ thì sai', () => {
    const q = buildMockExam(3, { dialogues, words: wordsUpTo(3) }, seeded(5)).questions.find((x) => x.kind === 'reorder')!
    expect(isRight(q, [...q.tokens!])).toBe(true)
    expect(isRight(q, [...q.tokens!].reverse())).toBe(q.tokens!.join('') === [...q.tokens!].reverse().join(''))
    expect(isRight(q, q.tokens!.slice(1))).toBe(false)
    expect(isRight(q, null)).toBe(false)
  })
  it('lời khuyên nêu đúng kỹ năng yếu', () => {
    const advice = adviceFor({ sections: [{ skill: 'listening', correct: 5, total: 20, score: 25 }, { skill: 'reading', correct: 19, total: 20, score: 95 }], total: 120, max: 200, pass: 120, passed: true, correct: 24, questions: 40, percent: 60 })
    expect(advice[0]).toMatch(/Nghe: 25\/100, cần ôn/)
    expect(advice[1]).toMatch(/Đọc: 95\/100, tốt/)
  })
})
