import { registerAudioSource } from '@/composables/useSpeech'

/**
 * Gói âm thanh người thật. Mỗi câu/từ có một khóa tính từ chính chữ Hán của nó (bỏ dấu câu và khoảng trắng),
 * nên đổi nội dung câu thì khóa đổi theo và không bao giờ phát nhầm file cũ.
 * File đặt ở `public/audio/<khóa>.mp3` (hoặc .ogg/.m4a/.wav) và được liệt kê trong `public/audio/manifest.json`.
 * Câu nào chưa có file thì dùng giọng đọc của trình duyệt như cũ.
 */
export function audioKey(text: string): string {
  const t = text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '')
  // FNV-1a 32 bit, ghép với độ dài để giảm va chạm
  let h = 0x811c9dc5
  for (const ch of t) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0') + t.length.toString(36)
}

export type AudioManifest = Record<string, string>

export function makeResolver(manifest: AudioManifest, base: string) {
  return (text: string): string | undefined => {
    const file = manifest[audioKey(text)]
    return file ? `${base}audio/${file}` : undefined
  }
}

/** Nạp danh mục âm thanh (nếu có). Lỗi hoặc không có danh mục thì im lặng dùng giọng máy. */
export async function loadAudioPack(base: string = import.meta.env.BASE_URL): Promise<number> {
  try {
    const res = await fetch(`${base}audio/manifest.json`, { cache: 'no-cache' })
    if (!res.ok) return 0
    const manifest = (await res.json()) as AudioManifest
    const n = Object.keys(manifest).length
    if (n) registerAudioSource(makeResolver(manifest, base))
    return n
  } catch {
    return 0
  }
}
