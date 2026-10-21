<script setup lang="ts">
withDefaults(defineProps<{ title: string; tone?: 'brand' | 'warning' }>(), { tone: 'brand' })
</script>

<template>
  <div class="relative mt-3 w-full max-w-[330px] rounded-[11px_15px_12px_14px] border-2 border-primary bg-white px-3 pb-3 pt-4 shadow-[4px_4px_0_color-mix(in_srgb,var(--color-primary)_70%,black)]" >
    <span class="absolute -top-3 left-2.5 z-[2] -rotate-3 rounded-[6px_8px_6px_7px] px-[9px] pb-1 pt-[3px] font-headline text-[11px] font-bold leading-[1.1] text-white" :class="tone === 'warning' ? 'bg-warning shadow-[1px_1px_0_color-mix(in_srgb,var(--color-warning)_70%,black)]' : 'bg-primary shadow-[1px_1px_0_color-mix(in_srgb,var(--color-primary)_70%,black)]'">{{ title }}</span>
    <slot />
  </div>
</template>
