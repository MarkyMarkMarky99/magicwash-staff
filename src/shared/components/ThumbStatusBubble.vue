<script setup lang="ts">
defineProps<{
  state: 'done' | 'current' | 'pending'
}>()
</script>

<template>
  <span v-if="state === 'done'" class="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-lime text-primary" aria-hidden="true"><span class="material-symbols-outlined block text-[14px] leading-none">check</span></span>
  <span v-else-if="state === 'current'" class="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary text-lime" aria-hidden="true"><span class="material-symbols-outlined block text-[14px] leading-none">sync</span></span>
  <span v-else class="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full border-2 border-dashed border-outline-variant bg-surface" aria-hidden="true" />
</template>
