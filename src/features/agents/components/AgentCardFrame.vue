<script setup lang="ts">
import PaperCard from '@/shared/components/PaperCard.vue'

withDefaults(defineProps<{ title: string; tone?: 'brand' | 'warning' }>(), { tone: 'brand' })
</script>

<template>
  <PaperCard :tab="title" :tone="tone" class="!mx-0 !mb-0 !mt-3 w-full max-w-[330px]">
    <div class="px-3 pb-3 pt-4"><slot /></div>
  </PaperCard>
</template>
