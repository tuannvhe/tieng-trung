/**
 * Tính hsk_max cho thuật ngữ IT từ dữ liệu HSK.
 * Cấp của một chữ Hán = cấp thấp nhất của từ HSK nào chứa chữ đó (xấp xỉ: chữ xuất hiện
 * trong từ HSK n thì coi như người học đã gặp ở cấp n). Chữ không có trong HSK1-5 => 6.
 * Chạy: npx tsx scripts/compute-hsk-max.ts          (chỉ báo cáo chênh lệch)
 *       npx tsx scripts/compute-hsk-max.ts --write  (ghi đè hsk_max trong terms.json)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const charLevel = new Map<string, number>()
for (let lv = 1; lv <= 5; lv++) {
  for (const w of JSON.parse(readFileSync(join(root, `hsk${lv}.json`), 'utf8'))) {
    for (const ch of w.hanzi.match(/[㐀-鿿]/g) ?? []) {
      if (!charLevel.has(ch)) charLevel.set(ch, lv)
    }
  }
}

export function hskMax(hanzi: string): number {
  let max = 1
  for (const ch of hanzi.match(/[㐀-鿿]/g) ?? []) max = Math.max(max, charLevel.get(ch) ?? 6)
  return max
}

const file = join(root, 'it', 'terms.json')
const terms = JSON.parse(readFileSync(file, 'utf8'))
let changed = 0
for (const t of terms) {
  const v = hskMax(t.hanzi_sc)
  if (v !== t.hsk_max) {
    changed++
    console.log(`${t.id} ${t.hanzi_sc}: ${t.hsk_max} -> ${v}`)
    t.hsk_max = v
  }
}
if (process.argv.includes('--write')) {
  writeFileSync(file, '[\n' + terms.map((t: unknown) => '  ' + JSON.stringify(t)).join(',\n') + '\n]\n')
  console.log(`Đã ghi ${changed} thay đổi`)
} else console.log(`${changed} mục lệch (thêm --write để ghi)`)
