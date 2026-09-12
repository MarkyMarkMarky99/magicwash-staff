<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  imageUrl: string | null
  icon: string
  fit?: 'cover' | 'contain'
}>()

const imageFailed = ref(false)

watch(() => props.imageUrl, () => {
  imageFailed.value = false
})
</script>

<template>
  <span class="flex shrink-0 items-center justify-center overflow-hidden border border-outline-variant/10 bg-primary/10 text-primary">
    <img
      v-if="props.imageUrl && !imageFailed"
      :src="props.imageUrl"
      alt=""
      class="h-full w-full"
      :class="props.fit === 'contain' ? 'object-contain' : 'object-cover'"
      loading="lazy"
      @error="imageFailed = true"
    >
    <span v-else class="material-symbols-outlined text-[22px]" aria-hidden="true">{{ props.icon }}</span>
  </span>
</template>
