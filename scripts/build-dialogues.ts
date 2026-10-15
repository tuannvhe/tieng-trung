/**
 * Dựng src/data/dialogues.json từ các file nguồn trong src/data/dialogues-src/*.txt
 * và 20 kịch bản soạn tay trong src/data/it/scenarios.json.
 *
 * Định dạng file nguồn (mỗi file một chủ đề):
 *   ## <id chủ đề>|<tên chủ đề tiếng Việt>
 *   # <tiêu đề đoạn thoại>
 *   A <câu tiếng Trung>|<nghĩa tiếng Việt>      (A = đối phương)
 *   B <câu tiếng Trung>|<nghĩa tiếng Việt>      (B = bạn, vai người dùng đóng)
 *   (dòng trống hoặc dòng "# ..." mới = đoạn thoại mới)
 *
 * Pinyin: sinh bằng pinyin-pro, nhưng mọi chữ đa âm nhạy cảm phải được rà qua `--audit`
 * và sửa bằng bảng ghi đè viết tay src/data/pinyin-overrides.json (từ → pinyin).
 *
 * Chạy: npx tsx scripts/build-dialogues.ts            (dựng file)
 *       npx tsx scripts/build-dialogues.ts --audit    (in danh sách chữ đa âm để rà soát)
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { customPinyin, pinyin } from 'pinyin-pro'

const data = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const srcDir = join(data, 'dialogues-src')
const overridesFile = join(data, 'pinyin-overrides.json')
const overrides: Record<string, string> = existsSync(overridesFile) ? JSON.parse(readFileSync(overridesFile, 'utf8')) : {}
customPinyin(overrides)

const CJK = /[㐀-鿿]/
// Chữ đa âm mà ngữ cảnh gần như luôn cho đáp án đúng; không đưa vào danh sách rà soát
const TRUSTED = new Set([...'了的得地着没不一吗吧呢啊么什为'])

// Cấp HSK của từng chữ = cấp thấp nhất của từ HSK chứa chữ đó
const charLevel = new Map<string, number>()
for (let lv = 1; lv <= 5; lv++) {
  for (const w of JSON.parse(readFileSync(join(data, `hsk${lv}.json`), 'utf8'))) {
    for (const ch of w.hanzi.match(/[㐀-鿿]/g) ?? []) if (!charLevel.has(ch)) charLevel.set(ch, lv)
  }
}
/** Cấp khó nhất: chữ có cấp cao nhất trong văn bản (6 = có chữ ngoài HSK1-5). */
export const levelOf = (text: string) =>
  Math.max(1, ...(text.match(/[㐀-鿿]/g) ?? []).map((c) => charLevel.get(c) ?? 6))

/**
 * Cấp theo độ phủ: cấp HSK nhỏ nhất mà các chữ thuộc HSK <= cấp đó bao phủ ít nhất COVERAGE số chữ.
 * Công bằng hơn với người học so với việc một chữ hiếm kéo cả đoạn lên cấp cao.
 */
export const COVERAGE = 0.9
export function coverageLevel(text: string): number {
  const chars = text.match(/[㐀-鿿]/g) ?? []
  if (!chars.length) return 1
  for (let lv = 1; lv <= 5; lv++) {
    const known = chars.filter((c) => (charLevel.get(c) ?? 99) <= lv).length
    if (known / chars.length >= COVERAGE) return lv
  }
  return 6
}

const auditHits = new Map<string, number>()
const FUNCTION_CHARS: Record<string, string> = { 了: 'le', 得: 'de', 着: 'zhe', 地: 'de', 的: 'de', 没: 'méi' }
const noTone = (p: string) => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
/** Chữ đa âm đáng rà soát: có ít nhất hai âm đọc khác nhau ngoài biến thể thanh nhẹ. */
function isRisky(ch: string, readings: string[]): boolean {
  if (TRUSTED.has(ch) || readings.length < 2) return false
  const distinct = new Set(readings.filter((r) => /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(r)))
  return distinct.size >= 2
}

/** Pinyin có dấu, tách âm tiết bằng dấu cách, bỏ dấu câu, giữ cụm Latin/số làm một token. */
function toPinyin(sc: string): string {
  const out: string[] = []
  for (const run of sc.match(/[㐀-鿿]+|[A-Za-z0-9]+/g) ?? []) {
    if (!CJK.test(run[0])) {
      out.push(run)
      continue
    }
    const info = pinyin(run, { toneType: 'symbol', type: 'all' }) as Array<{ origin: string; pinyin: string; polyphonic: string[] }>
    info.forEach((c, i) => {
      out.push(c.pinyin)
      // Chữ chức năng: chỉ ghi nhận khi máy chọn âm khác mặc định (ví dụ 了 liǎo, 得 děi, 着 zháo)
      const dflt = FUNCTION_CHARS[c.origin]
      if (dflt && noTone(c.pinyin) !== noTone(dflt) && !(c.origin === '不' || c.origin === '一')) {
        const key = `${c.origin}\t${c.pinyin}\t${run.slice(Math.max(0, i - 2), i + 3)}`
        auditHits.set(key, (auditHits.get(key) ?? 0) + 1)
      } else if (dflt && c.origin !== '不' && c.origin !== '一' && c.pinyin !== dflt && c.pinyin.normalize('NFD') !== dflt.normalize('NFD')) {
        const key = `${c.origin}\t${c.pinyin}\t${run.slice(Math.max(0, i - 2), i + 3)}`
        auditHits.set(key, (auditHits.get(key) ?? 0) + 1)
      }
      if (isRisky(c.origin, c.polyphonic)) {
        const ctx = run.slice(Math.max(0, i - 1), i + 2)
        const key = `${c.origin}\t${c.pinyin}\t${ctx}`
        auditHits.set(key, (auditHits.get(key) ?? 0) + 1)
      }
    })
  }
  return out.join(' ')
}

