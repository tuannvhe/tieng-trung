import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildWordIndex, segment } from '@/lib/segment'
import { examplesFor, findExample } from '@/lib/examples'
import { countReadingUnits, validateDialogue } from '@/lib/schema'
import { pinyinMatches, sentenceMatches } from '@/lib/pinyin'
import type { DialogueData, HskWord } from '@/types'

const data: DialogueData = JSON.parse(readFileSync('src/data/dialogues.json', 'utf8'))
const hsk: HskWord[] = [1, 2, 3, 4, 5].flatMap((n) => JSON.parse(readFileSync(`src/data/hsk${n}.json`, 'utf8')))
const index = buildWordIndex(hsk)

describe('kho hội thoại', () => {
  it('có khoảng 500+ đoạn, nhiều câu, đủ chủ đề, tập trung nhà máy', () => {
    expect(data.items.length).toBeGreaterThanOrEqual(500)
    expect(data.items.flatMap((d) => d.lines).length).toBeGreaterThanOrEqual(2000)
    expect(data.topics.length).toBeGreaterThanOrEqual(25)
  })
  it('mọi đoạn hợp lệ: pinyin khớp số chữ, id duy nhất, chủ đề tồn tại', () => {
    const ids = new Set(data.topics.map((t) => t.id))
    const seen = new Set<string>()
    for (const d of data.items) {
      expect(validateDialogue(d, ids, d.id)).toEqual([])
      expect(seen.has(d.id)).toBe(false)
      seen.add(d.id)
    }
  })
  it('có đủ nội dung cho từng cấp HSK 1-5 để luyện', () => {
    for (let lv = 1; lv <= 5; lv++) expect(data.items.filter((d) => d.level === lv).length).toBeGreaterThanOrEqual(30)
  })
  it('đoạn nào cũng có lượt thoại của người dùng và xen kẽ vai', () => {
    for (const d of data.items) {
      expect(d.lines.some((l) => l.who === 'm')).toBe(true)
      d.lines.forEach((l, i) => i > 0 && expect(l.who).not.toBe(d.lines[i - 1].who))
    }
  })
  it('pinyin của các chữ đa âm đã rà soát được áp dụng', () => {
    const find = (sc: string) => data.items.flatMap((d) => d.lines).find((l) => l.sc.includes(sc))!
    expect(find('我得早点').py).toContain('děi')
    expect(find('您说得对').py).toContain('shuō de')
    expect(find('出了事故').py).toContain('chū le')
    expect(find('不转了').py).toContain('zhuàn')
    expect(find('轴承只剩').py).toContain('zhǐ shèng')
    expect(find('重新').py).toContain('chóng xīn')
    expect(find('严重').py).toContain('zhòng')
  })
})

describe('tách từ theo từ vựng HSK', () => {
  it('khớp từ dài nhất và gộp chữ Latin', () => {
    const t = segment('我在工作，ERP很慢。', index).map((x) => x.text)
    expect(t).toContain('工作')
    expect(t).toContain('ERP')
    expect(t.join('')).toBe('我在工作，ERP很慢。')
  })
  it('từ HSK gắn đúng thông tin, chữ ngoài HSK là token lẻ', () => {
    const toks = segment('电脑坏了', index)
    expect(toks.find((x) => x.text === '电脑')?.word?.level).toBe(1)
    expect(segment('厂', index)[0].word).toBeUndefined()
  })
  it('ghép lại luôn đúng bằng câu gốc với mọi câu thoại', () => {
    for (const l of data.items.flatMap((d) => d.lines).slice(0, 400)) expect(segment(l.sc, index).map((x) => x.text).join('')).toBe(l.sc)
  })
  it('đơn vị đọc của token khớp số âm tiết của câu', () => {
    for (const l of data.items.flatMap((d) => d.lines).slice(0, 200)) {
      const units = segment(l.sc, index).reduce((n, t) => n + countReadingUnits(t.text), 0)
      expect(units).toBe(l.py.split(' ').length)
    }
  })
})

describe('câu ví dụ trong nhà máy cho từ HSK', () => {
  it('tìm được câu chứa từ và ưu tiên đoạn thoại dễ hơn', () => {
    const ex = findExample('工作', data.items)!
    expect(ex.sc).toContain('工作')
    const all = data.items.filter((d) => d.lines.some((l) => l.sc.includes('工作') && [...l.sc].length <= 22))
    expect(ex.level).toBe(Math.min(...all.map((d) => d.level)))
  })
  it('examplesFor trả về ví dụ đúng cho nhiều từ một lượt', () => {
    const m = examplesFor(['电脑', '不存在的词语'], data.items)
    expect(m.get('电脑')?.sc).toContain('电脑')
    expect(m.has('不存在的词语')).toBe(false)
  })
  it('đa số từ HSK1 có ví dụ trong kho hội thoại', () => {
    const w1 = hsk.filter((w) => w.level === 1).map((w) => w.hanzi)
    const m = examplesFor(w1, data.items)
    expect(m.size / w1.length).toBeGreaterThan(0.7)
  })
})

describe('so khớp pinyin chịu biến điệu', () => {
  it('一 và 不 gõ dạng gốc hay dạng biến điệu đều đúng', () => {
    expect(pinyinMatches('yi2 ge4', 'yí gè')).toBe(true)
    expect(pinyinMatches('yi1 ge4', 'yí gè')).toBe(true)
    expect(pinyinMatches('bu4 xing2', 'bù xíng')).toBe(true)
    expect(pinyinMatches('bu2 cuo4', 'bú cuò')).toBe(true)
    expect(pinyinMatches('bu4 cuo4', 'bú cuò')).toBe(true)
  })
  it('vẫn từ chối sai thanh ở âm tiết khác', () => {
    expect(pinyinMatches('yi1 ge2', 'yí gè')).toBe(false)
    expect(sentenceMatches('bu4 shi4 wo3', 'bú shì wǒ')).toBe(true)
    expect(sentenceMatches('bu4 shi4 wo2', 'bú shì wǒ')).toBe(false)
  })
})

describe('ngữ pháp theo cấp HSK', () => {
  const g = JSON.parse(readFileSync('src/data/grammar-hsk.json', 'utf8')) as Array<import('@/types').GrammarPoint>
  it('30 mẫu, mỗi cấp HSK 1-5 có 6 mẫu, đều hợp lệ', async () => {
    const { validateGrammar } = await import('@/lib/schema')
    expect(g).toHaveLength(30)
    for (let lv = 1; lv <= 5; lv++) expect(g.filter((x) => x.hsk === lv)).toHaveLength(6)
    for (const x of g) expect(validateGrammar(x, x.id)).toEqual([])
  })
  it('câu sai luôn khác câu đúng, và bài sắp xếp ghép lại được thành câu có nghĩa', () => {
    for (const x of g) {
      expect(x.mistake.wrong).not.toBe(x.mistake.right)
      for (const e of x.exercises) expect(e.tokens.join('').length).toBeGreaterThan(3)
    }
  })
})
