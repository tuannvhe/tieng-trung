import type { HskWord } from '@/types'

export interface Token {
  text: string
  /** Từ HSK khớp được (khớp dài nhất); không có thì là chữ lẻ/dấu câu */
  word?: HskWord
}

export type WordIndex = Map<string, HskWord>

const CJK = /[㐀-鿿]/
const MAX_LEN = 6

/** Chỉ mục chữ Hán → từ HSK. Nếu trùng, giữ từ có cấp thấp hơn (người học gặp trước). */
export function buildWordIndex(words: HskWord[]): WordIndex {
  const idx: WordIndex = new Map()
  for (const w of words) {
    const prev = idx.get(w.hanzi)
    if (!prev || w.level < prev.level) idx.set(w.hanzi, w)
  }
  return idx
}

/**
 * Tách câu thành các từ HSK bằng khớp dài nhất từ trái sang phải.
 * Chữ không thuộc từ nào để thành token lẻ (không có `word`), chữ Latin/số liền nhau gộp một token.
 */
export function segment(text: string, index: WordIndex): Token[] {
  const chars = [...text]
  const out: Token[] = []
  let i = 0
  while (i < chars.length) {
    if (!CJK.test(chars[i])) {
      let j = i + 1
      if (/[A-Za-z0-9]/.test(chars[i])) while (j < chars.length && /[A-Za-z0-9]/.test(chars[j])) j++
      out.push({ text: chars.slice(i, j).join('') })
      i = j
      continue
    }
    let hit = 0
    for (let len = Math.min(MAX_LEN, chars.length - i); len >= 1; len--) {
      const cand = chars.slice(i, i + len).join('')
      if (index.has(cand)) {
        out.push({ text: cand, word: index.get(cand) })
        hit = len
        break
      }
    }
    if (!hit) {
      out.push({ text: chars[i] })
      hit = 1
    }
    i += hit
  }
  return out
}
