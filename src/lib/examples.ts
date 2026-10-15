import type { Dialogue } from '@/types'

export interface Example {
  sc: string
  py: string
  vi: string
  /** Cấp của đoạn thoại chứa câu */
  level: number
  dialogueId: string
}

/**
 * Tìm câu ví dụ đầu tiên (ưu tiên đoạn thoại dễ hơn) có chứa từ `hanzi`.
 * Chỉ nhận các câu ngắn để thẻ không bị dài.
 */
export function findExample(hanzi: string, dialogues: Dialogue[], maxChars = 22): Example | undefined {
  let best: Example | undefined
  for (const d of dialogues) {
    if (best && d.level >= best.level) continue
    for (const l of d.lines) {
      if (l.sc.includes(hanzi) && [...l.sc].length <= maxChars) {
        best = { sc: l.sc, py: l.py, vi: l.vi, level: d.level, dialogueId: d.id }
        break
      }
    }
  }
  return best
}

/** Dựng bản đồ từ → ví dụ cho nhiều từ một lượt (một lần quét kho hội thoại). */
export function examplesFor(hanziList: string[], dialogues: Dialogue[], maxChars = 22): Map<string, Example> {
  const wanted = new Set(hanziList)
  const out = new Map<string, Example>()
  const sorted = [...dialogues].sort((a, b) => a.level - b.level)
  for (const d of sorted) {
    for (const l of d.lines) {
      if ([...l.sc].length > maxChars) continue
      for (const h of wanted) {
        if (!out.has(h) && l.sc.includes(h)) out.set(h, { sc: l.sc, py: l.py, vi: l.vi, level: d.level, dialogueId: d.id })
      }
    }
    if (out.size === wanted.size) break
  }
  return out
}
