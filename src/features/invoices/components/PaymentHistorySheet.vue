<script setup lang="ts">
import type { InvoiceResponseDto, PaymentResponseDto, PaymentStatusDto } from '../types/invoices.types'

defineProps<{
  open: boolean
  invoice: InvoiceResponseDto | null
  payments: PaymentResponseDto[]
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

function formatCurrency(value: number | null) {
  if (value === null) {
    return '-'
  }

  return `฿${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value: string | null) {
  return value || '-'
}

function formatMethod(value: string | null) {
  return value || 'NONE'
}

function getPaymentStatusLabel(status: PaymentStatusDto) {
  const labels: Record<PaymentStatusDto, string> = {
    PENDING: 'Pending',
    VERIFYING: 'Verifying',
    VERIFIED: 'Verified',
    FAILED: 'Failed',
    MANUAL_REVIEW: 'Manual review',
  }

  return labels[status]
}

function getPaymentStatusClass(status: PaymentStatusDto) {
  const classes: Record<PaymentStatusDto, string> = {
    PENDING: 'bg-surface-container-high text-on-surface-variant',
    VERIFYING: 'bg-tertiary-container text-tertiary',
    VERIFIED: 'bg-success-container text-success',
    FAILED: 'bg-error-container text-error',
    MANUAL_REVIEW: 'bg-warning-container text-warning',
  }

  return classes[status]
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[100] flex items-end">
      <button
        type="button"
        class="absolute inset-0 bg-black/40"
        aria-label="Close payment history"
        @click="emit('close')"
      />

      <section class="relative w-full max-h-[82vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b border-outline-variant/20 px-4 py-3">
          <div class="min-w-0">
            <h2 class="font-headline text-base font-bold text-primary">Payment history</h2>
            <p class="truncate text-xs text-on-surface-variant">
              {{ invoice?.invoiceNumber ?? '-' }}
            </p>
          </div>

          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-surface-container"
            aria-label="Close"
            @click="emit('close')"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </header>

        <div class="max-h-[calc(82vh-64px)] overflow-y-auto px-4 py-3">
          <p v-if="loading" class="py-6 text-sm text-on-surface-variant">Loading payments...</p>
          <p v-else-if="error" class="py-6 text-sm text-error">{{ error }}</p>
          <p v-else-if="payments.length === 0" class="py-6 text-sm text-on-surface-variant">
            No payment history
          </p>

          <div v-else class="space-y-3">
            <article
              v-for="payment in payments"
              :key="payment.id"
              class="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-headline text-base font-bold text-on-surface">
                    {{ formatCurrency(payment.amount) }}
                  </p>
                  <p class="mt-1 text-xs text-on-surface-variant">
                    {{ formatMethod(payment.method) }} · {{ formatDate(payment.createdAt) }}
                  </p>
                </div>

                <span
                  class="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                  :class="getPaymentStatusClass(payment.status)"
                >
                  {{ getPaymentStatusLabel(payment.status) }}
                </span>
              </div>

              <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt class="text-on-surface-variant">Reference</dt>
                  <dd class="font-medium text-on-surface">{{ payment.referenceNo || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-on-surface-variant">Receipt</dt>
                  <dd class="font-medium text-on-surface">{{ payment.receiptId || '-' }}</dd>
                </div>
              </dl>

              <p v-if="payment.notes" class="mt-3 text-xs text-on-surface-variant">
                {{ payment.notes }}
              </p>

              <a
                v-if="payment.proofUrl"
                :href="payment.proofUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary"
              >
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
                View proof
              </a>
            </article>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
