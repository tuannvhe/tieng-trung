export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6

/** Một mục từ HSK (dữ liệu gốc drkameleon/complete-hsk-vocabulary, đã chuẩn hóa). */
export interface HskWord {
  id: string | number
  level: HskLevel
  unit?: string | number
  hanzi: string
  traditional: string
  radical: string
  pos: string[]
  frequency: number
  pinyin: string
  numeric: string
  meanings_en: string[]
  forms: unknown[]
  meaning_vi: string
  han_viet: string
}

export const IT_DOMAINS = [
  'network',
  'server',
  'database',
  'dev',
  'erp_mes',
  'devices',
  'support',
  'comms',
] as const
export type ItDomain = (typeof IT_DOMAINS)[number]

export const IT_DOMAIN_LABELS: Record<ItDomain, string> = {
  network: 'Mạng & hạ tầng',
  server: 'Server, HĐH, bảo mật',
  database: 'Cơ sở dữ liệu',
  dev: 'Lập trình & phát triển',
  erp_mes: 'ERP & MES',
  devices: 'Thiết bị nhà máy',
  support: 'Hỗ trợ & xử lý sự cố',
  comms: 'Giao tiếp công việc',
}

/**
 * Thuật ngữ IT. `pinyin` ghi tay, tách âm tiết bằng dấu cách, giữ nguyên chữ Latin (ERP, MES...).
 * `hsk_max`: cấp HSK cao nhất trong các chữ Hán cấu thành; 6 = có chữ ngoài HSK1-5.
 */
export interface ItTerm {
  id: string
  domain: ItDomain
  hanzi_sc: string
  hanzi_tc?: string
  pinyin: string
  vi: string
  en: string
  example_sc: string
  example_pinyin: string
  example_vi: string
  hsk_max: 1 | 2 | 3 | 4 | 5 | 6
  reviewed: boolean
}

/** Phần người dùng sửa, ghi đè dữ liệu gốc (lưu IndexedDB). */
export interface ContentOverride {
  /** 'hsk:<id>' | 'it:<id>' */
  key: string
  meaning_vi?: string
  han_viet?: string
  note?: string
  reviewed?: boolean
  updatedAt: number
}

export type AppMode = 'full' | 'it-only'
export type ThemePref = 'system' | 'light' | 'dark'

export interface AppSettings {
  mode: AppMode
  theme: ThemePref
  /** Cỡ chữ Hán, px */
  zhFontSize: number
  showPinyin: boolean
  newCardsPerDay: number
  /** Mục tiêu số ngày học mỗi tuần (1–7) */
  weeklyDays: number
  /** Mục tiêu học: 'it:all' hoặc 'hsk:<cấp>' */
  goal: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  mode: 'full',
  theme: 'system',
  zhFontSize: 28,
  showPinyin: true,
  newCardsPerDay: 15,
  weeklyDays: 5,
  goal: 'it:all',
}

/** Tên Hán ngắn của từng nhóm IT, dùng làm chữ trên con dấu. */
export const IT_DOMAIN_ZH: Record<ItDomain, string> = {
  network: '网络',
  server: '服务',
  database: '数据',
  dev: '开发',
  erp_mes: '生产',
  devices: '设备',
  support: '支持',
  comms: '沟通',
}

export interface ReadingToken {
  t: string
  /** Ghi tay. Dấu câu thì bỏ trống. */
  py?: string
  vi?: string
}

export interface ReadingPassage {
  id: string
  title: string
  kind: 'error' | 'request' | 'notice' | 'report'
  tokens: ReadingToken[]
  translation_vi: string
  reviewed: boolean
}

export interface ScenarioLine {
  /** o = đối phương, m = bạn (vai người dùng đóng) */
  who: 'o' | 'm'
  sc: string
  py: string
  vi: string
}

export interface Scenario {
  id: string
  title: string
  /** Nói chuyện với ai */
  with: string
  domain: ItDomain
  lines: ScenarioLine[]
  reviewed: boolean
}

export interface TemplateOption {
  sc: string
  vi: string
}
export interface TemplateVar {
  key: string
  label: string
  options: TemplateOption[]
}
export interface MessageTemplate {
  id: string
  title: string
  channel: 'wechat' | 'email'
  when: string
  vars: TemplateVar[]
  /** Nội dung có chỗ điền dạng {{key}} */
  sc: string
  vi: string
  reviewed: boolean
}

export interface GrammarExample {
  sc: string
  py: string
  vi: string
}
export interface SortExercise {
  /** Các mảnh theo thứ tự đúng */
  tokens: string[]
  py: string
  vi: string
}
export interface GrammarPoint {
  id: string
  /** Cấp HSK của mẫu câu; không có = ngữ pháp công sở */
  hsk?: 1 | 2 | 3 | 4 | 5
  title: string
  pattern: string
  explain: string
  mistake: { wrong: string; right: string; why: string }
  examples: GrammarExample[]
  exercises: SortExercise[]
  reviewed: boolean
}

export interface ExamResult {
  id?: number
  /** level: thi cuối cấp; placement: thi xếp lớp (level = cấp được đề xuất); mock: thi thử theo cấu trúc HSK */
  kind: 'level' | 'placement' | 'mock'
  level: HskLevel
  correct: number
  total: number
  percent: number
  passed: boolean
  at: number
  /** Thi thử: JSON điểm từng phần, ví dụ [{"skill":"listening","score":80}] */
  detail?: string
}

export interface DialogueLine {
  /** o = đối phương, m = bạn (vai người dùng đóng) */
  who: 'o' | 'm'
  sc: string
  py: string
  vi: string
}

export interface DialogueTopic {
  id: string
  label: string
}

export interface Dialogue {
  id: string
  topic: string
  title: string
  /** Cấp HSK theo độ phủ (90% số chữ thuộc HSK ≤ cấp này); 6 = nhiều chữ ngoài HSK1-5 */
  level: number
  /** Cấp của chữ khó nhất trong đoạn */
  maxLevel: number
  lines: DialogueLine[]
  reviewed: boolean
}

export interface DialogueData {
  topics: DialogueTopic[]
  items: Dialogue[]
}

/** Kết quả luyện một đoạn hội thoại (điểm cao nhất, số lần luyện). */
export interface DialogueProgress {
  id: string
  /** Điểm cao nhất, 0-100: % câu đúng ngay lần đầu */
  best: number
  attempts: number
  last: number
}
