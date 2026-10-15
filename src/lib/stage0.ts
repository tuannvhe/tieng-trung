import type { HskWord } from '@/types'
import { pinyinSyllables } from './pinyin'
import { shuffle, type Rng } from './exercise'
import { shortMeaning } from './exam'

export interface DrillItem { hanzi: string; py: string }
export interface SandhiItem { sc: string; right: string; wrong: string }
export interface RadicalDef { r: string; py: string; hv: string; meaning: string; hint: string }

/** Thanh điệu (1-4, 5 = thanh nhẹ) của một âm tiết có dấu. */
export function toneOf(py: string): number {
  return pinyinSyllables(py)[0]?.tone ?? 0
}

export interface ToneQuestion { hanzi: string; py: string; answer: 1 | 2 | 3 | 4 }

/** Nghe một chữ và chọn thanh điệu: chỉ lấy các chữ thanh 1-4. */
export function buildToneQuiz(drill: DrillItem[], n: number, rng: Rng = Math.random): ToneQuestion[] {
  return shuffle(drill.filter((d) => toneOf(d.py) >= 1 && toneOf(d.py) <= 4), rng)
    .slice(0, n)
    .map((d) => ({ hanzi: d.hanzi, py: d.py, answer: toneOf(d.py) as 1 | 2 | 3 | 4 }))
}

export interface SandhiQuestion { sc: string; options: string[]; answer: number }

/** Chọn cách đọc đúng sau khi biến điệu. */
export function buildSandhiQuiz(items: SandhiItem[], n: number, rng: Rng = Math.random): SandhiQuestion[] {
  return shuffle(items, rng).slice(0, n).map((it) => {
    const options = shuffle([it.right, it.wrong], rng)
    return { sc: it.sc, options, answer: options.indexOf(it.right) }
  })
}

export interface RadicalExample { hanzi: string; pinyin: string; meaning: string; level: number }

/** Các chữ đơn HSK thật có bộ thủ này, ưu tiên cấp thấp rồi tần suất cao. */
export function radicalExamples(words: HskWord[], glyph: string, n = 4, vi: (w: HskWord) => string = () => ''): RadicalExample[] {
  return words
    .filter((w) => [...w.hanzi].length === 1 && w.radical === glyph)
    .sort((a, b) => a.level - b.level || a.frequency - b.frequency)
    .slice(0, n)
    .map((w) => ({ hanzi: w.hanzi, pinyin: w.pinyin, meaning: shortMeaning(w, vi(w)), level: w.level }))
}

export interface RadicalQuestion { hanzi: string; pinyin: string; meaning: string; options: string[]; answer: number }

/** Cho một chữ, chọn đúng bộ thủ trong bốn lựa chọn lấy từ danh sách 30 bộ thủ. */
export function buildRadicalQuiz(words: HskWord[], radicals: RadicalDef[], n: number, vi: (w: HskWord) => string = () => '', rng: Rng = Math.random): RadicalQuestion[] {
  const glyphs = radicals.map((r) => r.r)
  const pool = words.filter((w) => [...w.hanzi].length === 1 && glyphs.includes(w.radical) && w.level <= 3)
  return shuffle(pool, rng).slice(0, n).map((w) => {
    const others = shuffle(glyphs.filter((g) => g !== w.radical), rng).slice(0, 3)
    const options = shuffle([w.radical, ...others], rng)
    return { hanzi: w.hanzi, pinyin: w.pinyin, meaning: shortMeaning(w, vi(w)), options, answer: options.indexOf(w.radical) }
  })
}
