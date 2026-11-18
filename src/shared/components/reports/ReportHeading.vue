<script setup lang="ts">
defineProps<{ title: string; subtitle: string; sectionLabel: string }>()
</script>

<template>
  <section class="flex items-center gap-3.5 px-5 pb-1 pt-5" :aria-label="sectionLabel">
    <slot name="leading" />
    <div class="min-w-0 flex-1">
      <h2 class="truncate font-headline text-[20px] font-bold leading-tight">{{ title }}</h2>
      <p class="truncate text-[13px] text-on-primary/60">{{ subtitle }}</p>
      <slot />
    </div>
    <slot name="action" />
  </section>
</template>
