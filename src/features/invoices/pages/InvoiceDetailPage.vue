<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import InvoiceCustomerCard from '../components/InvoiceCustomerCard.vue'
import InvoicePaymentsMenu from '../components/InvoicePaymentsMenu.vue'
import InvoiceProofLightbox from '../components/InvoiceProofLightbox.vue'
import InvoiceSectionCard from '../components/InvoiceSectionCard.vue'
import {
  getInvoiceDetail,
  InvalidInvoiceNumberError,
} from '../services/invoice-detail.service'
import type { InvoiceDetailDto } from '../services/invoice-detail.service'
import { formatSheetDate } from '@/shared/utils/sheet-date'

const props = defineProps<{ invoiceNumber: string }>()

const invoice = ref<InvoiceDetailDto | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)
const proofUrl = ref<string | null>(null)
let latestRequest = 0

const statusStyles: Record<string, { badge: string; icon: string }> = {
  DRAFT: { badge: 'bg-gray-100 text-gray-600', icon: 'draft' },
  UNPAID: { badge: 'bg-amber-100 text-amber-700', icon: 'schedule' },
  OVERDUE: { badge: 'bg-error-container text-on-error-container', icon: 'event_busy' },
  PARTIALLY_PAID: { badge: 'bg-blue-100 text-blue-700', icon: 'donut_large' },
  PAID: { badge: 'bg-green-100 text-green-700', icon: 'task_alt' },
  CANCELLED: { badge: 'bg-error-container text-on-error-container', icon: 'cancel' },
  VOID: { badge: 'bg-error-container text-on-error-container', icon: 'block' },
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  UNPAID: 'Unpaid',
  OVERDUE: 'Overdue',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  VOID: 'Void',
}

const isReadOnlyFooterVisible = computed(() => {
  const status = invoice.value?.status
  return status !== undefined && status !== 'DRAFT'
})

function statusStyle(status: string) {
  return statusStyles[status] ?? { badge: 'bg-gray-100 text-gray-600', icon: 'receipt_long' }
}

