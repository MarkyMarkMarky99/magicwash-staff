<template>
  <div class="w-full shrink-0 overflow-x-auto no-scrollbar pb-4 pt-2">
    <div class="flex min-w-max gap-2 px-4">
      <button
        v-for="filter in filters"
        :key="filter.value"
        :class="buttonClass(filter.value)"
        type="button"
        @click="$emit('update:modelValue', filter.value)"
      >
        <span class="material-symbols-outlined text-[16px]">{{ filter.icon }}</span>
        {{ filter.label }}
        <span :class="['pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white', filter.badgeClass]">
          {{ formatCount(counts[filter.value]) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  counts: {
    type: Object,
    required: true,
  },
})

defineEmits(['update:modelValue'])

const filters = [
  { value: 'All', label: 'All', icon: 'check_circle', badgeClass: 'bg-primary' },
  { value: 'Pending', label: 'Pending', icon: 'schedule', badgeClass: 'bg-yellow-500' },
  { value: 'In Progress', label: 'In Progress', icon: 'play_circle', badgeClass: 'bg-blue-500' },
  { value: 'Completed', label: 'Completed', icon: 'check_circle', badgeClass: 'bg-green-500' },
]

function buttonClass(value) {
  const base = 'relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors'
  if (value === props.modelValue) {
    return `${base} bg-primary text-white shadow-sm`
  }

  return `${base} border border-border-light bg-white text-slate-600 hover:bg-slate-50 dark:border-border-dark dark:bg-surface-dark dark:text-slate-300 dark:hover:bg-border-dark`
}

function formatCount(count) {
  const n = Number(count) || 0
  return n > 99 ? '99+' : String(n)
}
</script>
