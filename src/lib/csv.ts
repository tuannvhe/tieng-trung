/** Một ô CSV: bọc ngoặc kép khi có dấu phẩy, ngoặc kép hoặc xuống dòng; nhân đôi ngoặc kép bên trong. */
function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV UTF-8 có BOM để Excel mở tiếng Việt và chữ Hán đúng. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** Đọc CSV (hỗ trợ ngoặc kép, dấu phẩy và xuống dòng trong ô, BOM). Trả về mảng dòng. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') (field += '"', i++)
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') (row.push(field), (field = ''))
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) (row.push(field), rows.push(row))
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}
