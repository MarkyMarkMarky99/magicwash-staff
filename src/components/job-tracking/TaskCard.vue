<template>
  <div :class="cardClass">
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <div :class="['flex h-10 w-10 items-center justify-center rounded-full', statusConfig.iconWrapClass]">
          <span class="material-symbols-outlined text-[20px]">{{ statusConfig.icon }}</span>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Order #{{ task.orderId }}</h3>
          <div class="mt-0.5 flex flex-wrap items-center gap-1">
            <span :class="['h-1.5 w-1.5 rounded-full', dueAlert ? 'animate-pulse bg-red-500' : statusConfig.dotClass]"></span>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ statusConfig.text }}</span>
            <span
              v-if="dueAlert"
              class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"
            >
              <span class="material-symbols-outlined text-[14px]">{{ dueAlert.icon }}</span>
              {{ dueAlert.label }}
            </span>
          </div>
        </div>
      </div>

      <button :class="statusConfig.buttonClass" type="button" @click="handleAction">
        <span class="material-symbols-outlined text-[16px]">{{ statusConfig.buttonIcon }}</span>
        {{ statusConfig.buttonText }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-4 border-t border-slate-100 pt-2 dark:border-border-dark">
      <div class="flex flex-col gap-1">
        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Handover</span>
        <div class="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
          <span class="material-symbols-outlined text-[14px] text-slate-400">calendar_today</span>
          {{ formatDate(task.handoverDate) }}
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Due Date</span>
        <div :class="['flex items-center gap-1.5 text-xs font-medium', dueAlert ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300']">
          <span :class="['material-symbols-outlined text-[14px]', dueAlert ? 'text-red-500 dark:text-red-300' : 'text-slate-400']">event</span>
          {{ formatDate(task.dueDate) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['status-change', 'delete'])

const configs = {
  Pending: {
    iconWrapClass: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-500',
    dotClass: 'bg-yellow-500',
    icon: 'pending',
    text: 'Pending',
    buttonClass: 'z-10 flex items-center gap-1 rounded-lg bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50',
    buttonIcon: 'play_arrow',
    buttonText: 'Start',
    nextStatus: 'In Progress',
  },
  'In Progress': {
    iconWrapClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-500',
    dotClass: 'bg-blue-500',
    icon: 'inventory_2',
    text: 'In Progress',
    buttonClass: 'z-10 flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50',
    buttonIcon: 'check',
    buttonText: 'Complete',
    nextStatus: 'Completed',
  },
  Completed: {
    iconWrapClass: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-500',
    dotClass: 'bg-green-500',
    icon: 'check_circle',
    text: 'Completed',
    buttonClass: 'z-10 flex items-center gap-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30',
    buttonIcon: 'delete',
    buttonText: 'Delete',
    nextStatus: null,
  },
}

const statusConfig = computed(() => configs[props.task.status] || configs.Pending)

const dueAlert = computed(() => {
  if (!props.task || props.task.status === 'Completed') return null
  const dueDate = parseDateOnlyLocal(props.task.dueDate)
  if (!dueDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (dueDate < today) return { kind: 'overdue', label: 'OVERDUE', icon: 'error' }
  if (dueDate >= today && dueDate < tomorrow) return { kind: 'due-today', label: 'DUE TODAY', icon: 'schedule' }
  return null
})

const cardClass = computed(() => {
  const base = 'group relative flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99]'
  if (dueAlert.value) {
    return `${base} border-red-200 bg-red-50/60 ring-1 ring-red-500/20 dark:border-red-900/50 dark:bg-red-900/10`
  }

  return `${base} border-border-light bg-white dark:border-border-dark dark:bg-surface-dark`
})

function parseDateOnlyLocal(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setHours(0, 0, 0, 0)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(value) {
  if (!value) return 'ไม่ระบุ'
  const date = parseDateOnlyLocal(value)
  if (!date) return 'ไม่ระบุ'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function handleAction() {
  if (props.task.status === 'Completed') {
    emit('delete', props.task.id)
    return
  }

  emit('status-change', props.task.id, statusConfig.value.nextStatus)
}
</script>
