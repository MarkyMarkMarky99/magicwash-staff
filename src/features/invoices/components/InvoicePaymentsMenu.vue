<script setup lang="ts">
import BaseDropdown from '@/shared/components/BaseDropdown.vue'
import DropdownPillTrigger from '@/shared/components/DropdownPillTrigger.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { formatSheetDateTime } from '@/shared/utils/sheet-date'
import type { InvoiceDetailDto } from '@/data/invoices/invoice-detail.service'

import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

const props = defineProps<{
  payments: InvoiceDetailDto['payments']
  suspended?: boolean
}>()

const emit = defineEmits<{
  proof: [url: string]
  review: [paymentId: string]
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
    panel-class="w-64 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl"
  >
    <template #trigger="{ open, setTrigger, toggle, triggerAttrs }">
      <DropdownPillTrigger
        :label="`${payments.length} payments`"
        :open="open"
        :set-trigger="setTrigger"
        :toggle="toggle"
        :trigger-attrs="triggerAttrs"
      />
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

        <button
          v-if="payment.status === 'PENDING' && payment.paymentId"
          type="button"
          class="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center justify-center gap-1.5 rounded-lg bg-warning-container py-1.5 font-label text-[11px] font-bold text-on-warning-container transition-colors hover:bg-warning-container/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
          @click="emit('review', payment.paymentId)"
        >
          <span class="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">fact_check</span>
          ตรวจสอบรายการนี้
        </button>
      </li>
      </ul>
    </template>
  </BaseDropdown>
</template>
