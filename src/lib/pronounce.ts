import { pinyin } from 'pinyin-pro'

export type CharVerdict = 'ok' | 'tone' | 'wrong' | 'missing'

export interface CharScore {
  ch: string
  verdict: CharVerdict
  /** Chữ máy nghe được ở vị trí này (nếu khác) */
  heard?: string
}

export interface PronounceResult {
  percent: number
  heard: string
  chars: CharScore[]
}

const HAN = /\p{Script=Han}/gu
const hanOnly = (s: string) => (s.match(HAN) ?? []).join('')
const numeric = (s: string): string[] => (s ? (pinyin(s, { toneType: 'num', type: 'array', v: true }) as string[]) : [])
const base = (p: string) => p.replace(/\d$/, '')

/** Chi phí ghép một chữ cần đọc với một chữ máy nghe được: 0 = cùng âm cùng thanh, 0.5 = đúng âm sai thanh. */
function pairCost(a: string, pa: string, b: string, pb: string): { cost: number; verdict: CharVerdict } {
  if (a === b || pa === pb) return { cost: 0, verdict: 'ok' }
  if (base(pa) === base(pb)) return { cost: 0.5, verdict: 'tone' }
  return { cost: 1, verdict: 'wrong' }
}

/** So một kết quả nhận dạng với câu cần đọc, từng chữ Hán. */
export function scoreOne(target: string, heard: string): PronounceResult {
  const t = hanOnly(target)
  const h = hanOnly(heard)
  const tc = [...t]
  const hc = [...h]
  const tp = numeric(t)
  const hp = numeric(h)
  const n = tc.length
  const m = hc.length
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) d[i][0] = i
  for (let j = 1; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + pairCost(tc[i - 1], tp[i - 1], hc[j - 1], hp[j - 1]).cost)
  const chars: CharScore[] = []
  let i = n
  let j = m
  while (i > 0) {
    if (j > 0) {
      const p = pairCost(tc[i - 1], tp[i - 1], hc[j - 1], hp[j - 1])
      if (d[i][j] === d[i - 1][j - 1] + p.cost) {
        chars.push({ ch: tc[i - 1], verdict: p.verdict, ...(p.verdict === 'ok' ? {} : { heard: hc[j - 1] }) })
        i--
        j--
        continue
      }
    }
    if (d[i][j] === d[i - 1][j] + 1) {
      chars.push({ ch: tc[i - 1], verdict: 'missing' })
      i--
    } else j-- // máy nghe thừa một chữ
  }
  chars.reverse()
  const percent = n ? Math.max(0, Math.round((1 - d[n][m] / Math.max(n, m)) * 100)) : 0
  return { percent, heard, chars }
}

/** Nhận dạng thường trả vài phương án; lấy phương án khớp nhất. */
export function scorePronunciation(target: string, alternatives: string[]): PronounceResult | null {
  if (!hanOnly(target) || alternatives.length === 0) return null
  return alternatives.map((a) => scoreOne(target, a)).reduce((best, r) => (r.percent > best.percent ? r : best))
}
