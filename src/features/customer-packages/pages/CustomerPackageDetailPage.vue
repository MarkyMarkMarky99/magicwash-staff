<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { z } from 'zod'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { formatSheetDate, formatSheetDateTime } from '@/shared/utils/sheet-date'
import { customerPackageDetailResponseSchema } from '@contracts/customer-packages/customer-package-view-api.schema'
import { packageCreditMovementTypeSchema } from '@contracts/customer-packages/package-transaction-api.schema'
import { appendPackageTransaction, getCustomerPackageDetail } from '../services/customer-package.service'

type CustomerPackageDetail = z.infer<typeof customerPackageDetailResponseSchema>
type TransactionType = z.infer<typeof packageCreditMovementTypeSchema>
const props = defineProps<{ customerPackageId: string }>()
const customerPackage = ref<CustomerPackageDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)
const showTransactionForm = ref(false)
const submittingTransaction = ref(false)
const transactionResult = ref<string | null>(null)
const transactionType = ref<TransactionType>('USAGE')
const creditChange = ref('')
const referenceSource = ref('')
const referenceId = ref('')
const transactionNotes = ref('')
const createdBy = ref(readActor())
let latestRequest = 0

const transactionTypes: readonly TransactionType[] = packageCreditMovementTypeSchema.options
const transactionLabels: Record<string, string> = {
  PURCHASE: 'Package purchased', USAGE: 'Credit used', REFUND: 'Credit refunded',
  ADJUSTMENT: 'Credit adjusted', EXPIRE: 'Credit expired', VOID: 'Transaction voided', TRANSFER: 'Credit transferred',
}
const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-secondary-container text-on-secondary-container',
  INACTIVE: 'bg-surface-container text-on-surface-variant',
  EXPIRED: 'bg-tertiary-container text-on-tertiary-container',
  CANCELLED: 'bg-error-container text-on-error-container',
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
  if (!customerPackage.value || signInvalid.value || !createdBy.value.trim() || submittingTransaction.value) return
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
    creditChange.value = ''; referenceSource.value = ''; referenceId.value = ''; transactionNotes.value = ''
    await loadDetail()
  } else {
    transactionResult.value = result.kind === 'validation_error' ? result.issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ') : result.message ?? 'Package was not found.'
  }
}
watch(() => props.customerPackageId, () => { void loadDetail() }, { immediate: true })
</script>

<template>
  <AppLayout>
    <main v-if="loading" class="flex flex-1 items-center justify-center font-body text-sm text-on-surface-variant">Loading customer package…</main>
    <main v-else-if="error || notFound || !customerPackage" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><p class="font-body text-sm text-on-surface-variant">{{ error ?? 'Customer package not found' }}</p><button type="button" class="rounded-xl bg-primary px-4 py-2 font-label text-xs text-on-primary" @click="loadDetail">Retry</button></main>
    <main v-else class="flex-1 overflow-y-auto bg-surface pb-20">
      <section class="px-4 py-4"><div class="flex items-start justify-between gap-3"><div><h1 class="font-headline text-lg font-bold text-on-surface">{{ customerPackage.customerName }}</h1><p class="font-body text-xs text-on-surface-variant">{{ customerPackage.customerId }}<template v-if="customerPackage.customerPhone"> · {{ customerPackage.customerPhone }}</template></p><p v-if="customerPackage.customerAddress" class="mt-1 font-body text-xs text-on-surface-variant">{{ customerPackage.customerAddress }}</p></div><span class="rounded-full px-2 py-1 font-label text-[10px] font-bold" :class="statusStyles[customerPackage.status]">{{ customerPackage.status }}</span></div></section>
      <section class="mx-4 rounded-2xl bg-primary p-4 text-on-primary"><p class="font-label text-[10px] uppercase tracking-wide text-on-primary/70">{{ customerPackage.packageCode }} · {{ customerPackage.packageEligibleService }}</p><div class="mt-1 flex items-end justify-between gap-3"><h2 class="font-headline text-xl font-bold">{{ customerPackage.packageName }}</h2><p class="font-headline text-4xl font-extrabold text-secondary-container">{{ customerPackage.remainingCredit }}</p></div><p class="mt-1 text-right font-body text-xs text-on-primary/75">remaining of {{ customerPackage.totalCredit }} total · {{ customerPackage.usedCredit }} used</p><div class="mt-4 grid grid-cols-2 gap-3 border-t border-on-primary/20 pt-3 text-xs"><p>Starts {{ formatSheetDate(customerPackage.startDate) }}</p><p>Expires {{ formatSheetDate(customerPackage.expiryDate) }}</p><p>{{ customerPackage.serviceDay ?? 'Flexible' }}</p><p>{{ customerPackage.timeSlot ?? 'By appointment' }}</p></div></section>
      <section class="mx-4 mt-3 rounded-2xl bg-surface-container-low p-4"><button type="button" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-xs font-semibold text-on-primary" @click="showTransactionForm = !showTransactionForm">{{ showTransactionForm ? 'Hide transaction form' : 'Add transaction' }}</button><form v-if="showTransactionForm" class="mt-4 space-y-3" @submit.prevent="submitTransaction"><select v-model="transactionType" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm"><option v-for="type in transactionTypes" :key="type" :value="type">{{ transactionLabels[type] }}</option></select><input v-model="creditChange" type="number" step="any" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Credit change"><p v-if="signHint" class="font-body text-xs" :class="signInvalid ? 'text-error' : 'text-on-surface-variant'">{{ signHint }}</p><input v-model="referenceSource" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Reference source (optional)"><input v-model="referenceId" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Reference ID (optional)"><textarea v-model="transactionNotes" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Notes (optional)" /><input v-model="createdBy" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" placeholder="Staff identity"><p v-if="transactionResult" class="font-body text-xs text-on-surface-variant">{{ transactionResult }}</p><button type="submit" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-xs text-on-primary disabled:opacity-40" :disabled="signInvalid || !createdBy.trim() || submittingTransaction">{{ submittingTransaction ? 'Saving…' : 'Save transaction' }}</button></form></section>
      <ListContainer class="mt-3" title="Recent activity" icon="history" :count="customerPackage.transactions.length" count-label="events"><ol class="divide-y divide-outline-variant/20 px-4"><li v-for="transaction in customerPackage.transactions" :key="transaction.id" class="flex gap-3 py-3"><span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /><div class="min-w-0 flex-1"><p class="font-body text-sm font-semibold text-on-surface">{{ transactionLabels[transaction.type] }}</p><p class="font-body text-xs text-on-surface-variant">{{ transaction.referenceSource ?? 'No reference' }}<template v-if="transaction.referenceId"> · {{ transaction.referenceId }}</template><template v-if="transaction.notes"> · {{ transaction.notes }}</template></p></div><div class="text-right"><p class="font-body text-xs font-semibold" :class="transaction.creditChange > 0 ? 'text-secondary' : 'text-tertiary'">{{ transaction.creditChange > 0 ? '+' : '' }}{{ transaction.creditChange }}</p><time class="font-body text-[10px] text-on-surface-variant">{{ formatSheetDateTime(transaction.createdAt) }}</time></div></li></ol></ListContainer>
    </main>
  </AppLayout>
</template>
