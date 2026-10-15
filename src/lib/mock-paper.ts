import { shuffle, type Rng } from './exercise'
import type { MockExam, MockKind, MockLevel, MockQuestion, MockSpec, SectionSpec, Skill } from './mock'

/**
 * Nạp một đề thi từ file JSON do người dùng cung cấp (đề tự soạn, hoặc đề họ có quyền sử dụng).
 * Ứng dụng KHÔNG kèm đề thi HSK thật vì đề có bản quyền; chỉ cần đưa đề vào đây để dùng chung khung thi thử.
 */
export interface PaperQuestion {
  kind: MockKind
  /** Phần được đọc lên bằng giọng máy (bắt buộc với câu nghe) */
  audio?: string
  /** Tên file mp3 đi kèm (câu nghe), ví dụ "cau01.mp3"; chọn file này cùng lúc khi nạp đề */
  mp3?: string
  /** Chữ Hán hiển thị (bắt buộc với câu đọc) */
  text?: string
  ask: string
  /** Câu trắc nghiệm: 2 đến 6 lựa chọn */
  options?: string[]
  /** Vị trí đáp án đúng, tính từ 0 */
  answer?: number
  /** Câu sắp xếp: các từ theo thứ tự đúng */
  tokens?: string[]
  /** Câu sắp xếp: thứ tự hiển thị; bỏ trống thì ứng dụng tự xáo */
  bank?: string[]
}
export interface PaperSection {
  skill: Skill
  minutes: number
  questions: PaperQuestion[]
}
export interface Paper {
  title: string
  level: MockLevel
  /** Điểm đạt (tối đa là số phần x 100); bỏ trống thì lấy 60% */
  pass?: number
  /** Nguồn gốc và giấy phép của đề, để người dùng tự nhớ */
  source?: string
  sections: PaperSection[]
}

const KINDS: MockKind[] = ['hear-meaning', 'hear-reply', 'hear-passage', 'read-meaning', 'fill-blank', 'read-reply', 'read-passage', 'reorder']
const SKILLS: Skill[] = ['listening', 'reading', 'writing']
export const MAX_PAPER_QUESTIONS = 300
/** Giới hạn đề lưu trong tài khoản */
export const MAX_SAVED_PAPERS = 30
export const MAX_PAPER_CHARS = 300_000
const MAX_TEXT = 1500

/** Một đề đã nạp và lưu trong tài khoản; `json` là nội dung file gốc đã được kiểm tra. */
export interface SavedPaper {
  id: string
  title: string
  level: number
  savedAt: number
  json: string
}
export type SavedPaperMeta = Omit<SavedPaper, 'json'>

export function isSavedPaper(v: unknown): v is SavedPaper {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return (
    typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 64 &&
    typeof x.title === 'string' && x.title.length > 0 && x.title.length <= 120 &&
    Number.isInteger(x.level) && (x.level as number) >= 1 && (x.level as number) <= 6 &&
    typeof x.savedAt === 'number' &&
    typeof x.json === 'string' && x.json.length > 0 && x.json.length <= MAX_PAPER_CHARS
  )
}

export interface PaperResult {
  exam?: MockExam
  title?: string
  errors: string[]
}

const isStr = (v: unknown, max = MAX_TEXT): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max

