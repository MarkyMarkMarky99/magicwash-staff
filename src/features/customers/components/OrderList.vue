<script setup lang="ts">
import ListContainer from '@/shared/components/ListContainer.vue'
import CreateDropdownMenu from './CreateDropdownMenu.vue'
import { orderCreateRoute } from '@/shared/navigation/form-routes'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getInvoiceTarget } from '@/shared/navigation/invoice-detail-route'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'
import { isInvoiceActionAvailable } from '../utils/customer-order-invoice-target'
import { presentationFor } from '../utils/customer-order-status-presentation'
import CustomerRecordCard from './CustomerRecordCard.vue'

const emit = defineEmits<{
  selectOrder: [orderId: string]
}>()

const props = defineProps<{ customerId: string }>()

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

function viewPhotos(orderId: string) {
  router.push(`/gallery/BEF-${orderId}`)
}

function viewInvoice(invoiceNumber: string) {
  const target = getInvoiceTarget(invoiceNumber)
  if (target) router.push(target)
}

function openOrderDetail(orderId: string, close: () => void) {
  router.push({ name: 'order-detail', params: { orderId } })
  close()
}
</script>

<template>
  <ListContainer
    title="Order History"
    icon="receipt_long"
    count-label="orders"
    :loading="ordersLoading || appointmentsLoading"
    :error="ordersError || appointmentsError"
    :empty="orders.length === 0 && waitingPickups.length === 0"
    empty-text="No order history"
    :skeleton-rows="4"
  >
    <template #actions>
      <CreateDropdownMenu
        :label="`${orders.length} orders`"
        aria-label="Create order"
        :items="[{ key: 'order', label: 'New Order' }]"
        @select="router.push(orderCreateRoute({ customerId: props.customerId }))"
      />
    </template>
    <CustomerRecordCard
      v-for="appointment in waitingPickups"
      :key="appointment.appointmentId"
      icon="local_shipping"
      tone="warning"
      icon-label="Waiting pickup"
      :title="formatSheetDate(appointment.appointmentDate)"
      :badges="[{ label: 'Waiting pickup', tone: 'warning' }]"
      :trailing="appointment.timeSlot || '—'"
      :pressable="false"
    />
    <CustomerRecordCard
      v-for="order in orders"
      :key="order.orderId"
      :icon="presentationFor(order.status).icon"
      :tone="presentationFor(order.status).tone"
      icon-label="Order"
      :title="formatSheetDate(order.receivedDate)"
      :badges="[
        { label: presentationFor(order.status).label, tone: presentationFor(order.status).tone },
        ...(serviceTypeLabel(order.serviceType) ? [{ label: serviceTypeLabel(order.serviceType)!, tone: 'brand' as const }] : []),
      ]"
      :trailing="order.quantity != null ? `${order.quantity} pcs` : undefined"
      :detail="order.note || '—'"
      @select="emit('selectOrder', order.orderId)"
    >
      <template #left-panel="{ close }">
        <div class="absolute inset-0 flex items-center justify-end bg-primary/80 text-on-primary">
          <button type="button" class="flex w-16 shrink-0 flex-col items-center gap-0.5 transition-all hover:scale-110 disabled:opacity-50" @click.stop="openOrderDetail(order.orderId, close)">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">open_in_new</span>
            <span class="font-label text-[8px] font-bold uppercase">Order detail</span>
          </button>
        </div>
      </template>
      <template #actions>
        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="isInvoiceActionAvailable(order)"
            type="button"
            class="shrink-0 p-1 text-primary transition hover:opacity-70 active:scale-95"
            aria-label="View invoice"
            @mousedown.stop
            @touchend.stop
            @click.stop="viewInvoice(order.invoiceNumber!)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">receipt_long</span>
          </button>
          <button
            type="button"
            class="shrink-0 p-1 text-primary transition hover:opacity-70 active:scale-95"
            aria-label="View photos"
            @mousedown.stop
            @touchend.stop
            @click.stop="viewPhotos(order.orderId)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">photo_library</span>
          </button>
        </div>
      </template>
    </CustomerRecordCard>
  </ListContainer>
</template>
