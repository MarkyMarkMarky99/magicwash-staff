<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { z } from 'zod'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { formatSheetDate, formatSheetDateTime } from '@/shared/utils/sheet-date'
import { customerPackageDetailResponseSchema, packageCreditMovementTypeSchema } from '@contracts/customer-packages/customer-package-api.schema'
import { appendPackageTransaction, getCustomerPackageDetail } from '../services/customer-package.service'
import CustomerPackageTransactionForm from '../components/CustomerPackageTransactionForm.vue'
import { useCustomerPackageTransactionRoute } from '../composables/useCustomerPackageTransactionRoute'

type CustomerPackageDetail = z.infer<typeof customerPackageDetailResponseSchema>
type TransactionType = z.infer<typeof packageCreditMovementTypeSchema>
import type { BadgeTone } from '@/shared/components/BaseBadge.vue'
const props = defineProps<{ customerPackageId: string }>()
const customerPackage = ref<CustomerPackageDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)
const submittingTransaction = ref(false)
const transactionResult = ref<string | null>(null)
const transactionRetryBlocked = ref(false)
const transactionType = ref<TransactionType>('USAGE')
const creditChange = ref('')
const referenceSource = ref('')
const referenceId = ref('')
const transactionNotes = ref('')
const createdBy = ref(readActor())
let latestRequest = 0
const { isOpen: transactionFormOpen, open: openTransactionRoute, close: closeTransactionRoute } = useCustomerPackageTransactionRoute()

const transactionTypes: readonly TransactionType[] = packageCreditMovementTypeSchema.options
const transactionLabels: Record<string, string> = {
  PURCHASE: 'Package purchased', USAGE: 'Credit used', REFUND: 'Credit refunded',
  ADJUSTMENT: 'Credit adjusted', EXPIRE: 'Credit expired', VOID: 'Transaction voided', TRANSFER: 'Credit transferred',
}
const statusTones: Record<string, BadgeTone> = {
  ACTIVE: 'accent',
  INACTIVE: 'neutral',
  EXPIRED: 'accent',
  CANCELLED: 'danger',
}
const signHint = computed(() => transactionType.value === 'USAGE'
  ? 'Usage must be a negative credit change.'
  : transactionType.value === 'REFUND' ? 'Refund must be a positive credit change.' : '')
const signInvalid = computed(() => {
  const value = Number(creditChange.value)
  return !Number.isFinite(value) || value === 0
    || (transactionType.value === 'USAGE' && value >= 0)
    || (transactionType.value === 'REFUND' && value <= 0)
})
const submitDisabled = computed(() => signInvalid.value || !createdBy.value.trim() || transactionRetryBlocked.value)

