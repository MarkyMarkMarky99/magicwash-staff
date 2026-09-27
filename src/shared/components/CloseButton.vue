<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{
  label?: string
  tone?: 'onDark' | 'onLight'
}>(), {
  label: 'Close',
  tone: 'onLight',
})

const buttonRef = ref<HTMLButtonElement | null>(null)

defineExpose({
  focus: (options?: FocusOptions) => buttonRef.value?.focus(options),
})
</script>

<template>
  <button
    ref="buttonRef"
    type="button"
    class="flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    :class="tone === 'onDark' ? 'hover:bg-white/10' : 'hover:bg-black/5'"
    :aria-label="label"
  >
    <span class="material-symbols-outlined" aria-hidden="true">close</span>
  </button>
</template>
