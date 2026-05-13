<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <div class="flex shrink-0 gap-2 px-4 py-3">
      <div class="relative flex w-full items-center">
        <div class="pointer-events-none absolute left-3 flex items-center">
          <span class="material-symbols-outlined text-[20px] text-slate-400 dark:text-slate-500">search</span>
        </div>
        <input
          :value="search"
          class="h-11 w-full rounded-xl border border-border-light bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white dark:placeholder:text-slate-500"
          placeholder="Search by Order ID..."
          type="text"
          @input="$emit('update:search', $event.target.value)"
        />
      </div>
      <button class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border-light bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 active:scale-95 dark:border-border-dark dark:bg-surface-dark dark:text-white dark:hover:bg-border-dark" type="button">
        <span class="material-symbols-outlined text-[20px]">tune</span>
      </button>
    </div>

    <TaskFilterTabs
      :model-value="filter"
      :counts="filterCounts"
      @update:model-value="$emit('update:filter', $event)"
    />

    <div class="flex flex-col gap-3 overflow-y-auto no-scrollbar px-4 pb-24 pt-2">
      <div v-if="loading" class="flex flex-col items-center justify-center py-10 text-slate-400">
        <div class="loader mb-2"></div>
        <p class="text-xs">Loading tasks...</p>
      </div>
      <div v-else-if="error" class="flex flex-col items-center justify-center py-10 text-slate-400">
        <span class="material-symbols-outlined mb-3 text-[48px] opacity-30">assignment</span>
        <p class="text-sm">Error loading data</p>
      </div>
      <div v-else-if="tasks.length === 0" class="flex flex-col items-center justify-center py-10 text-slate-400">
        <span class="material-symbols-outlined mb-3 text-[48px] opacity-30">assignment</span>
        <p class="text-sm">No tasks yet. Click "+" to add one.</p>
      </div>
      <TaskCard
        v-for="task in tasks"
        v-else
        :key="task.id"
        :task="task"
        @status-change="(taskId, newStatus) => $emit('status-change', taskId, newStatus)"
        @delete="$emit('delete', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import TaskCard from './TaskCard.vue'
import TaskFilterTabs from './TaskFilterTabs.vue'

defineProps({
  tasks: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: [String, Object],
    default: '',
  },
  search: {
    type: String,
    required: true,
  },
  filter: {
    type: String,
    required: true,
  },
  filterCounts: {
    type: Object,
    required: true,
  },
})

defineEmits(['update:search', 'update:filter', 'status-change', 'delete'])
</script>
