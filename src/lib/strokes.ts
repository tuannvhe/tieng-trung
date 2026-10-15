const CJK = /[㐀-鿿]/

/** URL dữ liệu nét của một chữ, đúng với bộ nạp mặc định của hanzi-writer. */
export function strokeUrl(ch: string): string {
  return `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(ch)}.json`
}

/** Các chữ Hán khác nhau (bỏ chữ Latin, dấu câu), giữ thứ tự xuất hiện. */
export function uniqueHan(texts: string[]): string[] {
  const seen = new Set<string>()
  for (const t of texts) for (const ch of t) if (CJK.test(ch)) seen.add(ch)
  return [...seen]
}

export interface PrefetchResult {
  ok: number
  failed: number
}

/**
 * Tải sẵn nét chữ để service worker lưu cache cho lần dùng offline.
 * Chạy `concurrency` yêu cầu song song, báo tiến độ sau mỗi chữ.
 */
export async function prefetchStrokes(
  chars: string[],
  onProgress: (done: number, total: number) => void,
  opts: { concurrency?: number; signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<PrefetchResult> {
  const { concurrency = 6, signal, fetchFn = fetch } = opts
  let next = 0
  let done = 0
  const res: PrefetchResult = { ok: 0, failed: 0 }
  async function worker() {
    while (next < chars.length && !signal?.aborted) {
      const ch = chars[next++]
      try {
        const r = await fetchFn(strokeUrl(ch), { signal })
        if (r.ok) res.ok++
        else res.failed++
      } catch {
        res.failed++
      }
      onProgress(++done, chars.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, chars.length) }, worker))
  return res
}
