/** Video YouTube người dùng tự lưu để học. Chỉ nhận đúng các dạng link YouTube, mọi thứ khác bị từ chối. */
/** Một mốc đáng nghe lại trong video. */
export interface VideoMark {
  /** Giây */
  t: number
  note: string
}

export const MAX_MARKS = 50

export interface SavedVideo {
  id: string
  /** Mã video 11 ký tự */
  videoId: string
  title: string
  note: string
  /** Cấp HSK liên quan, 0 = chưa gán */
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Giây bắt đầu phát */
  start: number
  createdAt: number
  lastWatchedAt?: number
  marks?: VideoMark[]
  /** Giây đã xem tới (để xem tiếp) và tổng độ dài, cập nhật khi xem */
  position?: number
  duration?: number
}

const ID = /^[A-Za-z0-9_-]{11}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'])

/** "1h2m3s", "90s", "90" thành số giây. */
export function parseTime(t: string | null): number {
  if (!t) return 0
  if (/^\d+$/.test(t)) return Math.min(Number(t), 86400 * 2)
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t)
  if (!m || (!m[1] && !m[2] && !m[3])) return 0
  return Math.min(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0), 86400 * 2)
}

/** Đọc mốc người dùng gõ: "1:15", "1:02:03", "75", "1m15s". Sai định dạng thì null. */
export function parseClock(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  const colon = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{1,2})$/.exec(s)
  if (colon) {
    const [h, m, sec] = [Number(colon[1] ?? 0), Number(colon[2]), Number(colon[3])]
    return sec < 60 && (colon[1] === undefined || m < 60) ? h * 3600 + m * 60 + sec : null
  }
  if (/^\d+$/.test(s) || /^(?:\d+h)?(?:\d+m)?(?:\d+s)?$/.test(s)) {
    const t = parseTime(s)
    return t > 0 || s === '0' ? t : null
  }
  return null
}

/** Lấy mã video và giây bắt đầu từ link watch, youtu.be, shorts, embed, live. Trả null nếu không phải link video YouTube. */
export function parseYoutube(input: string): { videoId: string; start: number } | null {
  const raw = input.trim()
  if (!raw) return null
  // Cho phép dán mỗi mã video
  if (ID.test(raw)) return { videoId: raw, start: 0 }
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || !HOSTS.has(url.hostname.toLowerCase())) return null
  let id: string | null = null
  if (url.hostname.toLowerCase() === 'youtu.be') id = url.pathname.split('/')[1] ?? null
  else if (url.pathname === '/watch') id = url.searchParams.get('v')
  else {
    const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)
    id = m?.[1] ?? null
  }
  if (!id || !ID.test(id)) return null
  const start = parseTime(url.searchParams.get('t') ?? url.searchParams.get('start'))
  return { videoId: id, start }
}

export const embedUrl = (videoId: string, start = 0, origin = '') =>
  `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1${origin ? `&origin=${encodeURIComponent(origin)}` : ''}${start > 0 ? `&start=${Math.floor(start)}` : ''}`

/** Điều khiển khung YouTube qua postMessage (không cần nạp thư viện ngoài). */
export const YT_ORIGIN = 'https://www.youtube-nocookie.com'
export const ytListening = () => JSON.stringify({ event: 'listening', id: 1, channel: 'widget' })
export const ytCommand = (func: 'playVideo' | 'pauseVideo' | 'seekTo', args: unknown[] = []) => JSON.stringify({ event: 'command', func, args })

export interface YtProgress {
  time?: number
  duration?: number
  /** -1 chưa bắt đầu, 0 hết, 1 đang phát, 2 tạm dừng, 3 đang tải */
  state?: number
}
/** Đọc tin nhắn từ khung YouTube; trả về null nếu không phải thông tin trạng thái. */
export function parseYtMessage(data: unknown): YtProgress | null {
  let m: unknown = data
  if (typeof data === 'string') {
    try { m = JSON.parse(data) } catch { return null }
  }
  if (!m || typeof m !== 'object') return null
  const x = m as { event?: unknown; info?: unknown }
  if (x.event !== 'infoDelivery' && x.event !== 'initialDelivery') return null
  const i = x.info as Record<string, unknown> | undefined
  if (!i || typeof i !== 'object') return null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
  const out: YtProgress = { time: num(i.currentTime), duration: num(i.duration) }
  if (typeof i.playerState === 'number' && i.playerState >= -1 && i.playerState <= 5) out.state = i.playerState
  return out
}

export const thumbnailUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`

export const watchUrl = (videoId: string, start = 0) => `https://www.youtube.com/watch?v=${videoId}${start > 0 ? `&t=${Math.floor(start)}s` : ''}`

/** Giây thành "1:02:03" hoặc "2:03". */
export function formatStart(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Lấy tên video qua oEmbed của YouTube. Không bắt buộc: lỗi mạng hoặc bị chặn thì trả chuỗi rỗng. */
export async function fetchTitle(videoId: string, timeoutMs = 4000): Promise<string> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(videoId))}&format=json`, { signal: ctl.signal })
    if (!res.ok) return ''
    const j = (await res.json()) as { title?: unknown }
    return typeof j.title === 'string' ? j.title.slice(0, 200) : ''
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

/** Kiểm tra dữ liệu đọc từ kho hoặc file nhập trước khi dùng. */
export function isSavedVideo(v: unknown): v is SavedVideo {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return (
    typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 64 &&
    typeof x.videoId === 'string' && ID.test(x.videoId) &&
    typeof x.title === 'string' && x.title.length <= 200 &&
    typeof x.note === 'string' && x.note.length <= 2000 &&
    Number.isInteger(x.level) && (x.level as number) >= 0 && (x.level as number) <= 6 &&
    typeof x.start === 'number' && x.start >= 0 &&
    typeof x.createdAt === 'number' &&
    (x.position === undefined || (typeof x.position === 'number' && x.position >= 0 && x.position <= 172800)) &&
    (x.duration === undefined || (typeof x.duration === 'number' && x.duration >= 0 && x.duration <= 172800)) &&
    (x.marks === undefined || (Array.isArray(x.marks) && x.marks.length <= MAX_MARKS && x.marks.every((m) => !!m && typeof m.t === 'number' && m.t >= 0 && m.t <= 172800 && typeof m.note === 'string' && m.note.length <= 200)))
  )
}
