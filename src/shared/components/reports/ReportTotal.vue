<script setup lang="ts">
defineProps<{ value: string; unit: string; change: string | null; comparison: string; sectionLabel: string }>()
</script>

<template>
  <section class="flex flex-col gap-1 px-5 pt-3" :aria-label="sectionLabel">
    <div class="flex items-baseline gap-2.5">
      <span class="font-headline text-[52px] font-extrabold leading-none tracking-[-0.02em]">{{ value }}</span>
      <span class="text-[14px] text-on-primary/60">{{ unit }}</span>
      <span v-if="change" class="ml-auto rounded-full bg-secondary-container px-2.5 py-1 font-headline text-[13px] font-bold text-on-secondary-container">{{ change }}</span>
    </div>
    <span class="text-[13px] text-on-primary/60">{{ comparison }}</span>
  </section>
</template>
