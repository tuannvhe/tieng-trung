import { stripTones } from './pinyin'

export interface SearchEntry {
  kind: 'hsk' | 'it'
  id: string | number
  hanzi: string
  traditional?: string
  pinyin: string
  vi: string
  en: string
  tag: string // 'HSK 1' | tên domain
}

interface Indexed extends SearchEntry {
  _py: string
  _vi: string
  _en: string
}

const CJK = /[㐀-鿿]/

/** Bỏ dấu tiếng Việt để gõ không dấu vẫn tìm ra. */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function buildIndex(entries: SearchEntry[]): Indexed[] {
  return entries.map((e) => ({
    ...e,
    _py: stripTones(e.pinyin).replace(/\s+/g, ''),
    _vi: foldVi(e.vi),
    _en: e.en.toLowerCase(),
  }))
}

function score(field: string, q: string): number {
  if (!field) return 0
  if (field === q) return 3
  if (field.startsWith(q)) return 2
  return field.includes(q) ? 1 : 0
}

/** Tìm theo hanzi (giản/phồn), pinyin không dấu, tiếng Việt, tiếng Anh. */
export function search(index: Indexed[], query: string, limit = 40): SearchEntry[] {
  const q = query.trim()
  if (!q) return []
  const scored: Array<[number, Indexed]> = []
  if (CJK.test(q)) {
    for (const e of index) {
      const s = Math.max(score(e.hanzi, q), score(e.traditional ?? '', q))
      if (s) scored.push([s, e])
    }
  } else {
    const py = stripTones(q).replace(/\s+/g, '')
    const vi = foldVi(q)
    const en = q.toLowerCase()
    for (const e of index) {
      const s = Math.max(py ? score(e._py, py) : 0, score(e._vi, vi), score(e._en, en))
      if (s) scored.push([s, e])
    }
  }
  scored.sort((a, b) => b[0] - a[0] || (a[1].kind === b[1].kind ? 0 : a[1].kind === 'it' ? -1 : 1))
  return scored.slice(0, limit).map(([, e]) => e)
}
