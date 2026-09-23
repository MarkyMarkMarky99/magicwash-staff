<script setup lang="ts">
import { computed, ref } from 'vue'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import { formatCustomerLabel } from '@/shared/utils/customer-label'
import type { workOrderListResponseSchema } from '@contracts/work-orders/work-order-api.schema'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { isInvoiceActionAvailable } from '../utils/customer-order-invoice-target'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
import { presentationFor } from '../utils/customer-order-status-presentation'

type WorkOrderListDto = ReturnType<typeof workOrderListResponseSchema.parse>
export type OrderRowData = WorkOrderListDto & { customerName?: string | null; customerIndex?: string | null }

const baseCard = ref<InstanceType<typeof BaseSwipeCard> | null>(null)

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
  openDetail: [orderId: string]
}>()


function viewPhotos() {
  emit('viewPhotos', props.order.orderId)
}

function viewInvoice() {
  const invoiceNumber = props.order.invoiceNumber
  if (!isInvoiceActionAvailable(props.order) || !invoiceNumber) return
  emit('viewInvoice', invoiceNumber)
}

function openDetail() {
  emit('openDetail', props.order.orderId)
  baseCard.value?.snapCard('none')
}

function selectOrder() {
  emit('select', props.order.orderId)
}

const customerLabel = computed(() => formatCustomerLabel(props.order.customerName?.trim() ? props.order.customerName : props.order.customerId, props.order.customerIndex))
const dateLineSlot = computed(() => props.showCustomerName ? 'line2' : 'line1')
const noteLineSlot = computed(() => props.showCustomerName ? 'line3' : 'line2')
</script>

<template>
  <div class="relative">
    <BaseSwipeCard ref="baseCard" :swipeable="true" :pressable="true" :left-actions="1" @tap="selectOrder">
      <template #left-panel>
        <div class="absolute inset-0 flex items-center justify-end bg-primary/80 text-on-primary">
          <button type="button" class="flex w-16 shrink-0 flex-col items-center gap-0.5 transition-all hover:scale-110 disabled:opacity-50" @click.stop="openDetail">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">open_in_new</span>
            <span class="font-label text-[8px] font-bold uppercase">Order detail</span>
          </button>
        </div>
      </template>
    <BaseRowCard
      :line1="showCustomerName
        ? customerLabel
        : formatSheetDate(order.receivedDate)"
    >
      <template v-if="showCustomerName" #line1>
        {{ customerLabel }}
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
  </div>
</template>
