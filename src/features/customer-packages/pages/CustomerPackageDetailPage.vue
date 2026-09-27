<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { z } from 'zod'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import CustomerPackageSummaryCard from '../components/CustomerPackageSummaryCard.vue'
import { formatSheetDateTime, normalizeSheetDate } from '@/shared/utils/sheet-date'
import { customerPackageDetailResponseSchema, packageCreditMovementTypeSchema } from '@contracts/customer-packages/customer-package-api.schema'
import { getCustomerPackageDetail, getCustomerPackages, type CustomerPackageListItem } from '@/data/customer-packages/customer-package.service'
import { listWorkOrders, type WorkOrderListDto } from '@/data/work-orders/work-order.service'
import { appendPackageTransaction } from '@/data/package-transactions/package-transaction.service'
import CustomerPackageTransactionForm from '../components/CustomerPackageTransactionForm.vue'
import { useCustomerPackageTransactionRoute } from '../composables/useCustomerPackageTransactionRoute'
import { currentActor } from '@/shared/config/actor'
import { useCustomerStore } from '@/data/customers/customer.store'

type CustomerPackageDetail = z.infer<typeof customerPackageDetailResponseSchema>
type TransactionType = z.infer<typeof packageCreditMovementTypeSchema>
const props = defineProps<{ customerPackageId: string }>()
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
const selectedTransaction = computed(() => customerPackage.value?.transactions.find(
  (item) => item.id === selectedTransactionId.value && item.type !== 'PURCHASE' && item.type !== 'VOID'
    && !customerPackage.value?.transactions.some((transaction) => transaction.type === 'VOID' && transaction.referenceId === item.id),
))
const validCredits = computed(() => /^\d+$/.test(credits.value) && Number.isSafeInteger(Number(credits.value)) && Number(credits.value) > 0)
const canSubmit = computed(() => {
  if (!customerPackage.value || transactionRetryBlocked.value || transactionType.value === 'TRANSFER') return false
  if (transactionType.value === 'EXPIRE') return customerPackage.value.remainingCredit > 0
  if (transactionType.value === 'VOID') return !!selectedTransaction.value && selectedTransaction.value.creditChange !== 0
  if (!validCredits.value) return false
  if ((transactionType.value === 'USAGE' || (transactionType.value === 'ADJUSTMENT' && adjustmentDirection.value === 'DEDUCT'))
    && Number(credits.value) > customerPackage.value.remainingCredit) return false
  if (transactionType.value === 'ADJUSTMENT') return !!transactionNotes.value.trim()
  return !!orders.value.find((order) => order.orderId === selectedOrderId.value)
})
const submitDisabled = computed(() => !canSubmit.value)

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
    referenceSource: type === 'USAGE' || type === 'REFUND' ? 'ORDER' : type === 'VOID' ? 'PackageTransactions' : null,
    referenceId: type === 'USAGE' || type === 'REFUND' ? selectedOrderId.value : type === 'VOID' ? selectedTransactionId.value : null,
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
  } catch {
    if (requestId === latestRequest) error.value = 'Unable to load customer package'
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}
async function submitTransaction() {
  if (!customerPackage.value || submitDisabled.value || submittingTransaction.value) return
  submittingTransaction.value = true
  transactionResult.value = null
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
</script>

<template>
  <AppLayout>
    <main v-if="loading" class="flex flex-1 items-center justify-center font-body text-sm text-on-surface-variant">Loading customer package…</main>
    <main v-else-if="error || notFound || !customerPackage" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><p class="font-body text-sm text-on-surface-variant">{{ error ?? 'Customer package not found' }}</p><button type="button" class="rounded-xl bg-primary px-4 py-2 font-label text-xs text-on-primary" @click="loadDetail">Retry</button></main>
    <ScrollRegion v-else as="main" class="bg-surface pb-20">
      <CustomerPackageSummaryCard class="mt-4" :customer-package="customerPackage" :customer-index="customerIndex" />
      <ListContainer class="mt-3" title="Recent activity" icon="history" count-label="entries"><template #actions><button type="button" class="rounded-full bg-surface-container px-2.5 py-1 font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-lime/30" @click="openTransaction">Add transaction</button></template><ol class="divide-y divide-outline-variant/20 px-4"><li v-for="transaction in customerPackage.transactions" :key="transaction.id" class="flex gap-3 py-3"><span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /><div class="min-w-0 flex-1"><p class="font-body text-sm font-semibold text-on-surface">{{ transactionLabels[transaction.type] }}</p><p class="font-body text-xs text-on-surface-variant">{{ transaction.referenceSource ?? 'No reference' }}<template v-if="transaction.referenceId"> · {{ transaction.referenceId }}</template><template v-if="transaction.notes"> · {{ transaction.notes }}</template></p></div><div class="text-right"><p class="font-body text-xs font-semibold" :class="transaction.creditChange > 0 ? 'text-secondary' : 'text-primary'">{{ transaction.creditChange > 0 ? '+' : '' }}{{ transaction.creditChange }}</p><time class="font-body text-[10px] text-on-surface-variant">{{ formatSheetDateTime(transaction.createdAt) }}</time></div></li></ol></ListContainer>
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
