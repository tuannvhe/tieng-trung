import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Đường dẫn tương đối: chạy được khi đặt dưới bất kỳ thư mục con nào (router dùng hash)
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Trung văn IT — tiếng Trung cho xưởng và văn phòng',
        short_name: 'Trung văn IT',
        description: 'Học tiếng Trung IT trong nhà máy, kèm nền tảng HSK 1–5.',
        lang: 'vi',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F1530',
        theme_color: '#0F1530',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [
          {
            // Gói âm thanh người thật: cache dần khi nghe; danh mục luôn lấy bản mới nếu có mạng
            urlPattern: ({ url }: { url: URL }) => /\/audio\/.+\.(mp3|ogg|m4a|wav)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'voice-pack', rangeRequests: true, expiration: { maxEntries: 6000, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.endsWith('/audio/manifest.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'voice-manifest', networkTimeoutSeconds: 3 },
          },
          {
            // Dữ liệu nét chữ của hanzi-writer: cache dần khi dùng, hoặc tải sẵn trong Cài đặt
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/hanzi-writer-data/,
            handler: 'CacheFirst',
            options: { cacheName: 'hanzi-strokes', expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Tối ưu sẵn mọi phụ thuộc client. Nếu để Vite tự phát hiện muộn khi mở từng trang, nó tối ưu lại giữa chừng
  // và trả "504 Outdated Optimize Dep", làm trang ngữ pháp, thống kê, tập viết không tải được lần đầu.
  optimizeDeps: { include: ['vue', 'vue-router', 'pinia', 'dexie', 'vue-draggable-plus', 'chart.js', 'vue-chartjs', 'hanzi-writer'] },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
})
