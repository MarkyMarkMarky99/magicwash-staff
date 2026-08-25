<script setup lang="ts">
import type { z } from 'zod'
import FormInput from '@/shared/components/FormInput.vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import type { packageCreditMovementTypeSchema } from '@contracts/customer-packages/package-transaction-api.schema'

type TransactionType = z.infer<typeof packageCreditMovementTypeSchema>

const props = withDefaults(defineProps<{
  open: boolean
  movementTypes: readonly TransactionType[]
  movementType: TransactionType
  creditChange: string
  referenceSource: string
  referenceId: string
  notes: string
  createdBy: string
  validationHint?: string | null
  isValidationInvalid?: boolean
  result?: string | null
  resultTone?: 'success' | 'error'
  isSubmitting?: boolean
  isSubmitDisabled?: boolean
}>(), {
  validationHint: null,
  isValidationInvalid: false,
  result: null,
  resultTone: 'success',
  isSubmitting: false,
  isSubmitDisabled: false,
})

const emit = defineEmits<{
  close: []
  submit: []
  'update:movementType': [value: TransactionType]
  'update:creditChange': [value: string]
  'update:referenceSource': [value: string]
  'update:referenceId': [value: string]
  'update:notes': [value: string]
  'update:createdBy': [value: string]
}>()

function movementLabel(movementType: TransactionType): string {
  return movementType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
</script>

<template>
  <FormOverlay
    :open="open"
    eyebrow="Package activity"
    title="Add transaction"
    helper-text="Record a credit movement with a clear staff trail."
    submit-label="Save transaction"
    :is-submitting="isSubmitting"
    :is-submit-disabled="isSubmitDisabled"
    :close-on-backdrop="false"
    @close="emit('close')"
    @submit="emit('submit')"
  >
    <div class="space-y-5 pb-6">
      <section class="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
        <p class="font-label text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Credit movement</p>
        <p class="mt-1 font-body text-xs leading-5 text-on-surface-variant">Choose why the customer’s available package credit is changing.</p>
      </section>

      <section class="space-y-3">
        <label for="customer-package-transaction-type" class="block font-label text-sm font-semibold text-on-surface">Transaction type</label>
        <select
          id="customer-package-transaction-type"
          :value="movementType"
          class="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          @change="emit('update:movementType', ($event.target as HTMLSelectElement).value as TransactionType)"
        >
          <option v-for="type in movementTypes" :key="type" :value="type">{{ movementLabel(type) }}</option>
        </select>

        <section>
          <FormLabel input-id="customer-package-credit-change">Credit change</FormLabel>
          <input
            id="customer-package-credit-change"
            :value="creditChange"
            type="number"
            step="any"
            placeholder="For example, -1 or 1"
            class="block h-[47px] w-full min-w-0 rounded-[10px] border border-[#a9c9c3] bg-white px-3 font-body text-sm text-[#073f38] shadow-[0_1px_0_rgba(0,79,69,0.02)] outline-none placeholder:text-[#5f7772] focus:border-[#007a69] focus:shadow-[0_0_0_3px_rgba(0,122,105,0.14)]"
            @input="emit('update:creditChange', ($event.target as HTMLInputElement).value)"
          >
        </section>
        <p v-if="validationHint" class="font-body text-xs leading-5" :class="isValidationInvalid ? 'text-error' : 'text-on-surface-variant'">{{ validationHint }}</p>
      </section>

      <section class="space-y-3 border-t border-outline-variant/25 pt-5">
        <p class="font-label text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Reference details <span class="normal-case font-medium tracking-normal text-on-surface-variant">(optional)</span></p>
        <FormInput id="customer-package-reference-source" :model-value="referenceSource" label="Reference source" placeholder="For example, service order" @update:model-value="emit('update:referenceSource', $event)" />
        <FormInput id="customer-package-reference-id" :model-value="referenceId" label="Reference ID" placeholder="Order or document number" @update:model-value="emit('update:referenceId', $event)" />
        <FormTextarea id="customer-package-transaction-notes" :model-value="notes" label="Notes" placeholder="Add context for this adjustment" @update:model-value="emit('update:notes', $event)" />
      </section>

      <section class="border-t border-outline-variant/25 pt-5">
        <FormInput id="customer-package-transaction-created-by" :model-value="createdBy" label="Staff identity" placeholder="Name or staff ID" autocomplete="name" @update:model-value="emit('update:createdBy', $event)" />
      </section>

      <p v-if="result" class="rounded-xl px-4 py-3 font-body text-sm leading-5" :class="resultTone === 'error' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'" role="status" aria-live="polite">{{ result }}</p>
    </div>
  </FormOverlay>
</template>