function readActor(): string {
  const actor = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('by')
  return actor?.trim() ?? ''
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
  const result = await appendPackageTransaction({
    customerPackageId: customerPackage.value.customerPackageId, type: transactionType.value, creditChange: Number(creditChange.value),
    referenceSource: referenceSource.value.trim() || null, referenceId: referenceId.value.trim() || null,
    notes: transactionNotes.value.trim() || null, createdBy: createdBy.value.trim(),
  })
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
      transactionResult.value = result.message ?? 'Package was not found.'
    }
  }
}
function resetTransactionForm() {
  transactionType.value = 'USAGE'
  creditChange.value = ''
  referenceSource.value = ''
  referenceId.value = ''
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
</script>

<template>
  <AppLayout>
    <main v-if="loading" class="flex flex-1 items-center justify-center font-body text-sm text-on-surface-variant">Loading customer package…</main>
    <main v-else-if="error || notFound || !customerPackage" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><p class="font-body text-sm text-on-surface-variant">{{ error ?? 'Customer package not found' }}</p><button type="button" class="rounded-xl bg-primary px-4 py-2 font-label text-xs text-on-primary" @click="loadDetail">Retry</button></main>
    <main v-else class="flex-1 overflow-y-auto no-scrollbar bg-surface pb-20">
      <section class="px-4 py-4"><div class="flex items-start justify-between gap-3"><div><h1 class="font-headline text-lg font-bold text-on-surface">{{ customerPackage.customerName }}</h1><p class="font-body text-xs text-on-surface-variant">{{ customerPackage.customerId }}<template v-if="customerPackage.customerPhone"> · {{ customerPackage.customerPhone }}</template></p><p v-if="customerPackage.customerAddress" class="mt-1 font-body text-xs text-on-surface-variant">{{ customerPackage.customerAddress }}</p></div><BaseBadge :label="customerPackage.status" size="md" :tone="statusTones[customerPackage.status] || 'neutral'" /></div></section>
      <section class="mx-4 rounded-2xl bg-primary p-4 text-on-primary"><p class="font-label text-[10px] uppercase tracking-wide text-on-primary/70">{{ customerPackage.packageCode }} · {{ customerPackage.packageEligibleService }}</p><div class="mt-1 flex items-end justify-between gap-3"><h2 class="font-headline text-xl font-bold">{{ customerPackage.packageName }}</h2><p class="font-headline text-4xl font-extrabold text-secondary-container">{{ customerPackage.remainingCredit }}</p></div><p class="mt-1 text-right font-body text-xs text-on-primary/75">remaining of {{ customerPackage.totalCredit }} total · {{ customerPackage.usedCredit }} used</p><div class="mt-4 grid grid-cols-2 gap-3 border-t border-on-primary/20 pt-3 text-xs"><p>Starts {{ formatSheetDate(customerPackage.startDate) }}</p><p>Expires {{ formatSheetDate(customerPackage.expiryDate) }}</p><p>{{ customerPackage.serviceDay ?? 'Flexible' }}</p><p>{{ customerPackage.timeSlot ?? 'By appointment' }}</p></div></section>
      <ListContainer class="mt-3" title="Recent activity" icon="history"><template #actions><button type="button" class="rounded-full bg-surface-container px-2.5 py-1 font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30" @click="openTransaction">Add transaction</button></template><ol class="divide-y divide-outline-variant/20 px-4"><li v-for="transaction in customerPackage.transactions" :key="transaction.id" class="flex gap-3 py-3"><span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /><div class="min-w-0 flex-1"><p class="font-body text-sm font-semibold text-on-surface">{{ transactionLabels[transaction.type] }}</p><p class="font-body text-xs text-on-surface-variant">{{ transaction.referenceSource ?? 'No reference' }}<template v-if="transaction.referenceId"> · {{ transaction.referenceId }}</template><template v-if="transaction.notes"> · {{ transaction.notes }}</template></p></div><div class="text-right"><p class="font-body text-xs font-semibold" :class="transaction.creditChange > 0 ? 'text-secondary' : 'text-tertiary'">{{ transaction.creditChange > 0 ? '+' : '' }}{{ transaction.creditChange }}</p><time class="font-body text-[10px] text-on-surface-variant">{{ formatSheetDateTime(transaction.createdAt) }}</time></div></li></ol></ListContainer>
      <CustomerPackageTransactionForm
        :open="transactionFormOpen"
        :movement-types="transactionTypes"
        :movement-type="transactionType"
        :credit-change="creditChange"
        :reference-source="referenceSource"
        :reference-id="referenceId"
        :notes="transactionNotes"
        :created-by="createdBy"
        :validation-hint="signHint"
        :is-validation-invalid="signInvalid"
        :result="transactionResult"
        :result-tone="transactionRetryBlocked ? 'error' : 'success'"
        :is-submitting="submittingTransaction"
        :is-submit-disabled="submitDisabled"
        @close="closeTransactionForm"
        @submit="submitTransaction"
        @update:movement-type="transactionType = $event"
        @update:credit-change="creditChange = $event"
        @update:reference-source="referenceSource = $event"
        @update:reference-id="referenceId = $event"
        @update:notes="transactionNotes = $event"
        @update:created-by="createdBy = $event"
      />
    </main>
  </AppLayout>
</template>
