<script setup lang="ts">
import ImageOrIcon from './ImageOrIcon.vue'

withDefaults(defineProps<{
  imageUrl: string | null
  title: string
  icon?: string
}>(), {
  icon: 'image',
})
</script>

<template>
  <span class="flex min-w-0 select-none flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface">
    <span class="relative aspect-4/3 w-full overflow-hidden bg-surface-container-low">
      <ImageOrIcon :image-url="imageUrl" :icon="icon" fit="cover" class="pointer-events-none h-full w-full scale-[1.15] rounded-none border-0" />
      <span v-if="$slots.badge" class="absolute right-2 top-2">
        <slot name="badge" />
      </span>
    </span>
    <span class="flex min-w-0 flex-1 flex-col p-3">
      <strong class="line-clamp-2 font-headline text-sm font-bold leading-5 text-primary">{{ title }}</strong>
      <span v-if="$slots.default" class="mt-1 min-w-0">
        <slot />
      </span>
      <span v-if="$slots.footer" class="mt-auto min-w-0 pt-2">
        <slot name="footer" />
      </span>
    </span>
  </span>
</template>
