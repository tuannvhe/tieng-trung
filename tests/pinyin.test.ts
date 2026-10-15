import { describe, it, expect } from 'vitest'
import { hasToneInfo, pinyinMatches, stripTones, toNumeric } from '@/lib/pinyin'

describe('chuẩn hóa pinyin', () => {
  it('dấu → số', () => {
    expect(toNumeric('nǐ hǎo')).toBe('ni3 hao3')
    expect(toNumeric('xiè xie')).toBe('xie4 xie5')
    expect(toNumeric('lǜ')).toBe('lü4')
  })
  it('chấp nhận số thanh liền và v/u: thay ü', () => {
    expect(toNumeric('ni3hao3')).toBe('ni3 hao3')
    expect(toNumeric('lv4')).toBe('lü4')
    expect(toNumeric('nu:3')).toBe('nü3')
  })
  it('bỏ thanh', () => {
    expect(stripTones('Nǐ Hǎo')).toBe('ni hao')
    expect(stripTones('ni3 hao3')).toBe('ni hao')
  })
  it('nhận diện có thông tin thanh', () => {
    expect(hasToneInfo('ni hao')).toBe(false)
    expect(hasToneInfo('ni3 hao')).toBe(true)
  })
  it('pinyinMatches: có dấu, số, không dấu, liền hoặc cách', () => {
    for (const a of ['nǐ hǎo', 'ni3 hao3', 'ni3hao3', 'ni hao', 'nihao', 'NI3 HAO3']) {
      expect(pinyinMatches(a, 'nǐ hǎo')).toBe(true)
    }
  })
  it('pinyinMatches từ chối sai thanh hoặc sai âm', () => {
    expect(pinyinMatches('ni2 hao3', 'nǐ hǎo')).toBe(false)
    expect(pinyinMatches('ni hau', 'nǐ hǎo')).toBe(false)
  })
  it('thanh nhẹ', () => {
    expect(pinyinMatches('xie4 xie5', 'xiè xie')).toBe(true)
    expect(pinyinMatches('xie4 xie', 'xiè xie')).toBe(true)
  })
  it('giữ chữ Latin như ERP', () => {
    expect(pinyinMatches('erp xi tong', 'ERP xì tǒng')).toBe(true)
  })
})
