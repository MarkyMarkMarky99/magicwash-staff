<script setup lang="ts">
import type { BillingDraft, BillingDraftLine } from '@contracts/ai-gateway/billing-draft.schema'
import AgentCardFrame from './AgentCardFrame.vue'

defineProps<{ draft: BillingDraft }>()
defineEmits<{ open: [draft: BillingDraft] }>()

const SOURCE_LABELS: Record<BillingDraftLine['source'], string> = {
  'customer-history': 'This customer',
  'other-history': 'Other customer',
  'price-list': 'Price list',
  'needs-price': 'Needs price',
}
const SOURCE_CLASSES: Record<BillingDraftLine['source'], string> = {
  'customer-history': 'bg-success-container text-on-success-container',
  'other-history': 'bg-secondary-container text-primary',
  'price-list': 'bg-surface-container text-on-surface-variant',
  'needs-price': 'bg-warning-container text-on-warning-container',
}
const PHOTO_LABELS = { exact: 'Exact photo', probable: 'Probable photo', none: 'No photo' } as const
const PHOTO_CLASSES = {
  exact: 'bg-success-container text-on-success-container',
  probable: 'bg-warning-container text-on-warning-container',
  none: 'bg-surface-container text-on-surface-variant',
} as const

function formatPrice(price: number): string {
  return `฿${price.toLocaleString('en-US')}`
}

function needsPrice(line: BillingDraftLine): boolean {
  return line.unitPrice === null || line.source === 'needs-price'
}

function showListPrice(line: BillingDraftLine): boolean {
  return line.priceListPrice !== null && line.priceListPrice !== line.unitPrice
}
</script>

<template>
  <AgentCardFrame title="Bill draft">
    <p class="mb-2 font-body text-[13px] font-extrabold text-primary">{{ draft.orderId }}</p>
    <ul class="font-body text-[13px]">
      <li v-for="line in draft.lines" :key="line.orderItemId" class="border-b border-dashed border-outline-variant py-2 first:pt-0 last:border-b-0">
        <div class="flex items-start justify-between gap-2">
          <p class="min-w-0 font-semibold leading-snug [overflow-wrap:anywhere]">
            {{ line.description }}
            <span class="block text-[11px] font-medium text-on-surface-variant">{{ line.quantity }} × {{ line.unit }}</span>
          </p>
          <span class="whitespace-nowrap text-sm font-extrabold" :class="needsPrice(line) ? 'text-warning' : 'text-primary'">{{ needsPrice(line) || line.unitPrice === null ? 'Needs price' : formatPrice(line.unitPrice) }}</span>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-1.5">
          <span class="rounded-full px-2 py-0.5 font-label text-[10px] font-extrabold uppercase" :class="SOURCE_CLASSES[line.source]">{{ SOURCE_LABELS[line.source] }}</span>
          <span v-if="line.photoMatch" class="rounded-full px-2 py-0.5 font-label text-[10px] font-extrabold uppercase" :class="PHOTO_CLASSES[line.photoMatch]">{{ PHOTO_LABELS[line.photoMatch] }}</span>
          <span v-if="line.priceListPrice !== null && showListPrice(line)" class="text-[11px] font-medium text-on-surface-variant">List: {{ formatPrice(line.priceListPrice) }}</span>
        </div>
        <p v-if="line.otherPrices.length" class="mt-0.5 text-[11px] font-medium text-on-surface-variant">Also seen: {{ line.otherPrices.join(', ') }}</p>
        <p v-if="line.note" class="mt-0.5 text-[11px] font-medium text-on-surface-variant [overflow-wrap:anywhere]">{{ line.note }}</p>
        <ul v-if="line.citations.length" class="mt-1 flex flex-col gap-0.5">
          <li v-for="citation in line.citations" :key="citation.invoiceItemId" class="flex flex-wrap items-center gap-x-2.5 text-[11px] font-bold text-primary">
            <RouterLink :to="{ name: 'invoice-detail', params: { invoiceNumber: citation.invoiceNumber } }" class="underline">{{ citation.invoiceNumber }}</RouterLink>
            <RouterLink v-if="citation.orderId" :to="{ name: 'order-detail', params: { orderId: citation.orderId } }" class="underline">{{ citation.orderId }}</RouterLink>
            <a v-if="citation.photoUrl" :href="citation.photoUrl" target="_blank" rel="noopener noreferrer" class="underline">Photo</a>
          </li>
        </ul>
      </li>
    </ul>
    <p v-for="warning in draft.warnings" :key="`${warning.orderItemId}-${warning.message}`" class="mt-2.5 flex items-start gap-1.5 font-body text-xs font-bold leading-snug text-warning">
      <span class="material-symbols-outlined mt-px text-[16px]" aria-hidden="true">warning</span>
      <span>{{ warning.message }}</span>
    </p>
    <div class="mt-3 grid gap-2">
      <button type="button" class="flex h-[46px] items-center justify-center gap-1.5 rounded-full bg-primary px-4 font-body text-sm font-extrabold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="$emit('open', draft)">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">receipt_long</span>Open in invoice form
      </button>
    </div>
  </AgentCardFrame>
</template>
