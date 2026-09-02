<script setup lang="ts">
import BaseDropdown from '@/shared/components/BaseDropdown.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { formatSheetDateTime } from '@/shared/utils/sheet-date'
import type { InvoiceDetailDto } from '../services/invoice-detail.service'

type BadgeTone = 'neutral' | 'brand' | 'accent' | 'info' | 'warning' | 'success' | 'danger'

const props = defineProps<{
  payments: InvoiceDetailDto['payments']
  suspended?: boolean
}>()

const emit = defineEmits<{
  proof: [url: string]
}>()

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const amount = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${value < 0 ? '-' : ''}฿${amount}`
}

function safeHttpUrl(value: string | null) {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function proofUrl(value: string | null) {
  return safeHttpUrl(value) ?? ''
}

function methodIcon(method: InvoiceDetailDto['payments'][number]['method']) {
  const icons: Record<string, string> = {
    CASH: 'payments',
    BANK_TRANSFER: 'account_balance',
    CREDIT_CARD: 'credit_card',
    QR_PROMPTPAY: 'qr_code_2',
    GIFT_VOUCHER: 'redeem',
    OTHER: 'receipt_long',
  }
  return method ? icons[method] ?? 'receipt_long' : 'receipt_long'
}

function statusTone(status: InvoiceDetailDto['payments'][number]['status']): BadgeTone {
  const tones: Record<string, BadgeTone> = {
    PENDING: 'warning',
    VERIFIED: 'success',
    FAILED: 'danger',
    CANCELLED: 'neutral',
  }
  return tones[status] ?? 'neutral'
}

function statusLabel(status: InvoiceDetailDto['payments'][number]['status']) {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    VERIFIED: 'Verified',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
  }
  return labels[status] ?? status
}

</script>

<template>
  <BaseDropdown
    :suspended="props.suspended"
    panel-class="w-64 overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl no-scrollbar"
  >
    <template #trigger="{ open, setTrigger, toggle, triggerAttrs }">
      <button
        :ref="setTrigger"
        v-bind="triggerAttrs"
        type="button"
        class="relative flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full bg-surface-container px-2.5 pr-1.5 font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant transition-all after:absolute after:-inset-2 after:content-[''] hover:bg-surface-container-high active:scale-95 focus:outline-none"
        @click="toggle"
      >
        {{ payments.length }} payments
        <span class="material-symbols-outlined text-[14px] leading-none transition-transform" :class="open ? 'rotate-180' : ''" aria-hidden="true">expand_more</span>
      </button>
    </template>

    <template #default>
      <ul>
      <li v-for="(payment, index) in payments" :key="`${payment.paymentId}-${index}`">
        <button
          v-if="proofUrl(payment.proofUrl)"
          type="button"
          class="w-full px-3 py-2 text-left transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          @click="emit('proof', proofUrl(payment.proofUrl))"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-1.5">
              <span class="material-symbols-outlined shrink-0 text-[16px] leading-none text-primary" aria-hidden="true">{{ methodIcon(payment.method) }}</span>
              <span class="truncate font-body text-[11px] text-on-surface-variant">{{ formatSheetDateTime(payment.paidAt) }}</span>
              <BaseBadge :label="statusLabel(payment.status)" size="sm" :tone="statusTone(payment.status)" />
            </span>
            <span class="shrink-0 font-headline text-[12px] font-bold text-on-surface">{{ formatMoney(payment.amount) }}</span>
          </span>
        </button>

        <div v-else class="px-3 py-2">
          <span class="flex items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-1.5">
              <span class="material-symbols-outlined shrink-0 text-[16px] leading-none text-primary" aria-hidden="true">{{ methodIcon(payment.method) }}</span>
              <span class="truncate font-body text-[11px] text-on-surface-variant">{{ formatSheetDateTime(payment.paidAt) }}</span>
              <BaseBadge :label="statusLabel(payment.status)" size="sm" :tone="statusTone(payment.status)" />
            </span>
            <span class="shrink-0 font-headline text-[12px] font-bold text-on-surface">{{ formatMoney(payment.amount) }}</span>
          </span>
        </div>
      </li>
      </ul>
    </template>
  </BaseDropdown>
</template>
