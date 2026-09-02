<script setup lang="ts">
import type { z } from 'zod'
import type { workOrderListResponseSchema } from '@contracts/work-orders/work-order-api.schema'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { isInvoiceActionAvailable } from '../utils/order-invoice-target'
import BaseBadge from '@/shared/components/BaseBadge.vue'

type BadgeTone = 'neutral' | 'brand' | 'accent' | 'info' | 'warning' | 'success' | 'danger'

type WorkOrderListDto = z.infer<typeof workOrderListResponseSchema>
export type OrderRowData = Omit<WorkOrderListDto, 'customerName'> & { customerName?: string | null }

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

interface StatusPresentation {
  icon: string
  label: string
  badgeTone: BadgeTone
  avatarClass: string
}

// Unknown status values fall through to a neutral presentation rather than guessing.
const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  SUBMITTED: { icon: 'local_laundry_service', label: 'Submitted', badgeTone: 'warning', avatarClass: 'bg-amber-50 text-amber-600' },
  PENDING: { icon: 'schedule', label: 'Pending', badgeTone: 'warning', avatarClass: 'bg-amber-50 text-amber-600' },
  APPROVED: { icon: 'task_alt', label: 'Approved', badgeTone: 'info', avatarClass: 'bg-blue-50 text-blue-700' },
  RECEIVED: { icon: 'inventory_2', label: 'Received', badgeTone: 'accent', avatarClass: 'bg-teal-50 text-teal-700' },
  COMPLETED: { icon: 'done_all', label: 'Completed', badgeTone: 'success', avatarClass: 'bg-green-50 text-green-700' },
  CANCELLED: { icon: 'cancel', label: 'Cancelled', badgeTone: 'danger', avatarClass: 'bg-red-50 text-red-600' },
}

const FALLBACK_PRESENTATION: StatusPresentation = {
  icon: 'receipt_long',
  label: 'Unknown',
  badgeTone: 'neutral',
  avatarClass: 'bg-gray-100 text-gray-500',
}

function presentationFor(status: string | null): StatusPresentation {
  if (!status) return FALLBACK_PRESENTATION
  return STATUS_PRESENTATION[status] ?? { ...FALLBACK_PRESENTATION, label: status }
}

// English labels for the OrderForm sheet's service_type column, matching the card's existing
// English STATUS_PRESENTATION labels. Not the Thai maps in order-status-labels.ts.
const SERVICE_TYPE_LABELS: Record<string, string> = {
  WASH: 'Wash',
  WSIR: 'Wash & Iron',
  IRON: 'Iron',
  DRCL: 'Dry Clean',
}

function serviceTypeLabel(serviceType: string | null | undefined): string | null {
  if (!serviceType) return null
  return SERVICE_TYPE_LABELS[serviceType] ?? serviceType
}

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
</script>

<template>
  <article
    class="flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low active:bg-surface-container"
    role="button"
    tabindex="0"
    @click="selectOrder"
    @keydown.enter="selectOrder"
    @keydown.space.prevent="selectOrder"
  >
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/10"
      :class="presentationFor(order.status).avatarClass"
    >
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ presentationFor(order.status).icon }}</span>
    </div>

    <div class="min-w-0 flex-grow">
      <p
        v-if="showCustomerName"
        class="mb-0.5 truncate font-headline text-[14px] font-bold leading-tight text-primary"
      >
        {{ order.customerName?.trim() ? order.customerName : order.customerId }}
      </p>
      <div class="mb-0.5 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-1.5">
          <h3 class="truncate font-body text-xs text-on-surface-variant">
            {{ formatSheetDate(order.receivedDate) }}
          </h3>
          <BaseBadge
            :label="presentationFor(order.status).label"
            size="xs"
            :uppercase="true"
            :tone="presentationFor(order.status).badgeTone"
          />
          <BaseBadge
            v-if="serviceTypeLabel(order.serviceType)"
            :label="serviceTypeLabel(order.serviceType)!"
            size="xs"
            :uppercase="true"
            tone="brand"
          />
        </div>
        <span class="shrink-0 font-body text-[11px] font-semibold text-on-surface-variant">
          {{ order.quantity != null ? `${order.quantity} pcs` : '' }}
        </span>
      </div>

      <div class="flex items-center justify-between gap-2">
        <p class="truncate font-body text-xs text-on-surface-variant">
          {{ order.note || '—' }}
        </p>
        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="showInvoice && isInvoiceActionAvailable(order)"
            type="button"
            class="shrink-0 p-1 text-primary transition hover:opacity-70 active:scale-95"
            aria-label="View invoice"
            @click.stop="viewInvoice"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">receipt_long</span>
          </button>
          <button
            v-if="showPhotos"
            type="button"
            class="shrink-0 p-1 text-primary transition hover:opacity-70 active:scale-95"
            aria-label="View photos"
            @click.stop="viewPhotos"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">photo_library</span>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
