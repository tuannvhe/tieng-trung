const CJK = /[㐀-鿿]/

export interface PrintWord {
  hanzi: string
  pinyin: string
  vi: string
}

export interface PrintChar {
  ch: string
  /** Pinyin của chữ này nếu tách được từ pinyin của từ; không thì rỗng */
  py: string
  /** Nghĩa của từ chứa chữ (từ đầu tiên) */
  vi: string
  /** Từ chứa chữ, để học viên biết cách dùng */
  word: string
}

/** Tách pinyin của từ theo từng chữ khi số âm tiết khớp số chữ Hán; không khớp thì trả mảng rỗng. */
export function splitWordPinyin(hanzi: string, pinyin: string): string[] {
  const chars = [...hanzi].filter((c) => CJK.test(c))
  const syl = pinyin.trim().split(/\s+/).filter(Boolean)
  return chars.length === syl.length && chars.length === [...hanzi].length ? syl : []
}

/** Danh sách chữ khác nhau theo thứ tự xuất hiện, kèm pinyin và nghĩa của từ chứa chữ đó lần đầu. */
export function charsFromWords(words: PrintWord[]): PrintChar[] {
  const seen = new Set<string>()
  const out: PrintChar[] = []
  for (const w of words) {
    const syl = splitWordPinyin(w.hanzi, w.pinyin)
    const chars = [...w.hanzi].filter((c) => CJK.test(c))
    chars.forEach((ch, i) => {
      if (seen.has(ch)) return
      seen.add(ch)
      out.push({ ch, py: syl[i] ?? '', vi: w.vi, word: w.hanzi })
    })
  }
  return out
}

/** Chữ Hán khác nhau trong một đoạn văn bản người dùng nhập. */
export function charsFromText(text: string): PrintChar[] {
  const seen = new Set<string>()
  const out: PrintChar[] = []
  for (const ch of text) {
    if (CJK.test(ch) && !seen.has(ch)) {
      seen.add(ch)
      out.push({ ch, py: '', vi: '', word: '' })
    }
  }
  return out
}

/** Chia danh sách thành các trang, mỗi trang tối đa `perPage` hàng. */
export function paginate<T>(items: T[], perPage: number): T[][] {
  if (perPage < 1) throw new Error('perPage phải >= 1')
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage))
  return pages
}

/** Số hàng chữ nhét vừa một trang A4 theo cỡ ô (mm), tính cả dòng thông tin phía trên mỗi hàng. */
export function rowsPerPage(boxMm: number, showStrokes: boolean, pageHeightMm = 297, marginMm = 12, headerMm = 12): number {
  const rowMm = boxMm + 5 + (showStrokes ? 10 : 0) + 2
  return Math.max(1, Math.floor((pageHeightMm - marginMm * 2 - headerMm) / rowMm))
}

/** Số ô trên một hàng: ô mẫu + `trace` ô chữ mờ + ô trống còn lại, vừa bề ngang A4. */
export function boxesPerRow(boxMm: number, pageWidthMm = 210, marginMm = 12): number {
  return Math.max(3, Math.floor((pageWidthMm - marginMm * 2) / boxMm))
}
