<template>
  <div
    v-if="show"
    class="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm"
  >
    <div class="loader mb-3"></div>
    <p class="text-sm text-gray-600 dark:text-gray-300">Loading...</p>
  </div>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})
</script>
