// Tải danh sách từ HSK 3.0 (chuẩn mới, 2021) từ drkameleon/complete-hsk-vocabulary (MIT) và ghi src/data/hsk30.json.
//   npm run hsk30
// File ra có dạng { "<chữ Hán>": cấp }, cấp 1-6, cấp 7 là nhóm 7-9. Từ ở nhiều cấp lấy cấp thấp nhất.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/new'
const out: Record<string, number> = {}
const counts: number[] = []

for (let level = 1; level <= 7; level++) {
  const res = await fetch(`${BASE}/${level}.min.json`)
  if (!res.ok) throw new Error(`Không tải được cấp ${level}: ${res.status}`)
  const rows = (await res.json()) as Array<{ s: string }>
  counts.push(rows.length)
  for (const r of rows) if (typeof r.s === 'string' && r.s && !(r.s in out)) out[r.s] = level
}

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'hsk30.json')
writeFileSync(file, JSON.stringify(out))
console.log(`Đã ghi ${Object.keys(out).length} từ (theo cấp: ${counts.join(', ')}) vào src/data/hsk30.json`)
