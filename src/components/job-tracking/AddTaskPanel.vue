<template>
  <div
    :class="[
      'absolute inset-0 z-[60] flex h-full w-full flex-col overflow-y-auto no-scrollbar bg-background-light transition-transform duration-300 dark:bg-background-dark',
      open ? 'translate-y-0' : 'translate-y-full',
    ]"
  >
    <header class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-background-light/95 px-4 py-3 backdrop-blur-md dark:border-gray-800/50 dark:bg-background-dark/95">
      <button class="group flex size-10 items-center justify-center rounded-full transition-colors hover:bg-gray-200 dark:hover:bg-gray-800" type="button" @click="$emit('close')">
        <span class="material-symbols-outlined text-[24px] text-gray-900 dark:text-white">close</span>
      </button>
      <h2 class="flex-1 text-center text-lg font-bold leading-tight tracking-tight">New Task</h2>
      <button class="flex h-10 items-center justify-center px-2 disabled:opacity-60" type="button" :disabled="saving" @click="submit">
        <p class="text-base font-semibold text-primary">Save</p>
      </button>
    </header>

    <main class="flex flex-1 flex-col gap-6 px-5 py-6">
      <div class="flex flex-col gap-4">
        <label class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-text-secondary">Order Details</span>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <span class="material-symbols-outlined text-gray-400 dark:text-gray-500">tag</span>
            </div>
            <input
              v-model.trim="form.orderId"
              class="h-14 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white dark:placeholder:text-gray-600"
              placeholder="e.g., 1024-B"
              type="text"
              required
            />
          </div>
        </label>
      </div>

      <div class="h-px w-full bg-gray-200 dark:bg-gray-800/60"></div>

      <div class="flex flex-col gap-5">
        <p class="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-text-secondary">Timeline</p>
        <label class="flex flex-col gap-2">
          <span class="text-base font-medium text-gray-800 dark:text-gray-200">Handover Date</span>
          <div class="group relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4">
              <span class="material-symbols-outlined text-gray-400 transition-colors group-focus-within:text-primary dark:text-gray-500">calendar_today</span>
            </div>
            <input
              v-model="form.handoverDate"
              class="relative h-14 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-base text-gray-900 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
              type="date"
            />
          </div>
        </label>

        <label class="flex flex-col gap-2">
          <span class="text-base font-medium text-gray-800 dark:text-gray-200">Due Date</span>
          <div class="group relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4">
              <span class="material-symbols-outlined text-gray-400 transition-colors group-focus-within:text-primary dark:text-gray-500">event_upcoming</span>
            </div>
            <input
              v-model="form.dueDate"
              class="relative h-14 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-base text-gray-900 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
              type="date"
            />
          </div>
        </label>
      </div>

      <div class="min-h-[40px] flex-1"></div>

      <div class="sticky bottom-0 mt-auto bg-gradient-to-t from-background-light via-background-light to-transparent pb-6 pt-4 dark:from-background-dark dark:via-background-dark dark:to-transparent">
        <button
          class="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:opacity-90 active:scale-[0.98] active:opacity-80 disabled:opacity-60"
          type="button"
          :disabled="saving"
          @click="submit"
        >
          <div v-if="saving" class="loader loader-sm"></div>
          <template v-else>
            <span class="material-symbols-outlined text-[20px] font-bold">add_task</span>
            Create Task
          </template>
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'save'])

const form = reactive({
  orderId: '',
  handoverDate: '',
  dueDate: '',
})

watch(() => props.open, (open) => {
  if (!open) return
  form.orderId = ''
  form.handoverDate = ''
  form.dueDate = ''
})

function submit() {
  if (!form.orderId) {
    window.alert('Please enter an Order ID')
    return
  }

  emit('save', { ...form })
}
</script>
