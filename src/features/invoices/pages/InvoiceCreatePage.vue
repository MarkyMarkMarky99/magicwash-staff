<script setup lang="ts">
/**
 * Owns all state for the create-invoice flow: the selected order context,
 * every form field, the live totals preview, and submit/loading/result state.
 * Components below it are presentation only (props in, events out); the
 * service call is the only thing that talks to the network.
 */
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import type { CreateInvoiceRequest, CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'
import { computeInvoiceLine, computeInvoiceTotal, roundMoney } from '@contracts/invoices/invoice-calculator'
import { useInvoiceCreateIntentStore, type InvoiceCreateIntentOrder } from '@/shared/stores/invoice-create-intent.store'
import { useSelectedCustomerStore } from '@/shared/stores/selected-customer.store'
import AppLayout from '@/layouts/AppLayout.vue'
import FormInput from '@/shared/components/FormInput.vue'
import {
  createEmptyAdjustmentRow,
  createEmptyLineItemRow,
  type AdjustmentFormRow,
  type LineItemFormRow,
} from '../types/invoice-create.types'
import { createInvoice } from '../services/invoice.service'
import { canRetryInvoiceOutcome, synthesizeNetworkFailureOutcome } from '../utils/invoice-outcome.utils'
import InvoiceLineItemsEditor from '../components/InvoiceLineItemsEditor.vue'
import InvoiceAdjustmentsEditor from '../components/InvoiceAdjustmentsEditor.vue'
import InvoiceTotalsPreview from '../components/InvoiceTotalsPreview.vue'
import { loadInvoiceCreateContext } from '../services/invoice-create-context.service'
import { addSheetDateDays, sheetDateDaysBetween, todaySheetDate } from '@/shared/utils/sheet-date'

const router = useRouter()
const route = useRoute()

// ── Order/customer context ───────────────────────────────────────────────────
const order = ref<InvoiceCreateIntentOrder | null>(null)
const selectedCustomerStore = useSelectedCustomerStore()
const invoiceCreateIntentStore = useInvoiceCreateIntentStore()
const { customer } = storeToRefs(selectedCustomerStore)
const contextLoading = ref(false)
const contextError = ref<string | null>(null)
let contextRequestId = 0

function todayIso(): string {
  return todaySheetDate()
}

function addDays(iso: string, days: number): string {
  return addSheetDateDays(iso, days)
}

/**
 * Pre-fills the invoice number field with INV + 2-digit year + 2-digit month
 * + 8 random digits, e.g. INV260729XXXXXXXX. This is a starting suggestion,
 * not an assignment — the field stays a plain editable text input and staff
 * may overwrite it entirely. The server treats whatever string ends up here
 * as opaque and stores it verbatim; nothing downstream depends on this format.
 */
function generateSuggestedInvoiceNumber(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  let digits = ''
  for (let i = 0; i < 8; i++) {
    digits += String(Math.floor(Math.random() * 10))
  }
  return `INV${yy}${mm}${digits}`
}

// ── Form state ───────────────────────────────────────────────────────────────
const invoiceNumber = ref(generateSuggestedInvoiceNumber())
const issuedDate = ref(todayIso())
const dueDate = ref(addDays(issuedDate.value, 3))
const items = ref<LineItemFormRow[]>([])
const invoiceAdjustments = ref<AdjustmentFormRow[]>([])

// ── Due date must always be after issued date; default is issued + 3 days.
//    Staff may shorten it, but never to or below the issued date. Changing
//    the issued date re-defaults the due date whenever the old one is no
//    longer valid against the new issued date. ──
const minDueDate = computed(() => addDays(issuedDate.value, 1))

watch(issuedDate, (newIssuedDate, oldIssuedDate) => {
  if (dueDate.value <= newIssuedDate) {
    dueDate.value = addDays(newIssuedDate, 3)
    return
  }
  // Still valid against the new issued date — preserve the staff's chosen gap.
  const gapDays = sheetDateDaysBetween(dueDate.value, oldIssuedDate) ?? 3
  dueDate.value = addDays(newIssuedDate, gapDays)
})

function addLine() {
  items.value = [...items.value, createEmptyLineItemRow()]
}

function addInvoiceAdjustment() {
  invoiceAdjustments.value = [...invoiceAdjustments.value, createEmptyAdjustmentRow()]
}

// ── Derived: adjustments parsed to real numbers, dropping empty/zero rows ──
function toRealAdjustments(rows: AdjustmentFormRow[]) {
  return rows
    .map((row) => ({
      label: row.label.trim(),
      calculation: row.calculation,
      value: Number(row.value),
      refSource: row.refSource.trim(),
      refCode: row.refCode.trim(),
    }))
    .filter((a) => a.label && Number.isFinite(a.value) && a.value !== 0)
    .map((a) => ({
      label: a.label,
      calculation: a.calculation,
      value: a.value,
      ...(a.refSource && a.refCode ? { refSource: a.refSource, refCode: a.refCode } : {}),
    }))
}

// ── Live totals preview — imports the ONE shared calculator, never reimplemented ──
const lineCalculations = computed(() =>
  items.value.map((item) =>
    computeInvoiceLine({
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      adjustments: toRealAdjustments(item.adjustments),
    }),
  ),
)

const itemsTotal = computed(() =>
  roundMoney(lineCalculations.value.reduce((sum, calc) => sum + calc.netTotal, 0)),
)

const invoiceTotal = computed(() =>
  computeInvoiceTotal(
    lineCalculations.value.map((calc) => calc.netTotal),
    toRealAdjustments(invoiceAdjustments.value),
  ),
)

// ── Validity: every line needs a description, unit, positive quantity, and a
//    unit price the staff has actually typed (order items carry no price). ──
const isValid = computed(() => {
  if (!order.value || !customer.value) return false
  if (!invoiceNumber.value.trim() || !issuedDate.value || !dueDate.value) return false
  if (dueDate.value <= issuedDate.value) return false
  if (items.value.length === 0) return false
  return items.value.every((item) =>
    item.description.trim().length > 0
    && item.unit.trim().length > 0
    && Number(item.quantity) > 0
    && item.unitPrice.trim() !== ''
    && Number.isFinite(Number(item.unitPrice)),
  )
})

// ── Build the exact request the service sends ─────────────────────────────
const requestPayload = computed<CreateInvoiceRequest | null>(() => {
  if (!order.value || !customer.value) return null

  return {
    invoiceNumber: invoiceNumber.value.trim(),
    sourceOrderId: order.value.orderId,
    issuedDate: issuedDate.value,
    dueDate: dueDate.value,
    customer: {
      customerCode: customer.value.customerId,
      customerName: customer.value.customerName,
      ...(customer.value.phone ? { phone: customer.value.phone } : {}),
      ...(customer.value.address ? { address: customer.value.address } : {}),
    },
    adjustments: toRealAdjustments(invoiceAdjustments.value),
    items: items.value.map((item) => ({
      description: item.description.trim(),
      unit: item.unit.trim(),
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      adjustments: toRealAdjustments(item.adjustments),
    })),
  }
})

// ── Submit ───────────────────────────────────────────────────────────────────
const submitting = ref(false)
const result = ref<CreateInvoiceResponse | null>(null)

function initializeForm(currentOrder: InvoiceCreateIntentOrder) {
  order.value = currentOrder
  invoiceNumber.value = generateSuggestedInvoiceNumber()
  issuedDate.value = todayIso()
  dueDate.value = addDays(issuedDate.value, 3)
  invoiceAdjustments.value = []
  result.value = null
  submitting.value = false

  items.value = currentOrder.items.length > 0
    ? currentOrder.items.map((item) => ({
      key: crypto.randomUUID(),
      description: item.description ?? '',
      unit: 'piece',
      unitOption: 'piece',
      quantity: item.quantity != null ? String(item.quantity) : '1',
      unitPrice: '',
      adjustments: [],
    }))
    : [createEmptyLineItemRow()]
}

function readRouteId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim() || null
}

