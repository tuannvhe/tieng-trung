export type Rng = () => number

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Bốn lựa chọn (1 đúng + 3 nhiễu khác nhau), đã xáo trộn. `index` là vị trí đáp án đúng. */
export function buildChoices(correct: string, pool: string[], rng: Rng = Math.random, n = 4) {
  const others = shuffle([...new Set(pool.filter((p) => p !== correct))], rng).slice(0, n - 1)
  const options = shuffle([correct, ...others], rng)
  return { options, index: options.indexOf(correct) }
}

/** Gói kết quả một phiên luyện tập. */
export function scoreSession(answers: boolean[]) {
  const correct = answers.filter(Boolean).length
  return { correct, total: answers.length, percent: answers.length ? Math.round((correct / answers.length) * 100) : 0 }
}
