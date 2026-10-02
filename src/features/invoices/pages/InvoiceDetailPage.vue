<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import InvoiceCustomerCard from '../components/InvoiceCustomerCard.vue'
import InvoicePaymentsMenu from '../components/InvoicePaymentsMenu.vue'
import InvoiceProofLightbox from '../components/InvoiceProofLightbox.vue'
import InvoiceSectionCard from '../components/InvoiceSectionCard.vue'
import {
  getInvoiceDetail,
  InvalidInvoiceNumberError,
} from '@/data/invoices/invoice-detail.service'
import type { InvoiceDetailDto } from '@/data/invoices/invoice-detail.service'
import { printInvoice } from '@/data/invoices/invoice-print.service'
import { ApiError } from '@/shared/api/api-client'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { invoicePaymentCreateRoute, invoicePaymentReviewRoute } from '@/shared/navigation/form-routes'

const props = defineProps<{ invoiceNumber: string }>()
const router = useRouter()

const invoice = ref<InvoiceDetailDto | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)
const proofUrl = ref<string | null>(null)
const printing = ref(false)
const printSuccess = ref<string | null>(null)
const printError = ref<string | null>(null)
let latestRequest = 0

const canRecordPayment = computed(() => {
  const status = invoice.value?.status
  return status !== undefined && status !== 'DRAFT' && status !== 'CANCELLED' && status !== 'VOID'
})

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const amount = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${value < 0 ? '-' : ''}฿${amount}`
}

function formatAdjustment(adjustment: { calculation: string | null, value: number | null }) {
  if (adjustment.value === null) return '—'
  if (adjustment.calculation === 'PERCENT') return `${adjustment.value}%`
  return formatMoney(adjustment.value)
}

// A silent reload keeps the current invoice on screen; it refreshes payments and
// balance after returning from the payment form.
async function loadInvoice(silent = false) {
  const requestId = ++latestRequest
  if (!silent) {
    loading.value = true
    error.value = null
    notFound.value = false
    invoice.value = null
    proofUrl.value = null
    printSuccess.value = null
    printError.value = null
  }

  try {
    const result = await getInvoiceDetail(props.invoiceNumber)
    if (requestId !== latestRequest) return
    if (!result) {
      notFound.value = true
      return
    }
    invoice.value = result
  } catch (loadError) {
    if (requestId !== latestRequest || silent) return
    if (loadError instanceof InvalidInvoiceNumberError) {
      notFound.value = true
      return
    }
    error.value = 'Unable to load invoice'
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}

async function handlePrint() {
  if (!invoice.value || printing.value) return

  const invoiceNumber = invoice.value.invoiceNumber
  printing.value = true
  printSuccess.value = null
  printError.value = null

  try {
    const result = await printInvoice(invoiceNumber)
    if (invoice.value?.invoiceNumber !== invoiceNumber) return
    printSuccess.value = `ส่งคำขอพิมพ์ไปยัง ${result.printerName} แล้ว`
  } catch (reason) {
    if (invoice.value?.invoiceNumber !== invoiceNumber) return
    if (reason instanceof ApiError && reason.status === 422) {
      printError.value = 'เลขที่ใบแจ้งหนี้ไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง'
    } else if (reason instanceof ApiError && reason.status === 502) {
      printError.value = 'ไม่สามารถติดต่อเครื่องพิมพ์ได้ กรุณาตรวจสอบเครื่องพิมพ์แล้วลองอีกครั้ง'
    } else {
      printError.value = 'ไม่สามารถส่งคำขอพิมพ์ได้ กรุณาตรวจสอบเครื่องพิมพ์ก่อนลองอีกครั้ง'
    }
  } finally {
    printing.value = false
  }
}

watch(() => props.invoiceNumber, () => loadInvoice(), { immediate: true })

let activatedBefore = false
onActivated(() => {
  if (activatedBefore && invoice.value) void loadInvoice(true)
  activatedBefore = true
})

function openRecordPayment() {
  if (!invoice.value) return
  void router.push(invoicePaymentCreateRoute(invoice.value.invoiceNumber))
}

function openPaymentReview(paymentId: string) {
  if (!invoice.value) return
  void router.push(invoicePaymentReviewRoute(invoice.value.invoiceNumber, paymentId))
}
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
          class="rounded-xl bg-primary px-4 py-2 font-label text-[12px] font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
          @click="loadInvoice()"
        >
          Retry
        </button>
      </main>

      <main v-else-if="notFound || !invoice" class="flex flex-1 flex-col items-center justify-center gap-3" role="status">
        <span class="material-symbols-outlined text-5xl text-error" aria-hidden="true">receipt_long</span>
        <p class="text-sm text-on-surface-variant">Invoice not found</p>
      </main>

      <template v-else>
        <ScrollRegion as="main">
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
                  <BaseBadge class="whitespace-nowrap" :label="formatSheetDate(invoice.issuedDate)" size="lg" tone="brand" />
                </div>
                <div class="flex items-center gap-2">
                  <p class="whitespace-nowrap font-label text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Due</p>
                  <BaseBadge class="whitespace-nowrap" :label="formatSheetDate(invoice.dueDate)" size="lg" tone="brand" />
                </div>
                <div
                  v-if="invoice.billingPeriodStart || invoice.billingPeriodEnd"
                  class="flex items-center gap-2"
                >
                  <p class="whitespace-nowrap font-label text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Billing</p>
                  <BaseBadge class="whitespace-nowrap" :label="`${formatSheetDate(invoice.billingPeriodStart)} – ${formatSheetDate(invoice.billingPeriodEnd)}`" size="lg" tone="brand" />
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
                      <span class="shrink-0 font-body text-[11px]" :class="(adjustment.value ?? 0) < 0 ? 'text-on-success-container' : 'text-on-surface-variant'">
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
                  @review="openPaymentReview"
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
                    <span class="shrink-0 font-body text-[13px]" :class="(adjustment.value ?? 0) < 0 ? 'text-on-success-container' : 'text-on-surface'">
                      {{ formatAdjustment(adjustment) }}
                    </span>
                  </div>
                </template>
                <div v-else class="flex items-center justify-between gap-3 py-0.5">
                  <span class="font-body text-[13px] leading-snug text-on-surface-variant">Adjustments</span>
                  <span class="shrink-0 font-body text-[13px]" :class="invoice.adjustmentTotal < 0 ? 'text-on-success-container' : 'text-on-surface'">
                    {{ formatMoney(invoice.adjustmentTotal) }}
                  </span>
                </div>

                <div class="flex items-center justify-between gap-3 py-0.5">
                  <span class="font-body text-[13px] leading-snug text-on-surface-variant">Paid</span>
                  <span class="shrink-0 font-body text-[13px]" :class="invoice.paidAmount > 0 ? 'text-on-success-container' : 'text-on-surface'">
                    {{ formatMoney(invoice.paidAmount > 0 ? -invoice.paidAmount : invoice.paidAmount) }}
                  </span>
                </div>

                <div class="mt-2 flex items-center justify-between gap-3 border-t border-outline-variant/25 pt-2">
                  <span class="font-headline text-[14px] font-bold leading-snug text-on-surface">Total due</span>
                  <span class="shrink-0 font-headline text-[18px] font-bold" :class="invoice.balanceDue > 0 ? 'text-error' : 'text-on-success-container'">
                    {{ formatMoney(invoice.balanceDue) }}
                  </span>
                </div>
              </div>
            </InvoiceSectionCard>
          </div>
        </ScrollRegion>

        <footer class="z-40 flex-none border-t border-outline-variant/20 bg-surface px-4 pb-4 pt-3">
          <p
            v-if="printSuccess"
            class="mb-2 rounded-xl bg-success-container px-3 py-2 font-body text-xs text-on-success-container"
            role="status"
          >
            {{ printSuccess }}
          </p>
          <p
            v-else-if="printError"
            class="mb-2 rounded-xl bg-error-container px-3 py-2 font-body text-xs text-on-error-container"
            role="alert"
          >
            {{ printError }}
          </p>
          <div class="flex w-full gap-2.5">
            <button
              type="button"
              class="flex h-[49px] min-w-0 flex-1 basis-0 items-center justify-center gap-2 rounded-[10px] bg-primary px-3 text-on-primary shadow-[0_4px_0_color-mix(in_srgb,var(--color-primary)_55%,black)] transition-all hover:bg-primary/90 active:translate-y-[2px] active:shadow-[0_2px_0_color-mix(in_srgb,var(--color-primary)_55%,black)] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/60 disabled:cursor-wait disabled:opacity-60"
              :disabled="printing"
              :aria-busy="printing"
              @click="handlePrint"
            >
              <span
                class="material-symbols-outlined shrink-0 text-[20px] leading-none"
                :class="{ 'animate-spin': printing }"
                aria-hidden="true"
              >{{ printing ? 'progress_activity' : 'print' }}</span>
              <span class="truncate font-headline text-[14px] font-extrabold">{{ printing ? 'Printing…' : 'Print' }}</span>
            </button>
            <button
              v-if="canRecordPayment"
              type="button"
              class="flex h-[49px] min-w-0 flex-1 basis-0 items-center justify-center gap-2 rounded-[10px] border border-lime bg-lime px-3 text-on-surface shadow-[0_4px_0_var(--color-on-secondary-container)] transition-all hover:brightness-95 active:translate-y-[2px] active:shadow-[0_2px_0_var(--color-on-secondary-container)] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/60 focus-visible:ring-offset-2"
              @click="openRecordPayment"
            >
              <span class="material-symbols-outlined shrink-0 text-[20px] leading-none" aria-hidden="true">payments</span>
              <span class="truncate font-headline text-[14px] font-extrabold">Record payment</span>
            </button>
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
