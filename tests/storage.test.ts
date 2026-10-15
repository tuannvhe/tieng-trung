import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { DexieStorage } from '@/lib/storage.dexie'
import type { CardState } from '@/lib/storage'

const card = (ref: string): CardState => ({
  ref, ease: 2.5, interval: 0, repetitions: 0, due: '2026-10-14', lapses: 0, createdAt: 1,
})

describe('DexieStorage', () => {
  it('createCardIfAbsent chỉ tạo một thẻ khi gọi đồng thời', async () => {
    const s = new DexieStorage('t-dup')
    const results = await Promise.all([1, 2, 3, 4].map(() => s.createCardIfAbsent(card('hsk:1'))))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await s.allCards()).toHaveLength(1)
  })

  it('seedContent idempotent theo version, không đè override', async () => {
    const s = new DexieStorage('t-seed')
    const w: any = { id: 'a', level: 1, hanzi: '好' }
    const t: any = { id: 'it-1', domain: 'server', hanzi_sc: '服务器' }
    await s.seedContent([w], [t], 'v1')
    await s.saveOverride({ key: 'hsk:a', meaning_vi: 'tốt', updatedAt: 1 })
    expect(await s.getContentVersion()).toBe('v1')
    await s.seedContent([w], [t], 'v2')
    expect(await s.contentCounts()).toEqual({ hsk: 1, it: 1 })
    expect((await s.getOverride('hsk:a'))?.meaning_vi).toBe('tốt')
  })

  it('export rồi import khôi phục tiến độ', async () => {
    const a = new DexieStorage('t-exp-a')
    await a.saveSettings({ mode: 'it-only', theme: 'dark', zhFontSize: 30, showPinyin: false, newCardsPerDay: 5, weeklyDays: 5, goal: 'it:all' })
    await a.createCardIfAbsent(card('it:x'))
    await a.addReview({ ref: 'it:x', grade: 2, day: '2026-10-14', at: 1 })
    const dump = await a.exportAll()
    const b = new DexieStorage('t-exp-b')
    await b.importAll(dump)
    expect((await b.getSettings())?.mode).toBe('it-only')
    expect(await b.allCards()).toHaveLength(1)
    expect(await b.reviewsBetween('2026-10-14', '2026-10-14')).toHaveLength(1)
  })
})

describe('tiến độ hội thoại', () => {
  it('giữ điểm cao nhất, đếm số lần, và đi theo file xuất/nhập', async () => {
    const a = new DexieStorage('t-dlg-a')
    await a.saveSettings({ mode: 'full', theme: 'system', zhFontSize: 28, showPinyin: true, newCardsPerDay: 15, weeklyDays: 5, goal: 'it:all' })
    await a.recordDialogue('dl-0001', 50)
    await a.recordDialogue('dl-0001', 100)
    await a.recordDialogue('dl-0001', 75)
    await a.recordDialogue('dl-0002', 25)
    const p = Object.fromEntries((await a.dialogueProgress()).map((x) => [x.id, x]))
    expect(p['dl-0001']).toMatchObject({ best: 100, attempts: 3 })
    expect(p['dl-0002']).toMatchObject({ best: 25, attempts: 1 })
    const b = new DexieStorage('t-dlg-b')
    await b.importAll(await a.exportAll())
    expect((await b.dialogueProgress()).length).toBe(2)
  })
})

describe('video YouTube đã lưu', () => {
  const v = (id: string, createdAt: number) => ({ id, videoId: 'dQw4w9WgXcQ', title: 't' + id, note: '', level: 1 as const, start: 0, createdAt })

  it('lưu, sắp xếp mới nhất trước, sửa và xóa; mỗi kho riêng', async () => {
    const a = new DexieStorage('t-vid-a')
    const b = new DexieStorage('t-vid-b')
    await a.saveVideo(v('1', 10))
    await a.saveVideo(v('2', 20))
    expect((await a.listVideos()).map((x) => x.id)).toEqual(['2', '1'])
    await a.saveVideo({ ...v('1', 10), title: 'đổi' })
    expect((await a.listVideos()).find((x) => x.id === '1')?.title).toBe('đổi')
    expect(await b.listVideos()).toEqual([])
    await a.deleteVideo('2')
    expect(await a.listVideos()).toHaveLength(1)
  })

  it('từ chối video sai mã và lọc video hỏng khi nhập', async () => {
    const s = new DexieStorage('t-vid-c')
    await expect(s.saveVideo({ ...v('x', 1), videoId: '<script>' })).rejects.toThrow()
    await s.saveSettings({ mode: 'full', theme: 'system', zhFontSize: 28, showPinyin: true, newCardsPerDay: 15, weeklyDays: 5, goal: 'it:all' })
    const base = await s.exportAll()
    await s.importAll({ ...base, videos: [v('ok', 1), { ...v('bad', 2), videoId: 'nope' }] })
    expect((await s.listVideos()).map((x) => x.id)).toEqual(['ok'])
  })
})

describe('video với dữ liệu reactive', () => {
  it('lưu được video có danh sách mốc là Proxy của Vue (lỗi DataCloneError trước đây)', async () => {
    const { reactive } = await import('vue')
    const s = new DexieStorage('t-vid-reactive')
    const base = reactive({ id: 'r1', videoId: 'dQw4w9WgXcQ', title: 't', note: '', level: 1 as const, start: 0, createdAt: 1, marks: [{ t: 5, note: 'a' }] })
    await s.saveVideo({ ...base, marks: [...base.marks, { t: 9, note: 'b' }] })
    expect((await s.listVideos())[0].marks).toEqual([{ t: 5, note: 'a' }, { t: 9, note: 'b' }])
  })
})

describe('đề thi thử đã lưu', () => {
  const p = (id: string, at: number) => ({ id, title: 'Đề ' + id, level: 3, savedAt: at, json: '{"a":1}' })
  it('lưu, liệt kê không kèm nội dung, lấy lại, xóa, riêng từng kho', async () => {
    const a = new DexieStorage('t-pap-a')
    const b = new DexieStorage('t-pap-b')
    await a.savePaper(p('1', 1))
    await a.savePaper(p('2', 2))
    const list = await a.listPapers()
    expect(list.map((x) => x.id)).toEqual(['2', '1'])
    expect('json' in list[0]).toBe(false)
    expect((await a.getPaper('1'))?.json).toBe('{"a":1}')
    expect(await b.listPapers()).toEqual([])
    await a.deletePaper('1')
    expect(await a.getPaper('1')).toBeUndefined()
  })
  it('từ chối đề sai, quá lớn hoặc vượt số lượng; lọc đề hỏng khi nhập', async () => {
    const s = new DexieStorage('t-pap-c')
    await expect(s.savePaper({ ...p('x', 1), level: 9 })).rejects.toThrow()
    await expect(s.savePaper({ ...p('x', 1), json: 'a'.repeat(300_001) })).rejects.toThrow()
    for (let i = 0; i < 30; i++) await s.savePaper(p('p' + i, i))
    await expect(s.savePaper(p('extra', 99))).rejects.toThrow(/tối đa/)
    await s.savePaper({ ...p('p0', 5), title: 'sửa' }) // ghi đè đề có sẵn vẫn được
    const base = await s.exportAll()
    await s.importAll({ ...base, papers: [p('ok', 1), { ...p('bad', 2), level: 0 }] })
    expect((await s.listPapers()).map((x) => x.id)).toEqual(['ok'])
  })
})
