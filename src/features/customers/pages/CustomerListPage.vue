<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { customerTypeSchema } from '@contracts/customers/customer-api.schema'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import CustomerTypeTabs from '../components/CustomerTypeTabs.vue'
import CustomerCard from '../components/CustomerCard.vue'
import { useCustomerStore } from '../stores/customer.store'
import { useCustomerFilterRoute } from '../composables/useCustomerFilterRoute'

const customerStore = useCustomerStore()
const router = useRouter()
const { customers, loading, error } = storeToRefs(customerStore)

const { filter, updateFilter } = useCustomerFilterRoute()

// Type-tab counts: a trivial count over the full list (every customer is loaded),
// so each tab shows the true total per type, independent of the active search.
const typeCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = { all: customers.value.length }
  for (const type of customerTypeSchema.options) {
    counts[type] = customers.value.filter((c) => c.customerType === type).length
  }
  return counts
})

// Search + type filter applied to the in-memory list — no re-fetch.
const filteredCustomers = computed(() => {
  let list = customers.value

  const type = filter.value.customerType
  if (type) list = list.filter((c) => c.customerType === type)

  const q = filter.value.keyword.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (c) =>
        (c.customerIndex ?? '').toLowerCase().includes(q) ||
        (c.customerName ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q),
    )
  }

  return list
})

const activeType = computed(() => filter.value.customerType ?? 'all')

function selectType(key: string) {
  updateFilter({ customerType: key === 'all' ? null : (key as typeof filter.value.customerType) })
}

onMounted(() => {
  customerStore.loadCustomers()
})
</script>

<template>
  <ListPageLayout
    :search-value="filter.keyword"
    search-placeholder="Search by index, name, phone, or address…"
    @update:search-value="updateFilter({ keyword: $event })"
  >
    <template #filters>
      <div class="flex-none bg-primary text-on-primary w-full min-w-0">
      <CustomerTypeTabs :active-type="activeType" :counts="typeCounts" @select="selectType" />
      </div>
    </template>

    <ListContainer
      title="Customers"
      icon="group"
      :count="filteredCustomers.length"
      count-label="Customers"
      :loading="loading"
      :error="error"
      :empty="filteredCustomers.length === 0"
      empty-text="No customers"
      :skeleton-rows="4"
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 font-label text-[10px] font-bold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Add customer"
          @click="router.push({ name: 'customer-create' })"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">person_add</span>
          <span>เพิ่มลูกค้า</span>
        </button>
      </template>
      <CustomerCard
        v-for="c in filteredCustomers"
        :key="c.customerId"
        :customer="c"
      />
    </ListContainer>
  </ListPageLayout>
</template>