async function syncCreateContext() {
  const requestId = ++contextRequestId
  const customerId = readRouteId(route.query.customerId)
  const orderId = readRouteId(route.query.orderId)

  contextError.value = null
  if (!customerId || !orderId) {
    contextLoading.value = false
    order.value = null
    items.value = []
    return
  }

  const stagedOrder = invoiceCreateIntentStore.order
  const stagedCustomer = selectedCustomerStore.customer
  if (
    stagedOrder?.orderId.trim() === orderId
    && stagedOrder.customerId.trim() === customerId
    && stagedCustomer?.customerId.trim() === customerId
  ) {
    contextLoading.value = false
    initializeForm(stagedOrder)
    return
  }

  contextLoading.value = true
  order.value = null
  items.value = []

  try {
    const context = await loadInvoiceCreateContext(customerId, orderId)
    if (requestId !== contextRequestId) return

    selectedCustomerStore.select(context.customer)
    invoiceCreateIntentStore.set(context.order)
    initializeForm(context.order)
  } catch {
    if (requestId !== contextRequestId) return
    contextError.value = 'Unable to load the selected customer and order.'
  } finally {
    if (requestId === contextRequestId) {
      contextLoading.value = false
    }
  }
}

watch(
  [() => route.query.customerId, () => route.query.orderId],
  () => {
    void syncCreateContext()
  },
  { immediate: true },
)

