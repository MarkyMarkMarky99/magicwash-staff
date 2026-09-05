<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import CustomerPackageExtraFilter from '../components/CustomerPackageExtraFilter.vue'
import CustomerPackageFilterBar from '../components/CustomerPackageFilterBar.vue'
import CustomerPackageListCards from '../components/CustomerPackageListCards.vue'
import { useCustomerPackageFilterRoute } from '../composables/useCustomerPackageFilterRoute'
import { useCustomerPackageStore } from '../stores/customer-package.store'

const router = useRouter()
const store = useCustomerPackageStore()
const { items, loading, error } = storeToRefs(store)
const { filter, updateFilter } = useCustomerPackageFilterRoute()
const extraFilterOpen = ref(false)
watch(filter, (value) => { void store.fetchCustomerPackages(value) }, { immediate: true })
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <CustomerPackageFilterBar :filter="filter" @change="updateFilter" />
    </template>

    <ListContainer title="Customer packages" icon="card_membership" searchable :search-value="filter.keyword" search-placeholder="Search customer or package" @update:search-value="updateFilter({ keyword: $event })" :count="items.length" count-label="packages" :loading="loading" :error="error" :empty="items.length === 0" empty-text="No customer packages" :skeleton-rows="4">
      <template #search-actions>
        <CustomerPackageExtraFilter v-model:open="extraFilterOpen" :filter="filter" :disabled="loading" />
      </template>

      <template #actions>
        <button
          type="button"
          class="-my-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="New package"
          @click="router.push({ name: 'customer-package-create' })"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add_shopping_cart</span>
        </button>
      </template>
      <div v-if="extraFilterOpen" class="grid grid-cols-2 gap-2 bg-surface-container-lowest px-4 py-3">
        <input :value="filter.customerId ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Customer ID" @input="updateFilter({ customerId: ($event.target as HTMLInputElement).value || null })">
        <input :value="filter.packageCode ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Package code" @input="updateFilter({ packageCode: ($event.target as HTMLInputElement).value || null })">
      </div>

      <template #empty>
        <div v-if="extraFilterOpen" class="grid grid-cols-2 gap-2 bg-surface-container-lowest px-4 py-3">
          <input :value="filter.customerId ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Customer ID" @input="updateFilter({ customerId: ($event.target as HTMLInputElement).value || null })">
          <input :value="filter.packageCode ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Package code" @input="updateFilter({ packageCode: ($event.target as HTMLInputElement).value || null })">
        </div>
        <p class="px-6 py-4 font-body text-sm italic text-on-surface-variant">No customer packages</p>
      </template>

      <template #error>
        <div v-if="extraFilterOpen" class="grid grid-cols-2 gap-2 bg-surface-container-lowest px-4 py-3">
          <input :value="filter.customerId ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Customer ID" @input="updateFilter({ customerId: ($event.target as HTMLInputElement).value || null })">
          <input :value="filter.packageCode ?? ''" class="rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Package code" @input="updateFilter({ packageCode: ($event.target as HTMLInputElement).value || null })">
        </div>
        <p class="px-6 py-4 font-body text-sm text-error">{{ error }}</p>
      </template>

      <CustomerPackageListCards :items="items" @select="router.push({ name: 'customer-package-detail', params: { customerPackageId: $event.customerPackageId } })" />
    </ListContainer>
  </ListPageLayout>
</template>
