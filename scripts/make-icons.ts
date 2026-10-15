/**
 * Sinh biểu tượng PWA (PNG) từ public/icon.svg.
 * Chạy: npx tsx scripts/make-icons.ts
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const svg = readFileSync(join(pub, 'icon.svg'))

const plain: Array<[string, number]> = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]
for (const [name, size] of plain) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(pub, name))
  console.log('✔', name)
}

// Bản maskable: nội dung thu nhỏ 80% trên nền đặc để không bị cắt khi Android bo tròn
const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0F1530' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(join(pub, 'icon-maskable-512.png'))
console.log('✔ icon-maskable-512.png')
