<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListContainer from '@/shared/components/ListContainer.vue'
import CustomerPackageListCards from '@/features/customer-packages/components/CustomerPackageListCards.vue'
import { useCustomerPackagesStore } from '../stores/customer-packages.store'

defineProps<{ customerId: string }>()
const emit = defineEmits<{ buy: [] }>()
const router = useRouter()
const { items, loading, error } = storeToRefs(useCustomerPackagesStore())
</script>

<template>
  <ListContainer
    title="Packages" icon="card_membership" :count="items.length" count-label="packages"
    :loading="loading" :error="error" :empty="items.length === 0" empty-text="No packages" :skeleton-rows="4"
  >
    <template #actions>
      <button
        type="button"
        class="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 font-label text-[11px] font-bold text-on-primary shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        @click.stop="emit('buy')"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
        <span>Buy</span>
      </button>
    </template>
    <CustomerPackageListCards
      :items="items"
      @select="router.push({ name: 'customer-package-detail', params: { customerPackageId: $event.customerPackageId } })"
    />
  </ListContainer>
</template>
