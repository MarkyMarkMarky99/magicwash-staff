<script setup lang="ts">
import { computed, onActivated } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import DateTabs from '@/shared/components/DateTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import { getInvoiceTarget } from '@/shared/navigation/invoice-detail-route'
import { orderEditRoute } from '@/shared/navigation/form-routes'
import OrderCard from '@/features/orders/components/OrderCard.vue'
import OrderListActionsMenu from '@/features/orders/components/OrderListActionsMenu.vue'
import OrderListDateFieldMenu from '@/features/orders/components/OrderListDateFieldMenu.vue'
import { useOrderListFilterRoute } from '@/features/orders/composables/use-order-list-filter-route'
import { useCustomerStore } from '@/data/customers/customer.store'
import { useOrderSnapshotStore } from '@/data/order-snapshots/order-snapshot.store'
import { filterOrderList } from '@/features/orders/utils/order-list-filter'
import { addSheetDateDays, getSheetDateCalendar } from '@/shared/utils/sheet-date'

const router = useRouter()
const customerStore = useCustomerStore()
const snapshotStore = useOrderSnapshotStore()
const { customers } = storeToRefs(customerStore)
const { orders, loading, error } = storeToRefs(snapshotStore)
const listLoading = computed(() => loading.value && orders.value === null)
const listError = computed(() => orders.value === null ? error.value : null)
const { keyword, dateField, date, setKeyword, setDateField, setDate } = useOrderListFilterRoute()
const calendar = computed(() => getSheetDateCalendar(date.value))
const customersById = computed(() => new Map(
  customers.value.map((customer) => [customer.customerId, customer]),
))
const orderRows = computed(() => filterOrderList(
  orders.value ?? [],
  { keyword: keyword.value, dateField: dateField.value, date: date.value },
  customersById.value,
).map(
  (order) => ({
    ...order,
    customerName: customersById.value.get(order.customerId)?.customerName,
    customerIndex: customersById.value.get(order.customerId)?.customerIndex,
  }),
))

onActivated(() => void snapshotStore.load())
function stepMonth(direction: -1 | 1) {
  const firstOfMonth = `${date.value.slice(0, 7)}-01`
  const target = addSheetDateDays(firstOfMonth, direction < 0 ? -1 : 31)
  setDate(`${target.slice(0, 7)}-01`)
}
function openOrder(orderId: string) { router.push({ name: 'order-detail', params: { orderId } }) }
function editOrder(orderId: string) { return router.push(orderEditRoute(orderId)) }
function viewPhotos(orderId: string) { router.push('/gallery/BEF-' + orderId) }
function viewInvoice(invoiceNumber: string) {
  const target = getInvoiceTarget(invoiceNumber)
  if (target) router.push(target)
}
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <div class="bg-primary text-on-primary">
        <DateTabs v-if="calendar" :year="calendar.year" :month="calendar.month - 1" :selected-date="date" @date-select="setDate" @prev-month="stepMonth(-1)" @next-month="stepMonth(1)" />
      </div>
    </template>
    <ListContainer title="Orders" icon="local_laundry_service" searchable close-search-on-outside-click :search-value="keyword" search-placeholder="Search customer, phone, order or invoice no." @update:search-value="setKeyword($event)" count-label="orders" :loading="listLoading" :error="listError" :empty="!listLoading && !listError && orderRows.length === 0" empty-text="No orders match these filters" :skeleton-rows="5">
      <template #search-actions><OrderListDateFieldMenu :date-field="dateField" @select="setDateField" /></template>
      <template #actions><OrderListActionsMenu :date="date" /></template>
      <OrderCard v-for="order in orderRows" :key="order.orderId" :order="order" :show-customer-name="true" :show-photos="true" :show-invoice="true" :on-edit="editOrder" @select="openOrder" @view-photos="viewPhotos" @view-invoice="viewInvoice" />
    </ListContainer>
  </ListPageLayout>
</template>
