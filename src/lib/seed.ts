import type { HskLevel } from '@/types'
import { loadHsk, loadItTerms } from './data'
import { getStorage } from './storage'

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Nạp HSK + IT vào DB cục bộ lần đầu, hoặc khi dữ liệu gốc đổi. Trả về true nếu đã nạp. */
export async function seedLocalDb(): Promise<boolean> {
  const storage = await getStorage()
  const levels: HskLevel[] = [1, 2, 3, 4, 5, 6]
  const words = (await Promise.all(levels.map(loadHsk))).flat()
  const terms = await loadItTerms()
  const version = `${words.length}-${terms.length}-${hash(JSON.stringify(terms))}`
  if ((await storage.getContentVersion()) === version) return false
  await storage.seedContent(words, terms, version)
  return true
}
