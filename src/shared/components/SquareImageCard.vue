<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ imageUrl: string | null; primaryText: string; secondaryText: string }>()
const imageFailed = ref(false)
watch(() => props.imageUrl, () => { imageFailed.value = false })
</script>

<template>
  <article class="min-w-0 rounded-xl text-left">
    <div class="relative aspect-square overflow-hidden rounded-xl bg-surface-container-low">
      <img v-if="imageUrl && !imageFailed" :src="imageUrl" alt="" loading="lazy" class="h-full w-full object-cover" @error="imageFailed = true">
      <div v-else class="flex h-full w-full items-center justify-center bg-surface-container-low text-on-surface-variant">
        <span class="material-symbols-outlined text-4xl" aria-hidden="true">image</span>
      </div>
      <div v-if="$slots.badge" class="absolute left-2 top-2"><slot name="badge" /></div>
    </div>
    <strong class="mt-2 block truncate font-headline text-sm font-semibold text-on-surface">{{ primaryText }}</strong>
    <span class="mt-0.5 block truncate font-body text-xs text-on-surface-variant">{{ secondaryText }}</span>
  </article>
</template>
