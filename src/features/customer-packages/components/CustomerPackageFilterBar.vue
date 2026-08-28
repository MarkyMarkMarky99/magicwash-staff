<script setup lang="ts">
import { ref } from 'vue'
import { customerPackageStatusSchema } from '@contracts/customer-packages/customer-package-api.schema'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import type { CustomerPackageFilter } from '../composables/useCustomerPackageFilterRoute'
defineProps<{ filter: CustomerPackageFilter }>()
const emit = defineEmits<{ change: [Partial<CustomerPackageFilter>] }>()
const filterOpen = ref(false)
const packageStatusTabs = [
  { key: 'All', label: 'All' },
  ...customerPackageStatusSchema.options.map((status) => ({ key: status, label: status })),
]

function selectStatus(status: string) {
  emit('change', { status: status === 'All' ? null : status as CustomerPackageFilter['status'] })
}
</script>

<template>
  <section>
    <GenericTabs :tabs="packageStatusTabs" :active-key="filter.status ?? 'All'" @select="selectStatus" />
    <div class="space-y-3 px-4 py-3">
      <div class="flex items-center justify-end">
        <button
          type="button"
          class="material-symbols-outlined text-[18px] transition-colors shrink-0 rounded-full p-0.5 text-on-surface-variant hover:text-on-surface"
          :aria-label="filterOpen ? 'Hide filters' : 'Show filters'"
          :aria-expanded="filterOpen"
          @click="filterOpen = !filterOpen"
        >tune</button>
      </div>
      <div v-if="filterOpen" class="grid grid-cols-2 gap-2">
        <input :value="filter.customerId ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Customer ID" @input="emit('change', { customerId: ($event.target as HTMLInputElement).value || null })">
        <input :value="filter.packageCode ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Package code" @input="emit('change', { packageCode: ($event.target as HTMLInputElement).value || null })">
      </div>
    </div>
  </section>
</template>
