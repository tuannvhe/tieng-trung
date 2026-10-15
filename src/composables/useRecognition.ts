import { onBeforeUnmount, ref } from 'vue'

interface RecEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
interface Rec {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: RecEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Trình duyệt chưa được phép dùng micro. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ để cho phép.',
  'service-not-allowed': 'Trình duyệt không cho dùng nhận dạng giọng nói trên trang này.',
  'no-speech': 'Không nghe thấy gì. Hãy đưa micro lại gần và đọc ngay sau khi bấm.',
  'audio-capture': 'Không tìm thấy micro.',
  network: 'Nhận dạng giọng nói cần có mạng Internet.',
}

/** Nhận dạng giọng nói tiếng Trung bằng Web Speech API (Chrome, Edge; Chrome gửi âm thanh lên máy chủ của Google). */
export function useRecognition() {
  const w = typeof window !== 'undefined' ? (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }) : {}
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  const supported = !!Ctor
  const listening = ref(false)
  const error = ref('')
  let rec: Rec | null = null

  /** Nghe một lần, trả về các phương án nhận dạng (tốt nhất trước); mảng rỗng nếu lỗi hoặc không nghe được. */
  function listen(): Promise<string[]> {
    return new Promise((resolve) => {
      if (!Ctor) return resolve([])
      error.value = ''
      rec = new Ctor()
      rec.lang = 'zh-CN'
      rec.interimResults = false
      rec.continuous = false
      rec.maxAlternatives = 5
      let out: string[] = []
      rec.onresult = (e) => {
        const first = e.results[0]
        out = Array.from({ length: first.length }, (_, i) => first[i].transcript)
      }
      rec.onerror = (e) => {
        if (e.error !== 'aborted') error.value = ERRORS[e.error] ?? `Lỗi nhận dạng: ${e.error}`
      }
      rec.onend = () => {
        listening.value = false
        resolve(out)
      }
      listening.value = true
      try {
        rec.start()
      } catch {
        listening.value = false
        resolve([])
      }
    })
  }
  function stop() {
    rec?.stop()
  }
  onBeforeUnmount(() => rec?.abort())

  return { supported, listening, error, listen, stop }
}
