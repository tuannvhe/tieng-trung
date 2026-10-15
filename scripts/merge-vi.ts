// Gộp nghĩa tiếng Việt và âm Hán Việt của từ HSK từ src/data/vi-src/hsk<N>.txt vào src/data/hsk<N>.json.
//   npm run vi            ghi vào dữ liệu
//   npm run vi -- --check chỉ kiểm tra
// Mỗi dòng nguồn: số thứ tự|chữ Hán|nghĩa tiếng Việt|âm Hán Việt (có thể để trống với trợ từ, từ mượn).
// Nội dung do AI soạn nháp và CHƯA được giáo viên kiểm duyệt; sửa trực tiếp trong vi-src rồi chạy lại là xong.
// Dòng thiếu chữ Hán (3 cột) được điền từ dữ liệu theo số thứ tự rồi ghi lại, nên sau lần chạy đầu mọi dòng đều có đủ 4 cột.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface Word {
  id: string
  hanzi: string
  meaning_vi: string
  han_viet: string
  [k: string]: unknown
}

const check = process.argv.includes('--check')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const problems: string[] = []
let total = 0

for (let level = 1; level <= 6; level++) {
  const src = join(root, 'vi-src', `hsk${level}.txt`)
  if (!existsSync(src)) continue
  const jsonFile = join(root, `hsk${level}.json`)
  const words = JSON.parse(readFileSync(jsonFile, 'utf8')) as Word[]
  const byNum = new Map(words.map((w) => [w.id.split('-')[1], w]))
  const seen = new Set<string>()
  const lines: string[] = []

  for (const [i, raw] of readFileSync(src, 'utf8').split(/\r?\n/).entries()) {
    if (!raw.trim()) continue
    const cols = raw.split('|')
    const where = `hsk${level}.txt:${i + 1}`
    const num = cols[0]?.trim()
    const w = byNum.get(num)
    if (!w) {
      problems.push(`${where}: không có từ số ${num}`)
      continue
    }
    // 3 cột (thiếu chữ Hán) hoặc 4 cột
    const hasHanzi = cols.length >= 4 || (cols.length === 3 && cols[1] === w.hanzi)
    const [vi, hv] = hasHanzi ? [cols[2], cols[3] ?? ''] : [cols[1], cols[2] ?? '']
    if (hasHanzi && cols[1] !== w.hanzi) problems.push(`${where}: chữ Hán ${cols[1]} không khớp ${w.hanzi} (số ${num})`)
    if (!vi?.trim()) problems.push(`${where}: thiếu nghĩa của ${w.hanzi}`)
    if (/[A-Za-z]{4,}.*[|]/.test(vi ?? '')) problems.push(`${where}: nghĩa có vẻ lẫn cột`)
    if (seen.has(num)) problems.push(`${where}: số ${num} bị lặp`)
    seen.add(num)
    w.meaning_vi = vi.trim()
    w.han_viet = (hv ?? '').trim()
    lines.push(`${num}|${w.hanzi}|${w.meaning_vi}|${w.han_viet}`)
  }
  const missing = words.filter((w) => !seen.has(w.id.split('-')[1]))
  if (missing.length) problems.push(`hsk${level}: thiếu ${missing.length} từ, ví dụ ${missing.slice(0, 5).map((w) => w.hanzi).join(' ')}`)
  total += seen.size

  if (!problems.length && !check) {
    writeFileSync(jsonFile, JSON.stringify(words))
    writeFileSync(src, lines.join('\n') + '\n')
  }
}

if (problems.length) {
  console.error(`${problems.length} vấn đề:\n` + problems.slice(0, 40).join('\n'))
  process.exit(1)
}
console.log(`${check ? '[kiểm tra] ' : ''}Đã gộp nghĩa tiếng Việt cho ${total} từ.`)