interface Line { who: 'o' | 'm'; sc: string; py: string; vi: string }
interface Dialogue { id: string; topic: string; title: string; level: number; maxLevel: number; lines: Line[]; reviewed: boolean }

const topics: Array<{ id: string; label: string }> = []
const items: Dialogue[] = []
const errors: string[] = []

for (const f of readdirSync(srcDir).filter((x) => x.endsWith('.txt')).sort()) {
  let topic = ''
  let cur: { title: string; lines: Line[] } | null = null
  const flush = () => {
    if (!cur) return
    if (cur.lines.length < 2) errors.push(`${f}: đoạn "${cur.title}" ít hơn 2 câu`)
    else {
      const all = cur.lines.map((l) => l.sc).join('')
      items.push({ id: `dl-${String(items.length + 1).padStart(4, '0')}`, topic, title: cur.title, level: coverageLevel(all), maxLevel: levelOf(all), lines: cur.lines, reviewed: false })
    }
    cur = null
  }
  readFileSync(join(srcDir, f), 'utf8').split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim()
    if (!line) return flush()
    if (line.startsWith('## ')) {
      flush()
      const [id, label] = line.slice(3).split('|').map((s) => s.trim())
      topic = id
      topics.push({ id, label })
    } else if (line.startsWith('# ')) {
      flush()
      cur = { title: line.slice(2).trim(), lines: [] }
    } else if (/^[AB] /.test(line)) {
      const [sc, vi] = line.slice(2).split('|').map((s) => s.trim())
      if (!cur) cur = { title: '', lines: [] }
      if (!sc || !vi) return errors.push(`${f}:${n + 1}: thiếu tiếng Trung hoặc nghĩa Việt`)
      cur.lines.push({ who: line[0] === 'A' ? 'o' : 'm', sc, py: toPinyin(sc), vi })
    } else errors.push(`${f}:${n + 1}: dòng không hiểu: ${line.slice(0, 40)}`)
  })
  flush()
}

// Gộp 20 kịch bản IT soạn tay (đã có pinyin ghi tay)
const scenarios = JSON.parse(readFileSync(join(data, 'it', 'scenarios.json'), 'utf8'))
topics.push({ id: 'it-tinh-huong', label: 'Tình huống IT trong nhà máy (soạn tay)' })
for (const s of scenarios) {
  items.push({
    id: `dl-${String(items.length + 1).padStart(4, '0')}`, topic: 'it-tinh-huong', title: s.title,
    level: coverageLevel(s.lines.map((l: Line) => l.sc).join("")), maxLevel: levelOf(s.lines.map((l: Line) => l.sc).join("")), lines: s.lines, reviewed: false,
  })
}

if (process.argv.includes('--audit')) {
  const tree = new Map<string, Map<string, Map<string, number>>>()
  for (const [k, n] of auditHits) {
    const [ch, py, ctx] = k.split('\t')
    const byPy = tree.get(ch) ?? tree.set(ch, new Map()).get(ch)!
    const byCtx = byPy.get(py) ?? byPy.set(py, new Map()).get(py)!
    byCtx.set(ctx, (byCtx.get(ctx) ?? 0) + n)
  }
  console.log(`Rà soát chữ đa âm: ${tree.size} chữ`)
  for (const [ch, byPy] of [...tree].sort((a, b) => [...b[1].values()].reduce((n, m) => n + m.size, 0) - [...a[1].values()].reduce((n, m) => n + m.size, 0))) {
    const parts = [...byPy].map(([py, ctxs]) => {
      const sample = [...ctxs].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([c, n]) => (n > 1 ? `${c}×${n}` : c)).join(' ')
      const total = [...ctxs.values()].reduce((a, b) => a + b, 0)
      return `${py}(${total}): ${sample}`
    })
    console.log(`${ch}  ${parts.join('  |  ')}`)
  }
  process.exit(0)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
writeFileSync(join(data, 'dialogues.json'), JSON.stringify({ topics, items }))
const perLevel: Record<number, number> = {}
for (const d of items) perLevel[d.level] = (perLevel[d.level] ?? 0) + 1
console.log(`Đã dựng ${items.length} đoạn thoại, ${items.reduce((n, d) => n + d.lines.length, 0)} câu, ${topics.length} chủ đề. Theo cấp HSK:`, perLevel)
