<template>
  <main class="flex-1 overflow-y-auto no-scrollbar p-5 pb-24">
    <div class="mb-6">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Welcome back,</p>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Select Department</h2>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <DepartmentCard
        v-for="department in departments"
        :key="department.key"
        :department="department"
        :summary="summaries[department.key] || emptySummary"
        @select="$emit('select-department', $event)"
      />
    </div>

    <div class="mt-8">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        <a class="text-sm font-medium text-primary hover:opacity-80" href="#" @click.prevent>View All</a>
      </div>
      <div class="space-y-3">
        <div class="flex items-center rounded-xl border border-gray-200 bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
          <div class="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <span class="material-symbols-outlined text-[14px] text-primary dark:text-blue-400">local_laundry_service</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-gray-900 dark:text-white">Order #2481 Washed</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Completed by Sarah - 2m ago</p>
          </div>
          <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">Done</span>
        </div>
        <div class="flex items-center rounded-xl border border-gray-200 bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
          <div class="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <span class="material-symbols-outlined text-[14px] text-purple-600 dark:text-purple-400">local_shipping</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-gray-900 dark:text-white">Delivery Route #4 Started</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Driver Mike - 15m ago</p>
          </div>
          <span class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">In Progress</span>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import DepartmentCard from './DepartmentCard.vue'

defineProps({
  departments: {
    type: Array,
    required: true,
  },
  summaries: {
    type: Object,
    required: true,
  },
})

defineEmits(['select-department'])

const emptySummary = {
  total: 0,
  doneToday: 0,
  inProgress: 0,
}
</script>
