const MARKS: Record<string, [string, number]> = {}
const TABLE: Record<string, string> = {
  a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ',
}
for (const [base, marks] of Object.entries(TABLE)) {
  marks.split('').forEach((m, i) => (MARKS[m] = [base, i + 1]))
}

function clean(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/u:|v/g, 'ü')
    .replace(/['’]/g, ' ')
    .trim()
}

/** Chuyển một âm tiết về dạng số: "nǐ" → "ni3". Không có dấu/số → trả nguyên (tone = null). */
function syllableToNumeric(syl: string): { base: string; tone: number | null } {
  let tone: number | null = null
  let base = ''
  for (const ch of syl) {
    if (MARKS[ch]) {
      base += MARKS[ch][0]
      tone = MARKS[ch][1]
    } else if (/[0-5]/.test(ch)) {
      tone = ch === '0' ? 5 : Number(ch)
    } else base += ch
  }
  return { base, tone }
}

/** Tách chuỗi thành âm tiết theo khoảng trắng; "ni3hao3" tách theo chữ số. */
function split(s: string): string[] {
  return clean(s)
    .replace(/([0-5])(?=[a-zü])/g, '$1 ')
    .split(/\s+/)
    .filter(Boolean)
}

/** "nǐ hǎo" → "ni3 hao3". Nếu có ít nhất một âm tiết có thanh thì âm tiết trần = thanh nhẹ (5). */
export function toNumeric(input: string): string {
  const syls = split(input).map(syllableToNumeric)
  const anyTone = syls.some((s) => s.tone !== null)
  return syls.map((s) => s.base + (s.tone ?? (anyTone ? 5 : ''))).join(' ')
}

/** "nǐ hǎo" / "ni3 hao3" → "ni hao". */
export function stripTones(input: string): string {
  return split(input).map((s) => syllableToNumeric(s).base).join(' ')
}

export function hasToneInfo(input: string): boolean {
  return split(input).some((s) => syllableToNumeric(s).tone !== null)
}

/**
 * So khớp đáp án gõ với pinyin chuẩn. Chấp nhận có dấu, số thanh (ni3 hao3, ni3hao3),
 * hoặc không dấu (khi đó chỉ so âm tiết). Bỏ qua khoảng trắng và hoa/thường.
 */
export function pinyinMatches(answer: string, expected: string): boolean {
  const compact = (s: string) => s.replace(/\s+/g, '')
  if (!hasToneInfo(answer)) return compact(stripTones(answer)) === compact(stripTones(expected))
  return compact(sandhiFold(toNumeric(answer))) === compact(sandhiFold(toNumeric(expected)))
}

/** Gộp các dạng biến điệu của 一 (yi1/yi2/yi4) và 不 (bu2/bu4) để người học gõ dạng nào cũng được. */
function sandhiFold(numeric: string): string {
  return numeric.replace(/\byi[124]\b/g, 'yi*').replace(/\bbu[24]\b/g, 'bu*')
}

const PUNCT = /[，。！？、；：“”‘’（）,.!?;:()"]/g

/** So khớp pinyin cả câu, bỏ qua dấu câu. */
export function sentenceMatches(answer: string, expected: string): boolean {
  return pinyinMatches(answer.replace(PUNCT, ' '), expected.replace(PUNCT, ' '))
}

const MARK_TABLE: Record<string, string> = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' }

/** Âm tiết có số thanh ("ni3", "lv4", "nu:3") thành âm tiết có dấu ("nǐ", "lǜ", "nǚ"); không có số thì giữ nguyên. */
export function syllableNumericToMarks(syl: string): string {
  const m = /^([a-zA-ZüÜ:]+?)([0-5])$/.exec(syl)
  if (!m) return syl
  const base = m[1].replace(/u:|v/gi, 'ü')
  const tone = Number(m[2])
  if (tone === 0 || tone === 5) return base
  const lower = base.toLowerCase()
  // Quy tắc đặt dấu: a hoặc e nếu có; ou thì đặt trên o; còn lại đặt trên nguyên âm cuối
  let idx = lower.search(/[ae]/)
  if (idx < 0 && lower.includes('ou')) idx = lower.indexOf('o')
  if (idx < 0) for (let i = lower.length - 1; i >= 0; i--) if ('iouü'.includes(lower[i])) { idx = i; break }
  if (idx < 0) return base
  const ch = lower[idx]
  const marked = MARK_TABLE[ch][tone - 1]
  return base.slice(0, idx) + (base[idx] === base[idx].toUpperCase() && base[idx] !== ch ? marked.toUpperCase() : marked) + base.slice(idx + 1)
}

/** Chuyển cả chuỗi: các âm tiết kết thúc bằng số thanh được đổi thành dấu, phần còn lại giữ nguyên. */
export function numericToMarks(input: string): string {
  return input.replace(/[a-zA-ZüÜ:]+[0-5]/g, (tok) => syllableNumericToMarks(tok))
}

export interface Syllable {
  text: string
  /** 1-4, 5 = thanh nhẹ, 0 = không phải âm tiết pinyin (ERP, số...) */
  tone: 0 | 1 | 2 | 3 | 4 | 5
}

/** Tách pinyin để tô màu theo thanh điệu. */
export function pinyinSyllables(py: string): Syllable[] {
  return py
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => {
      if (/^[A-Z0-9]+$/.test(text)) return { text, tone: 0 as const }
      const { tone } = syllableToNumeric(text.toLowerCase())
      return { text, tone: (tone ?? 5) as Syllable['tone'] }
    })
}
