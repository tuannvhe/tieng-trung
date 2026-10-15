import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { countReadingUnits, findDuplicateIds, validateHskWord, validateItTerm } from '@/lib/schema'

const term = JSON.parse(readFileSync('src/data/it/terms.json', 'utf8'))[0]

describe('schema', () => {
  it('đếm đơn vị đọc với chữ Latin', () => {
    expect(countReadingUnits('ERP系统')).toBe(3)
    expect(countReadingUnits('SQL Server宕机')).toBe(4)
  })
  it('thuật ngữ IT mẫu hợp lệ', () => {
    expect(validateItTerm(term, 't')).toEqual([])
  })
  it('bắt pinyin sai số âm tiết', () => {
    const bad = { ...term, pinyin: 'fú wù' }
    expect(validateItTerm(bad, 't').length).toBeGreaterThan(0)
  })
  it('bắt domain sai và reviewed thiếu', () => {
    const bad = { ...term, domain: 'xyz', reviewed: undefined }
    expect(validateItTerm(bad, 't').length).toBe(2)
  })
  it('bắt từ HSK thiếu trường', () => {
    expect(validateHskWord({ id: 1, level: 9 }, 'w').length).toBeGreaterThan(3)
  })
  it('tìm id trùng', () => {
    expect(findDuplicateIds(['a', 'b', 'a', 1, 1])).toEqual(['a', 1])
  })
})
