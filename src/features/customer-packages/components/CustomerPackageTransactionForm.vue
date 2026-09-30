<script setup lang="ts">
import { computed } from 'vue'
import type { z } from 'zod'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormPicker from '@/shared/components/FormPicker.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import type { WorkOrderListDto } from '@/data/work-orders/work-order.service'
import type { CustomerPackageListItem } from '@/data/customer-packages/customer-package.service'
import type { OrderCreditUsagePreview } from '@/data/customer-packages/order-credit-usage.service'
import type { customerPackageDetailResponseSchema, packageCreditMovementTypeSchema } from '@contracts/customer-packages/customer-package-api.schema'

type TransactionType = z.infer<typeof packageCreditMovementTypeSchema>
type PackageTransaction = z.infer<typeof customerPackageDetailResponseSchema>['transactions'][number]

const props = withDefaults(defineProps<{
  open: boolean
  movementTypes: readonly TransactionType[]
  movementType: TransactionType
  credits: string
  adjustmentDirection: 'ADD' | 'DEDUCT'
  selectedOrderId: string
  selectedTransactionId: string
  selectedTargetPackageId: string
  orders: WorkOrderListDto[]
  ordersLoading: boolean
  ordersError: string
  targetPackages: CustomerPackageListItem[]
  targetPackagesLoading: boolean
  targetPackagesError: string
  transactions: PackageTransaction[]
  remainingCredit: number
  usagePreview: OrderCreditUsagePreview | null
  usageLoading: boolean
  usageError: string
  notes: string
  result?: string | null
  resultTone?: 'success' | 'error'
  isSubmitting?: boolean
  isSubmitDisabled?: boolean
}>(), {
  result: null, resultTone: 'success', isSubmitting: false, isSubmitDisabled: false,
})

const emit = defineEmits<{
  close: []
  submit: []
  'update:movementType': [value: TransactionType]
  'update:credits': [value: string]
  'update:adjustmentDirection': [value: 'ADD' | 'DEDUCT']
  'update:selectedOrderId': [value: string]
  'update:selectedTransactionId': [value: string]
  'update:selectedTargetPackageId': [value: string]
  'update:notes': [value: string]
}>()

