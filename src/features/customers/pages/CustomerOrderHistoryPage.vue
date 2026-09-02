<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import { useSelectedCustomerStore } from '@/shared/stores/selected-customer.store'
import { useDeliveryBookingIntentStore } from '@/shared/stores/delivery-booking-intent.store'
import { useInvoiceCreateIntentStore } from '@/shared/stores/invoice-create-intent.store'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'
import { useOrderSheetRoute } from '@/features/customers/composables/useOrderSheetRoute'
import OrderDetailSheet from '../components/OrderDetailSheet.vue'
import OrderHistoryCustomerCard from '../components/OrderHistoryCustomerCard.vue'
import OrderList from '../components/OrderList.vue'

const props = defineProps<{
  customerId: string
}>()

const router = useRouter()
const store = useCustomerOrderHistoryStore()
const { customer, orders, customerLoading, customerError } = storeToRefs(store)
const { openOrderId, open: openSheet, close: closeSheet } = useOrderSheetRoute()

const selectedOrder = computed(
  () => orders.value.find((order) => order.orderId?.trim() === openOrderId.value) ?? null,
)
const sheetOpen = computed(() => selectedOrder.value !== null)

function loadCustomer() {
  store.load(props.customerId)
}

function openOrder(orderId: string) {
  openSheet(orderId)
}

function bookDelivery() {
  const order = selectedOrder.value
  if (!customer.value || !order) return
  const orderId = order.orderId?.trim()
  if (!orderId || order.customerId !== customer.value.customerId) return
  useSelectedCustomerStore().select(customer.value)
  useDeliveryBookingIntentStore().set(orderId)
  router.replace('/new-booking')
}

function createInvoice() {
  const order = selectedOrder.value
  if (!customer.value || !order) return
  const orderId = order.orderId?.trim()
  const customerId = customer.value.customerId.trim()
  if (!orderId || !customerId || order.customerId.trim() !== customerId) return
  useSelectedCustomerStore().select(customer.value)
  useInvoiceCreateIntentStore().set(order)
  router.replace({
    name: 'invoice-create',
    query: { customerId, orderId },
  })
}

onMounted(loadCustomer)
watch(() => props.customerId, loadCustomer)
</script>

<template>
  <AppLayout>
    <main class="flex-1 overflow-y-auto bg-surface pb-20">
      <p v-if="customerLoading" class="px-4 py-6 text-sm text-on-surface-variant">
        Loading customer...
      </p>
      <p v-else-if="customerError" class="px-4 py-4 text-sm text-error">
        Unable to load customer details.
      </p>

      <OrderHistoryCustomerCard v-if="customer" :customer="customer" />
      <OrderList @select-order="openOrder" />
    </main>

    <OrderDetailSheet
      :open="sheetOpen"
      :order="selectedOrder"
      @close="closeSheet"
      @book-delivery="bookDelivery"
      @create-invoice="createInvoice"
    />
  </AppLayout>
</template>
