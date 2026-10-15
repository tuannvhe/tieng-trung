import type { HskWord } from '@/types'
import { buildChoices, shuffle, type Rng } from './exercise'
import { newCard } from './srs'
import type { Storage } from './storage'

export interface CourseVocab {
  h: string
  py: string
  vi?: string
}
export interface CourseFile {
  k: 'pdf' | 'video' | 'image' | 'doc'
  t: string
}
export interface CourseGrammar {
  t: string
  rule: string
  ex: Array<{ zh: string; vi: string }>
}
export interface CourseLesson {
  n: number
  zh: string
  vi: string
  days: string
  missing?: boolean
  vocab: CourseVocab[]
  grammar?: CourseGrammar[]
  files: CourseFile[]
}
export interface CourseData {
  title: string
  note: string
  lessons: CourseLesson[]
  review: CourseFile[]
}

/** Các bước người học tự đánh dấu cho từng bài (lưu như cờ "đã xong" của riêng người dùng). */
export const STEPS = [
  { id: 'watch', label: 'Xem bài giảng' },
  { id: 'vocab', label: 'Học từ mới' },
  { id: 'homework', label: 'Làm bài tập' },
] as const
export type StepId = (typeof STEPS)[number]['id']

export const stepKey = (n: number, step: StepId) => `course:${n}:${step}`
export const quizId = (n: number) => `course:${n}:quiz`

/** Bỏ phần trong ngoặc: "没(有)" thành "没". */
export const baseHanzi = (h: string) => h.replace(/[(（][^)）]*[)）]/g, '').trim()

/** Từ HSK theo chữ Hán, ưu tiên cấp thấp nhất khi trùng. */
export function buildHskIndex(words: HskWord[]): Map<string, HskWord> {
  const idx = new Map<string, HskWord>()
  for (const w of [...words].sort((a, b) => a.level - b.level)) if (!idx.has(w.hanzi)) idx.set(w.hanzi, w)
  return idx
}

export interface ResolvedWord extends CourseVocab {
  word?: HskWord
  /** Nghĩa hiển thị: nghĩa trong giáo trình, nếu không thì nghĩa trong bộ HSK */
  meaning: string
}

export function resolveVocab(vocab: CourseVocab[], idx: Map<string, HskWord>, viOf: (w: HskWord) => string): ResolvedWord[] {
  return vocab.map((v) => {
    const word = idx.get(baseHanzi(v.h))
    return { ...v, word, meaning: v.vi || (word ? viOf(word) : '') }
  })
}

/** Đưa từ của bài vào lịch ôn hôm nay. Chỉ từ có trong bộ HSK mới tạo được thẻ; trả về số thẻ mới và số từ không có thẻ. */
export async function addLessonToCards(
  store: Pick<Storage, 'createCardIfAbsent'>,
  words: ResolvedWord[],
  today: string,
): Promise<{ added: number; skipped: number; noCard: number }> {
  let added = 0
  let skipped = 0
  let noCard = 0
  const seen = new Set<string>()
  for (const w of words) {
    if (!w.word) {
      noCard++
      continue
    }
    const ref = `hsk:${w.word.id}`
    if (seen.has(ref)) continue
    seen.add(ref)
    if (await store.createCardIfAbsent(newCard(ref, today))) added++
    else skipped++
  }
  return { added, skipped, noCard }
}

export interface QuizQuestion {
  kind: 'meaning' | 'hanzi'
  prompt: string
  sub: string
  options: string[]
  answer: number
}

/** Bài kiểm tra từ mới của một bài: xen kẽ "chữ Hán sang nghĩa" và "nghĩa sang chữ Hán". Nhiễu lấy từ các bài đã học. */
export function buildLessonQuiz(own: ResolvedWord[], pool: ResolvedWord[], n = 10, rng: Rng = Math.random): QuizQuestion[] {
  const usable = own.filter((w) => w.meaning)
  const picked = shuffle(usable, rng).slice(0, n)
  return picked.map((w, i) => {
    const others = pool.filter((p) => p.h !== w.h && p.meaning)
    if (i % 2 === 0) {
      const { options, index } = buildChoices(w.meaning, others.map((p) => p.meaning), rng)
      return { kind: 'meaning' as const, prompt: w.h, sub: w.py, options, answer: index }
    }
    const { options, index } = buildChoices(w.h, others.map((p) => p.h), rng)
    return { kind: 'hanzi' as const, prompt: w.meaning, sub: '', options, answer: index }
  })
}

/** Tiến độ tổng của một bài: các bước đã tick và điểm cao nhất bài kiểm tra. */
export function lessonProgress(flags: Record<string, boolean | undefined>, n: number, quizBest = 0) {
  const done = STEPS.filter((s) => flags[stepKey(n, s.id)]).length
  const total = STEPS.length + 1 // 3 bước + bài kiểm tra đạt từ 80%
  const quizPassed = quizBest >= 80
  const count = done + (quizPassed ? 1 : 0)
  return { done, quizPassed, count, total, percent: Math.round((count / total) * 100) }
}
