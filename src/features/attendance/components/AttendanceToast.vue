<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <Transition name="attendance-toast">
    <div
      v-if="message"
      role="status"
      class="pointer-events-none absolute inset-x-4 bottom-5 z-30 rounded-[14px] bg-on-surface px-3.5 py-3 text-[13px] leading-[1.4] text-on-primary"
    >{{ message }}</div>
  </Transition>
</template>

<style scoped>
.attendance-toast-enter-active,
.attendance-toast-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.attendance-toast-enter-from,
.attendance-toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
