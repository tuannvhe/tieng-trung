const c = (n) => `rgb(var(--c-${n}) / <alpha-value>)`
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { paper: c('paper'), surface: c('surface'), ink: c('ink'), ink2: c('ink2'), line: c('line'), seal: c('seal'), jade: c('jade'), lantern: c('lantern'), sky: c('sky') },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        han: ['"Noto Serif SC"', '"Songti SC"', 'serif'],
        zh: ['"Noto Sans SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      boxShadow: { lift: '0 1px 2px rgb(var(--c-ink) / .06), 0 8px 24px -8px rgb(var(--c-ink) / .18)' },
    },
  },
  plugins: [],
}
