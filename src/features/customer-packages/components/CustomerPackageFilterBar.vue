<script setup lang="ts">
import { customerPackageStatusSchema } from '@contracts/customer-packages/customer-package-api.schema'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import type { CustomerPackageFilter } from '../composables/useCustomerPackageFilterRoute'
defineProps<{ filter: CustomerPackageFilter }>()
const emit = defineEmits<{ change: [Partial<CustomerPackageFilter>] }>()
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
  </section>
</template>
