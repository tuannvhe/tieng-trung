import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pinyin } from 'pinyin-pro'
import { numericToMarks, syllableNumericToMarks } from '@/lib/pinyin'
import { buildRadicalQuiz, buildSandhiQuiz, buildToneQuiz, radicalExamples, toneOf } from '@/lib/stage0'
import { ref } from 'vue'
import { usePinyinInput } from '@/composables/usePinyinInput'
import type { HskWord } from '@/types'

const data = JSON.parse(readFileSync('src/data/stage0.json', 'utf8'))
const hsk: HskWord[] = [1, 2, 3, 4, 5].flatMap((n) => JSON.parse(readFileSync(`src/data/hsk${n}.json`, 'utf8')))
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }
const py = (s: string) => pinyin(s, { toneType: 'symbol' })

describe('chuyển số thanh thành dấu', () => {
  it('đặt dấu đúng quy tắc a/e, ou, nguyên âm cuối', () => {
    expect(numericToMarks('ni3 hao3')).toBe('nǐ hǎo')
    expect(syllableNumericToMarks('xie4')).toBe('xiè')
    expect(syllableNumericToMarks('gou3')).toBe('gǒu')
    expect(syllableNumericToMarks('liu2')).toBe('liú')
    expect(syllableNumericToMarks('hui4')).toBe('huì')
    expect(syllableNumericToMarks('lv4')).toBe('lǜ')
    expect(syllableNumericToMarks('nu:3')).toBe('nǚ')
    expect(syllableNumericToMarks('guo2')).toBe('guó')
  })
  it('thanh nhẹ bỏ số, không có số thì giữ nguyên, ký tự khác không đụng tới', () => {
    expect(numericToMarks('xie4 xie5')).toBe('xiè xie')
    expect(numericToMarks('nǐ hao')).toBe('nǐ hao')
    expect(numericToMarks('ERP xi4 tong3')).toBe('ERP xì tǒng')
  })
  it('usePinyinInput: xem trước, chấm đúng mọi cách gõ', () => {
    const raw = ref('ni3 hao3')
    const { display, showPreview, check } = usePinyinInput(raw)
    expect(display.value).toBe('nǐ hǎo')
    expect(showPreview.value).toBe(true)
    expect(check('nǐ hǎo')).toBe(true)
    raw.value = 'nǐ hǎo'
    expect(showPreview.value).toBe(false)
    raw.value = 'ni hao'
    expect(showPreview.value).toBe(false)
    expect(check('nǐ hǎo')).toBe(true)
    raw.value = ''
    expect(check('nǐ hǎo')).toBe(false)
  })
})

describe('nội dung Giai đoạn 0 đúng với từ điển', () => {
  it('pinyin của mọi chữ ví dụ trong bảng thanh mẫu và vần khớp pinyin-pro', () => {
    const rows = [...data.initials.flatMap((g: any) => g.items), ...data.finals.flatMap((g: any) => g.items)]
    expect(data.initials.flatMap((g: any) => g.items)).toHaveLength(21)
    expect(rows.length).toBeGreaterThanOrEqual(21 + 35)
    for (const r of rows) expect(py(r.hanzi), r.hanzi).toBe(r.py)
  })
  it('thanh điệu, bài nghe thanh và 30 chữ đầu khớp pinyin-pro', () => {
    for (const t of data.tones) expect(py(t.hanzi), t.hanzi).toBe(t.py)
    for (const d of data.toneDrill) expect(py(d.hanzi), d.hanzi).toBe(d.py)
    const first = data.firstChars.flatMap((l: any) => l.items)
    expect(first).toHaveLength(30)
    expect(new Set(first.map((c: any) => c.hanzi)).size).toBe(30)
    for (const c of first) expect(py(c.hanzi), c.hanzi).toBe(c.py)
  })
  it('30 chữ đầu đều xuất hiện trong từ vựng HSK 1-5', () => {
    const chars = new Set(hsk.flatMap((w) => [...w.hanzi]))
    for (const c of data.firstChars.flatMap((l: any) => l.items)) expect(chars.has(c.hanzi), c.hanzi).toBe(true)
  })
  it('đúng 30 bộ thủ, mỗi bộ đều có ít nhất 3 chữ HSK thật làm ví dụ', () => {
    expect(data.radicals).toHaveLength(30)
    expect(new Set(data.radicals.map((r: any) => r.r)).size).toBe(30)
    for (const r of data.radicals) expect(radicalExamples(hsk, r.r, 4).length, r.r).toBeGreaterThanOrEqual(3)
  })
  it('8 nét cơ bản và các quy tắc đều có chữ ví dụ', () => {
    expect(data.strokes).toHaveLength(8)
    for (const s of [...data.strokes, ...data.strokeRules]) expect([...s.ex]).toHaveLength(1)
  })
  it('ví dụ biến điệu: thanh 3 pinyin-pro giữ dạng gốc; 不 và 一 pinyin-pro viết dạng đã biến điệu', () => {
    const [tone3, bu, yi] = data.sandhi
    for (const e of tone3.examples) expect(py(e.sc), e.sc).toBe(e.written)
    for (const e of [...bu.examples, ...yi.examples]) expect(py(e.sc), e.sc).toBe(e.real)
    for (const e of tone3.examples) expect(e.real).not.toBe(e.written)
  })
})

describe('bài tập Giai đoạn 0', () => {
  it('toneOf', () => {
    expect([toneOf('mā'), toneOf('má'), toneOf('mǎ'), toneOf('mà'), toneOf('ma')]).toEqual([1, 2, 3, 4, 5])
  })
  it('bài nghe thanh: đáp án đúng bằng thanh của chữ, chỉ thanh 1-4', () => {
    const qs = buildToneQuiz(data.toneDrill, 10, seq([0.2, 0.7, 0.4]))
    expect(qs).toHaveLength(10)
    for (const q of qs) expect(q.answer).toBe(toneOf(q.py))
  })
  it('bài biến điệu: đáp án nằm trong lựa chọn và là dạng đọc đúng', () => {
    const qs = buildSandhiQuiz(data.sandhiQuiz, 10, seq([0.3, 0.9, 0.1]))
    for (const q of qs) {
      const item = data.sandhiQuiz.find((x: any) => x.sc === q.sc)
      expect(q.options[q.answer]).toBe(item.right)
      expect(q.options).toContain(item.wrong)
    }
  })
  it('bài đoán bộ thủ lấy từ dữ liệu HSK thật, đáp án khớp trường radical', () => {
    const qs = buildRadicalQuiz(hsk, data.radicals, 20, () => '', seq([0.1, 0.8, 0.5, 0.3]))
    expect(qs.length).toBe(20)
    const byChar = new Map(hsk.map((w) => [w.hanzi, w]))
    for (const q of qs) {
      expect(new Set(q.options).size).toBe(4)
      expect(q.options[q.answer]).toBe(byChar.get(q.hanzi)!.radical)
    }
  })
})
