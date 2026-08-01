<script setup lang="ts">
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
        <span
          v-if="badge"
          class="flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full bg-surface-container px-2.5 font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant"
        >
          {{ badge }}
        </span>
        <slot name="action" />
      </div>
    </div>

    <div class="overflow-hidden rounded-b-2xl">
      <slot />
    </div>
  </section>
</template>
