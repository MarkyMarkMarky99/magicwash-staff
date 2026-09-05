<script setup lang="ts">
import ListContainer from '@/shared/components/ListContainer.vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'
import { getInvoiceTarget, isInvoiceActionAvailable } from '@/features/orders/utils/order-invoice-target'
import OrderCard from '@/features/orders/components/OrderCard.vue'
import WaitingPickupCard from './WaitingPickupCard.vue'

const emit = defineEmits<{
  selectOrder: [orderId: string]
}>()

const store = useCustomerOrderHistoryStore()
const router = useRouter()
const {
  orders,
  waitingPickups,
  ordersLoading,
  appointmentsLoading,
  ordersError,
  appointmentsError,
} = storeToRefs(store)

function refresh() {
  store.refresh()
}

function viewPhotos(orderId: string) {
  router.push(`/gallery/BEF-${orderId}`)
}

function viewInvoice(invoiceNumber: string) {
  if (!isInvoiceActionAvailable({ invoiceNumber })) return
  const target = getInvoiceTarget(invoiceNumber)
  if (target) router.push(target)
}
</script>

<template>
  <ListContainer
    title="Order History"
    icon="receipt_long"
    :count="orders.length"
    count-label="orders"
    collapsible
    :loading="ordersLoading || appointmentsLoading"
    :error="ordersError || appointmentsError"
    :empty="orders.length === 0 && waitingPickups.length === 0"
    empty-text="No order history"
    :skeleton-rows="4"
  >
    <template #actions>
      <button
        type="button"
        class="flex h-[22px] w-[22px] items-center justify-center rounded-full transition-all hover:bg-surface-container active:scale-95 disabled:opacity-50"
        aria-label="Refresh order history"
        :disabled="ordersLoading || appointmentsLoading"
        @click.stop="refresh"
      >
        <span
          class="material-symbols-outlined text-[16px] text-primary"
          :class="(ordersLoading || appointmentsLoading) ? 'animate-spin' : ''"
          aria-hidden="true"
        >refresh</span>
      </button>
    </template>
    <WaitingPickupCard
      v-for="appointment in waitingPickups"
      :key="appointment.appointmentId"
      :appointment="appointment"
    />
    <OrderCard
      v-for="order in orders"
      :key="order.orderId"
      :order="order"
      :show-customer-name="false"
      :show-photos="true"
      :show-invoice="true"
      @select="emit('selectOrder', $event)"
      @view-photos="viewPhotos"
      @view-invoice="viewInvoice"
    />
  </ListContainer>
</template>
