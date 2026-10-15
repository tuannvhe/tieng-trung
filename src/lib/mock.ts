import type { Dialogue, HskWord } from '@/types'
import { shuffle, type Rng } from './exercise'
import { buildWordIndex, segment } from './segment'

/**
 * Thi thử theo CẤU TRÚC bài thi HSK 2.0 (số câu, thời gian, thang điểm, ngưỡng đạt). Nội dung từng câu là câu hỏi do
 * ứng dụng tự dựng từ kho hội thoại và từ vựng của chính nó, KHÔNG phải đề thi thật, nên điểm chỉ mang tính tham khảo.
 */
export type Skill = 'listening' | 'reading' | 'writing'
export type MockKind = 'hear-meaning' | 'hear-reply' | 'hear-passage' | 'read-meaning' | 'fill-blank' | 'read-reply' | 'read-passage' | 'reorder'
export type MockLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface SectionSpec {
  skill: Skill
  minutes: number
  /** Số câu theo dạng; tổng là số câu của phần */
  mix: Partial<Record<MockKind, number>>
}
export interface MockSpec {
  level: MockLevel
  sections: SectionSpec[]
  /** Điểm tối đa của cả bài (mỗi phần 100) */
  max: number
  /** Điểm tối thiểu để đạt */
  pass: number
  /** Chỗ đề của ứng dụng khác đề thật, hiện cho người học thấy trước khi thi */
  note?: string
}

const sum = (m: SectionSpec['mix']) => Object.values(m).reduce((a, b) => a + b, 0)
export const sectionCount = (s: SectionSpec) => sum(s.mix)

export const MOCK_SPECS: Record<MockLevel, MockSpec> = {
  1: {
    level: 1,
    max: 200,
    pass: 120,
    sections: [
      { skill: 'listening', minutes: 15, mix: { 'hear-meaning': 12, 'hear-reply': 8 } },
      { skill: 'reading', minutes: 17, mix: { 'read-meaning': 10, 'fill-blank': 10 } },
    ],
  },
  2: {
    level: 2,
    max: 200,
    pass: 120,
    sections: [
      { skill: 'listening', minutes: 25, mix: { 'hear-meaning': 20, 'hear-reply': 15 } },
      { skill: 'reading', minutes: 22, mix: { 'read-meaning': 8, 'fill-blank': 10, 'read-reply': 7 } },
    ],
  },
  3: {
    level: 3,
    max: 300,
    pass: 180,
    sections: [
      { skill: 'listening', minutes: 35, mix: { 'hear-meaning': 24, 'hear-reply': 16 } },
      { skill: 'reading', minutes: 30, mix: { 'read-meaning': 10, 'fill-blank': 12, 'read-reply': 8 } },
      { skill: 'writing', minutes: 15, mix: { reorder: 10 } },
    ],
  },
  4: {
    level: 4,
    max: 300,
    pass: 180,
    note: 'Phần viết chỉ có dạng sắp xếp từ thành câu (đề thật còn có phần tự viết câu theo từ cho sẵn, không chấm tự động được).',
    sections: [
      { skill: 'listening', minutes: 30, mix: { 'hear-meaning': 15, 'hear-reply': 15, 'hear-passage': 15 } },
      { skill: 'reading', minutes: 40, mix: { 'read-meaning': 8, 'fill-blank': 14, 'read-reply': 8, 'read-passage': 10 } },
      { skill: 'writing', minutes: 25, mix: { reorder: 15 } },
    ],
  },
  5: {
    level: 5,
    max: 300,
    pass: 180,
    note: 'Phần viết chỉ có dạng sắp xếp từ thành câu (đề thật còn có phần viết đoạn văn ngắn, không chấm tự động được).',
    sections: [
      { skill: 'listening', minutes: 30, mix: { 'hear-meaning': 12, 'hear-reply': 15, 'hear-passage': 18 } },
      { skill: 'reading', minutes: 45, mix: { 'read-meaning': 8, 'fill-blank': 15, 'read-reply': 7, 'read-passage': 15 } },
      { skill: 'writing', minutes: 40, mix: { reorder: 10 } },
    ],
  },
  6: {
    level: 6,
    max: 200,
    pass: 120,
    note: 'Không có phần viết: đề thật yêu cầu đọc bài văn rồi tự viết bài tóm tắt, không chấm tự động được. Vì vậy thang điểm ở đây là 200 (nghe và đọc) và đạt từ 60%, không phải thang 300 của đề thật.',
    sections: [
      { skill: 'listening', minutes: 35, mix: { 'hear-meaning': 15, 'hear-reply': 15, 'hear-passage': 20 } },
      { skill: 'reading', minutes: 50, mix: { 'read-meaning': 10, 'fill-blank': 15, 'read-reply': 10, 'read-passage': 15 } },
    ],
  },
}

