<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { customerPackageCreateRoute } from '@/shared/navigation/form-routes'
import ListContainer from '@/shared/components/ListContainer.vue'
import CreateDropdownMenu from './CreateDropdownMenu.vue'
import CustomerRecordCard from './CustomerRecordCard.vue'
import type { BadgeTone } from '@/shared/components/BaseBadge.vue'
import { useCustomerPackagesStore } from '../stores/customer-packages.store'

const props = defineProps<{ customerId: string }>()
const router = useRouter()
const { items, loading, error } = storeToRefs(useCustomerPackagesStore())
const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'accent',
  INACTIVE: 'neutral',
  EXPIRED: 'accent',
  CANCELLED: 'danger',
}
</script>

<template>
  <ListContainer
    title="Packages" icon="card_membership" count-label="packages"
    :loading="loading" :error="error" :empty="items.length === 0" empty-text="No packages" :skeleton-rows="4"
  >
    <template #actions>
      <CreateDropdownMenu
        :label="`${items.length} packages`"
        aria-label="Create package"
        :items="[{ key: 'package', label: 'New Package' }]"
        @select="router.push(customerPackageCreateRoute({ customerId: props.customerId }))"
      />
    </template>
    <CustomerRecordCard
      v-for="item in items"
      :key="item.customerPackageId"
      icon="card_membership"
      :tone="STATUS_TONES[item.status] || 'neutral'"
      icon-label="Package"
      :title="item.packageName"
      :badges="[{ label: item.status, tone: STATUS_TONES[item.status] || 'neutral' }]"
      :trailing="`${item.remainingCredit} left`"
      :detail="`${item.packageCode} · ${item.usedCredit}/${item.totalCredit} used`"
      @select="router.push({ name: 'customer-package-detail', params: { customerPackageId: item.customerPackageId } })"
    />
  </ListContainer>
</template>
