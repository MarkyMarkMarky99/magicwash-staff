<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { OrderListDto } from '../services/order.service'

const props = defineProps<{
  order: OrderListDto
}>()

const emit = defineEmits<{
  select: [order: OrderListDto]
}>()

const router = useRouter()

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  CONFIRM: 'Confirmed',
  RECEIVED: 'Received',
  COMPLETED: 'Completed',
}

const STATUS_CLASSES: Record<string, string> = {
  SUBMITTED: 'bg-surface-container-high text-on-surface-variant',
  PENDING: 'bg-warning-container text-warning',
  APPROVED: 'bg-blue-50 text-blue-700',
  CONFIRM: 'bg-blue-50 text-blue-700',
  RECEIVED: 'bg-tertiary-container text-tertiary',
  COMPLETED: 'bg-success-container text-success',
}

function statusLabel(status: string | null) {
  if (!status) return 'Unknown'
  return STATUS_LABELS[status] || status
}

function viewPhotos() {
  router.push(`/gallery/AFT-${props.order.orderId}`)
}

function selectOrder() {
  emit('select', props.order)
}
</script>

<template>
  <article
    class="cursor-pointer rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-3 transition hover:bg-surface-container"
    role="button"
    tabindex="0"
    @click="selectOrder"
    @keydown.enter="selectOrder"
    @keydown.space.prevent="selectOrder"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-headline text-sm font-bold text-primary">
          {{ order.receivedDate || '—' }}
        </p>
        <p class="mt-1 truncate text-xs text-on-surface-variant">
          {{ order.note || order.serviceType || '—' }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <span
          class="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
          :class="STATUS_CLASSES[order.status || ''] || 'bg-surface-container-high text-on-surface-variant'"
        >
          {{ statusLabel(order.status) }}
        </span>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-surface-container-high"
          aria-label="View photos"
          @click.stop="viewPhotos"
        >
          <span class="material-symbols-outlined text-[19px]" aria-hidden="true">photo_library</span>
        </button>
      </div>
    </div>

    <div class="mt-2 flex items-center gap-3 text-xs text-on-surface-variant">
      <span>Quantity: {{ order.quantity ?? '—' }}</span>
      <span v-if="order.orderNumber">{{ order.orderNumber }}</span>
    </div>
  </article>
</template>
