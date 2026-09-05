<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import OrderCard from '@/features/orders/components/OrderCard.vue'
import { useOrderListFilterRoute } from '@/features/orders/composables/use-order-list-filter-route'
import { orderStatusLabels } from '@/features/orders/order-status-labels'
import { useOrderStore } from '@/features/orders/stores/order.store'
import { getInvoiceTarget, isInvoiceActionAvailable } from '@/features/orders/utils/order-invoice-target'

const router = useRouter()
const orderStore = useOrderStore()
const { orders, listLoading, listError } = storeToRefs(orderStore)
const { keyword, status, page, setKeyword, setStatus, setPage } = useOrderListFilterRoute()
const statusTabs = [
  { key: '', label: 'ทั้งหมด' },
  ...Object.entries(orderStatusLabels).map(([key, label]) => ({ key, label })),
]

watch([keyword, status, page], () => void orderStore.loadList({ keyword: keyword.value, status: status.value, page: page.value }), { immediate: true })
function openOrder(orderId: string) { router.push({ name: 'order-detail', params: { orderId } }) }
function viewPhotos(orderId: string) { router.push('/gallery/BEF-' + orderId) }
function viewInvoice(invoiceNumber: string) {
  if (!isInvoiceActionAvailable({ invoiceNumber })) return
  const target = getInvoiceTarget(invoiceNumber)
  if (target) router.push(target)
}
</script>

<template>
  <ListPageLayout>
    <template #filters><GenericTabs :tabs="statusTabs" :active-key="status" @select="setStatus($event)" /></template>
    <ListContainer title="รายการออเดอร์" icon="local_laundry_service" searchable :search-value="keyword" search-placeholder="ค้นหาเลขออเดอร์หรือรหัสลูกค้า" @update:search-value="setKeyword($event)" count-label="orders" :loading="listLoading" :error="listError" :empty="!listLoading && !listError && orders.length === 0" empty-text="ไม่พบออเดอร์ที่ตรงกับเงื่อนไข" :skeleton-rows="5">
      <template #actions>
        <button
          type="button"
          class="-my-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="สร้างออเดอร์"
          @click="router.push({ name: 'order-create' })"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">post_add</span>
        </button>
      </template>
      <OrderCard v-for="order in orders" :key="order.orderId" :order="order" :show-customer-name="true" :show-photos="true" :show-invoice="true" @select="openOrder" @view-photos="viewPhotos" @view-invoice="viewInvoice" />
    </ListContainer>
  </ListPageLayout>
</template>
