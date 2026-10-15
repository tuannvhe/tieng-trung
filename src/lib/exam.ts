import type { ExamResult, HskLevel, HskWord } from '@/types'
import { buildChoices, shuffle, type Rng } from './exercise'
import { newCard } from './srs'
import type { Storage } from './storage'

export type QuestionKind = 'meaning' | 'pinyin' | 'reverse'

export interface Question {
  kind: QuestionKind
  prompt: string
  options: string[]
  answer: number
  level: HskLevel
  ref: string
}

export const PASS_PERCENT = 80
const KINDS: QuestionKind[] = ['meaning', 'pinyin', 'reverse']

/** Nghĩa ngắn gọn để làm đáp án: ưu tiên tiếng Việt đã nhập, nếu không lấy nghĩa Anh đầu tiên. */
export function shortMeaning(w: HskWord, vi = ''): string {
  if (vi) return vi
  const first = (w.meanings_en[0] ?? '').split(';')[0].replace(/\s*\(.*?\)\s*/g, ' ').trim()
  return first || (w.meanings_en[0] ?? '')
}

/** Tạo n câu hỏi trắc nghiệm từ từ vựng HSK có thật (không bịa nội dung). */
export function buildQuestions(
  words: HskWord[],
  n: number,
  viOf: (w: HskWord) => string = () => '',
  rng: Rng = Math.random,
): Question[] {
  const pool = words.filter((w) => shortMeaning(w, viOf(w)))
  const picked = shuffle(pool, rng).slice(0, n)
  return picked.map((w, i) => {
    const kind = KINDS[i % KINDS.length]
    const meaning = shortMeaning(w, viOf(w))
    const sample = shuffle(pool.filter((x) => x !== w), rng).slice(0, 40)
    if (kind === 'meaning') {
      const { options, index } = buildChoices(meaning, sample.map((x) => shortMeaning(x, viOf(x))), rng)
      return { kind, prompt: w.hanzi, options, answer: index, level: w.level, ref: `hsk:${w.id}` }
    }
    if (kind === 'pinyin') {
      const { options, index } = buildChoices(w.pinyin, sample.map((x) => x.pinyin), rng)
      return { kind, prompt: w.hanzi, options, answer: index, level: w.level, ref: `hsk:${w.id}` }
    }
    const { options, index } = buildChoices(w.hanzi, sample.map((x) => x.hanzi), rng)
    return { kind, prompt: meaning, options, answer: index, level: w.level, ref: `hsk:${w.id}` }
  })
}

export interface Graded {
  correct: number
  total: number
  percent: number
  passed: boolean
  byLevel: Partial<Record<HskLevel, { correct: number; total: number }>>
}

/** Chấm bài. Câu bỏ trống (null) tính sai. */
export function gradeExam(questions: Question[], answers: Array<number | null>): Graded {
  const byLevel: Graded['byLevel'] = {}
  let correct = 0
  questions.forEach((q, i) => {
    const slot = (byLevel[q.level] ??= { correct: 0, total: 0 })
    slot.total++
    if (answers[i] === q.answer) {
      slot.correct++
      correct++
    }
  })
  const total = questions.length
  const percent = total ? Math.round((correct / total) * 100) : 0
  return { correct, total, percent, passed: percent >= PASS_PERCENT, byLevel }
}

/** Cấp 1 luôn mở. Cấp n+1 mở khi có bài thi cuối cấp n đạt, hoặc thi xếp lớp đề xuất từ n+1 trở lên. */
export function unlockedLevels(results: ExamResult[]): HskLevel[] {
  let max = 1
  for (const r of results) {
    if (r.kind === 'level' && r.passed) max = Math.max(max, r.level + 1)
    if (r.kind === 'placement') max = Math.max(max, r.level)
  }
  return ([1, 2, 3, 4, 5, 6] as HskLevel[]).filter((l) => l <= max)
}

/** Thi xếp lớp: đề xuất cấp đầu tiên chưa đạt từ 70% (tối thiểu 1, tối đa 5). */
export function placementLevel(byLevel: Graded['byLevel']): HskLevel {
  for (const lv of [1, 2, 3, 4, 5] as HskLevel[]) {
    const s = byLevel[lv]
    if (!s || s.total === 0 || s.correct / s.total < 0.7) return lv
  }
  return 5
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Đưa các từ làm sai vào lịch ôn hôm nay: thẻ chưa có thì tạo mới, thẻ đã có mà chưa đến hạn thì kéo về hôm nay. Trả về số thẻ được đưa vào. */
export async function scheduleMissed(
  store: Pick<Storage, 'getCard' | 'createCardIfAbsent' | 'saveCard'>,
  refs: string[],
  today: string,
): Promise<number> {
  let n = 0
  for (const ref of new Set(refs)) {
    const card = await store.getCard(ref)
    if (!card) n += (await store.createCardIfAbsent(newCard(ref, today))) ? 1 : 0
    else if (card.due > today) {
      await store.saveCard({ ...card, due: today })
      n++
    }
  }
  return n
}
