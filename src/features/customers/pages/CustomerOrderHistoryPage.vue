<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppLayout from '@/layouts/AppLayout.vue'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'
import type { OrderListDto } from '../services/order.service'
import OrderDetailSheet from '../components/OrderDetailSheet.vue'
import OrderHistoryCustomerCard from '../components/OrderHistoryCustomerCard.vue'
import OrderList from '../components/OrderList.vue'

const props = defineProps<{
  customerId: string
}>()

const store = useCustomerOrderHistoryStore()
const { customer, customerLoading, customerError } = storeToRefs(store)
const selectedOrder = ref<OrderListDto | null>(null)
const sheetOpen = ref(false)

function loadCustomer() {
  store.load(props.customerId)
}

function openOrder(order: OrderListDto) {
  selectedOrder.value = order
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  selectedOrder.value = null
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
    />
  </AppLayout>
</template>
