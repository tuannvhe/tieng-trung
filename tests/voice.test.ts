import { describe, expect, it } from 'vitest'
import { audioKey, makeResolver } from '@/lib/audio-pack'
import { scoreOne, scorePronunciation } from '@/lib/pronounce'

describe('gói âm thanh', () => {
  it('khóa ổn định, bỏ dấu câu và khoảng trắng, đổi nội dung thì đổi khóa', () => {
    expect(audioKey('你好！')).toBe(audioKey('你好'))
    expect(audioKey('你 好。')).toBe(audioKey('你好'))
    expect(audioKey('你好')).not.toBe(audioKey('你们好'))
    expect(audioKey('你好')).toMatch(/^[0-9a-f]{8}[0-9a-z]+$/)
  })
  it('resolver chỉ trả URL khi có trong danh mục', () => {
    const r = makeResolver({ [audioKey('你好')]: `${audioKey('你好')}.mp3` }, './')
    expect(r('你好！')).toBe(`./audio/${audioKey('你好')}.mp3`)
    expect(r('再见')).toBeUndefined()
  })
})

describe('chấm phát âm', () => {
  it('đọc đúng được 100%, đồng âm cùng thanh tính đúng', () => {
    expect(scoreOne('你好', '你好').percent).toBe(100)
    expect(scoreOne('他', '她').chars[0].verdict).toBe('ok')
  })
  it('đúng âm sai thanh bị trừ nửa điểm và đánh dấu tone', () => {
    const r = scoreOne('妈妈', '麻妈')
    expect(r.chars[0].verdict).toBe('tone')
    expect(r.percent).toBe(75)
  })
  it('thiếu chữ, sai chữ, thừa chữ', () => {
    expect(scoreOne('我喜欢你', '我你').chars.map((c) => c.verdict)).toEqual(['ok', 'missing', 'missing', 'ok'])
    expect(scoreOne('你好', '你们').chars[1].verdict).toBe('wrong')
    expect(scoreOne('你好', '你好吗').percent).toBeLessThan(100)
  })
  it('lấy phương án tốt nhất; không có chữ Hán thì null', () => {
    expect(scorePronunciation('谢谢', ['写些', '谢谢'])?.percent).toBe(100)
    expect(scorePronunciation('谢谢', ['hello'])?.percent).toBe(0)
    expect(scorePronunciation('谢谢', [])).toBeNull()
    expect(scorePronunciation('ERP', ['ERP'])).toBeNull()
  })
})
