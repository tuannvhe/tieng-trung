import { describe, expect, it } from 'vitest'
import { embedUrl, formatStart, isSavedVideo, parseTime, parseYoutube } from '@/lib/youtube'

describe('parseYoutube', () => {
  const id = 'dQw4w9WgXcQ'
  it('nhận các dạng link YouTube', () => {
    for (const u of [
      `https://www.youtube.com/watch?v=${id}`,
      `youtube.com/watch?v=${id}&list=PL123`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      id,
    ]) expect(parseYoutube(u)?.videoId, u).toBe(id)
  })
  it('đọc mốc thời gian', () => {
    expect(parseYoutube(`https://youtu.be/${id}?t=90`)?.start).toBe(90)
    expect(parseYoutube(`https://www.youtube.com/watch?v=${id}&t=1m30s`)?.start).toBe(90)
    expect(parseYoutube(`https://www.youtube.com/watch?v=${id}&t=1h2m3s`)?.start).toBe(3723)
    expect(parseYoutube(`https://www.youtube.com/watch?v=${id}&t=abc`)?.start).toBe(0)
    expect(parseTime('99999999')).toBe(172800)
  })
  it('từ chối link lạ, giả mạo tên miền và mã sai', () => {
    for (const u of [
      '', 'hello', 'javascript:alert(1)', `https://evil.com/watch?v=${id}`,
      `https://youtube.com.evil.com/watch?v=${id}`, `https://evil.com/?u=youtube.com/watch?v=${id}`,
      'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/watch', 'https://www.youtube.com/playlist?list=PL1',
      `https://www.youtube.com/embed/${id}x`, `data:text/html,<script>${id}</script>`,
    ]) expect(parseYoutube(u), u).toBeNull()
  })
})

describe('tiện ích', () => {
  it('embed dùng youtube-nocookie và chỉ thêm start khi có', () => {
    expect(embedUrl('dQw4w9WgXcQ')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/)
    expect(embedUrl('dQw4w9WgXcQ')).not.toContain('start=')
    expect(embedUrl('dQw4w9WgXcQ', 75.9)).toContain('start=75')
  })
  it('định dạng giây', () => {
    expect(formatStart(0)).toBe('0:00')
    expect(formatStart(75)).toBe('1:15')
    expect(formatStart(3723)).toBe('1:02:03')
  })
  it('isSavedVideo kiểm tra từng trường', () => {
    const ok = { id: 'a', videoId: 'dQw4w9WgXcQ', title: 't', note: '', level: 2, start: 0, createdAt: 1 }
    expect(isSavedVideo(ok)).toBe(true)
    expect(isSavedVideo({ ...ok, videoId: '<script>' })).toBe(false)
    expect(isSavedVideo({ ...ok, level: 9 })).toBe(false)
    expect(isSavedVideo({ ...ok, title: 'x'.repeat(201) })).toBe(false)
    expect(isSavedVideo(null)).toBe(false)
  })
})

import { MAX_MARKS, parseClock } from '@/lib/youtube'
describe('mốc thời gian', () => {
  it('parseClock đọc các dạng gõ tay và từ chối giá trị sai', () => {
    expect(parseClock('1:15')).toBe(75)
    expect(parseClock('01:15')).toBe(75)
    expect(parseClock('1:02:03')).toBe(3723)
    expect(parseClock('75')).toBe(75)
    expect(parseClock('0')).toBe(0)
    expect(parseClock('1m15s')).toBe(75)
    for (const bad of ['', 'abc', '1:75', '1:2:3:4', '-5', '1:60', '1:61:00']) expect(parseClock(bad), bad).toBeNull()
  })
  it('isSavedVideo kiểm tra danh sách mốc', () => {
    const base = { id: 'a', videoId: 'dQw4w9WgXcQ', title: 't', note: '', level: 1, start: 0, createdAt: 1 }
    expect(isSavedVideo({ ...base, marks: [{ t: 5, note: 'x' }] })).toBe(true)
    expect(isSavedVideo({ ...base, marks: [{ t: -1, note: 'x' }] })).toBe(false)
    expect(isSavedVideo({ ...base, marks: [{ t: 1, note: 'x'.repeat(201) }] })).toBe(false)
    expect(isSavedVideo({ ...base, marks: Array.from({ length: MAX_MARKS + 1 }, () => ({ t: 1, note: '' })) })).toBe(false)
  })
})

describe('điều khiển và tiến độ qua khung YouTube', () => {
  it('đọc thời gian, độ dài, trạng thái; bỏ qua tin lạ hoặc giá trị sai', async () => {
    const { parseYtMessage, ytCommand, embedUrl } = await import('@/lib/youtube')
    expect(parseYtMessage(JSON.stringify({ event: 'infoDelivery', info: { currentTime: 12.5, duration: 300, playerState: 1 } }))).toEqual({ time: 12.5, duration: 300, state: 1 })
    expect(parseYtMessage({ event: 'infoDelivery', info: { currentTime: -3, duration: NaN, playerState: 99 } })).toEqual({ time: undefined, duration: undefined })
    expect(parseYtMessage('khong phai json')).toBeNull()
    expect(parseYtMessage(JSON.stringify({ event: 'onReady' }))).toBeNull()
    expect(parseYtMessage(null)).toBeNull()
    expect(JSON.parse(ytCommand('seekTo', [30, true]))).toEqual({ event: 'command', func: 'seekTo', args: [30, true] })
    expect(embedUrl('dQw4w9WgXcQ', 5, 'https://a.b')).toContain('enablejsapi=1&origin=https%3A%2F%2Fa.b&start=5')
  })
})

describe('vị trí đã xem', () => {
  it('chấp nhận position/duration hợp lệ và từ chối giá trị sai', async () => {
    const { isSavedVideo } = await import('@/lib/youtube')
    const v = { id: 'a', videoId: 'dQw4w9WgXcQ', title: 't', note: '', level: 0, start: 0, createdAt: 1 }
    expect(isSavedVideo({ ...v, position: 90, duration: 300 })).toBe(true)
    expect(isSavedVideo(v)).toBe(true)
    expect(isSavedVideo({ ...v, position: -1 })).toBe(false)
    expect(isSavedVideo({ ...v, duration: 999999 })).toBe(false)
    expect(isSavedVideo({ ...v, position: '5' })).toBe(false)
  })
})
