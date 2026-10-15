import { describe, it, expect } from 'vitest'
import { buildChoices, scoreSession, shuffle } from '@/lib/exercise'
import { buildIndex, foldVi, search, type SearchEntry } from '@/lib/search'
import { computeStreak, formatInterval, summarize } from '@/lib/stats'
import { pinyinSyllables, sentenceMatches } from '@/lib/pinyin'
import { newCard } from '@/lib/srs'

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }

describe('bài tập', () => {
  it('buildChoices có đúng 4 lựa chọn khác nhau và chỉ số đáp án đúng', () => {
    const { options, index } = buildChoices('a', ['a', 'b', 'c', 'd', 'e', 'b'], seq([0.1, 0.9, 0.5]))
    expect(options).toHaveLength(4)
    expect(new Set(options).size).toBe(4)
    expect(options[index]).toBe('a')
  })
  it('buildChoices thiếu nhiễu thì trả ít lựa chọn hơn', () => {
    expect(buildChoices('a', ['a', 'b']).options).toHaveLength(2)
  })
  it('shuffle giữ nguyên phần tử', () => {
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4])
  })
  it('chấm điểm phiên', () => {
    expect(scoreSession([true, false, true, true])).toEqual({ correct: 3, total: 4, percent: 75 })
    expect(scoreSession([]).percent).toBe(0)
  })
  it('chấm câu pinyin bỏ qua dấu câu và chấp nhận không dấu', () => {
    const exp = 'qǐng xiān chóng qǐ fú wù zài shì yī cì'
    expect(sentenceMatches('qing xian chong qi fu wu zai shi yi ci', exp)).toBe(true)
    expect(sentenceMatches('qing3 xian1 chong2 qi3 fu2 wu4 zai4 shi4 yi1 ci4', exp)).toBe(true)
    expect(sentenceMatches('qing xian chong qi fu wu', exp)).toBe(false)
  })
})

describe('tra cứu', () => {
  const entries: SearchEntry[] = [
    { kind: 'hsk', id: 1, hanzi: '电脑', traditional: '電腦', pinyin: 'diàn nǎo', vi: '', en: 'computer', tag: 'HSK 1' },
    { kind: 'it', id: 'a', hanzi: '服务器', traditional: '伺服器', pinyin: 'fú wù qì', vi: 'máy chủ', en: 'server', tag: 'Server' },
    { kind: 'it', id: 'b', hanzi: '数据库', traditional: '資料庫', pinyin: 'shù jù kù', vi: 'cơ sở dữ liệu', en: 'database', tag: 'CSDL' },
  ]
  const idx = buildIndex(entries)
  it('theo hanzi giản và phồn', () => {
    expect(search(idx, '服务')[0].id).toBe('a')
    expect(search(idx, '伺服器')[0].id).toBe('a')
  })
  it('theo pinyin không dấu, có hoặc không khoảng trắng', () => {
    expect(search(idx, 'dian nao')[0].id).toBe(1)
    expect(search(idx, 'shujuku')[0].id).toBe('b')
  })
  it('theo tiếng Việt có/không dấu và tiếng Anh', () => {
    expect(search(idx, 'may chu')[0].id).toBe('a')
    expect(search(idx, 'cơ sở')[0].id).toBe('b')
    expect(search(idx, 'database')[0].id).toBe('b')
  })
  it('foldVi và truy vấn rỗng', () => {
    expect(foldVi('Đường Dẫn')).toBe('duong dan')
    expect(search(idx, '  ')).toEqual([])
  })
})

describe('thống kê', () => {
  it('streak: liên tiếp, giữ chuỗi nếu hôm nay chưa học, đứt khi bỏ ngày', () => {
    expect(computeStreak(['2026-10-12', '2026-10-13', '2026-10-14'], '2026-10-14')).toBe(3)
    expect(computeStreak(['2026-10-12', '2026-10-13'], '2026-10-14')).toBe(2)
    expect(computeStreak(['2026-10-11', '2026-10-13'], '2026-10-14')).toBe(1)
    expect(computeStreak([], '2026-10-14')).toBe(0)
  })
  it('summarize', () => {
    const cards = [{ ...newCard('a', '2026-10-14'), interval: 30 }, { ...newCard('b', '2026-10-20') }]
    const s = summarize(cards, [{ ref: 'a', grade: 2, day: '2026-10-14', at: 1 }], '2026-10-14')
    expect(s).toMatchObject({ learned: 2, mature: 1, due: 1, reviewedToday: 1, streak: 1 })
  })
  it('formatInterval', () => {
    expect([formatInterval(1), formatInterval(14), formatInterval(60)]).toEqual(['1 ngày', '2 tuần', '2 tháng'])
  })
})

describe('tô màu thanh điệu', () => {
  it('tách âm tiết và thanh', () => {
    expect(pinyinSyllables('ERP xì tǒng')).toEqual([
      { text: 'ERP', tone: 0 }, { text: 'xì', tone: 4 }, { text: 'tǒng', tone: 3 },
    ])
    expect(pinyinSyllables('xiè xie').map((s) => s.tone)).toEqual([4, 5])
  })
})

describe('cấp HSK 3.0', () => {
  it('dữ liệu hợp lệ và phủ phần lớn từ HSK 2.0', async () => {
    const m = (await import('@/data/hsk30.json')).default as Record<string, number>
    expect(Object.values(m).every((n) => Number.isInteger(n) && n >= 1 && n <= 7)).toBe(true)
    expect(m['你']).toBe(1)
    const all = (await Promise.all([1, 2, 3, 4, 5].map(async (l) => (await import(`@/data/hsk${l}.json`)).default as Array<{ hanzi: string }>))).flat()
    const hit = all.filter((w) => m[w.hanzi]).length
    expect(all.length).toBe(2491)
    expect(hit / all.length).toBeGreaterThan(0.95)
  })
})

describe('HSK 6', () => {
  it('đủ 2500 từ, id liên tục, không trùng chữ với cấp 1-5, có pinyin và nghĩa', async () => {
    const six = (await import('@/data/hsk6.json')).default as Array<{ id: string; level: number; hanzi: string; pinyin: string; meanings_en: string[] }>
    expect(six).toHaveLength(2500)
    expect(six.every((w, i) => w.level === 6 && w.id === `hsk6-${String(i + 1).padStart(4, '0')}`)).toBe(true)
    expect(six.every((w) => w.pinyin && w.meanings_en.length > 0)).toBe(true)
    expect(new Set(six.map((w) => w.hanzi)).size).toBe(2500)
    const low = new Set((await Promise.all([1, 2, 3, 4, 5].map(async (l) => (await import(`@/data/hsk${l}.json`)).default as Array<{ hanzi: string }>))).flat().map((w) => w.hanzi))
    expect(six.filter((w) => low.has(w.hanzi))).toHaveLength(0)
  })
  it('bộ kiểm tra dữ liệu chấp nhận cấp 6 và từ chối cấp 7', async () => {
    const { validateHskWord } = await import('@/lib/schema')
    const six = (await import('@/data/hsk6.json')).default[0]
    expect(validateHskWord(six, 'hsk6').filter((i: { message: string }) => /level/.test(i.message))).toHaveLength(0)
    expect(validateHskWord({ ...six, level: 7 }, 'hsk6').some((i: { message: string }) => /level/.test(i.message))).toBe(true)
  })
})
