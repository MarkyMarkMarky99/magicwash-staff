<template>
  <header class="sticky top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-surface-light px-5 py-4 dark:border-border-dark dark:bg-background-dark">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ title }}</h1>
    <div class="flex items-center space-x-4">
      <button
        class="text-gray-500 hover:text-gray-700 focus:outline-none dark:text-gray-300 dark:hover:text-white"
        type="button"
        aria-label="Notifications"
      >
        <span class="material-symbols-outlined text-[24px]">notifications</span>
      </button>
      <button
        v-if="showAdd"
        class="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-500/30 transition-colors hover:opacity-90"
        type="button"
        aria-label="Add task"
        @click="$emit('add')"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
      </button>
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  showAdd: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['add'])
</script>
