<script setup lang="ts">
import type { CustomerPackageFilter } from '../composables/useCustomerPackageFilterRoute'
defineProps<{ filter: CustomerPackageFilter }>()
const emit = defineEmits<{ change: [Partial<CustomerPackageFilter>] }>()
</script>

<template>
  <section class="space-y-3 px-4 py-3">
    <input :value="filter.keyword" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Search customer or package" @input="emit('change', { keyword: ($event.target as HTMLInputElement).value })">
    <div class="grid grid-cols-2 gap-2">
      <input :value="filter.customerId ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Customer ID" @input="emit('change', { customerId: ($event.target as HTMLInputElement).value || null })">
      <input :value="filter.packageCode ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Package code" @input="emit('change', { packageCode: ($event.target as HTMLInputElement).value || null })">
    </div>
    <div class="flex flex-wrap gap-2">
      <button v-for="status in [null, 'ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED']" :key="status ?? 'all'" type="button" class="rounded-full px-3 py-1 font-label text-xs" :class="filter.status === status ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'" @click="emit('change', { status })">{{ status ?? 'All' }}</button>
    </div>
  </section>
</template>
