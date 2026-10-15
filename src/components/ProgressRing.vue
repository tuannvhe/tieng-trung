<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ value: number; max: number; size?: number; label?: string }>()
const r = 26
const C = 2 * Math.PI * r
const frac = computed(() => (props.max > 0 ? Math.min(1, props.value / props.max) : 0))
</script>
<template>
  <div class="relative grid place-items-center" :style="{ width: (size ?? 72) + 'px', height: (size ?? 72) + 'px' }" role="img" :aria-label="label ?? `${value}/${max}`">
    <svg viewBox="0 0 64 64" class="absolute inset-0 -rotate-90">
      <circle cx="32" cy="32" :r="r" fill="none" stroke="rgb(var(--c-line))" stroke-width="6" />
      <circle cx="32" cy="32" :r="r" fill="none" stroke="rgb(var(--c-seal))" stroke-width="6" stroke-linecap="round"
        :stroke-dasharray="C" :stroke-dashoffset="C * (1 - frac)" style="transition: stroke-dashoffset .8s ease" />
    </svg>
    <span class="text-sm font-semibold tabular-nums"><slot>{{ value }}</slot></span>
  </div>
</template>
