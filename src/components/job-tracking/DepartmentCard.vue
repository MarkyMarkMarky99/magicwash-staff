<template>
  <button
    class="group flex h-full flex-col rounded-2xl border border-gray-200 bg-surface-light p-4 text-left shadow-sm transition-all duration-300 hover:border-primary hover:shadow-md active:scale-95 dark:border-border-dark dark:bg-surface-dark"
    type="button"
    @click="$emit('select', department.key)"
  >
    <div class="mb-3 flex w-full items-start">
      <div :class="['mr-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-300', department.iconWrapClass]">
        <span :class="['material-symbols-outlined text-[24px]', department.iconClass]">{{ department.icon }}</span>
      </div>
      <div class="flex h-12 flex-col justify-center">
        <h3 class="text-base font-semibold leading-tight text-gray-900 dark:text-white">{{ department.title }}</h3>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Department</p>
      </div>
    </div>

    <div class="mt-auto w-full border-t border-gray-100 pt-3 dark:border-gray-800">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs text-gray-400">Overview</span>
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ summary.total }} Tasks</span>
      </div>
      <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div :class="department.doneBarClass" :style="{ width: `${donePercent}%` }"></div>
        <div :class="department.inProgressBarClass" :style="{ width: `${inProgressPercent}%` }"></div>
      </div>
      <div class="mt-2 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
        <div class="flex items-center gap-1">
          <div :class="['h-1.5 w-1.5 rounded-full', department.doneBarClass]"></div>
          <span>{{ summary.doneToday }} Done</span>
        </div>
        <div class="flex items-center gap-1">
          <div :class="['h-1.5 w-1.5 rounded-full', department.inProgressBarClass]"></div>
          <span>{{ summary.inProgress }} In Pro.</span>
        </div>
      </div>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  department: {
    type: Object,
    required: true,
  },
  summary: {
    type: Object,
    required: true,
  },
})

defineEmits(['select'])

const donePercent = computed(() => {
  const total = Number(props.summary.total) || 0
  if (!total) return 0
  return Math.max(0, Math.min(100, ((Number(props.summary.doneToday) || 0) / total) * 100))
})

const inProgressPercent = computed(() => {
  const total = Number(props.summary.total) || 0
  if (!total) return 0
  return Math.max(0, Math.min(100 - donePercent.value, ((Number(props.summary.inProgress) || 0) / total) * 100))
})
</script>
