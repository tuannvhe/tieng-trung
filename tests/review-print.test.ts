import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCsv, toCsv } from '@/lib/csv'
import { collectReviewItems, exportUnreviewedCsv, parseReviewCsv, stateOf, type ReviewSources } from '@/lib/review'
import { boxesPerRow, charsFromText, charsFromWords, paginate, rowsPerPage, splitWordPinyin } from '@/lib/print'
import type { ContentOverride } from '@/types'

const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const sources: ReviewSources = {
  terms: json('src/data/it/terms.json'),
  dialogues: json('src/data/dialogues.json').items,
  readings: json('src/data/it/reading.json'),
  grammar: [...json('src/data/grammar-hsk.json'), ...json('src/data/it/grammar.json')],
  templates: json('src/data/it/templates.json'),
}
const items = collectReviewItems(sources)

describe('CSV', () => {
  it('quote đúng dấu phẩy, ngoặc kép, xuống dòng và có BOM', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'nói "ok"'], ['dòng 1\ndòng 2', '']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"x,y"')
    expect(csv).toContain('"nói ""ok"""')
  })
  it('đọc lại được đúng những gì đã ghi (vòng khứ hồi), kể cả chữ Hán và xuống dòng', () => {
    const rows = [['服务器,伺服器', 'máy chủ "server"'], ['câu 1\r\ncâu 2', 'x'], ['', 'chỉ cột hai']]
    expect(parseCsv(toCsv(['c1', 'c2'], rows))).toEqual([['c1', 'c2'], ...rows])
  })
  it('bỏ dòng trống và chịu được CRLF', () => {
    expect(parseCsv('a,b\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('kiểm duyệt', () => {
  it('gom đủ mọi loại nội dung và key duy nhất', () => {
    const types = new Set(items.map((i) => i.type))
    expect([...types].sort()).toEqual(['dl', 'gr', 'it', 'rd', 'tp'])
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
    expect(items.length).toBe(sources.terms.length + sources.dialogues.length + sources.readings.length + sources.grammar.length + sources.templates.length)
  })
  it('override của người dùng thắng dữ liệu gốc', () => {
    const ov: Record<string, ContentOverride> = { [items[0].key]: { key: items[0].key, reviewed: true, note: 'đã sửa', updatedAt: 1 } }
    expect(stateOf(items[0], ov)).toEqual({ reviewed: true, note: 'đã sửa' })
    expect(stateOf(items[1], ov)).toEqual({ reviewed: false, note: '' })
  })
  it('xuất CSV chỉ gồm mục chưa kiểm duyệt và có thể lọc theo loại', () => {
    const ov: Record<string, ContentOverride> = { [items[0].key]: { key: items[0].key, reviewed: true, updatedAt: 1 } }
    const all = parseCsv(exportUnreviewedCsv(items, ov))
    expect(all.length - 1).toBe(items.length - 1)
    expect(all.some((r) => r[0] === items[0].key)).toBe(false)
    const it = parseCsv(exportUnreviewedCsv(items, {}, 'it'))
    expect(it.length - 1).toBe(sources.terms.length)
  })
  it('nhập lại CSV đã điền: cập nhật trạng thái và ghi chú, bỏ qua key lạ', () => {
    const valid = new Set(items.map((i) => i.key))
    const csv = toCsv(['key', 'đã kiểm duyệt (Y/N)', 'ghi chú sửa'], [[items[0].key, 'Y', 'ok'], [items[1].key, 'N', 'đổi "服务器" thành 伺服器'], ['xx:khong-co', 'Y', '']])
    const r = parseReviewCsv(csv, valid)
    expect(r.skipped).toBe(1)
    expect(r.updates).toEqual([{ key: items[0].key, reviewed: true, note: 'ok' }, { key: items[1].key, reviewed: false, note: 'đổi "服务器" thành 伺服器' }])
  })
  it('báo lỗi rõ khi thiếu cột bắt buộc', () => {
    expect(() => parseReviewCsv('a,b\n1,2', new Set())).toThrow(/thiếu cột/)
  })
})

describe('in phiếu tập viết', () => {
  it('tách pinyin theo chữ khi khớp số âm tiết', () => {
    expect(splitWordPinyin('电脑', 'diàn nǎo')).toEqual(['diàn', 'nǎo'])
    expect(splitWordPinyin('ERP系统', 'ERP xì tǒng')).toEqual([])
    expect(splitWordPinyin('电脑', 'diànnǎo')).toEqual([])
  })
  it('gom chữ khác nhau theo thứ tự, giữ pinyin và nghĩa từ chứa chữ lần đầu', () => {
    const r = charsFromWords([
      { hanzi: '电脑', pinyin: 'diàn nǎo', vi: 'máy tính' },
      { hanzi: '电话', pinyin: 'diàn huà', vi: 'điện thoại' },
    ])
    expect(r.map((c) => c.ch)).toEqual(['电', '脑', '话'])
    expect(r[0]).toMatchObject({ py: 'diàn', vi: 'máy tính', word: '电脑' })
    expect(r[2]).toMatchObject({ py: 'huà', vi: 'điện thoại' })
  })
  it('chữ từ văn bản nhập tay bỏ trùng, chữ Latin và dấu câu', () => {
    expect(charsFromText('服务器，ERP 服务').map((c) => c.ch)).toEqual(['服', '务', '器'])
  })
  it('chia trang và tính số hàng, số ô hợp lý trên A4', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(paginate([], 3)).toEqual([])
    expect(() => paginate([1], 0)).toThrow()
    const a = rowsPerPage(15, false)
    const b = rowsPerPage(15, true)
    expect(a).toBeGreaterThan(b)
    expect(a * (15 + 7)).toBeLessThanOrEqual(297 - 24)
    expect(boxesPerRow(15)).toBe(12)
    expect(boxesPerRow(30)).toBe(6)
  })
})
