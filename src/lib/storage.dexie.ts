import Dexie, { type Table } from 'dexie'
import type { AppSettings, ContentOverride, DialogueProgress, ExamResult, HskWord, ItTerm } from '@/types'
import type { CardState, ProgressExport, ReviewLogEntry, Storage } from './storage'
import { isSavedVideo, type SavedVideo } from './youtube'
import { isSavedPaper, MAX_SAVED_PAPERS, type SavedPaper, type SavedPaperMeta } from './mock-paper'

class AppDb extends Dexie {
  settings!: Table<{ id: 'main'; value: AppSettings }, string>
  cards!: Table<CardState, string>
  log!: Table<ReviewLogEntry, number>
  overrides!: Table<ContentOverride, string>
  hsk!: Table<HskWord, string | number>
  it!: Table<ItTerm, string>
  meta!: Table<{ key: string; value: string }, string>
  exams!: Table<ExamResult, number>
  dialogues!: Table<DialogueProgress, string>
  videos!: Table<SavedVideo, string>
  papers!: Table<SavedPaper, string>

  constructor(name = 'hoc-trung-it') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      cards: 'ref, due',
      log: '++id, day, ref',
      overrides: 'key',
    })
    this.version(2).stores({
      hsk: 'id, level, hanzi',
      it: 'id, domain, hanzi_sc',
      meta: 'key',
    })
    this.version(3).stores({ exams: '++id, at, kind' })
    this.version(4).stores({ dialogues: 'id' })
    this.version(5).stores({ videos: 'id, createdAt' })
    this.version(6).stores({ papers: 'id, savedAt' })
  }
}

export class DexieStorage implements Storage {
  readonly db: AppDb
  constructor(dbName?: string) {
    this.db = new AppDb(dbName)
  }

  async getSettings() {
    return (await this.db.settings.get('main'))?.value
  }
  async saveSettings(s: AppSettings) {
    await this.db.settings.put({ id: 'main', value: s })
  }

  getCard(ref: string) {
    return this.db.cards.get(ref)
  }
  createCardIfAbsent(card: CardState) {
    return this.db.transaction('rw', this.db.cards, async () => {
      if (await this.db.cards.get(card.ref)) return false
      await this.db.cards.add(card)
      return true
    })
  }
  async saveCard(card: CardState) {
    await this.db.cards.put(card)
  }
  dueCards(today: string) {
    return this.db.cards.where('due').belowOrEqual(today).toArray()
  }
  allCards() {
    return this.db.cards.toArray()
  }

  async addReview(entry: ReviewLogEntry) {
    await this.db.log.add(entry)
  }
  reviewsBetween(fromDay: string, toDay: string) {
    return this.db.log.where('day').between(fromDay, toDay, true, true).toArray()
  }

  getOverride(key: string) {
    return this.db.overrides.get(key)
  }
  allOverrides() {
    return this.db.overrides.toArray()
  }
  async saveOverride(o: ContentOverride) {
    await this.db.overrides.put(o)
  }

  async getContentVersion() {
    return (await this.db.meta.get('contentVersion'))?.value
  }
  async seedContent(words: HskWord[], terms: ItTerm[], version: string) {
    const { db } = this
    await db.transaction('rw', db.hsk, db.it, db.meta, async () => {
      await db.hsk.clear()
      await db.it.clear()
      await db.hsk.bulkPut(words)
      await db.it.bulkPut(terms)
      await db.meta.put({ key: 'contentVersion', value: version })
    })
  }
  async contentCounts() {
    return { hsk: await this.db.hsk.count(), it: await this.db.it.count() }
  }

  recordDialogue(id: string, percent: number) {
    return this.db.transaction('rw', this.db.dialogues, async () => {
      const prev = await this.db.dialogues.get(id)
      await this.db.dialogues.put({ id, best: Math.max(prev?.best ?? 0, percent), attempts: (prev?.attempts ?? 0) + 1, last: Date.now() })
    })
  }
  dialogueProgress() {
    return this.db.dialogues.toArray()
  }

  async listVideos() {
    return (await this.db.videos.orderBy('createdAt').reverse().toArray()).filter(isSavedVideo)
  }
  async saveVideo(v: SavedVideo) {
    if (!isSavedVideo(v)) throw new Error('Video không hợp lệ')
    // Bản sao thuần: đối tượng reactive của Vue (Proxy) không lưu được vào IndexedDB
    await this.db.videos.put(JSON.parse(JSON.stringify(v)) as SavedVideo)
  }
  async deleteVideo(id: string) {
    await this.db.videos.delete(id)
  }

  async listPapers(): Promise<SavedPaperMeta[]> {
    const all = (await this.db.papers.orderBy('savedAt').reverse().toArray()).filter(isSavedPaper)
    return all.map(({ json: _j, ...meta }) => meta)
  }
  async getPaper(id: string) {
    const p = await this.db.papers.get(id)
    return isSavedPaper(p) ? p : undefined
  }
  async savePaper(p: SavedPaper) {
    if (!isSavedPaper(p)) throw new Error('Đề không hợp lệ hoặc quá lớn')
    if (!(await this.db.papers.get(p.id)) && (await this.db.papers.count()) >= MAX_SAVED_PAPERS) throw new Error(`Đã lưu tối đa ${MAX_SAVED_PAPERS} đề, hãy xóa bớt trước.`)
    await this.db.papers.put({ ...p })
  }
  async deletePaper(id: string) {
    await this.db.papers.delete(id)
  }

  async addExamResult(r: ExamResult) {
    const { id: _id, ...rest } = r
    await this.db.exams.add(rest)
  }
  examResults() {
    return this.db.exams.orderBy('at').toArray()
  }

  async exportAll(): Promise<ProgressExport> {
    const settings = (await this.getSettings())!
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      cards: await this.db.cards.toArray(),
      log: await this.db.log.toArray(),
      overrides: await this.db.overrides.toArray(),
      exams: await this.db.exams.toArray(),
      dialogues: await this.db.dialogues.toArray(),
      videos: await this.db.videos.toArray(),
      papers: await this.db.papers.toArray(),
    }
  }

  async importAll(data: ProgressExport) {
    if (data?.version !== 1) throw new Error('File tiến độ không đúng phiên bản')
    const { db } = this
    await db.transaction('rw', [db.settings, db.cards, db.log, db.overrides, db.exams, db.dialogues, db.videos, db.papers], async () => {
      await Promise.all([db.settings.clear(), db.cards.clear(), db.log.clear(), db.overrides.clear(), db.exams.clear(), db.dialogues.clear(), db.videos.clear(), db.papers.clear()])
      if (data.settings) await db.settings.put({ id: 'main', value: data.settings })
      await db.cards.bulkPut(data.cards ?? [])
      await db.log.bulkAdd((data.log ?? []).map(({ id: _id, ...rest }) => rest))
      await db.overrides.bulkPut(data.overrides ?? [])
      await db.exams.bulkAdd((data.exams ?? []).map(({ id: _id, ...rest }) => rest))
      await db.dialogues.bulkPut(data.dialogues ?? [])
      await db.videos.bulkPut((data.videos ?? []).filter(isSavedVideo))
      await db.papers.bulkPut((data.papers ?? []).filter(isSavedPaper).slice(0, MAX_SAVED_PAPERS))
    })
  }
}
