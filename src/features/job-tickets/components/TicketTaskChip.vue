<script setup lang="ts">
defineProps<{ taskCode: string | null }>()
</script>

<template>
  <span v-if="taskCode" class="absolute bottom-2 left-2 max-w-[calc(100%-3.5rem)] truncate rounded-full bg-surface/90 px-2 py-0.5 font-label text-[10px] font-semibold leading-4 text-on-surface" :title="taskCode">{{ taskCode }}</span>
</template>
