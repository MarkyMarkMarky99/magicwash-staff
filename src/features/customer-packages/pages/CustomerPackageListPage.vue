<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import CustomerPackageFilterBar from '../components/CustomerPackageFilterBar.vue'
import CustomerPackageListCards from '../components/CustomerPackageListCards.vue'
import { useCustomerPackageFilterRoute } from '../composables/useCustomerPackageFilterRoute'
import { useCustomerPackageStore } from '../stores/customer-package.store'

const router = useRouter()
const store = useCustomerPackageStore()
const { items, loading, error } = storeToRefs(store)
const { filter, updateFilter } = useCustomerPackageFilterRoute()
watch(filter, (value) => { void store.fetchCustomerPackages(value) }, { immediate: true })
</script>

<template>
  <ListPageLayout
    :search-value="filter.keyword"
    search-placeholder="Search customer or package"
    @update:search-value="updateFilter({ keyword: $event })"
  >
    <template #filters>
      <CustomerPackageFilterBar :filter="filter" @change="updateFilter" />
    </template>

    <ListContainer title="Customer packages" icon="card_membership" :count="items.length" count-label="packages" :loading="loading" :error="error" :empty="items.length === 0" empty-text="No customer packages" :skeleton-rows="4">
      <template #actions>
        <button
          type="button"
          class="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 font-label text-[11px] font-bold text-on-primary shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="router.push({ name: 'customer-package-create' })"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
          <span>New package</span>
        </button>
      </template>
      <CustomerPackageListCards :items="items" @select="router.push({ name: 'customer-package-detail', params: { customerPackageId: $event.customerPackageId } })" />
    </ListContainer>
  </ListPageLayout>
</template>