function movementLabel(type: TransactionType): string {
  return type.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const movementTypeOptions = computed(() => props.movementTypes.map((type) => ({ value: type, label: movementLabel(type) })))
const orderOptions = computed(() => props.orders.map((order) => {
  const date = formatSheetDate(order.receivedDate)
  const service = serviceTypeLabel(order.serviceType)
  return { value: order.orderId, label: [date, service].filter(Boolean).join(' · '), date, service, quantity: order.quantity }
}))
const transactionOptions = computed(() => props.transactions
  .filter((transaction) => transaction.type !== 'PURCHASE' && transaction.type !== 'VOID'
    && !props.transactions.some((item) => item.type === 'VOID' && item.referenceId === transaction.id))
  .map((transaction) => ({
    value: transaction.id,
    label: `${movementLabel(transaction.type as TransactionType)} · ${formatSheetDate(transaction.createdAt)} · ${transaction.creditChange > 0 ? '+' : ''}${transaction.creditChange} credits`,
  })))
const targetPackageOptions = computed(() => props.targetPackages.map((item) => ({
  value: item.customerPackageId, label: item.packageName, remainingCredit: item.remainingCredit,
})))
const selectedTransaction = computed(() => props.transactions.find((item) => item.id === props.selectedTransactionId))
const deductingCredits = computed(() => props.movementType === 'TRANSFER')
const creditsOverBalance = computed(() => /^\d+$/.test(props.credits)
  && Number.isSafeInteger(Number(props.credits))
  && Number(props.credits) > props.remainingCredit)
function orderOption(option: unknown): { date: string; service: string | null; quantity: number | null } {
  return option as { date: string; service: string | null; quantity: number | null }
}
function targetOption(option: unknown): { label: string; remainingCredit: number } {
  return option as { label: string; remainingCredit: number }
}
const reversalText = computed(() => {
  const change = selectedTransaction.value?.creditChange
  if (change === undefined) return 'Select a transaction to reverse'
  const reversed = -change
  return `Reverses ${change > 0 ? '+' : ''}${change} credits → ${reversed > 0 ? '+' : ''}${reversed}`
})
</script>

<template>
  <FormOverlay
    :open="open" eyebrow="Package activity" title="Add transaction"
    helper-text="Record a credit movement against this package."
    submit-label="Save transaction" :is-submitting="isSubmitting"
    :is-submit-disabled="isSubmitDisabled" :close-on-backdrop="false"
    @close="emit('close')" @submit="emit('submit')"
  >
    <div class="space-y-5 pb-6">
      <FormPicker
        id="customer-package-transaction-type" :model-value="movementType"
        label="Transaction type" :options="movementTypeOptions" :searchable="false"
        @update:model-value="emit('update:movementType', $event as TransactionType)"
      />

      <FormPicker
        v-if="movementType === 'USAGE' || movementType === 'REFUND'"
        id="customer-package-order" :model-value="selectedOrderId"
        label="Order" placeholder="Select an order" search-placeholder="Search orders"
        :options="orderOptions" :loading="ordersLoading" :error="ordersError"
        empty-text="No orders for this customer"
        @update:model-value="emit('update:selectedOrderId', $event)"
      >
        <template #option="{ option }">
          <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-2">
              <span>{{ orderOption(option).date }}</span>
              <BaseBadge v-if="orderOption(option).service" :label="orderOption(option).service!" size="sm" tone="brand" />
            </span>
            <span v-if="orderOption(option).quantity != null" class="shrink-0 text-xs text-on-surface-variant">{{ orderOption(option).quantity }} pcs</span>
          </span>
        </template>
      </FormPicker>
      <FormPicker
        v-else-if="movementType === 'VOID'" id="customer-package-void-transaction"
        :model-value="selectedTransactionId" label="Transaction to void"
        placeholder="Select a transaction" :options="transactionOptions"
        empty-text="No transactions to reverse"
        @update:model-value="emit('update:selectedTransactionId', $event)"
      />
      <FormPicker
        v-else-if="movementType === 'TRANSFER'" id="customer-package-target"
        :model-value="selectedTargetPackageId" label="Transfer to package"
        placeholder="Select a package" :options="targetPackageOptions"
        :loading="targetPackagesLoading" :error="targetPackagesError"
        empty-text="No other active packages"
        @update:model-value="emit('update:selectedTargetPackageId', $event)"
      >
        <template #option="{ option }">
          <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span class="min-w-0">{{ targetOption(option).label }}</span>
            <span class="shrink-0 text-xs text-on-surface-variant">{{ targetOption(option).remainingCredit }} left</span>
          </span>
        </template>
      </FormPicker>

      <section v-if="movementType === 'EXPIRE' || movementType === 'VOID'" class="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface">
        {{ movementType === 'EXPIRE' ? (remainingCredit > 0 ? `Removes all ${remainingCredit} remaining credits` : 'No credits left to expire') : reversalText }}
      </section>
      <section v-else-if="movementType === 'USAGE'" class="space-y-3 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 font-body text-sm">
        <p v-if="usageLoading">Calculating order credits…</p>
        <p v-if="usageError" class="text-error">{{ usageError }}</p>
        <template v-if="usagePreview">
          <p v-for="item in usagePreview.items" :key="item.sourceItemId">{{ item.description || item.itemId || item.sourceItemId }} · {{ item.quantity }} {{ item.unit || '' }} · {{ item.credits == null ? item.noRateReason + ' (manual total)' : item.credits + ' credits (' + item.creditsPerUnit + '/unit)' }}</p>
          <div v-if="usagePreview.items.some((item) => !!item.noRateReason)">
            <FormLabel input-id="customer-package-manual-credits">Credits for this order</FormLabel>
            <input id="customer-package-manual-credits" :value="credits" type="number" inputmode="decimal" min="0" step="any" class="block h-[47px] w-full min-w-0 rounded-[10px] border border-outline-variant bg-white px-3 font-body text-sm text-on-surface" @input="emit('update:credits', ($event.target as HTMLInputElement).value)" />
          </div>
          <p class="font-semibold">Total {{ usagePreview.items.some((item) => !!item.noRateReason) ? credits || '—' : usagePreview.totalCredits }} credits · Balance {{ usagePreview.balance }} → {{ usagePreview.balance - (usagePreview.items.some((item) => !!item.noRateReason) ? Number(credits) : usagePreview.totalCredits) }}</p>
          <p v-if="usagePreview.alreadyUsed" class="text-error">Usage for this order was already recorded.</p>
        </template>
      </section>
      <section v-else class="space-y-3">
        <FormPicker v-if="movementType === 'ADJUSTMENT'" id="customer-package-correction-usage" :model-value="selectedTransactionId"
          label="Original usage (if correcting)" placeholder="Select usage to correct" :options="transactions.filter((item) => item.type === 'USAGE').map((item) => ({ value: item.id, label: `${formatSheetDate(item.createdAt)} · ${item.creditChange} credits · ${item.referenceId || ''}` }))"
          @update:model-value="emit('update:selectedTransactionId', $event)" />
        <div v-if="movementType === 'ADJUSTMENT'" class="space-y-2">
          <FormLabel input-id="customer-package-adjustment-add">Direction</FormLabel>
          <div class="flex rounded-xl border border-outline-variant bg-surface-container-low p-1" role="group" aria-label="Adjustment direction">
            <button v-for="direction in (['ADD', 'DEDUCT'] as const)" :id="`customer-package-adjustment-${direction.toLowerCase()}`" :key="direction" type="button" class="flex-1 rounded-lg px-3 py-2 font-label text-sm" :class="adjustmentDirection === direction ? 'bg-primary text-on-primary' : 'text-on-surface-variant'" :aria-pressed="adjustmentDirection === direction" @click="emit('update:adjustmentDirection', direction)">{{ direction === 'ADD' ? 'Add' : 'Deduct' }}</button>
          </div>
        </div>
        <div>
          <FormLabel input-id="customer-package-credits">Credits</FormLabel>
          <input id="customer-package-credits" :value="credits" type="number" inputmode="decimal" min="0.01" step="any" :max="deductingCredits ? remainingCredit : undefined" placeholder="1" class="block h-[47px] w-full min-w-0 rounded-[10px] border border-outline-variant bg-white px-3 font-body text-sm text-on-surface shadow-[0_1px_0_color-mix(in_srgb,_var(--color-primary)_2%,_transparent)] outline-none placeholder:text-on-surface-variant focus:border-lime focus:shadow-[0_0_0_3px_color-mix(in_srgb,_var(--color-lime)_14%,_transparent)]" @input="emit('update:credits', ($event.target as HTMLInputElement).value)">
          <p v-if="deductingCredits" class="mt-1 font-body text-xs" :class="creditsOverBalance ? 'text-error' : 'text-on-surface-variant'">{{ creditsOverBalance ? `Only ${remainingCredit} credits available` : `${remainingCredit} credits available` }}</p>
        </div>
        <p v-if="movementType === 'TRANSFER'" class="font-body text-xs text-on-surface-variant">Transfers can't be saved yet.</p>
      </section>

      <section class="border-t border-outline-variant/25 pt-5">
        <FormTextarea id="customer-package-transaction-notes" :model-value="notes" :label="movementType === 'ADJUSTMENT' ? 'Notes (required)' : 'Notes'" placeholder="Add context for this transaction" @update:model-value="emit('update:notes', $event)" />
      </section>
      <p v-if="result" class="rounded-xl px-4 py-3 font-body text-sm leading-5" :class="resultTone === 'error' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'" role="status" aria-live="polite">{{ result }}</p>
    </div>
  </FormOverlay>
</template>
