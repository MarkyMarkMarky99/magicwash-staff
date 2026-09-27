<script setup lang="ts">
import BaseBadge from '@/shared/components/BaseBadge.vue'
defineProps<{
  icon: string
  title: string
  badge?: string
}>()
</script>

<template>
  <section class="w-full rounded-2xl bg-white">
    <div class="flex items-center justify-between gap-2 rounded-t-2xl bg-surface-container-low px-4 py-2 text-primary">
      <span class="flex min-w-0 items-center gap-2.5">
        <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">{{ icon }}</span>
        <h2 class="truncate font-headline text-[13px] font-bold tracking-tight">{{ title }}</h2>
      </span>

      <div class="flex shrink-0 items-center gap-2">
        <BaseBadge v-if="badge" class="h-[22px] whitespace-nowrap" :label="badge" size="lg" tone="neutral" :uppercase="true" />
        <slot name="action" />
      </div>
    </div>

    <div class="overflow-hidden rounded-b-2xl">
      <slot />
    </div>
  </section>
</template>