export interface MockQuestion {
  skill: Skill
  kind: MockKind
  /** Phần chữ Hán được đọc lên (phần nghe) */
  audio?: string
  /** Tên file mp3 (đề nạp từ file); có file này thì phát thay cho giọng máy */
  mp3?: string
  /** Chữ Hán hiển thị cho người làm bài (phần đọc, viết); có thể nhiều dòng */
  text?: string
  /** Yêu cầu bằng tiếng Việt */
  ask: string
  options: string[]
  /** Vị trí đáp án đúng; -1 với dạng sắp xếp từ */
  answer: number
  /** Dạng sắp xếp: các từ theo thứ tự đúng */
  tokens?: string[]
  /** Dạng sắp xếp: các từ đã xáo trộn để hiển thị */
  bank?: string[]
}

export interface MockExam {
  level: MockLevel
  spec: MockSpec
  questions: MockQuestion[]
  /** Chỉ số câu đầu tiên của từng phần, cùng thứ tự với spec.sections */
  starts: number[]
}

export interface MockData {
  dialogues: Dialogue[]
  /** Từ HSK các cấp từ 1 đến cấp thi */
  words: HskWord[]
}

interface Line {
  key: string
  sc: string
  vi: string
  who: 'o' | 'm'
  next?: { sc: string; vi: string }
}

