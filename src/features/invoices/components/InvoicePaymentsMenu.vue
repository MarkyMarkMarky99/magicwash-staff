<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { formatSheetDateTime } from '@/shared/utils/sheet-date'
import type { InvoiceDetailDto } from '../services/invoice-detail.service'

const props = defineProps<{
  payments: InvoiceDetailDto['payments']
  suspended?: boolean
}>()

const emit = defineEmits<{
  proof: [url: string]
}>()

const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLUListElement | null>(null)
const position = ref<{ right: string; top: string; maxHeight: string } | null>(null)

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

function statusClass(status: InvoiceDetailDto['payments'][number]['status']) {
  const classes: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    VERIFIED: 'bg-green-100 text-green-700',
    FAILED: 'bg-error-container text-on-error-container',
    CANCELLED: 'bg-gray-100 text-gray-600',
  }
  return classes[status] ?? 'bg-gray-100 text-gray-600'
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

function toggle() {
  if (open.value) {
    close(false)
    return
  }

  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) return

  position.value = {
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    top: `${rect.bottom + 6}px`,
    maxHeight: `${Math.max(96, window.innerHeight - rect.bottom - 16)}px`,
  }
  open.value = true
}

function close(refocus: boolean) {
  open.value = false
  if (refocus) triggerRef.value?.focus()
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (panelRef.value?.contains(target) || triggerRef.value?.contains(target)) return
  close(false)
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true)
}

function dismiss() {
  close(false)
}

watch([open, () => props.suspended], ([isOpen, isSuspended]) => {
  if (isOpen && !isSuspended) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('scroll', dismiss, true)
    window.removeEventListener('resize', dismiss)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('scroll', dismiss, true)
  window.removeEventListener('resize', dismiss)
})
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="relative flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full bg-surface-container px-2.5 pr-1.5 font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant transition-all after:absolute after:-inset-2 after:content-[''] hover:bg-surface-container-high active:scale-95 focus:outline-none"
    :aria-expanded="open"
    aria-haspopup="true"
    @click="toggle"
  >
    {{ payments.length }} payments
    <span class="material-symbols-outlined text-[14px] leading-none transition-transform" :class="open ? 'rotate-180' : ''" aria-hidden="true">expand_more</span>
  </button>

  <Teleport to="body">
    <ul
      v-if="open && position"
      ref="panelRef"
      class="fixed z-[60] w-64 overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl no-scrollbar"
      :style="position"
    >
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
              <span class="inline-flex shrink-0 items-center rounded-full px-2 py-px font-label text-[9px] font-bold" :class="statusClass(payment.status)">
                {{ statusLabel(payment.status) }}
              </span>
            </span>
            <span class="shrink-0 font-headline text-[12px] font-bold text-on-surface">{{ formatMoney(payment.amount) }}</span>
          </span>
        </button>

        <div v-else class="px-3 py-2">
          <span class="flex items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-1.5">
              <span class="material-symbols-outlined shrink-0 text-[16px] leading-none text-primary" aria-hidden="true">{{ methodIcon(payment.method) }}</span>
              <span class="truncate font-body text-[11px] text-on-surface-variant">{{ formatSheetDateTime(payment.paidAt) }}</span>
              <span class="inline-flex shrink-0 items-center rounded-full px-2 py-px font-label text-[9px] font-bold" :class="statusClass(payment.status)">
                {{ statusLabel(payment.status) }}
              </span>
            </span>
            <span class="shrink-0 font-headline text-[12px] font-bold text-on-surface">{{ formatMoney(payment.amount) }}</span>
          </span>
        </div>
      </li>
    </ul>
  </Teleport>
</template>
