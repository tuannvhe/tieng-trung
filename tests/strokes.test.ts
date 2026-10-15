import { describe, it, expect } from 'vitest'
import { prefetchStrokes, strokeUrl, uniqueHan } from '@/lib/strokes'

describe('nét chữ', () => {
  it('URL khớp bộ nạp mặc định của hanzi-writer và mã hóa chữ Hán', () => {
    expect(strokeUrl('好')).toBe('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/%E5%A5%BD.json')
  })
  it('uniqueHan bỏ trùng, chữ Latin và dấu câu, giữ thứ tự', () => {
    expect(uniqueHan(['服务器', 'ERP系统，好', '数据库'])).toEqual(['服', '务', '器', '系', '统', '好', '数', '据', '库'])
  })
  it('prefetch đếm thành công và thất bại, báo tiến độ đủ số lần, giới hạn song song', async () => {
    const chars = ['一', '二', '三', '四', '五', '六', '七']
    let inFlight = 0
    let peak = 0
    const fetchFn = (async (url: string) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      if (url.includes(encodeURIComponent('三'))) throw new Error('mạng lỗi')
      return { ok: !url.includes(encodeURIComponent('五')) } as Response
    }) as unknown as typeof fetch
    const calls: number[] = []
    const r = await prefetchStrokes(chars, (d) => calls.push(d), { concurrency: 3, fetchFn })
    expect(r).toEqual({ ok: 5, failed: 2 })
    expect(calls).toHaveLength(7)
    expect(calls[calls.length - 1]).toBe(7)
    expect(peak).toBeLessThanOrEqual(3)
  })
  it('dừng khi bị hủy', async () => {
    const ac = new AbortController()
    ac.abort()
    const r = await prefetchStrokes(['一', '二'], () => {}, { signal: ac.signal, fetchFn: (async () => ({ ok: true })) as unknown as typeof fetch })
    expect(r).toEqual({ ok: 0, failed: 0 })
  })
})
