// Sửa cách đọc chính của từ HSK có nhiều cách đọc.
// Nguồn gốc lỗi: với chữ nhiều âm, cách đọc đầu tiên trong dữ liệu gốc (CC-CEDICT) thường là cách đọc hiếm
// (ví dụ 都 hiện "Dū, họ Đỗ", 看 hiện "kān, trông coi", 个 hiện "gě"). Script chọn lại cách đọc chính bằng cách đối chiếu
// với cách đọc phổ biến của pinyin-pro, rồi đưa cách đọc đó lên đầu và lấy nghĩa, pinyin của nó làm nghĩa chính.
// Chạy lại được nhiều lần (idempotent):  npx tsx scripts/fix-hsk-readings.ts [--dry]
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

interface Form {
  pinyin: string
  numeric: string
  meanings: string[]
  classifiers: string[]
}
interface Word {
  id: string
  hanzi: string
  pinyin: string
  numeric: string
  meanings_en: string[]
  forms: Form[]
  [k: string]: unknown
}

const dry = process.argv.includes('--dry')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const norm = (s: string) => s.toLowerCase().replace(/[\s'’]/g, '')
const strip = (s: string) => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'v').replace(/u:/g, 'v')
/** Dạng hiển thị: "lu:è" thành "lüè". */
const fixU = (s: string) => s.replace(/u:/g, 'ü').replace(/U:/g, 'Ü')

/** Giữ nguyên cách đọc hiện có: pinyin-pro đoán sai hoặc cả hai cách đọc đều thuộc danh sách HSK. */
const KEEP = new Set(['地', '只'])
/** Cách đọc ép cứng khi pinyin-pro chọn cách đọc không phải nghĩa thường gặp của từ HSK. */
const FORCE: Record<string, string> = { 了: 'le' }
const RARE = /^(surname|variant of|old variant|unofficial variant|abbr\. for|also pr\.|used in|see )|\((archaic|dialect)\)/i

let changed = 0
let umlaut = 0
const log: string[] = []

for (let level = 1; level <= 6; level++) {
  const file = join(root, `hsk${level}.json`)
  const words = JSON.parse(readFileSync(file, 'utf8')) as Word[]
  for (const w of words) {
    const display = fixU(w.pinyin)
    if (display !== w.pinyin) {
      w.pinyin = display
      umlaut++
    }
    for (const f of w.forms) f.pinyin = fixU(f.pinyin)

    if (w.forms.length < 2 || KEEP.has(w.hanzi)) continue
    const target = FORCE[w.hanzi] ?? pinyin(w.hanzi, { toneType: 'symbol', v: true })
    // Chỉ xét dạng "bình thường": không phải họ, biến thể, từ cổ, viết tắt; pinyin không viết hoa (trừ khi chính chữ đó là tên riêng)
    const ok = (f: Form) => !/^[A-ZÀ-Ý]/.test(f.pinyin) && !RARE.test(f.meanings[0] ?? '')
    const pool = w.forms.map((f, i) => ({ f, i })).filter((x) => ok(x.f))
    if (!pool.length) continue
    const pick =
      pool.find((x) => x.f.pinyin === target) ?? pool.find((x) => norm(x.f.pinyin) === norm(target)) ?? pool.find((x) => strip(x.f.pinyin) === strip(target))
    if (!pick || pick.i === 0) continue
    const idx = pick.i
    const [main] = w.forms.splice(idx, 1)
    w.forms.unshift(main)
    log.push(`${w.id} ${w.hanzi}: ${w.pinyin} → ${main.pinyin}  (${(main.meanings[0] ?? '').slice(0, 40)})`)
    w.pinyin = main.pinyin
    w.numeric = main.numeric
    w.meanings_en = main.meanings
    changed++
  }
  if (!dry) writeFileSync(file, JSON.stringify(words))
}

console.log(`${dry ? '[thử] ' : ''}Đã đổi cách đọc chính của ${changed} từ, sửa ký hiệu ü cho ${umlaut} từ.`)
if (process.argv.includes('--list')) console.log(log.join('\n'))
