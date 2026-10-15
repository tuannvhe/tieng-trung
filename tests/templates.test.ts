import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fillTemplate } from '@/lib/template'
import { validateScenario, validateTemplate } from '@/lib/schema'
import type { MessageTemplate, Scenario } from '@/types'

const templates: MessageTemplate[] = JSON.parse(readFileSync('src/data/it/templates.json', 'utf8'))
const scenarios: Scenario[] = JSON.parse(readFileSync('src/data/it/scenarios.json', 'utf8'))
const t = templates[0]

describe('điền biến mẫu tin nhắn', () => {
  it('thay đủ biến ở cả bản Trung và Việt', () => {
    const r = fillTemplate(t, { system: 'MES系统', time: '昨晚', cause: '网络中断', impact: '报工' }, { system: 'hệ thống MES', time: 'tối qua', cause: 'mất mạng', impact: 'việc báo sản lượng' })
    expect(r.sc).toContain('MES系统在昨晚出现故障，原因：网络中断')
    expect(r.vi).toContain('hệ thống MES gặp sự cố vào tối qua')
    expect(r.missing).toEqual([])
    expect(r.sc).not.toContain('{{')
  })
  it('biến chưa điền được đánh dấu và liệt kê một lần', () => {
    const r = fillTemplate(t, { system: 'ERP' })
    expect(r.sc).toContain('【Thời điểm】')
    expect(r.missing).toEqual(['Thời điểm', 'Nguyên nhân', 'Ảnh hưởng'])
  })
  it('bản Việt dùng lại giá trị Trung khi không có bản dịch (tên hệ thống, giờ)', () => {
    const r = fillTemplate(t, { system: 'SQL Server', time: '22:00', cause: 'x', impact: 'y' })
    expect(r.vi).toContain('SQL Server gặp sự cố vào 22:00')
  })
  it('giá trị chỉ có khoảng trắng coi như thiếu', () => {
    expect(fillTemplate(t, { system: '  ' }).missing).toContain('Hệ thống / thiết bị')
  })
})

describe('dữ liệu kịch bản và mẫu', () => {
  it('có ít nhất 20 kịch bản hợp lệ, mỗi bài có lượt của người dùng', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(20)
    for (const s of scenarios) expect(validateScenario(s, s.id)).toEqual([])
  })
  it('mọi mẫu tin nhắn hợp lệ (biến khớp giữa Trung và Việt)', () => {
    for (const m of templates) expect(validateTemplate(m, m.id)).toEqual([])
  })
  it('validator bắt biến chưa khai báo và pinyin sai số âm tiết', () => {
    expect(validateTemplate({ ...t, sc: t.sc + '{{ghost}}' }, 't').length).toBeGreaterThan(0)
    const bad = { ...scenarios[0], lines: [{ ...scenarios[0].lines[0], py: 'xiǎo' }, scenarios[0].lines[1]] }
    expect(validateScenario(bad, 's').length).toBeGreaterThan(0)
  })
})
