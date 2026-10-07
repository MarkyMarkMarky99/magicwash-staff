<script setup lang="ts">
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { formatTrackingDateTime } from '../utils/delivery-tracking'

defineProps<{
  customerIndex: string
  orderId: string
  receivedDate: string
  deliveredAt: string | null
  hasProofOfDelivery: boolean
}>()

const emit = defineEmits<{
  openProof: []
}>()

const ROW_CLASS = 'flex justify-between gap-4 border-b border-outline-variant py-[11px]'
</script>

<template>
  <dl class="m-0 mb-[22px] border-t border-outline-variant">
    <div :class="ROW_CLASS">
      <dt class="text-sm text-on-surface-variant">Customer code</dt>
      <dd class="m-0 text-right font-mono text-sm font-semibold tracking-[0.02em]">{{ customerIndex }}</dd>
    </div>
    <div :class="ROW_CLASS">
      <dt class="text-sm text-on-surface-variant">Order</dt>
      <dd class="m-0 text-right font-mono text-sm font-semibold tracking-[0.02em]">{{ orderId }}</dd>
    </div>
    <div :class="ROW_CLASS">
      <dt class="text-sm text-on-surface-variant">Received</dt>
      <dd class="m-0 text-right text-sm font-semibold">{{ formatSheetDate(receivedDate) }}</dd>
    </div>
    <div :class="ROW_CLASS">
      <dt class="text-sm text-on-surface-variant">Delivered</dt>
      <dd class="m-0 inline-flex items-center gap-0.5 text-right text-sm font-semibold">
        {{ deliveredAt ? formatTrackingDateTime(deliveredAt) : '—' }}
        <button
          v-if="deliveredAt && hasProofOfDelivery"
          type="button"
          class="-my-2 -mr-2 grid h-9 w-9 place-items-center rounded-[10px] border-0 bg-transparent p-0 text-primary focus-visible:outline-3 focus-visible:outline-lime"
          aria-haspopup="dialog"
          aria-label="Show proof of delivery photo"
          @click="emit('openProof')"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="M21 16l-5-5-9 9" /></svg>
        </button>
      </dd>
    </div>
  </dl>
</template>
