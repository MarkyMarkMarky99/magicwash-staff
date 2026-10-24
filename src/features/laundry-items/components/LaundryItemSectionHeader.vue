<script setup lang="ts">
defineProps<{ title: string, subtitle: string }>()
</script>

<template>
  <div class="relative mb-2.5 mt-1.5 flex items-stretch">
    <span class="mr-2.5 w-1 flex-none rounded-sm bg-lime" aria-hidden="true" />
    <div class="min-w-0 flex-1" :class="{ 'pr-28': $slots.action }">
      <h2 class="whitespace-nowrap font-headline text-xl font-extrabold leading-[1.1] text-primary">{{ title }}</h2>
      <p class="mt-[3px] whitespace-nowrap font-label text-[10px] font-extrabold uppercase leading-none tracking-[0.08em] text-on-surface-variant">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.action" class="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-3">
      <slot name="action" />
    </div>
  </div>
</template>