function retryContextLoad() {
  void syncCreateContext()
}

// See `canRetryInvoiceOutcome` (utils/invoice-outcome.utils.ts) for the full
// retry-eligibility policy and why it keys off `certainty`, not just `kind`.
const canRetry = computed(() => canRetryInvoiceOutcome(result.value))

async function handleSubmit() {
  if (!isValid.value || submitting.value || !requestPayload.value) return
  submitting.value = true
  result.value = null
  try {
    result.value = await createInvoice(requestPayload.value)
  } catch {
    // A network-level failure (not a modeled `kind`) — see
    // `synthesizeNetworkFailureOutcome`'s doc comment for why this is always
    // `certainty: 'unknown'`, never `'rejected'`.
    result.value = synthesizeNetworkFailureOutcome()
  } finally {
    submitting.value = false
  }
}

function resetForRetry() {
  result.value = null
}

function backToOrderHistory() {
  const customerId = order.value?.customerId.trim() ?? readRouteId(route.query.customerId)
  if (customerId) {
    router.push({ name: 'customer-order-history', params: { customerId } })
  } else {
    router.push({ name: 'customer-list' })
  }
}

function goToInvoiceList() {
  router.push({ name: 'invoice-list' })
}

// ── Post-create: LIFF link staff can hand straight to the customer ─────────
const copied = ref(false)

function liffUrl(invoiceNumber: string): string {
  return `https://magicwash-liff.vercel.app/?invoiceNumber=${encodeURIComponent(invoiceNumber)}`
}

