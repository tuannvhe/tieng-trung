import type { ContentOverride, Dialogue, GrammarPoint, ItTerm, MessageTemplate, ReadingPassage } from '@/types'
import { parseCsv, toCsv } from './csv'

export type ReviewType = 'it' | 'dl' | 'rd' | 'gr' | 'tp'

export const REVIEW_LABELS: Record<ReviewType, string> = {
  it: 'Thuật ngữ IT',
  dl: 'Hội thoại',
  rd: 'Bài đọc',
  gr: 'Ngữ pháp',
  tp: 'Mẫu tin nhắn',
}

export interface ReviewItem {
  /** Khóa lưu override, ví dụ 'dl:dl-0001' */
  key: string
  type: ReviewType
  id: string
  /** Tiêu đề ngắn hiển thị trong danh sách */
  title: string
  zh: string
  py: string
  vi: string
  /** Trạng thái mặc định trong dữ liệu gốc */
  reviewed: boolean
}

export interface ReviewSources {
  terms: ItTerm[]
  dialogues: Dialogue[]
  readings: ReadingPassage[]
  grammar: GrammarPoint[]
  templates: MessageTemplate[]
}

/** Gom mọi nội dung do AI soạn thành một danh sách phẳng để kiểm duyệt. */
export function collectReviewItems(s: ReviewSources): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const t of s.terms) {
    out.push({
      key: `it:${t.id}`, type: 'it', id: t.id, title: t.hanzi_sc,
      zh: `${t.hanzi_sc}${t.hanzi_tc ? ` (${t.hanzi_tc})` : ''}\n${t.example_sc}`,
      py: `${t.pinyin}\n${t.example_pinyin}`, vi: `${t.vi} (${t.en})\n${t.example_vi}`, reviewed: t.reviewed,
    })
  }
  for (const d of s.dialogues) {
    out.push({
      key: `dl:${d.id}`, type: 'dl', id: d.id, title: d.title || d.lines[0].sc,
      zh: d.lines.map((l) => `${l.who === 'm' ? 'B' : 'A'}: ${l.sc}`).join('\n'),
      py: d.lines.map((l) => l.py).join('\n'), vi: d.lines.map((l) => l.vi).join('\n'), reviewed: d.reviewed,
    })
  }
  for (const r of s.readings) {
    out.push({
      key: `rd:${r.id}`, type: 'rd', id: r.id, title: r.title,
      zh: r.tokens.map((t) => t.t).join(''), py: r.tokens.filter((t) => t.py).map((t) => t.py).join(' '), vi: r.translation_vi, reviewed: r.reviewed,
    })
  }
  for (const g of s.grammar) {
    out.push({
      key: `gr:${g.id}`, type: 'gr', id: g.id, title: g.title,
      zh: [g.pattern, `✗ ${g.mistake.wrong}`, `✓ ${g.mistake.right}`, ...g.examples.map((e) => e.sc)].join('\n'),
      py: g.examples.map((e) => e.py).join('\n'), vi: [g.explain, g.mistake.why, ...g.examples.map((e) => e.vi)].join('\n'), reviewed: g.reviewed,
    })
  }
  for (const t of s.templates) {
    out.push({ key: `tp:${t.id}`, type: 'tp', id: t.id, title: t.title, zh: t.sc, py: '', vi: t.vi, reviewed: t.reviewed })
  }
  return out
}

export interface ReviewState {
  reviewed: boolean
  note: string
}

/** Trạng thái hiện tại của một mục: override của người dùng thắng dữ liệu gốc. */
export function stateOf(item: Pick<ReviewItem, 'key' | 'reviewed'>, overrides: Record<string, ContentOverride>): ReviewState {
  const o = overrides[item.key]
  return { reviewed: o?.reviewed ?? item.reviewed, note: o?.note ?? '' }
}

export const CSV_HEADER = ['key', 'loại', 'id', 'tiếng Trung', 'pinyin', 'tiếng Việt', 'đã kiểm duyệt (Y/N)', 'ghi chú sửa']

/** CSV các mục chưa kiểm duyệt để gửi đồng nghiệp người Trung xác nhận. */
export function exportUnreviewedCsv(items: ReviewItem[], overrides: Record<string, ContentOverride>, only?: ReviewType): string {
  const rows = items
    .filter((i) => (only ? i.type === only : true))
    .filter((i) => !stateOf(i, overrides).reviewed)
    .map((i) => [i.key, REVIEW_LABELS[i.type], i.id, i.zh, i.py, i.vi, 'N', stateOf(i, overrides).note])
  return toCsv(CSV_HEADER, rows)
}

export interface CsvUpdate {
  key: string
  reviewed: boolean
  note: string
}

/**
 * Đọc lại file CSV mà người kiểm duyệt đã điền. Chỉ cần các cột `key`, `đã kiểm duyệt (Y/N)` và `ghi chú sửa`.
 * Bỏ qua dòng có key không tồn tại; trả về danh sách cập nhật và số dòng bị bỏ.
 */
export function parseReviewCsv(text: string, validKeys: Set<string>): { updates: CsvUpdate[]; skipped: number } {
  const rows = parseCsv(text)
  if (!rows.length) return { updates: [], skipped: 0 }
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const iKey = head.indexOf('key')
  const iRev = head.findIndex((h) => h.startsWith('đã kiểm duyệt') || h === 'reviewed')
  const iNote = head.findIndex((h) => h.startsWith('ghi chú') || h === 'note')
  if (iKey < 0 || iRev < 0) throw new Error('File CSV thiếu cột "key" hoặc "đã kiểm duyệt (Y/N)"')
  const updates: CsvUpdate[] = []
  let skipped = 0
  for (const r of rows.slice(1)) {
    const key = (r[iKey] ?? '').trim()
    if (!validKeys.has(key)) {
      skipped++
      continue
    }
    updates.push({ key, reviewed: /^(y|yes|1|true|đã|x)$/i.test((r[iRev] ?? '').trim()), note: iNote >= 0 ? (r[iNote] ?? '').trim() : '' })
  }
  return { updates, skipped }
}
