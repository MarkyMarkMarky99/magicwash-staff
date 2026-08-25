<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
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
  <AppLayout>
    <CustomerPackageFilterBar :filter="filter" @change="updateFilter" />
    <main class="flex-1 overflow-y-auto bg-surface pb-20">
      <ListContainer title="Customer packages" icon="card_membership" :count="items.length" count-label="packages" :loading="loading" :error="error" :empty="items.length === 0" empty-text="No customer packages" :skeleton-rows="4">
        <CustomerPackageListCards :items="items" @select="router.push({ name: 'customer-package-detail', params: { customerPackageId: $event.customerPackageId } })" />
      </ListContainer>
    </main>
  </AppLayout>
</template>
