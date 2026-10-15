import { describe, expect, it } from 'vitest'
import course from '@/data/course-hsk1.json'
import { addLessonToCards, baseHanzi, buildHskIndex, buildLessonQuiz, lessonProgress, resolveVocab, stepKey, type CourseData } from '@/lib/course'
import hsk1 from '@/data/hsk1.json'
import hsk2 from '@/data/hsk2.json'
import hsk3 from '@/data/hsk3.json'
import hsk4 from '@/data/hsk4.json'
import hsk5 from '@/data/hsk5.json'
import type { HskWord } from '@/types'

const data = course as unknown as CourseData
const words = [...hsk1, ...hsk2, ...hsk3, ...hsk4, ...hsk5] as unknown as HskWord[]

describe('dữ liệu giáo trình HSK1', () => {
  it('đủ 15 bài, đúng thứ tự, bài 6-8 đánh dấu thiếu tài liệu', () => {
    expect(data.lessons.map((l) => l.n)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(data.lessons.filter((l) => l.missing).map((l) => l.n)).toEqual([6, 7, 8])
  })
  it('mỗi bài có tiêu đề và từ không rỗng; từ không trùng trong cùng bài; pinyin có nội dung', () => {
    for (const l of data.lessons.filter((x) => !x.missing)) {
      expect(l.zh && l.vi, `bài ${l.n}`).toBeTruthy()
      expect(l.vocab.length, `bài ${l.n}`).toBeGreaterThan(5)
      expect(new Set(l.vocab.map((v) => v.h)).size, `bài ${l.n} có từ trùng`).toBe(l.vocab.length)
      for (const v of l.vocab) {
        expect(v.h, `bài ${l.n}`).toMatch(/\p{Script=Han}/u)
        expect(v.py.length, `${v.h}`).toBeGreaterThan(0)
      }
    }
  })
  it('mục ngữ pháp có quy tắc và ví dụ đầy đủ, chỉ ở các bài có tài liệu', () => {
    const withG = data.lessons.filter((l) => l.grammar)
    expect(withG.map((l) => l.n)).toEqual([10, 11, 12, 13, 15])
    for (const l of withG)
      for (const g of l.grammar!) {
        expect(g.t && g.rule, `bài ${l.n}`).toBeTruthy()
        expect(g.ex.length, `${l.n}: ${g.t}`).toBeGreaterThan(0)
        for (const e of g.ex) expect(e.zh && e.vi).toBeTruthy()
      }
  })
  it('đa số từ khớp được với bộ từ HSK của ứng dụng', () => {
    const idx = buildHskIndex(words)
    const all = data.lessons.flatMap((l) => l.vocab)
    const hit = all.filter((v) => idx.has(baseHanzi(v.h))).length
    expect(hit / all.length).toBeGreaterThan(0.6)
  })
})

describe('chức năng giáo trình', () => {
  const idx = buildHskIndex(words)
  const viOf = (w: HskWord) => w.meaning_vi || w.meanings_en[0] || ''
  const resolved = (n: number) => resolveVocab(data.lessons[n - 1].vocab, idx, viOf)

  it('baseHanzi bỏ phần ngoặc', () => {
    expect(baseHanzi('没(有)')).toBe('没')
    expect(baseHanzi('你好')).toBe('你好')
  })

  it('thêm từ vào thẻ chỉ với từ có trong bộ HSK, không tạo trùng', async () => {
    const cards = new Map<string, unknown>()
    const store = { createCardIfAbsent: async (c: { ref: string }) => (cards.has(c.ref) ? false : (cards.set(c.ref, c), true)) }
    const r1 = await addLessonToCards(store, resolved(10), '2026-01-10')
    expect(r1.added).toBeGreaterThan(0)
    expect(r1.added + r1.noCard + r1.skipped).toBeLessThanOrEqual(data.lessons[9].vocab.length)
    expect(cards.size).toBe(r1.added)
    const r2 = await addLessonToCards(store, resolved(10), '2026-01-10')
    expect(r2.added).toBe(0)
    expect(r2.skipped).toBe(r1.added)
  })

  it('bài kiểm tra có đáp án đúng nằm trong lựa chọn, xen kẽ hai dạng, không quá số từ', () => {
    const own = resolved(12)
    const pool = [...resolved(10), ...own]
    const qs = buildLessonQuiz(own, pool, 10)
    expect(qs.length).toBeLessThanOrEqual(10)
    expect(qs.length).toBeGreaterThan(0)
    qs.forEach((q, i) => {
      expect(q.kind).toBe(i % 2 === 0 ? 'meaning' : 'hanzi')
      expect(q.options[q.answer]).toBeTruthy()
      expect(new Set(q.options).size).toBe(q.options.length)
    })
  })

  it('tiến độ bài tính các bước và bài kiểm tra từ 80%', () => {
    const flags = { [stepKey(3, 'watch')]: true, [stepKey(3, 'vocab')]: true }
    expect(lessonProgress(flags, 3, 70)).toMatchObject({ done: 2, quizPassed: false, count: 2, percent: 50 })
    expect(lessonProgress(flags, 3, 80)).toMatchObject({ count: 3, percent: 75 })
    expect(lessonProgress({}, 4)).toMatchObject({ count: 0, percent: 0 })
    expect(lessonProgress({ ...flags, [stepKey(3, 'homework')]: true }, 3, 100).percent).toBe(100)
  })
})
