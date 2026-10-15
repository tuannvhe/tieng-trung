<script setup lang="ts">
defineProps<{ name: string; size?: number }>()
// Bộ icon nét mảnh tự vẽ, viewBox 24x24
const P: Record<string, string> = {
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM6 11a6 6 0 0012 0m-6 6v4m-3 0h6',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14',
  sun: 'M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M3 12h2m14 0h2M5.6 18.4L7 17m10-10l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  cards: 'M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zm3 5h4m-4 4h4',
  brush: 'M18 3l3 3-8.5 8.5-3-3L18 3zM9.5 14.5C7 14.5 6 16 6 17.5S5 21 3 21c4 0 7-1 7-3.5',
  chip: 'M8 8h8v8H8zM10 3v3m4-3v3m-4 12v3m4-3v3M3 10h3m-3 4h3m12-4h3m-3 4h3',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zm9 16l-4-4',
  headphones: 'M4 15v-3a8 8 0 0116 0v3M4 15a2 2 0 012-2h1v6H6a2 2 0 01-2-2v-2zm16 0a2 2 0 00-2-2h-1v6h1a2 2 0 002-2v-2z',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zm2 14h13v2H6',
  chat: 'M4 5h16v11H9l-5 4V5z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  chart: 'M4 20V10m6 10V4m6 16v-8m5 8H3',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zm0-6l1.5 2.5 2.9-.6.6 2.9L19.5 9l-1.5 2.5L19.5 14l-2.5 1.5-.6 2.9-2.9-.6L12 20.5 10.5 18l-2.9.6-.6-2.9L4.5 14 6 11.5 4.5 9l2.5-1.5.6-2.9 2.9.6L12 3z',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  turtle: 'M3 14h2l2-3h8a5 5 0 015 3H3zm4 0l-1 3m9-3l1 3m5-3h1.5',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 100 6 3 3 0 000-6z',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4z',
  chevron: 'M6 9l6 6 6-6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  clock: 'M12 7v5l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  trophy: 'M8 4h8v5a4 4 0 01-8 0V4zM8 6H4v1a4 4 0 004 4m8-5h4v1a4 4 0 01-4 4m-4 1v4m-4 3h8',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 3-5 6-5s6 2 6 5M16 5.5a3 3 0 010 5.5M17 14c2.5.5 4 2 4 5',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  moon: 'M20 14A8 8 0 0110 4a8 8 0 1010 10z',
}
</script>
<template>
  <svg :width="size ?? 22" :height="size ?? 22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="P[name] ?? P.grid" :fill="name === 'play' || name === 'pause' ? 'currentColor' : 'none'" />
  </svg>
</template>