/** Kiểm tra cặn kẽ nội dung file và dựng thành bài thi. Trả về danh sách lỗi cụ thể theo vị trí câu. */
export function parsePaper(raw: string, rng: Rng = Math.random): PaperResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { errors: ['File không phải JSON hợp lệ (kiểm tra dấu phẩy, dấu ngoặc và dấu nháy kép).'] }
  }
  const errors: string[] = []
  const p = data as Partial<Paper>
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { errors: ['Nội dung gốc của file phải là một đối tượng JSON.'] }
  if (!isStr(p.title, 120)) errors.push('Thiếu "title" (tên đề, tối đa 120 ký tự).')
  if (![1, 2, 3, 4, 5, 6].includes(p.level as number)) errors.push('"level" phải là số từ 1 đến 6.')
  if (!Array.isArray(p.sections) || p.sections.length < 1 || p.sections.length > 4) errors.push('"sections" phải có từ 1 đến 4 phần.')
  if (errors.length) return { errors }

  const sections = p.sections as PaperSection[]
  const questions: MockQuestion[] = []
  const starts: number[] = []
  const specSections: SectionSpec[] = []
  let total = 0

  sections.forEach((s, si) => {
    const where = `Phần ${si + 1}`
    if (!s || !SKILLS.includes(s.skill)) return void errors.push(`${where}: "skill" phải là listening, reading hoặc writing.`)
    if (!Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 240) errors.push(`${where}: "minutes" phải là số nguyên từ 1 đến 240.`)
    if (!Array.isArray(s.questions) || s.questions.length < 1) return void errors.push(`${where}: cần ít nhất một câu hỏi.`)
    starts.push(questions.length)
    const mix: SectionSpec['mix'] = {}
    s.questions.forEach((q, qi) => {
      const at = `${where}, câu ${qi + 1}`
      total++
      if (!q || !KINDS.includes(q.kind)) return void errors.push(`${at}: "kind" không hợp lệ (dùng một trong: ${KINDS.join(', ')}).`)
      if (!isStr(q.ask, 300)) errors.push(`${at}: thiếu "ask" (yêu cầu của câu, tối đa 300 ký tự).`)
      const listening = q.kind.startsWith('hear-')
      if (q.mp3 !== undefined && !(typeof q.mp3 === 'string' && /^[^\\/:*?"<>|]{1,100}\.mp3$/i.test(q.mp3))) errors.push(`${at}: "mp3" phải là tên file kết thúc bằng .mp3, không có đường dẫn.`)
      if (listening && !isStr(q.audio)) errors.push(`${at}: câu nghe cần "audio" (chữ Hán sẽ được đọc lên).`)
      if (!listening && q.kind !== 'reorder' && !isStr(q.text)) errors.push(`${at}: câu đọc cần "text".`)
      if (listening !== (s.skill === 'listening') && q.kind !== 'reorder') errors.push(`${at}: dạng "${q.kind}" không khớp kỹ năng "${s.skill}" của phần này.`)
      mix[q.kind] = (mix[q.kind] ?? 0) + 1

      if (q.kind === 'reorder') {
        const t = q.tokens
        if (!Array.isArray(t) || t.length < 2 || t.length > 15 || !t.every((x) => isStr(x, 20))) return void errors.push(`${at}: câu sắp xếp cần "tokens" gồm 2-15 từ.`)
        let bank = q.bank
        if (bank !== undefined && (!Array.isArray(bank) || [...bank].sort().join('|') !== [...t].sort().join('|'))) {
          errors.push(`${at}: "bank" phải gồm đúng các từ của "tokens", chỉ khác thứ tự.`)
          bank = undefined
        }
        bank ??= shuffle(t, rng)
        questions.push({ skill: s.skill, kind: 'reorder', ask: q.ask, options: [], answer: -1, tokens: t, bank })
        return
      }
      const o = q.options
      if (!Array.isArray(o) || o.length < 2 || o.length > 6 || !o.every((x) => isStr(x, 300))) return void errors.push(`${at}: cần "options" gồm 2-6 lựa chọn không rỗng.`)
      if (new Set(o).size !== o.length) errors.push(`${at}: các lựa chọn không được trùng nhau.`)
      if (!Number.isInteger(q.answer) || (q.answer as number) < 0 || (q.answer as number) >= o.length) return void errors.push(`${at}: "answer" phải là số thứ tự (từ 0) của một lựa chọn.`)
      questions.push({ skill: s.skill, kind: q.kind, audio: q.audio, text: q.text, ask: q.ask, options: o, answer: q.answer as number, ...(listening && q.mp3 ? { mp3: q.mp3 } : {}) })
    })
    specSections.push({ skill: s.skill, minutes: s.minutes, mix })
  })

  if (total > MAX_PAPER_QUESTIONS) errors.push(`Đề có ${total} câu, tối đa ${MAX_PAPER_QUESTIONS} câu.`)
  const max = specSections.length * 100
  if (p.pass !== undefined && (!Number.isInteger(p.pass) || p.pass < 1 || p.pass > max)) errors.push(`"pass" phải là số nguyên từ 1 đến ${max}.`)
  if (errors.length) return { errors }

  const spec: MockSpec = {
    level: p.level as MockLevel,
    sections: specSections,
    max,
    pass: p.pass ?? Math.round(max * 0.6),
    note: `Đề nạp từ file: ${p.title}${p.source ? ` (nguồn: ${p.source})` : ''}. Số câu, thời gian và điểm đạt theo file, không do ứng dụng quyết định.`,
  }
  return { exam: { level: spec.level, spec, questions, starts }, title: p.title, errors: [] }
}

/** Đề mẫu nhỏ (tự soạn, miễn bản quyền) để người dùng xem cấu trúc file và sửa lại. */
export const PAPER_TEMPLATE: Paper = {
  title: 'Đề mẫu để thay bằng đề của bạn',
  level: 1,
  pass: 120,
  source: 'tự soạn',
  sections: [
    {
      skill: 'listening',
      minutes: 15,
      questions: [
        { kind: 'hear-meaning', audio: '你好，请坐。', ask: 'Nghe và chọn nghĩa đúng.', options: ['Xin chào, mời ngồi.', 'Tạm biệt, hẹn gặp lại.', 'Cảm ơn bạn rất nhiều.', 'Bạn tên là gì?'], answer: 0 },
        { kind: 'hear-reply', audio: '你叫什么名字？', ask: 'Nghe câu hỏi và chọn câu trả lời phù hợp.', options: ['我叫王明。', '我很好，谢谢。', '明天见。'], answer: 0 },
      ],
    },
    {
      skill: 'reading',
      minutes: 17,
      questions: [
        { kind: 'fill-blank', text: '我____学生。', ask: 'Chọn từ điền vào chỗ trống.', options: ['是', '吃', '看', '去'], answer: 0 },
        { kind: 'read-meaning', text: '今天天气很好。', ask: 'Đọc câu và chọn nghĩa đúng.', options: ['Hôm nay thời tiết rất đẹp.', 'Hôm qua trời mưa to.', 'Ngày mai tôi đi làm.'], answer: 0 },
      ],
    },
  ],
}