const CJK = /\p{Script=Han}/u
const norm = (s: string) => s.replace(/[\s，。！？、,.!?；;：:“”"']/g, '')

/** Các hội thoại của cấp thi. Cấp 1-3 lấy đúng cấp; cấp 4-6 lấy cấp đó và cấp liền dưới. Thiếu thì mở rộng dần. */
function windowDialogues(level: MockLevel, ds: Dialogue[], need: number): Dialogue[] {
  let lo = level <= 3 ? level : level - 1
  let hi: number = level
  const pick = () => ds.filter((d) => d.level >= lo && d.level <= hi && d.lines.length >= 3)
  let out = pick()
  while (out.length < need && (lo > 1 || hi < 6)) {
    if (lo > 1) lo--
    else hi++
    out = pick()
  }
  return out
}

function toLines(ds: Dialogue[]): Line[] {
  const usable = (l: Line) => CJK.test(l.sc) && l.sc.length >= 3 && l.sc.length <= 24 && l.vi.trim().length > 0
  const seen = new Set<string>()
  return ds
    .flatMap((d) =>
      d.lines.map((l, i): Line => {
        const n = d.lines[i + 1]
        return { key: `${d.id}#${i}`, sc: l.sc, vi: l.vi, who: l.who, next: n ? { sc: n.sc, vi: n.vi } : undefined }
      }),
    )
    .filter(usable)
    .filter((l) => (seen.has(norm(l.sc)) ? false : (seen.add(norm(l.sc)), true)))
}

function pickDistractors(correct: string, from: string[], rng: Rng, n = 3): string[] {
  const uniq = [...new Set(from.filter((x) => x && x !== correct))]
  return shuffle(uniq, rng).slice(0, n)
}

function withOptions(correct: string, others: string[], rng: Rng): { options: string[]; answer: number } {
  const options = shuffle([correct, ...pickDistractors(correct, others, rng)], rng)
  return { options, answer: options.indexOf(correct) }
}

const speaker = (who: 'o' | 'm') => (who === 'o' ? 'A' : 'B')

/** Dựng một bài thi thử. Ném lỗi nếu dữ liệu không đủ để dựng đủ số câu mà không lặp nội dung. */
export function buildMockExam(level: MockLevel, data: MockData, rng: Rng = Math.random): MockExam {
  const spec = MOCK_SPECS[level]
  const kindCount = (k: MockKind) => spec.sections.reduce((n, s) => n + (s.mix[k] ?? 0), 0)
  const passageCount = kindCount('hear-passage') + kindCount('read-passage')
  const totalQ = spec.sections.reduce((n, s) => n + sectionCount(s), 0)
  const lineQ = totalQ - passageCount

  const dialogues = shuffle(windowDialogues(level, data.dialogues, passageCount + Math.ceil(lineQ / 2) + 8), rng)
  // Đoạn dùng cho câu "cả đoạn" lấy trước (mỗi đoạn một tiêu đề), phần còn lại cho câu theo từng dòng
  const seenTitle = new Set<string>()
  const passageDs: Dialogue[] = []
  for (const d of dialogues) {
    if (passageDs.length >= passageCount) break
    if (seenTitle.has(d.title) || !d.title.trim()) continue
    seenTitle.add(d.title)
    passageDs.push(d)
  }
  if (passageDs.length < passageCount) throw new Error(`Chưa đủ hội thoại để dựng câu cả đoạn cho HSK ${level}.`)
  const passageIds = new Set(passageDs.map((d) => d.id))
  const pool = shuffle(toLines(dialogues.filter((d) => !passageIds.has(d.id))), rng)
  if (pool.length < lineQ + 10) throw new Error(`Chưa đủ câu thoại để dựng đề HSK ${level} (cần ${lineQ + 10}, có ${pool.length}).`)

  const allVi = pool.map((l) => l.vi)
  const allTitles = dialogues.map((d) => d.title)
  const wordIndex = buildWordIndex(data.words)
  const used = new Set<string>()
  const passageQueue = [...passageDs]
  const take = (ok: (l: Line) => boolean): Line | undefined => {
    const l = pool.find((x) => !used.has(x.key) && ok(x))
    if (l) used.add(l.key)
    return l
  }
  const reorderMax = level >= 4 ? 9 : 8
  const wantLevel = Math.max(1, level - 1)

  const passage = (skill: Skill, kind: 'hear-passage' | 'read-passage'): MockQuestion | undefined => {
    const d = passageQueue.shift()
    if (!d) return
    const shown = d.lines.map((l) => `${speaker(l.who)}：${l.sc}`).join('\n')
    const base = { skill, kind, ask: 'Chọn tiêu đề phù hợp nhất với đoạn hội thoại.', ...withOptions(d.title, allTitles, rng) }
    return kind === 'hear-passage' ? { ...base, audio: d.lines.map((l) => l.sc).join(' ') } : { ...base, text: shown }
  }

  const build: Record<MockKind, (skill: Skill) => MockQuestion | undefined> = {
    'hear-meaning': (skill) => {
      const l = take(() => true)
      if (!l) return
      return { skill, kind: 'hear-meaning', audio: l.sc, ask: 'Nghe và chọn nghĩa đúng của câu em vừa nghe.', ...withOptions(l.vi, allVi, rng) }
    },
    'read-meaning': (skill) => {
      const l = take(() => true)
      if (!l) return
      return { skill, kind: 'read-meaning', text: l.sc, ask: 'Đọc câu và chọn nghĩa đúng.', ...withOptions(l.vi, allVi, rng) }
    },
    'hear-reply': (skill) => {
      const l = take((x) => x.who === 'o' && !!x.next)
      if (!l?.next) return
      const replies = pool.filter((x) => x.next && x.who === 'o').map((x) => x.next!.sc)
      return { skill, kind: 'hear-reply', audio: l.sc, ask: 'Nghe câu hỏi và chọn câu trả lời phù hợp.', ...withOptions(l.next.sc, replies, rng) }
    },
    'read-reply': (skill) => {
      const l = take((x) => x.who === 'o' && !!x.next)
      if (!l?.next) return
      const replies = pool.filter((x) => x.next && x.who === 'o').map((x) => x.next!.sc)
      return { skill, kind: 'read-reply', text: l.sc, ask: 'Đọc câu hỏi và chọn câu trả lời phù hợp.', ...withOptions(l.next.sc, replies, rng) }
    },
    'hear-passage': (skill) => passage(skill, 'hear-passage'),
    'read-passage': (skill) => passage(skill, 'read-passage'),
    'fill-blank': (skill) => {
      const blankable = (t: { word?: HskWord; text: string }) => t.word && t.text.length <= 3 && CJK.test(t.text)
      // Cấp cao ưu tiên khoét từ thuộc cấp gần cấp thi
      const hard = (l: Line) => segment(l.sc, wordIndex).some((t) => blankable(t) && t.word!.level >= wantLevel)
      const l = take(hard) ?? take((x) => segment(x.sc, wordIndex).some(blankable))
      if (!l) return
      const toks = segment(l.sc, wordIndex)
      const all = toks.filter(blankable)
      const hardOnes = all.filter((t) => t.word!.level >= wantLevel)
      const cands = hardOnes.length ? hardOnes : all
      const target = cands[Math.floor(rng() * cands.length)]
      const text = toks.map((t) => (t === target ? '____' : t.text)).join('')
      const same = data.words.filter((w) => w.hanzi.length === target.text.length && w.hanzi !== target.text).map((w) => w.hanzi)
      return { skill, kind: 'fill-blank', text, ask: 'Chọn từ điền vào chỗ trống.', ...withOptions(target.text, same, rng) }
    },
    reorder: (skill) => {
      const l = take((x) => {
        const t = segment(x.sc, wordIndex).filter((k) => CJK.test(k.text) || /[A-Za-z0-9]/.test(k.text))
        return t.length >= 4 && t.length <= reorderMax
      })
      if (!l) return
      const tokens = segment(l.sc, wordIndex).map((k) => k.text).filter((t) => CJK.test(t) || /[A-Za-z0-9]/.test(t))
      let bank = shuffle(tokens, rng)
      for (let i = 0; i < 5 && bank.join('') === tokens.join(''); i++) bank = shuffle(tokens, rng)
      return { skill, kind: 'reorder', ask: `Sắp xếp các từ thành câu đúng. Nghĩa: ${l.vi}`, options: [], answer: -1, tokens, bank }
    },
  }

  const questions: MockQuestion[] = []
  const starts: number[] = []
  for (const s of spec.sections) {
    starts.push(questions.length)
    const part: MockQuestion[] = []
    for (const [kind, n] of Object.entries(s.mix) as Array<[MockKind, number]>)
      for (let i = 0; i < n; i++) {
        const q = build[kind](s.skill)
        if (!q) throw new Error(`Không dựng đủ câu dạng ${kind} cho HSK ${level}.`)
        part.push(q)
      }
    questions.push(...shuffle(part, rng))
  }
  return { level, spec, questions, starts }
}

/** Câu trả lời: số thứ tự lựa chọn; mảng từ với dạng sắp xếp; null nếu bỏ trống */
export type MockAnswer = number | string[] | null

export interface SectionResult {
  skill: Skill
  correct: number
  total: number
  /** 0-100 */
  score: number
}
export interface MockResult {
  sections: SectionResult[]
  total: number
  max: number
  pass: number
  passed: boolean
  correct: number
  questions: number
  /** Điểm trên thang 100 để lưu cùng kết quả các bài thi khác */
  percent: number
}

export const isRight = (q: MockQuestion, a: MockAnswer | undefined): boolean => {
  if (a == null) return false
  if (q.kind === 'reorder') return Array.isArray(a) && !!q.tokens && a.length === q.tokens.length && a.join('') === q.tokens.join('')
  return a === q.answer
}

/** Các dạng câu có đáp án là chữ Hán (hiển thị bằng phông chữ Hán). */
export const hasHanOptions = (k: MockKind) => k === 'hear-reply' || k === 'read-reply' || k === 'fill-blank'

export function gradeMock(exam: MockExam, answers: MockAnswer[]): MockResult {
  const sections = exam.spec.sections.map((s, si): SectionResult => {
    const from = exam.starts[si]
    const to = si + 1 < exam.starts.length ? exam.starts[si + 1] : exam.questions.length
    let correct = 0
    for (let i = from; i < to; i++) if (isRight(exam.questions[i], answers[i])) correct++
    const total = to - from
    return { skill: s.skill, correct, total, score: Math.round((correct / total) * 100) }
  })
  const total = sections.reduce((n, s) => n + s.score, 0)
  const correct = sections.reduce((n, s) => n + s.correct, 0)
  const questions = sections.reduce((n, s) => n + s.total, 0)
  return { sections, total, max: exam.spec.max, pass: exam.spec.pass, passed: total >= exam.spec.pass, correct, questions, percent: Math.round((total / exam.spec.max) * 100) }
}

export const SKILL_LABEL: Record<Skill, string> = { listening: 'Nghe', reading: 'Đọc', writing: 'Viết' }

/** Nhận xét ngắn theo từng kỹ năng để người học biết nên ôn gì. */
export function adviceFor(result: MockResult): string[] {
  const out: string[] = []
  for (const s of result.sections) {
    if (s.score < 60) out.push(`${SKILL_LABEL[s.skill]}: ${s.score}/100, cần ôn thêm. ${s.skill === 'listening' ? 'Nghe lại hội thoại, nghe chậm rồi đối chiếu pinyin.' : s.skill === 'reading' ? 'Đọc hội thoại có chú giải và ôn từ vựng đã sai.' : 'Luyện sắp xếp câu ở mục Ngữ pháp.'}`)
    else if (s.score < 80) out.push(`${SKILL_LABEL[s.skill]}: ${s.score}/100, khá, thêm một chút luyện tập là qua vững.`)
    else out.push(`${SKILL_LABEL[s.skill]}: ${s.score}/100, tốt.`)
  }
  return out
}
