<script setup lang="ts">
import { computed } from 'vue'
import { pinyinSyllables } from '@/lib/pinyin'

/** Pinyin tô màu theo thanh điệu: giúp mắt nhớ thanh cùng với âm. */
const props = defineProps<{ text: string; plain?: boolean }>()
const syl = computed(() => pinyinSyllables(props.text))
</script>
<template>
  <span class="whitespace-pre-wrap">
    <template v-for="(s, i) in syl" :key="i"
      ><span :class="plain || s.tone === 0 ? '' : 't' + s.tone">{{ s.text }}</span
      ><template v-if="i < syl.length - 1">{{ ' ' }}</template></template
    >
  </span>
</template>
