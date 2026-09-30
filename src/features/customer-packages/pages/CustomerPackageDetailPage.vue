<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { z } from 'zod'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import CustomerPackageSummaryCard from '../components/CustomerPackageSummaryCard.vue'
import { formatSheetDate, normalizeSheetDate } from '@/shared/utils/sheet-date'
import { customerPackageDetailResponseSchema, packageCreditMovementTypeSchema } from '@contracts/customer-packages/customer-package-api.schema'
import { getCustomerPackageDetail, getCustomerPackages, type CustomerPackageListItem } from '@/data/customer-packages/customer-package.service'
import { listWorkOrders, type WorkOrderListDto } from '@/data/work-orders/work-order.service'
import { appendPackageTransaction } from '@/data/package-transactions/package-transaction.service'
import { getOrderCreditUsage, confirmOrderCreditUsage, type OrderCreditUsagePreview } from '@/data/customer-packages/order-credit-usage.service'
import CustomerPackageTransactionForm from '../components/CustomerPackageTransactionForm.vue'
import { useCustomerPackageTransactionRoute } from '../composables/useCustomerPackageTransactionRoute'
import { currentActor } from '@/shared/config/actor'
import { useCustomerStore } from '@/data/customers/customer.store'
import { packageInvoiceCreateRoute } from '@/shared/navigation/form-routes'
import { getRenewalTransfers, transferRenewalCredits, type RenewalTransferStatus } from '@/data/customer-packages/package-renewal.service'
import { getPackageBillPreview, settlePackageOverage } from '@/data/customer-packages/package-billing.service'

type CustomerPackageDetail = z.infer<typeof customerPackageDetailResponseSchema>
type TransactionType = z.infer<typeof packageCreditMovementTypeSchema>
const props = defineProps<{ customerPackageId: string }>()
const router = useRouter()
const renewalTransfers = ref<RenewalTransferStatus[]>([])
const renewalError = ref('')
const renewing = ref(false)
const pendingOverage = ref<{ invoiceNumber: string; credits: number } | null>(null)
const settlingOverage = ref(false)
const overageError = ref('')
const customerPackage = ref<CustomerPackageDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)
const submittingTransaction = ref(false)
const transactionResult = ref<string | null>(null)
const transactionRetryBlocked = ref(false)
const transactionType = ref<TransactionType>('USAGE')
const credits = ref('')
const adjustmentDirection = ref<'ADD' | 'DEDUCT'>('ADD')
const selectedOrderId = ref('')
const usagePreview = ref<OrderCreditUsagePreview | null>(null)
const usageError = ref('')
const usageLoading = ref(false)
const selectedTransactionId = ref('')
const selectedTargetPackageId = ref('')
const orders = ref<WorkOrderListDto[]>([])
const ordersLoading = ref(false)
const ordersError = ref('')
const targetPackages = ref<CustomerPackageListItem[]>([])
const targetPackagesLoading = ref(false)
const targetPackagesError = ref('')
const transactionNotes = ref('')
let latestRequest = 0
let latestOrdersRequest = 0
let latestTargetsRequest = 0
let latestUsageRequest = 0
const { isOpen: transactionFormOpen, open: openTransactionRoute, close: closeTransactionRoute } = useCustomerPackageTransactionRoute()

const transactionTypes: readonly TransactionType[] = packageCreditMovementTypeSchema.options
const transactionLabels: Record<string, string> = {
  PURCHASE: 'Package purchased', USAGE: 'Credit used', REFUND: 'Credit refunded',
  ADJUSTMENT: 'Credit adjusted', EXPIRE: 'Credit expired', VOID: 'Transaction voided', TRANSFER: 'Credit transferred',
}
const { customers } = storeToRefs(useCustomerStore())
const customerIndex = computed(() => {
  const customerId = customerPackage.value?.customerId
  return customers.value.find((customer) => customer.customerId === customerId)?.customerIndex ?? null
})
// Newest first: the ledger arrives oldest to newest.
const recentTransactions = computed(() => [...(customerPackage.value?.transactions ?? [])].reverse())
const changeColumnClass = computed(() => customerPackage.value?.transactions.some((transaction) => Math.abs(transaction.creditChange) >= 100)
  ? 'grid-cols-[44px_minmax(0,1fr)_58px]'
  : 'grid-cols-[36px_minmax(0,1fr)_58px]')
