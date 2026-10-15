import type { AppSettings, ContentOverride, DialogueProgress, ExamResult, HskWord, ItTerm } from '@/types'
import { api } from './api'
import type { CardState, ProgressExport, ReviewLogEntry, Storage } from './storage'
import type { SavedVideo } from './youtube'
import type { SavedPaper, SavedPaperMeta } from './mock-paper'

const q = encodeURIComponent

/** Nơi giữ nội dung gốc đã nạp (HSK, IT). Nội dung dùng chung cho mọi người nên không cần lên máy chủ. */
export type ContentStore = Pick<Storage, 'getContentVersion' | 'seedContent' | 'contentCounts'>

/**
 * Kho tiến độ lưu trên máy chủ ASP.NET Core + SQL Server. Chỉ dữ liệu của người đang đăng nhập:
 * máy chủ lấy id từ token chứ không từ yêu cầu, nên không thể đọc nhầm dữ liệu người khác.
 */
export class ApiStorage implements Storage {
  constructor(private content: ContentStore) {}

  async getSettings() {
    return (await api<AppSettings | undefined>('GET', '/me/settings')) ?? undefined
  }
  saveSettings = (s: AppSettings) => api('PUT', '/me/settings', s)

  async getCard(ref: string) {
    try {
      return await api<CardState>('GET', `/me/cards/one?ref=${q(ref)}`)
    } catch (e) {
      if ((e as { status?: number }).status === 404) return undefined
      throw e
    }
  }
  async createCardIfAbsent(card: CardState) {
    return (await api<{ created: boolean }>('POST', '/me/cards', card)).created
  }
  saveCard = (card: CardState) => api('PUT', '/me/cards', card)
  dueCards = (today: string) => api<CardState[]>('GET', `/me/cards/due?today=${q(today)}`)
  allCards = () => api<CardState[]>('GET', '/me/cards')

  addReview = (entry: ReviewLogEntry) => api('POST', '/me/reviews', entry)
  reviewsBetween = (from: string, to: string) => api<ReviewLogEntry[]>('GET', `/me/reviews?from=${q(from)}&to=${q(to)}`)

  async getOverride(key: string) {
    try {
      return await api<ContentOverride>('GET', `/me/overrides/one?key=${q(key)}`)
    } catch (e) {
      if ((e as { status?: number }).status === 404) return undefined
      throw e
    }
  }
  allOverrides = () => api<ContentOverride[]>('GET', '/me/overrides')
  saveOverride = (o: ContentOverride) => api('PUT', '/me/overrides', o)

  recordDialogue = (id: string, percent: number) => api('POST', '/me/dialogues', { id, percent })
  dialogueProgress = () => api<DialogueProgress[]>('GET', '/me/dialogues')

  listVideos = () => api<SavedVideo[]>('GET', '/me/videos')
  saveVideo = (v: SavedVideo) => api('PUT', '/me/videos', v)
  deleteVideo = (id: string) => api('DELETE', `/me/videos/${q(id)}`)

  listPapers = () => api<SavedPaperMeta[]>('GET', '/me/papers')
  async getPaper(id: string) {
    try {
      return await api<SavedPaper>('GET', `/me/papers/${q(id)}`)
    } catch (e) {
      if ((e as { status?: number }).status === 404) return undefined
      throw e
    }
  }
  savePaper = (p: SavedPaper) => api('PUT', '/me/papers', p)
  deletePaper = (id: string) => api('DELETE', `/me/papers/${q(id)}`)

  addExamResult = (r: ExamResult) => api('POST', '/me/exams', r)
  examResults = () => api<ExamResult[]>('GET', '/me/exams')

  exportAll = () => api<ProgressExport>('GET', '/me/export')
  importAll = (data: ProgressExport) => api('POST', '/me/import', data)

  getContentVersion = () => this.content.getContentVersion()
  seedContent = (w: HskWord[], t: ItTerm[], v: string) => this.content.seedContent(w, t, v)
  contentCounts = () => this.content.contentCounts()
}
