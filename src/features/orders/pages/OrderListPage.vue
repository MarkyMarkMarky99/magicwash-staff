<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import DateTabs from '@/shared/components/DateTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import { getInvoiceTarget } from '@/shared/navigation/invoice-detail-route'
import { orderEditRoute } from '@/shared/navigation/form-routes'
import OrderCard from '@/features/orders/components/OrderCard.vue'
import OrderListActionsMenu from '@/features/orders/components/OrderListActionsMenu.vue'
import { ORDER_LIST_DATE_FIELDS, useOrderListFilterRoute } from '@/features/orders/composables/use-order-list-filter-route'
import { useCustomerStore } from '@/data/customers/customer.store'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'
import { addSheetDateDays, getSheetDateCalendar } from '@/shared/utils/sheet-date'

const router = useRouter()
const customerStore = useCustomerStore()
const orderStore = useWorkOrderStore()
const { customers } = storeToRefs(customerStore)
const { orders, listLoading, listError } = storeToRefs(orderStore)
const { keyword, dateField, date, page, setKeyword, setDateField, setDate } = useOrderListFilterRoute()
const calendar = computed(() => getSheetDateCalendar(date.value))
const customersById = computed(() => new Map(
  customers.value.map((customer) => [customer.customerId, customer]),
))
const orderRows = computed(() => orders.value.map(
  (order) => ({
    ...order,
    customerName: customersById.value.get(order.customerId)?.customerName,
    customerIndex: customersById.value.get(order.customerId)?.customerIndex,
  }),
))

// A keyword searches every day, so an old order can still be found by its number.
watch([keyword, dateField, date, page], () => void orderStore.loadList({
  keyword: keyword.value,
  dateField: dateField.value,
  date: keyword.value ? undefined : date.value,
  page: page.value,
}), { immediate: true })
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
    <ListContainer title="Orders" icon="local_laundry_service" searchable :search-value="keyword" search-placeholder="Search customer, phone, order or invoice no." @update:search-value="setKeyword($event)" count-label="orders" :loading="listLoading" :error="listError" :empty="!listLoading && !listError && orders.length === 0" empty-text="No orders match these filters" :skeleton-rows="5">
      <template #search-actions>
        <div class="flex shrink-0 gap-1" role="group" aria-label="Filter by date">
          <button
            v-for="option in ORDER_LIST_DATE_FIELDS"
            :key="option.key"
            type="button"
            class="h-7 rounded-full px-2.5 font-label text-[11px] font-bold transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
            :class="dateField === option.key ? 'bg-primary text-on-primary' : 'text-primary hover:bg-primary/10 active:bg-primary/20'"
            :aria-pressed="dateField === option.key"
            @click="setDateField(option.key)"
          >{{ option.label }}</button>
        </div>
      </template>
      <template #actions><OrderListActionsMenu /></template>
      <OrderCard v-for="order in orderRows" :key="order.orderId" :order="order" :show-customer-name="true" :show-photos="true" :show-invoice="true" :on-edit="editOrder" @select="openOrder" @view-photos="viewPhotos" @view-invoice="viewInvoice" />
    </ListContainer>
  </ListPageLayout>
</template>
