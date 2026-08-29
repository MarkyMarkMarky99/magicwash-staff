<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import OrderListPagination from '@/features/orders/components/OrderListPagination.vue'
import OrderRow from '@/features/orders/components/OrderRow.vue'
import { useOrderListFilterRoute } from '@/features/orders/composables/use-order-list-filter-route'
import { useOrderStore } from '@/features/orders/stores/order.store'

const router = useRouter()
const orderStore = useOrderStore()
const { orders, pagination, listLoading, listError, customers } = storeToRefs(orderStore)
const { keyword, status, page, setKeyword, setStatus, setPage } = useOrderListFilterRoute()
const statusTabs = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'PENDING', label: 'รอดำเนินการ' },
  { key: 'RECEIVED', label: 'รับผ้าแล้ว' },
  { key: 'COMPLETED', label: 'เสร็จแล้ว' },
]

watch([keyword, status, page], () => void orderStore.loadList({ keyword: keyword.value, status: status.value, page: page.value }), { immediate: true })
function customerName(customerId: string) { return customers.value.find((customer) => customer.customerId === customerId)?.customerName }
function openOrder(orderId: string) { router.push({ name: 'order-detail', params: { orderId } }) }
</script>

<template>
  <ListPageLayout :search-value="keyword" search-placeholder="ค้นหาเลขออเดอร์หรือรหัสลูกค้า" @update:search-value="setKeyword($event)">
    <template #filters><GenericTabs :tabs="statusTabs" :active-key="status" @select="setStatus($event)" /></template>
    <div class="relative"><div class="border-b border-outline-variant/20 bg-primary px-4 pb-4 pt-2 text-on-primary"><p class="font-label text-[9px] font-bold uppercase tracking-[0.2em] text-on-primary/70">Laundry floor</p><div class="mt-1 flex items-end justify-between gap-3"><div><h1 class="font-headline text-2xl font-bold tracking-tight">Orders</h1><p class="mt-0.5 font-body text-xs text-on-primary/75">ติดตามผ้าตั้งแต่รับเข้าจนพร้อมส่ง</p></div><button type="button" class="flex shrink-0 items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 font-label text-[11px] font-bold text-on-secondary shadow-sm" @click="router.push({ name: 'order-create' })"><span class="material-symbols-outlined text-[17px]" aria-hidden="true">add</span>สร้างออเดอร์</button></div></div>
      <ListContainer title="รายการออเดอร์" icon="local_laundry_service" :count="pagination.total" count-label="orders" :loading="listLoading" :error="listError" :empty="!listLoading && !listError && orders.length === 0" empty-text="ไม่พบออเดอร์ที่ตรงกับเงื่อนไข" :skeleton-rows="5"><OrderRow v-for="order in orders" :key="order.orderId" :order="order" :customer-name="customerName(order.customerId)" @select="openOrder" /><OrderListPagination :page="pagination.page" :total-pages="pagination.totalPages" :total="pagination.total" @change="setPage" /></ListContainer>
    </div>
  </ListPageLayout>
</template>
