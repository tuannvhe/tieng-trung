import type { AppSettings, ContentOverride, DialogueProgress, ExamResult, HskWord, ItTerm } from '@/types'
import type { SavedVideo } from './youtube'
import type { SavedPaper, SavedPaperMeta } from './mock-paper'

/** Thẻ SRS. `ref` = 'hsk:<id>' | 'it:<id>' — dùng chung một deck cho HSK và IT. */
export interface CardState {
  ref: string
  ease: number
  interval: number // ngày
  repetitions: number
  /** Ngày đến hạn theo giờ địa phương, dạng 'YYYY-MM-DD' */
  due: string
  lapses: number
  createdAt: number
}

export interface ReviewLogEntry {
  id?: number
  ref: string
  /** 0=Quên 1=Khó 2=Được 3=Dễ */
  grade: 0 | 1 | 2 | 3
  /** Ngày địa phương 'YYYY-MM-DD' */
  day: string
  at: number
}

export interface ProgressExport {
  version: 1
  exportedAt: string
  settings: AppSettings
  cards: CardState[]
  log: ReviewLogEntry[]
  overrides: ContentOverride[]
  exams?: ExamResult[]
  dialogues?: DialogueProgress[]
  videos?: SavedVideo[]
  papers?: SavedPaper[]
}

/**
 * Giao diện lưu trữ. UI chỉ biết interface này; có thể thay bằng
 * bản gọi API ASP.NET Core + SQL Server mà không sửa UI.
 */
export interface Storage {
  getSettings(): Promise<AppSettings | undefined>
  saveSettings(s: AppSettings): Promise<void>

  getCard(ref: string): Promise<CardState | undefined>
  /** Tạo thẻ mới nếu chưa có (atomic, chống trùng khi nhiều tab). Trả về true nếu đã tạo. */
  createCardIfAbsent(card: CardState): Promise<boolean>
  saveCard(card: CardState): Promise<void>
  dueCards(today: string): Promise<CardState[]>
  allCards(): Promise<CardState[]>

  addReview(entry: ReviewLogEntry): Promise<void>
  reviewsBetween(fromDay: string, toDay: string): Promise<ReviewLogEntry[]>

  getOverride(key: string): Promise<ContentOverride | undefined>
  allOverrides(): Promise<ContentOverride[]>
  saveOverride(o: ContentOverride): Promise<void>

  /** Ghi một lượt luyện hội thoại: giữ điểm cao nhất, tăng số lần. */
  recordDialogue(id: string, percent: number): Promise<void>
  dialogueProgress(): Promise<DialogueProgress[]>

  /** Video YouTube người dùng tự lưu để học (riêng từng người). */
  listVideos(): Promise<SavedVideo[]>
  saveVideo(v: SavedVideo): Promise<void>
  deleteVideo(id: string): Promise<void>

  /** Đề thi thử đã nạp từ file (riêng từng người). Danh sách chỉ có thông tin tóm tắt, lấy nội dung bằng getPaper. */
  listPapers(): Promise<SavedPaperMeta[]>
  getPaper(id: string): Promise<SavedPaper | undefined>
  savePaper(p: SavedPaper): Promise<void>
  deletePaper(id: string): Promise<void>

  addExamResult(r: ExamResult): Promise<void>
  examResults(): Promise<ExamResult[]>

  exportAll(): Promise<ProgressExport>
  importAll(data: ProgressExport): Promise<void>

  /** Kho nội dung gốc trong DB cục bộ (HSK + IT). Override của người dùng nằm bảng riêng nên không bị đè. */
  getContentVersion(): Promise<string | undefined>
  seedContent(words: HskWord[], terms: ItTerm[], version: string): Promise<void>
  contentCounts(): Promise<{ hsk: number; it: number }>
}

let current: Storage | null = null

export function setStorage(s: Storage) {
  current = s
}

/** Kích hoạt kho tiến độ riêng của một người dùng. Gọi ngay sau khi đăng nhập hoặc khôi phục phiên. */
export async function activateUserStorage(userId: string): Promise<Storage> {
  const [{ DexieStorage }, { userDbName }, { apiEnabled }] = await Promise.all([import('./storage.dexie'), import('./auth'), import('./api')])
  if (apiEnabled) {
    const { ApiStorage } = await import('./storage.api')
    // Nội dung gốc (HSK, IT) dùng chung nên vẫn nạp vào một kho cục bộ; tiến độ thì lên máy chủ
    current = new ApiStorage(new DexieStorage('hoc-trung-it-content'))
    return current
  }
  current = new DexieStorage(userDbName(userId))
  return current
}

export function deactivateStorage() {
  current = null
}

/** Kho tiến độ của người dùng đang đăng nhập. Chưa đăng nhập thì báo lỗi, tránh vô tình đọc dữ liệu người khác. */
export async function getStorage(): Promise<Storage> {
  if (!current) throw new Error('Chưa đăng nhập, chưa có kho tiến độ.')
  return current
}
