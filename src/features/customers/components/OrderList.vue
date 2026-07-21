<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'
import type { OrderListDto } from '../services/order.service'
import OrderCard from './OrderCard.vue'
import WaitingPickupCard from './WaitingPickupCard.vue'

const emit = defineEmits<{
  selectOrder: [order: OrderListDto]
}>()

const store = useCustomerOrderHistoryStore()
const {
  orders,
  waitingPickups,
  ordersLoading,
  appointmentsLoading,
  ordersError,
  appointmentsError,
} = storeToRefs(store)
const collapsed = ref(false)

function refresh() {
  store.refresh()
}
</script>

<template>
  <section class="flex flex-col gap-3 px-4 py-4">
    <header class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-surface-container"
          :aria-label="collapsed ? 'Expand order history' : 'Collapse order history'"
          @click="collapsed = !collapsed"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
            {{ collapsed ? 'expand_more' : 'expand_less' }}
          </span>
        </button>
        <div>
          <h2 class="font-headline text-lg font-bold text-primary">Order History</h2>
          <p class="text-xs text-on-surface-variant">{{ orders.length }} orders</p>
        </div>
      </div>

      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-surface-container disabled:opacity-40"
        aria-label="Refresh order history"
        :disabled="ordersLoading || appointmentsLoading"
        @click="refresh"
      >
        <span class="material-symbols-outlined text-[19px]" aria-hidden="true">refresh</span>
      </button>
    </header>

    <div v-if="!collapsed" class="flex flex-col gap-3">
      <p v-if="appointmentsError" class="text-xs text-warning">
        Waiting pickups are unavailable right now.
      </p>
      <p v-if="ordersError" class="text-sm text-error">Unable to load order history.</p>
      <p v-if="ordersLoading" class="py-4 text-sm text-on-surface-variant">Loading orders...</p>

      <div v-if="waitingPickups.length" class="flex flex-col gap-2">
        <p class="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          Waiting pickups
        </p>
        <WaitingPickupCard
          v-for="appointment in waitingPickups"
          :key="appointment.appointmentId"
          :appointment="appointment"
        />
      </div>

      <div v-if="orders.length" class="flex flex-col gap-2">
        <OrderCard
          v-for="order in orders"
          :key="order.orderId"
          :order="order"
          @select="emit('selectOrder', $event)"
        />
      </div>

      <p
        v-if="!ordersLoading && !ordersError && orders.length === 0 && waitingPickups.length === 0"
        class="py-6 text-center text-sm text-on-surface-variant"
      >
        No order history
      </p>
    </div>
  </section>
</template>