const selectedTransaction = computed(() => customerPackage.value?.transactions.find(
  (item) => item.id === selectedTransactionId.value && item.type !== 'PURCHASE' && item.type !== 'VOID'
    && !customerPackage.value?.transactions.some((transaction) => transaction.type === 'VOID' && transaction.referenceId === item.id),
))
const validCredits = computed(() => credits.value.trim() !== '' && Number.isFinite(Number(credits.value)) && Number(credits.value) > 0)
const canSubmit = computed(() => {
  if (!customerPackage.value || transactionRetryBlocked.value || transactionType.value === 'TRANSFER') return false
  if (transactionType.value === 'USAGE') return !!usagePreview.value && !usageLoading.value && !usagePreview.value.alreadyUsed
    && (usagePreview.value.items.some((item) => !!item.noRateReason) ? validCredits.value : usagePreview.value.totalCredits > 0)
  if (transactionType.value === 'EXPIRE') return customerPackage.value.remainingCredit > 0
  if (transactionType.value === 'VOID') return !!selectedTransaction.value && selectedTransaction.value.creditChange !== 0
  if (!validCredits.value) return false
  if (transactionType.value === 'ADJUSTMENT') return !!transactionNotes.value.trim()
  return !!orders.value.find((order) => order.orderId === selectedOrderId.value)
})
const submitDisabled = computed(() => !canSubmit.value || submittingTransaction.value)

async function loadOrders() {
  const packageValue = customerPackage.value
  if (!packageValue) return
  const requestId = ++latestOrdersRequest
  orders.value = []
  ordersLoading.value = true
  ordersError.value = ''
  try {
    const all: WorkOrderListDto[] = []
    let page = 1
    while (true) {
      const result = await listWorkOrders({ customerId: packageValue.customerId, page, perPage: 500, sortBy: 'receivedDate', sortOrder: 'desc' })
      if (requestId !== latestOrdersRequest) return
      all.push(...result.items)
      if (all.length >= result.pagination.total || result.items.length === 0) break
      page += 1
    }
    orders.value = all.sort((a, b) => (normalizeSheetDate(b.receivedDate) ?? '').localeCompare(normalizeSheetDate(a.receivedDate) ?? ''))
  } catch {
    if (requestId === latestOrdersRequest) ordersError.value = 'Unable to load orders'
  } finally {
    if (requestId === latestOrdersRequest) ordersLoading.value = false
  }
}

async function loadTargetPackages() {
  const packageValue = customerPackage.value
  if (!packageValue) return
  const requestId = ++latestTargetsRequest
  targetPackages.value = []
  targetPackagesLoading.value = true
  targetPackagesError.value = ''
  try {
    const all: CustomerPackageListItem[] = []
    let page = 1
    while (true) {
      const result = await getCustomerPackages({ customerId: packageValue.customerId, status: 'ACTIVE', page, perPage: 100, keyword: '', packageCode: null, sortBy: 'startDate', sortOrder: 'desc' })
      if (requestId !== latestTargetsRequest) return
      all.push(...result.items)
      if (result.items.length < 100) break
      page += 1
    }
    targetPackages.value = all.filter((item) => item.customerPackageId !== packageValue.customerPackageId)
  } catch {
    if (requestId === latestTargetsRequest) targetPackagesError.value = 'Unable to load packages'
  } finally {
    if (requestId === latestTargetsRequest) targetPackagesLoading.value = false
  }
}

function changeTransactionType(type: TransactionType) {
  transactionType.value = type
  credits.value = ''
  adjustmentDirection.value = 'ADD'
  selectedOrderId.value = ''
  selectedTransactionId.value = ''
  selectedTargetPackageId.value = ''
  transactionNotes.value = ''
  transactionResult.value = null
}

