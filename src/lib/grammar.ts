import { shuffle, type Rng } from './exercise'

/** Xáo các mảnh câu, đảm bảo khác thứ tự đúng (nếu có thể). */
export function shuffleTokens(tokens: string[], rng: Rng = Math.random): string[] {
  if (new Set(tokens).size < 2) return [...tokens]
  for (let i = 0; i < 20; i++) {
    const s = shuffle(tokens, rng)
    if (s.some((t, n) => t !== tokens[n])) return s
  }
  return [...tokens.slice(1), tokens[0]]
}

export function isCorrectOrder(answer: string[], tokens: string[]): boolean {
  return answer.length === tokens.length && answer.every((t, i) => t === tokens[i])
}
