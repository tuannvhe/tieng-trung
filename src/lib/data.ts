import type { DialogueData, HskLevel, HskWord, ItDomain, ItTerm } from '@/types'

/** Mỗi cấp HSK là một chunk riêng, chỉ tải khi cần. */
const hskLoaders = import.meta.glob('../data/hsk[1-6].json', { import: 'default' }) as Record<
  string,
  () => Promise<HskWord[]>
>

const hskCache = new Map<HskLevel, HskWord[]>()

export async function loadHsk(level: HskLevel): Promise<HskWord[]> {
  const hit = hskCache.get(level)
  if (hit) return hit
  const words = await hskLoaders[`../data/hsk${level}.json`]()
  hskCache.set(level, words)
  return words
}

let hsk30Cache: Record<string, number> | null = null

/** Cấp HSK 3.0 (chuẩn mới) theo chữ Hán, cấp 7 là nhóm 7-9. Từ không có trong danh sách thì không có khóa. */
export async function loadHsk30(): Promise<Record<string, number>> {
  if (!hsk30Cache) hsk30Cache = (await import('../data/hsk30.json')).default as Record<string, number>
  return hsk30Cache
}

let itCache: ItTerm[] | null = null

export async function loadItTerms(domain?: ItDomain): Promise<ItTerm[]> {
  if (!itCache) itCache = (await import('../data/it/terms.json')).default as ItTerm[]
  return domain ? itCache.filter((t) => t.domain === domain) : itCache
}

let dialogueCache: DialogueData | null = null

/** Kho hội thoại nhà máy (khoảng 570 đoạn), chỉ tải khi cần. */
export async function loadDialogues(): Promise<DialogueData> {
  if (!dialogueCache) dialogueCache = (await import('../data/dialogues.json')).default as DialogueData
  return dialogueCache
}
