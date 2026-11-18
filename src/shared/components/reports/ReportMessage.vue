<script setup lang="ts">
defineProps<{ kind: 'loading' | 'error' }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <p v-if="kind === 'error'" class="mx-4 mt-4 rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
    <slot />
    <button type="button" class="ml-2 min-h-11 min-w-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="emit('retry')">Retry</button>
  </p>
  <p v-else class="px-5 pt-8 text-center text-[13px] text-on-primary/60" aria-live="polite"><slot /></p>
</template>