function createPayload() {
  const packageValue = customerPackage.value!
  const type = transactionType.value
  const transaction = selectedTransaction.value
  const creditChange = type === 'EXPIRE' ? -packageValue.remainingCredit
    : type === 'VOID' ? -(transaction?.creditChange ?? 0)
      : type === 'USAGE' || (type === 'ADJUSTMENT' && adjustmentDirection.value === 'DEDUCT')
        ? -Number(credits.value) : Number(credits.value)
  return {
    customerPackageId: packageValue.customerPackageId, type, creditChange,
    referenceSource: type === 'REFUND' ? 'ORDER' : type === 'VOID' || (type === 'ADJUSTMENT' && selectedTransactionId.value) ? 'PackageTransactions' : null,
    referenceId: type === 'REFUND' ? selectedOrderId.value : type === 'VOID' || (type === 'ADJUSTMENT' && selectedTransactionId.value) ? selectedTransactionId.value : null,
    notes: transactionNotes.value.trim() || null, createdBy: readActor(),
  }
}

// Read at submit time because KeepAlive cannot make window.location.hash reactive.
function readActor(): string {
  const actor = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('by')
  return currentActor(actor)
}
async function loadDetail() {
  const requestId = ++latestRequest
  loading.value = true
  error.value = null
  notFound.value = false
  customerPackage.value = null
  try {
    const result = await getCustomerPackageDetail(props.customerPackageId)
    if (requestId !== latestRequest) return
    if (!result) notFound.value = true
    else customerPackage.value = result
    if (result) {
      const [pending, bill] = await Promise.all([getRenewalTransfers(result.customerPackageId), getPackageBillPreview(result.customerPackageId)])
      renewalTransfers.value = pending.transfers
      pendingOverage.value = bill.pendingOverage
    }
  } catch {
    if (requestId === latestRequest) error.value = 'Unable to load customer package'
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}
async function settleExistingOverage() {
  if (!customerPackage.value || !pendingOverage.value || settlingOverage.value) return
  settlingOverage.value = true
  overageError.value = ''
  try { await settlePackageOverage(customerPackage.value.customerPackageId, pendingOverage.value.invoiceNumber, readActor()); await loadDetail() }
  catch (reason) { overageError.value = reason instanceof Error ? reason.message : 'Unable to settle overage' }
  finally { settlingOverage.value = false }
}
async function repairTransfer(newPackageId: string) {
  if (!customerPackage.value || renewing.value) return
  renewing.value = true
  renewalError.value = ''
  try { await transferRenewalCredits(customerPackage.value.customerPackageId, newPackageId, readActor()); await loadDetail() }
  catch (reason) { renewalError.value = reason instanceof Error ? reason.message : 'Unable to complete transfer' }
  finally { renewing.value = false }
}
function openMonthlyBill() {
  if (customerPackage.value) void router.push(packageInvoiceCreateRoute(customerPackage.value.customerId, customerPackage.value.customerPackageId))
}
function openRenewal() {
  if (customerPackage.value) void router.push({ name: 'customer-package-create', query: { customerId: customerPackage.value.customerId, renewalFrom: customerPackage.value.customerPackageId } })
}
async function submitTransaction() {
  if (!customerPackage.value || submitDisabled.value || submittingTransaction.value) return
  submittingTransaction.value = true
  transactionResult.value = null
  if (transactionType.value === 'USAGE') {
    try {
      await confirmOrderCreditUsage(customerPackage.value.customerPackageId, selectedOrderId.value, readActor(),
        usagePreview.value?.items.some((item) => !!item.noRateReason) ? Number(credits.value) : undefined)
      await loadDetail()
      closeTransactionForm()
    } catch (reason) {
      transactionResult.value = reason instanceof Error ? reason.message : 'Unable to record usage'
      transactionRetryBlocked.value = true
    } finally { submittingTransaction.value = false }
    return
  }
  const result = await appendPackageTransaction(createPayload())
  submittingTransaction.value = false
  if (result.kind === 'created') {
    transactionResult.value = 'Transaction added. Refreshing package activity…'
    await loadDetail()
    resetTransactionForm()
    closeTransactionForm()
  } else {
    if (result.kind === 'validation_error') {
      transactionResult.value = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ')
    } else if (result.kind === 'transaction_write_failed' && result.certainty === 'unknown') {
      transactionRetryBlocked.value = true
      transactionResult.value = 'The transaction outcome needs reconciliation before another submission. It may already have been saved. Close this form and verify package activity before trying again.'
    } else {
      transactionResult.value = 'message' in result ? result.message : 'Package was not found.'
    }
  }
}
function resetTransactionForm() {
  transactionType.value = 'USAGE'
  credits.value = ''
  adjustmentDirection.value = 'ADD'
  selectedOrderId.value = ''
  usagePreview.value = null
  usageError.value = ''
  selectedTransactionId.value = ''
  selectedTargetPackageId.value = ''
  transactionNotes.value = ''
  transactionResult.value = null
  transactionRetryBlocked.value = false
}
function openTransaction() {
  resetTransactionForm()
  openTransactionRoute()
}
function closeTransactionForm() {
  resetTransactionForm()
  closeTransactionRoute()
}
watch(() => props.customerPackageId, () => { void loadDetail() }, { immediate: true })
watch([transactionFormOpen, customerPackage, transactionType], ([open, packageValue, type]) => {
  if (!open || !packageValue) return
  if (type === 'USAGE' || type === 'REFUND') void loadOrders()
  if (type === 'TRANSFER') void loadTargetPackages()
})
watch(selectedOrderId, async (orderId) => {
  const requestId = ++latestUsageRequest
  usagePreview.value = null
  if (transactionType.value === 'USAGE') credits.value = ''
  usageError.value = ''
  usageLoading.value = false
  if (!orderId || transactionType.value !== 'USAGE' || !customerPackage.value) return
  usageLoading.value = true
  try {
    const preview = await getOrderCreditUsage(customerPackage.value.customerPackageId, orderId)
    if (requestId === latestUsageRequest) {
      usagePreview.value = preview
      if (preview.items.some((item) => !!item.noRateReason) && preview.totalCredits > 0) credits.value = String(preview.totalCredits)
    }
  } catch (reason) {
    if (requestId === latestUsageRequest) usageError.value = reason instanceof Error ? reason.message : 'Unable to calculate credits'
  } finally { if (requestId === latestUsageRequest) usageLoading.value = false }
})
</script>

<template>
  <AppLayout>
    <main v-if="loading" class="flex flex-1 items-center justify-center font-body text-sm text-on-surface-variant">Loading customer package…</main>
    <main v-else-if="error || notFound || !customerPackage" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><p class="font-body text-sm text-on-surface-variant">{{ error ?? 'Customer package not found' }}</p><button type="button" class="rounded-xl bg-primary px-4 py-2 font-label text-xs text-on-primary" @click="loadDetail">Retry</button></main>
    <ScrollRegion v-else as="main" class="bg-surface pb-20">
      <CustomerPackageSummaryCard class="mt-4" :customer-package="customerPackage" :customer-index="customerIndex" />
      <p class="mx-4 mt-2 font-body text-xs text-on-surface-variant">Used {{ customerPackage.usedCredit }} · Transferred out {{ customerPackage.transferredOutCredit }} · Expired {{ customerPackage.expiredCredit }} · Overage billed {{ customerPackage.overageBilledCredit }} credits</p>
      <section class="mx-3 mt-4 grid gap-2">
        <button type="button" class="rounded-xl bg-primary px-4 py-2 font-label text-sm text-on-primary" @click="openMonthlyBill">ออกบิลรายเดือน</button>
        <button type="button" class="rounded-xl bg-surface-container px-4 py-2 font-label text-sm text-primary" :disabled="renewing" @click="openRenewal">ต่อแพ็กเกจเดือนหน้า</button>
        <div v-for="transfer in renewalTransfers.filter((item) => item.pending)" :key="transfer.referenceId" class="rounded-xl bg-warning-container px-4 py-3 font-body text-sm">
          Transfer {{ transfer.credits }} credits to {{ transfer.newPackageId }} is pending.
          <button type="button" class="ml-2 font-label font-bold text-primary" :disabled="renewing" @click="repairTransfer(transfer.newPackageId)">Write missing side</button>
        </div>
        <div v-if="pendingOverage" class="rounded-xl bg-warning-container px-4 py-3 font-body text-sm">Overage {{ pendingOverage.credits }} credits is on invoice {{ pendingOverage.invoiceNumber }}.
          <button type="button" class="ml-2 font-label font-bold text-primary" :disabled="settlingOverage" @click="settleExistingOverage">Settle existing invoice</button>
        </div>
        <p v-if="overageError" role="alert" class="font-body text-sm text-error">{{ overageError }}</p>
        <p v-if="renewalError" role="alert" class="font-body text-sm text-error">{{ renewalError }}</p>
      </section>
      <section class="mx-3 mt-5" aria-labelledby="package-activity-title">
        <header class="mb-2.5 flex items-center justify-between gap-3">
          <div class="border-l-4 border-lime pl-2.5">
            <h2 id="package-activity-title" class="font-headline text-[17px] font-extrabold tracking-[-0.03em] text-primary">Package activity</h2>
            <p class="mt-[3px] font-label text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-on-surface-variant">Credit movements</p>
          </div>
          <button type="button" class="min-h-[34px] shrink-0 rounded px-1 font-label text-[10px] font-extrabold uppercase tracking-[0.04em] text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-lime" @click="openTransaction">Add transaction</button>
        </header>
        <ol class="grid gap-2">
          <li v-for="transaction in recentTransactions" :key="transaction.id" class="grid items-center gap-2 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(7,63,56,0.05)]" :class="changeColumnClass">
            <p class="flex items-center justify-end self-stretch border-r border-outline-variant pr-1.5 font-[Manrope,sans-serif] text-[17px] font-extrabold tracking-[-0.06em] tabular-nums" :class="transaction.creditChange > 0 ? 'text-success' : 'text-primary'">{{ transaction.creditChange > 0 ? '+' : transaction.creditChange < 0 ? '−' : '' }}{{ Math.abs(transaction.creditChange) }}</p>
            <div class="min-w-0">
              <p class="truncate font-body text-sm font-extrabold leading-tight tracking-[-0.015em] text-on-surface">{{ transactionLabels[transaction.type] }}</p>
              <p class="mt-[3px] font-label text-[10px] font-semibold text-on-surface-variant">{{ formatSheetDate(transaction.createdAt) }}</p>
            </div>
            <p class="text-right font-label text-[11px] font-semibold leading-tight text-on-surface-variant"><span class="block font-[Manrope,sans-serif] text-[15px] font-bold leading-none tracking-[-0.04em] tabular-nums">{{ transaction.remainingCredit }}</span>credits</p>
          </li>
        </ol>
        <p v-if="customerPackage.transactions.length === 0" class="rounded-[14px] bg-white px-3 py-3 font-body text-[13px] text-on-surface-variant">No activity yet</p>
      </section>
      <CustomerPackageTransactionForm
        :open="transactionFormOpen"
        :movement-types="transactionTypes"
        :movement-type="transactionType"
        :credits="credits"
        :adjustment-direction="adjustmentDirection"
        :selected-order-id="selectedOrderId"
        :selected-transaction-id="selectedTransactionId"
        :selected-target-package-id="selectedTargetPackageId"
        :orders="orders"
        :orders-loading="ordersLoading"
        :orders-error="ordersError"
        :target-packages="targetPackages"
        :target-packages-loading="targetPackagesLoading"
        :target-packages-error="targetPackagesError"
        :transactions="customerPackage.transactions"
        :remaining-credit="customerPackage.remainingCredit"
        :usage-preview="usagePreview"
        :usage-loading="usageLoading"
        :usage-error="usageError"
        :notes="transactionNotes"
        :result="transactionResult"
        :result-tone="transactionRetryBlocked ? 'error' : 'success'"
        :is-submitting="submittingTransaction"
        :is-submit-disabled="submitDisabled"
        @close="closeTransactionForm"
        @submit="submitTransaction"
        @update:movement-type="changeTransactionType"
        @update:credits="credits = $event"
        @update:adjustment-direction="adjustmentDirection = $event"
        @update:selected-order-id="selectedOrderId = $event"
        @update:selected-transaction-id="selectedTransactionId = $event"
        @update:selected-target-package-id="selectedTargetPackageId = $event"
        @update:notes="transactionNotes = $event"
      />
    </ScrollRegion>
  </AppLayout>
</template>