async function copyLiffUrl(invoiceNumber: string) {
  await navigator.clipboard.writeText(liffUrl(invoiceNumber))
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <AppLayout>
  <main class="flex-1 overflow-y-auto bg-surface pb-24">
    <div v-if="contextLoading" class="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span class="material-symbols-outlined animate-spin text-[40px] text-primary" aria-hidden="true">progress_activity</span>
      <h1 class="font-headline text-base font-bold text-on-surface">Loading order</h1>
      <p class="max-w-xs font-body text-sm text-on-surface-variant">
        Restoring the customer and order selected from order history.
      </p>
    </div>

    <div v-else-if="contextError" class="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span class="material-symbols-outlined text-[40px] text-error" aria-hidden="true">error</span>
      <h1 class="font-headline text-base font-bold text-on-surface">Could not load this order</h1>
      <p class="max-w-xs font-body text-sm text-on-surface-variant">{{ contextError }}</p>
      <div class="mt-2 flex gap-2">
        <button
          type="button"
          class="rounded-xl bg-primary px-4 py-2 font-label text-[12px] font-semibold text-on-primary"
          @click="retryContextLoad"
        >
          Try again
        </button>
        <button
          type="button"
          class="rounded-xl bg-surface-container px-4 py-2 font-label text-[12px] font-semibold text-primary"
          @click="backToOrderHistory"
        >
          Back to order history
        </button>
      </div>
    </div>

    <!-- No route ids: someone navigated here directly rather than from an order. -->
    <div v-else-if="!order || !customer" class="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span class="material-symbols-outlined text-[40px] text-on-surface-variant/50" aria-hidden="true">receipt_long</span>
      <h1 class="font-headline text-base font-bold text-on-surface">No order selected</h1>
      <p class="max-w-xs font-body text-sm text-on-surface-variant">
        Open a customer's order history and choose "Create Invoice" on the order you want to bill.
      </p>
      <button
        type="button"
        class="mt-2 rounded-xl bg-primary px-4 py-2 font-label text-[12px] font-semibold text-on-primary"
        @click="goToInvoiceList"
      >
        Go to invoices
      </button>
    </div>

    <!-- Result state: submitted, show one of the six distinct outcomes. -->
    <div v-else-if="result" class="space-y-4 px-4 pt-5">
      <section
        v-if="result.kind === 'created'"
        class="space-y-3 rounded-2xl border border-secondary/30 bg-secondary-container/15 p-5 text-center"
      >
        <span class="material-symbols-outlined text-[36px] text-secondary" aria-hidden="true">task_alt</span>
        <h1 class="font-headline text-base font-bold text-on-surface">Invoice created</h1>
        <p class="font-body text-sm text-on-surface-variant">
          {{ result.invoiceNumber }} · {{ result.itemCount }} line{{ result.itemCount === 1 ? '' : 's' }}
        </p>
        <p class="font-headline text-xl font-bold text-primary">
          ฿{{ result.invoiceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
        </p>

        <div class="flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-left">
          <span class="min-w-0 flex-1 truncate font-body text-xs text-on-surface-variant">{{ liffUrl(result.invoiceNumber) }}</span>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-label text-[11px] font-semibold text-on-primary"
            @click="copyLiffUrl(result.invoiceNumber)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">{{ copied ? 'check' : 'content_copy' }}</span>
            {{ copied ? 'Copied' : 'Copy link' }}
          </button>
        </div>

        <div class="flex flex-col gap-2 pt-2">
          <button type="button" class="rounded-xl bg-primary px-4 py-2.5 font-label text-[12px] font-semibold text-on-primary" @click="backToOrderHistory">
            Back to order history
          </button>
          <button type="button" class="rounded-xl bg-surface-container px-4 py-2.5 font-label text-[12px] font-semibold text-primary" @click="goToInvoiceList">
            View invoices
          </button>
        </div>
      </section>

      <section
        v-else-if="result.kind === 'validation_error'"
        class="space-y-3 rounded-2xl border border-error/30 bg-error-container/20 p-5"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[24px] text-error" aria-hidden="true">error</span>
          <h1 class="font-headline text-base font-bold text-on-surface">Fix these fields and resubmit</h1>
        </div>
        <p class="font-body text-xs text-on-surface-variant">Nothing was written — this invoice was never created.</p>
        <ul class="space-y-1.5">
          <li v-for="(issue, i) in result.issues" :key="i" class="font-body text-sm text-on-surface">
            <span class="font-semibold text-error">{{ issue.path }}</span>: {{ issue.message }}
          </li>
        </ul>
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-[12px] font-semibold text-on-primary" @click="resetForRetry">
          Back to the form
        </button>
      </section>

      <!-- The condition here IS `canRetry` (canRetryInvoiceOutcome), not a
           re-typed copy of its rule — this is the exact function the footnote
           below and the frontend Layer 5 test both exercise, so the tested
           thing is the real thing driving whether "Try again" renders at all. -->
      <section
        v-else-if="result.kind === 'items_write_failed' && canRetry"
        class="space-y-3 rounded-2xl border border-error/30 bg-error-container/20 p-5"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[24px] text-error" aria-hidden="true">error</span>
          <h1 class="font-headline text-base font-bold text-on-surface">Nothing was saved</h1>
        </div>
        <p class="font-body text-sm text-on-surface-variant">{{ result.message }}</p>
        <p class="font-body text-xs text-on-surface-variant">Safe to try again — no invoice or line items were written.</p>
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-[12px] font-semibold text-on-primary" @click="resetForRetry">
          Try again
        </button>
      </section>

      <!-- No definite answer ever came back — the batch may already be in the
           sheet. NEVER a "Try again" button, NEVER the "Nothing was saved"
           heading: this must route to manual reconciliation, the same as the
           other never-retry outcomes below. `!canRetry` here is exactly
           `certainty === 'unknown'` (the only other value items_write_failed
           carries), driven by the same shared policy function as above. -->
      <section
        v-else-if="result.kind === 'items_write_failed' && !canRetry"
        class="space-y-3 rounded-2xl border border-tertiary/40 bg-tertiary-container/15 p-5"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[24px] text-tertiary" aria-hidden="true">help</span>
          <h1 class="font-headline text-base font-bold text-on-surface">Outcome unconfirmed</h1>
        </div>
        <p class="font-body text-sm text-on-surface-variant">{{ result.message }}</p>
        <p class="font-body text-xs font-semibold text-tertiary">
          We could not confirm whether the line items were written. Check InvoiceItems for
          <span class="font-semibold text-on-surface">{{ invoiceNumber }}</span> before resubmitting —
          do not just try again, or you may double every line item.
        </p>
        <button type="button" class="w-full rounded-xl bg-surface-container px-4 py-2.5 font-label text-[12px] font-semibold text-primary" @click="backToOrderHistory">
          Back to order history
        </button>
      </section>

      <section
        v-else-if="result.kind === 'invoice_write_failed'"
        class="space-y-3 rounded-2xl border border-tertiary/40 bg-tertiary-container/15 p-5"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[24px] text-tertiary" aria-hidden="true">warning</span>
          <h1 class="font-headline text-base font-bold text-on-surface">Needs a person to fix this</h1>
        </div>
        <p class="font-body text-sm text-on-surface-variant">
          The {{ result.itemCount }} line item{{ result.itemCount === 1 ? '' : 's' }} for
          <span class="font-semibold text-on-surface">{{ result.invoiceNumber }}</span> were saved, but the invoice
          record itself failed to write.
        </p>
        <p class="font-body text-xs font-semibold text-error">
          Do not resubmit — that would save a second set of line items. Tell an admin about {{ result.invoiceNumber }}.
        </p>
        <button type="button" class="w-full rounded-xl bg-surface-container px-4 py-2.5 font-label text-[12px] font-semibold text-primary" @click="backToOrderHistory">
          Back to order history
        </button>
      </section>

      <section
        v-else-if="result.kind === 'order_link_failed'"
        class="space-y-3 rounded-2xl border border-secondary/30 bg-secondary-container/15 p-5"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[24px] text-secondary" aria-hidden="true">task_alt</span>
          <h1 class="font-headline text-base font-bold text-on-surface">Invoice created — one link is stale</h1>
        </div>
        <p class="font-body text-sm text-on-surface-variant">
          <span class="font-semibold text-on-surface">{{ result.invoiceNumber }}</span> is fully recorded and the
          money is correct. Only the note on order <span class="font-semibold text-on-surface">{{ result.sourceOrderId }}</span>
          pointing back to it didn't save.
        </p>
        <p class="font-body text-xs font-semibold text-tertiary">
          Do not resubmit — that would bill this order twice. Tell an admin to link
          {{ result.sourceOrderId }} to {{ result.invoiceNumber }} by hand.
        </p>
        <button type="button" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-[12px] font-semibold text-on-primary" @click="backToOrderHistory">
          Back to order history
        </button>
      </section>

      <section
        v-else-if="result.kind === 'invoice_view_sync_failed'"
        class="space-y-3 rounded-2xl border border-tertiary/40 bg-tertiary-container/15 p-5"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[24px] text-tertiary" aria-hidden="true">sync_problem</span>
          <h1 class="font-headline text-base font-bold text-on-surface">Invoice created — view needs a refresh</h1>
        </div>
        <p class="font-body text-sm text-on-surface-variant">
          <span class="font-semibold text-on-surface">{{ result.invoiceNumber }}</span> was saved successfully,
          but the invoice view could not be synchronized.
        </p>
        <p class="font-body text-xs text-on-surface-variant">{{ result.message }}</p>
        <p class="font-body text-xs font-semibold text-tertiary">
          Do not resubmit — that would create a duplicate invoice.
        </p>

        <div class="flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-left">
          <span class="min-w-0 flex-1 truncate font-body text-xs text-on-surface-variant">{{ liffUrl(result.invoiceNumber) }}</span>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-label text-[11px] font-semibold text-on-primary"
            @click="copyLiffUrl(result.invoiceNumber)"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">{{ copied ? 'check' : 'content_copy' }}</span>
            {{ copied ? 'Copied' : 'Copy link' }}
          </button>
        </div>

        <button type="button" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-[12px] font-semibold text-on-primary" @click="goToInvoiceList">
          View invoices
        </button>
      </section>

      <p v-if="canRetry" class="text-center font-body text-[11px] text-on-surface-variant/70">
        (retry re-shows the form with everything you typed still in place)
      </p>

    </div>

    <!-- The form itself. -->
    <form v-else class="space-y-5 px-4 py-5" @submit.prevent="handleSubmit">
      <header class="space-y-1 border-b border-outline-variant/40 pb-3 text-center">
        <p class="font-headline text-xl font-bold tracking-tight text-on-surface">#{{ invoiceNumber }}</p>
      </header>

      <section class="space-y-1 rounded-2xl bg-surface-container-low px-4 py-3">
        <p class="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">Billing</p>
        <p class="font-headline text-sm font-bold text-on-surface">{{ customer.customerName }}</p>
        <p class="font-body text-xs text-on-surface-variant">
          {{ customer.customerId }}<template v-if="customer.phone"> · {{ customer.phone }}</template>
        </p>
        <p v-if="customer.address" class="font-body text-xs text-on-surface-variant">{{ customer.address }}</p>
        <p class="mt-1 font-body text-xs text-on-surface-variant">Order <span class="font-semibold text-on-surface">{{ order.orderId }}</span></p>
      </section>

      <section class="grid grid-cols-2 gap-3">
        <FormInput id="invoice-issued-date" v-model="issuedDate" type="date" label="Issued date" icon="event" />
        <FormInput id="invoice-due-date" v-model="dueDate" type="date" label="Due date" icon="event_available" :min="minDueDate" />
      </section>

      <InvoiceLineItemsEditor v-model="items" @add-line="addLine" />

      <InvoiceAdjustmentsEditor
        v-model="invoiceAdjustments"
        label="Invoice-level adjustments"
        @add="addInvoiceAdjustment"
      />

      <InvoiceTotalsPreview
        :item-count="items.length"
        :items-total="itemsTotal"
        :invoice-total="invoiceTotal"
      />

      <button
        type="submit"
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-label text-[13px] font-semibold text-on-primary transition-all disabled:opacity-40"
        :disabled="!isValid || submitting"
      >
        <span v-if="submitting" class="material-symbols-outlined animate-spin text-[18px]" aria-hidden="true">progress_activity</span>
        {{ submitting ? 'Creating invoice…' : 'Create invoice' }}
      </button>
    </form>
  </main>
  </AppLayout>
</template>
