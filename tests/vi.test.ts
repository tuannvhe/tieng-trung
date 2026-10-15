import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { HskWord } from '@/types'

const load = (l: number): HskWord[] => JSON.parse(readFileSync(`src/data/hsk${l}.json`, 'utf8'))
const LEVELS = [1, 2, 3, 4, 5, 6]

describe('nghĩa tiếng Việt của từ HSK', () => {
  it('mọi từ HSK 1-6 đều có nghĩa tiếng Việt, không phải bản sao tiếng Anh', () => {
    for (const l of LEVELS)
      for (const w of load(l)) {
        expect(w.meaning_vi.trim(), `${w.id} ${w.hanzi}`).not.toBe('')
        expect(w.meaning_vi, `${w.id} ${w.hanzi}`).not.toBe(w.meanings_en[0])
        expect(w.meaning_vi, `${w.id} có ký tự thừa`).not.toMatch(/[|\t]/)
      }
  })

  it('tiếng Việt thật sự có dấu ở phần lớn các từ (không phải tiếng Anh dán nhầm)', () => {
    const all = LEVELS.flatMap(load)
    const accented = all.filter((w) => /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(w.meaning_vi)).length
    expect(accented / all.length).toBeGreaterThan(0.8)
  })

  it('âm Hán Việt chỉ gồm chữ thường tiếng Việt và dấu cách; thiếu không quá 1%', () => {
    const all = LEVELS.flatMap(load)
    for (const w of all) if (w.han_viet) expect(w.han_viet, `${w.id} ${w.hanzi}`).toMatch(/^[a-zà-ỹđ ]+$/i)
    expect(all.filter((w) => !w.han_viet).length / all.length).toBeLessThan(0.01)
  })

  it('tệp nguồn vi-src khớp dữ liệu: cùng số dòng, số thứ tự, chữ Hán và nghĩa', () => {
    for (const l of LEVELS) {
      const words = load(l)
      const lines = readFileSync(`src/data/vi-src/hsk${l}.txt`, 'utf8').split('\n').filter(Boolean)
      expect(lines).toHaveLength(words.length)
      lines.forEach((line, i) => {
        const [num, hanzi, vi, hv] = line.split('|')
        expect(num, `hsk${l} dòng ${i + 1}`).toBe(String(words[i].id).split('-')[1])
        expect(hanzi).toBe(words[i].hanzi)
        expect(vi).toBe(words[i].meaning_vi)
        expect(hv ?? '').toBe(words[i].han_viet)
      })
    }
  })
})

describe('bài thi dùng nghĩa tiếng Việt', () => {
  it('câu hỏi chọn nghĩa có đáp án và lựa chọn bằng tiếng Việt khi truyền nghĩa Việt', async () => {
    const { buildQuestions } = await import('@/lib/exam')
    const words = load(1)
    const qs = buildQuestions(words, 30, (w) => w.meaning_vi)
    const meaningQs = qs.filter((q) => q.kind === 'meaning')
    expect(meaningQs.length).toBeGreaterThan(5)
    for (const q of meaningQs) {
      const w = words.find((x) => x.hanzi === q.prompt)!
      expect(q.options[q.answer]).toBe(w.meaning_vi)
      expect(q.options.some((o) => /^[\x20-\x7e]+$/.test(o) && o === w.meanings_en[0])).toBe(false)
    }
  })
})
