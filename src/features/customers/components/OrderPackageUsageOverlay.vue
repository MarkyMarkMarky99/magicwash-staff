<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { z } from 'zod'
import type { customerPackageListResponseSchema } from '@contracts/customer-packages/customer-package-api.schema'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'

type CustomerPackage = z.infer<typeof customerPackageListResponseSchema>

const props = defineProps<{
  open: boolean
  orderId: string
  packages: CustomerPackage[]
  defaultStaff: string
  loading: boolean
  error: string | null
  submitting: boolean
  retryBlocked: boolean
}>()
const emit = defineEmits<{
  close: []
  submit: [value: { customerPackageId: string; creditsUsed: number; notes: string; createdBy: string }]
}>()
const packageId = ref('')
const creditsUsed = ref('')
const notes = ref('')
const createdBy = ref('')
const submitDisabled = computed(() => props.loading || props.retryBlocked
  || !props.packages.some((item) => item.customerPackageId === packageId.value)
  || !Number.isFinite(Number(creditsUsed.value)) || Number(creditsUsed.value) <= 0
  || !createdBy.value.trim())

watch(() => props.open, (open) => {
  if (!open) return
  packageId.value = props.packages.length === 1 ? props.packages[0].customerPackageId : ''
  creditsUsed.value = ''
  notes.value = ''
  createdBy.value = props.defaultStaff
}, { immediate: true })

watch(() => props.packages, (items) => {
  if (items.length === 1) packageId.value = items[0].customerPackageId
  else if (!items.some((item) => item.customerPackageId === packageId.value)) packageId.value = ''
})

function submit() {
  if (submitDisabled.value || props.submitting) return
  emit('submit', {
    customerPackageId: packageId.value, creditsUsed: Number(creditsUsed.value),
    notes: notes.value, createdBy: createdBy.value,
  })
}
</script>

<template>
  <FormOverlay
    :open="open" title="Use package credit" :eyebrow="`Order ${orderId}`"
    helper-text="Record credits used for this order." submit-label="Record usage"
    :is-submitting="submitting" :is-submit-disabled="submitDisabled" :close-on-backdrop="false"
    @close="emit('close')" @submit="submit"
  >
    <fieldset :disabled="submitting || retryBlocked" class="space-y-5 pb-6">
      <section>
        <FormLabel input-id="order-usage-package">Package</FormLabel>
        <select
          id="order-usage-package" v-model="packageId" :disabled="loading || packages.length <= 1" required
          class="w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-3 font-body text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="" disabled>Select a package</option>
          <option v-for="item in packages" :key="item.customerPackageId" :value="item.customerPackageId">
            {{ item.packageName }} · {{ item.remainingCredit }} remaining
          </option>
        </select>
        <p v-if="loading" class="mt-2 text-sm text-on-surface-variant">Loading packages…</p>
        <p v-else-if="packages.length === 0" class="mt-2 text-sm text-on-surface-variant">No active packages</p>
      </section>
      <section>
        <FormLabel input-id="order-usage-credits">Credits used</FormLabel>
        <input
          id="order-usage-credits" v-model="creditsUsed" type="number" min="0" step="any" required
          class="block h-[47px] w-full rounded-[10px] border border-[#a9c9c3] bg-white px-3 font-body text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
        <p class="mt-2 font-body text-xs text-on-surface-variant">Enter a positive amount to deduct from the package.</p>
      </section>
      <FormTextarea id="order-usage-notes" v-model="notes" label="Notes (optional)" />
      <FormInput id="order-usage-staff" v-model="createdBy" label="Staff identity (required)" placeholder="Name or staff ID" autocomplete="name" />
      <p v-if="error" role="alert" class="rounded-xl bg-error-container px-4 py-3 font-body text-sm text-on-error-container">{{ error }}</p>
    </fieldset>
  </FormOverlay>
</template>
