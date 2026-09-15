<script setup lang="ts">
import { computed } from 'vue'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import type { z } from 'zod'
import type { workOrderListResponseSchema } from '@contracts/work-orders/work-order-api.schema'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { isInvoiceActionAvailable } from '../utils/order-invoice-target'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'
import { presentationFor } from '../order-status-presentation'

type WorkOrderListDto = z.infer<typeof workOrderListResponseSchema>
export type OrderRowData = WorkOrderListDto & { customerName?: string | null }

const props = defineProps<{
  order: OrderRowData
  showCustomerName?: boolean
  showPhotos?: boolean
  showInvoice?: boolean
}>()

const emit = defineEmits<{
  select: [orderId: string]
  viewPhotos: [orderId: string]
  viewInvoice: [invoiceNumber: string]
}>()


function viewPhotos() {
  emit('viewPhotos', props.order.orderId)
}

function viewInvoice() {
  const invoiceNumber = props.order.invoiceNumber
  if (!isInvoiceActionAvailable(props.order) || !invoiceNumber) return
  emit('viewInvoice', invoiceNumber)
}

function selectOrder() {
  emit('select', props.order.orderId)
}

const dateLineSlot = computed(() => props.showCustomerName ? 'line2' : 'line1')
const noteLineSlot = computed(() => props.showCustomerName ? 'line3' : 'line2')
</script>

<template>
  <BaseSwipeCard :swipeable="false" :pressable="true" @tap="selectOrder">
    <BaseRowCard
      :line1="showCustomerName
        ? (order.customerName?.trim() ? order.customerName : order.customerId)
        : formatSheetDate(order.receivedDate)"
    >
      <template #lead>
        <CardLeadingIcon
          :icon="presentationFor(order.status).icon"
          :tone="presentationFor(order.status).tone"
          label="Order"
        />
      </template>
      <template v-if="showCustomerName" #line1>
        {{ showCustomerName && order.customerName?.trim() ? order.customerName : order.customerId }}
      </template>
      <template #[dateLineSlot]>
        <span class="flex min-w-0 items-center gap-1.5 font-body text-xs font-normal text-on-surface-variant">
          <span class="truncate">
            {{ formatSheetDate(order.receivedDate) }}
          </span>
          <BaseBadge
            :label="presentationFor(order.status).label"
            size="xs"
            :uppercase="true"
            :tone="presentationFor(order.status).tone"
          />
          <BaseBadge
            v-if="serviceTypeLabel(order.serviceType)"
            :label="serviceTypeLabel(order.serviceType)!"
            size="xs"
            :uppercase="true"
            tone="brand"
          />
        </span>
      </template>
      <template #top-end>
        <span class="shrink-0 font-body text-[11px] font-semibold text-on-surface-variant">
          {{ order.quantity != null ? `${order.quantity} pcs` : '' }}
        </span>
      </template>
      <template #[noteLineSlot]>
        {{ order.note || '—' }}
      </template>
      <template #bot-end>
        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="showInvoice && isInvoiceActionAvailable(order)"
            type="button"
            class="shrink-0 p-1 text-primary transition hover:opacity-70 active:scale-95"
            aria-label="View invoice"
            @mousedown.stop
            @touchend.stop
            @click.stop="viewInvoice"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">receipt_long</span>
          </button>
          <button
            v-if="showPhotos"
            type="button"
            class="shrink-0 p-1 text-primary transition hover:opacity-70 active:scale-95"
            aria-label="View photos"
            @mousedown.stop
            @touchend.stop
            @click.stop="viewPhotos"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">photo_library</span>
          </button>
        </div>
      </template>
    </BaseRowCard>
  </BaseSwipeCard>
</template>