function statusLabel(status: string) {
  return statusLabels[status] ?? status
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const amount = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${value < 0 ? '-' : ''}฿${amount}`
}

function formatDate(value: string | null) {
  return formatSheetDate(value, '—')
}

function formatAdjustment(adjustment: { calculation: string; value: number }) {
  if (adjustment.calculation === 'PERCENT') return `${adjustment.value}%`
  return formatMoney(adjustment.value)
}

async function loadInvoice() {
  const requestId = ++latestRequest
  loading.value = true
  error.value = null
  notFound.value = false
  invoice.value = null
  proofUrl.value = null

  try {
    const result = await getInvoiceDetail(props.invoiceNumber)
    if (requestId !== latestRequest) return
    if (!result) {
      notFound.value = true
      return
    }
    invoice.value = result
  } catch (loadError) {
    if (requestId !== latestRequest) return
    if (loadError instanceof InvalidInvoiceNumberError) {
      notFound.value = true
      return
    }
    error.value = 'Unable to load invoice'
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}

watch(() => props.invoiceNumber, loadInvoice, { immediate: true })
</script>

<template>
  <AppLayout>
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden font-body text-on-surface">
      <main v-if="loading" class="flex flex-1 flex-col items-center justify-center gap-3" role="status">
        <span class="material-symbols-outlined animate-pulse text-5xl text-primary" aria-hidden="true">local_laundry_service</span>
        <p class="text-sm text-on-surface-variant">Loading</p>
      </main>

      <main v-else-if="error" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
        <span class="material-symbols-outlined text-5xl text-error" aria-hidden="true">error_outline</span>
        <p class="text-sm text-on-surface-variant">{{ error }}</p>
        <button
          type="button"
          class="rounded-xl bg-primary px-4 py-2 font-label text-[12px] font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          @click="loadInvoice"
        >
          Retry
        </button>
      </main>

      <main v-else-if="notFound || !invoice" class="flex flex-1 flex-col items-center justify-center gap-3" role="status">
        <span class="material-symbols-outlined text-5xl text-error" aria-hidden="true">receipt_long</span>
        <p class="text-sm text-on-surface-variant">Invoice not found</p>
      </main>

      <template v-else>
        <main class="flex-1 overflow-y-auto no-scrollbar">
          <div class="space-y-5 px-4 pb-8 pt-4">
            <section class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p class="mb-0.5 font-label text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                  Invoice number
                </p>
                <h2 class="truncate font-headline text-[22px] font-bold leading-tight text-on-surface">
                  {{ invoice.invoiceNumber }}
                </h2>
              </div>

              <div class="flex min-w-[112px] shrink-0 flex-col items-end gap-2 pt-0.5">
                <div class="flex items-center gap-2">
                  <p class="whitespace-nowrap font-label text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Issued</p>
                  <span class="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 font-headline text-[11px] font-bold text-primary">
                    {{ formatDate(invoice.issuedDate) }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <p class="whitespace-nowrap font-label text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Due</p>
                  <span class="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 font-headline text-[11px] font-bold text-primary">
                    {{ formatDate(invoice.dueDate) }}
                  </span>
                </div>
                <div
                  v-if="invoice.billingPeriodStart || invoice.billingPeriodEnd"
                  class="flex items-center gap-2"
                >
                  <p class="whitespace-nowrap font-label text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Billing</p>
                  <span class="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 font-headline text-[11px] font-bold text-primary">
                    {{ formatDate(invoice.billingPeriodStart) }} – {{ formatDate(invoice.billingPeriodEnd) }}
                  </span>
                </div>
              </div>
            </section>

            <InvoiceCustomerCard :customer="invoice.customer" />

            <InvoiceSectionCard
              icon="checkroom"
              title="Items"
              :badge="`${invoice.items.length} items`"
            >
              <p v-if="invoice.items.length === 0" class="px-4 py-4 text-[13px] italic text-on-surface-variant">
                No items
              </p>
              <ul v-else class="divide-y divide-outline-variant/10">
                <li v-for="(item, index) in invoice.items" :key="`${item.description}-${index}`" class="px-4 py-3">
                  <div class="flex items-start gap-3">
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-body text-sm font-medium leading-snug text-on-surface">{{ item.description }}</p>
                      <p class="mt-0.5 font-body text-[11px] leading-relaxed text-on-surface-variant">
                        {{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }} × {{ formatMoney(item.unitPrice) }}
                      </p>
                    </div>
                    <span class="shrink-0 font-headline text-[13px] font-bold text-on-surface">
                      {{ formatMoney(item.netTotal ?? item.subtotal) }}
                    </span>
                  </div>

                  <div v-if="item.adjustments.length" class="mt-2 space-y-1 border-l-2 border-outline-variant/30 pl-3">
                    <div v-for="(adjustment, adjustmentIndex) in item.adjustments" :key="`${adjustment.label}-${adjustmentIndex}`" class="flex items-start justify-between gap-3">
                      <span class="font-body text-[11px] leading-relaxed text-on-surface-variant">{{ adjustment.label }}</span>
                      <span class="shrink-0 font-body text-[11px]" :class="adjustment.value < 0 ? 'text-green-700' : 'text-on-surface-variant'">
                        {{ formatAdjustment(adjustment) }}
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </InvoiceSectionCard>

            <InvoiceSectionCard icon="calculate" title="Totals">
              <template #action>
                <InvoicePaymentsMenu
                  v-if="invoice.payments.length"
                  :payments="invoice.payments"
                  :suspended="proofUrl !== null"
                  @proof="proofUrl = $event"
                />
              </template>

              <div class="px-4 py-3">
                <div class="flex items-center justify-between gap-3 py-0.5">
                  <span class="font-body text-[13px] leading-snug text-on-surface-variant">Subtotal</span>
                  <span class="shrink-0 font-body text-[13px] text-on-surface">{{ formatMoney(invoice.subtotal) }}</span>
                </div>

                <template v-if="invoice.adjustments.length">
                  <div v-for="(adjustment, index) in invoice.adjustments" :key="`${adjustment.label}-${index}`" class="flex items-center justify-between gap-3 py-0.5">
                    <span class="font-body text-[13px] leading-snug text-on-surface-variant">{{ adjustment.label }}</span>
                    <span class="shrink-0 font-body text-[13px]" :class="adjustment.value < 0 ? 'text-green-700' : 'text-on-surface'">
                      {{ formatAdjustment(adjustment) }}
                    </span>
                  </div>
                </template>
                <div v-else class="flex items-center justify-between gap-3 py-0.5">
                  <span class="font-body text-[13px] leading-snug text-on-surface-variant">Adjustments</span>
                  <span class="shrink-0 font-body text-[13px]" :class="invoice.adjustmentTotal < 0 ? 'text-green-700' : 'text-on-surface'">
                    {{ formatMoney(invoice.adjustmentTotal) }}
                  </span>
                </div>

                <div class="flex items-center justify-between gap-3 py-0.5">
                  <span class="font-body text-[13px] leading-snug text-on-surface-variant">Paid</span>
                  <span class="shrink-0 font-body text-[13px]" :class="invoice.paidAmount > 0 ? 'text-green-700' : 'text-on-surface'">
                    {{ formatMoney(invoice.paidAmount > 0 ? -invoice.paidAmount : invoice.paidAmount) }}
                  </span>
                </div>

                <div class="mt-2 flex items-center justify-between gap-3 border-t border-outline-variant/25 pt-2">
                  <span class="font-headline text-[14px] font-bold leading-snug text-on-surface">Total due</span>
                  <span class="shrink-0 font-headline text-[18px] font-bold" :class="invoice.balanceDue > 0 ? 'text-error' : 'text-green-700'">
                    {{ formatMoney(invoice.balanceDue) }}
                  </span>
                </div>
              </div>
            </InvoiceSectionCard>
          </div>
        </main>

        <footer v-if="isReadOnlyFooterVisible" class="z-40 flex-none border-t border-outline-variant/20 bg-surface px-4 pb-4 pt-3">
          <div class="flex h-14 w-full items-center justify-between gap-3 rounded-2xl bg-primary px-4 text-left text-on-primary shadow-md">
            <span class="flex min-w-0 items-center gap-2.5">
              <span class="material-symbols-outlined shrink-0 text-[20px] leading-none" aria-hidden="true">{{ statusStyle(invoice.status).icon }}</span>
              <span class="truncate font-headline text-[14px] font-bold">{{ statusLabel(invoice.status) }}</span>
            </span>
            <span class="shrink-0 font-headline text-[15px] font-bold">
              {{ formatMoney(invoice.status === 'PAID' ? invoice.paidAmount : invoice.balanceDue) }}
            </span>
          </div>
        </footer>
      </template>

      <InvoiceProofLightbox
        :open="proofUrl !== null"
        :url="proofUrl"
        @close="proofUrl = null"
      />
    </div>
  </AppLayout>
</template>
