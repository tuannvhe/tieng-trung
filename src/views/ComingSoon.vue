<script setup lang="ts">
import { useRoute, RouterLink } from 'vue-router'
const route = useRoute()
</script>
<template>
  <div class="surface mx-auto mt-8 max-w-md space-y-3 p-10 text-center">
    <span class="seal mx-auto h-14 w-14 text-2xl">待</span>
    <h1 class="text-xl font-bold">{{ route.meta.title }}</h1>
    <p class="text-ink2">Phần này sẽ có ở bước {{ route.meta.step }} của kế hoạch.</p>
    <RouterLink to="/practice" class="btn-ghost">Về luyện tập</RouterLink>
  </div>
</template>
