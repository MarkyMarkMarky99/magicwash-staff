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
  <section class="w-full bg-surface">
    <div
      class="flex cursor-pointer select-none items-center justify-between bg-surface-container-low px-4 py-2 text-primary"
      @click="collapsed = !collapsed"
    >
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">receipt_long</span>
        <h2 class="font-headline text-[13px] font-bold tracking-tight">Order History</h2>
        <span
          class="material-symbols-outlined text-[16px] text-primary transition-transform"
          :class="collapsed ? '' : 'rotate-180'"
          aria-hidden="true"
        >expand_more</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex h-[22px] items-center gap-1.5 rounded-full bg-surface-container px-2.5">
          <span class="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
            {{ orders.length }} orders
          </span>
        </div>
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
      </div>
    </div>

    <div v-if="!collapsed">
      <p v-if="appointmentsError" class="px-4 py-2 font-body text-xs text-warning">
        Waiting pickups are unavailable right now.
      </p>
      <p v-if="ordersError" class="px-4 py-3 font-body text-sm text-error">Unable to load order history.</p>
      <p v-if="ordersLoading" class="px-4 py-4 font-body text-sm text-on-surface-variant">Loading orders...</p>

      <p
        v-if="!ordersLoading && !ordersError && orders.length === 0 && waitingPickups.length === 0"
        class="px-6 py-4 font-body text-sm italic text-on-surface-variant"
      >
        No order history
      </p>

      <div v-else class="divide-y divide-outline-variant/10">
        <WaitingPickupCard
          v-for="appointment in waitingPickups"
          :key="appointment.appointmentId"
          :appointment="appointment"
        />
        <OrderCard
          v-for="order in orders"
          :key="order.orderId"
          :order="order"
          @select="emit('selectOrder', $event)"
        />
      </div>
    </div>
  </section>
</template>
