<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { z } from 'zod'
import type { customerPackageListResponseSchema } from '@contracts/customer-packages/customer-package-api.schema'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormPicker from '@/shared/components/FormPicker.vue'
import type { OrderCreditUsagePreview } from '@/data/customer-packages/order-credit-usage.service'

type CustomerPackage = z.infer<typeof customerPackageListResponseSchema>

const props = defineProps<{
  open: boolean
  orderId: string
  packages: CustomerPackage[]
  loading: boolean
  error: string | null
  submitting: boolean
  retryBlocked: boolean
  preview: OrderCreditUsagePreview | null
  previewLoading: boolean
}>()
const emit = defineEmits<{
  close: []
  submit: [value: { customerPackageId: string; manualCredits?: number }]
  'select-package': [packageId: string]
}>()
const packageId = ref('')
const manualCredits = ref('')
const hasNoRate = computed(() => props.preview?.items.some((item) => !!item.noRateReason) ?? false)
const usageCredits = computed(() => hasNoRate.value ? Number(manualCredits.value) : props.preview?.totalCredits ?? 0)
const validUsageCredits = computed(() => (!hasNoRate.value || manualCredits.value.trim() !== '')
  && Number.isFinite(usageCredits.value) && usageCredits.value > 0)
const packageOptions = computed(() => props.packages.map((item) => ({
  value: item.customerPackageId,
  label: `${item.packageName} · ${item.remainingCredit} remaining`,
})))
const submitDisabled = computed(() => props.loading || props.submitting || props.retryBlocked
  || !props.packages.some((item) => item.customerPackageId === packageId.value)
  || props.previewLoading || props.preview?.customerPackageId !== packageId.value
  || !validUsageCredits.value || props.preview.alreadyUsed)

watch(() => props.preview, (preview) => { manualCredits.value = preview && preview.totalCredits > 0 ? String(preview.totalCredits) : '' })

watch(() => props.open, (open) => {
  if (!open) return
  packageId.value = props.packages.length === 1 ? props.packages[0].customerPackageId : ''
}, { immediate: true })

watch(() => props.packages, (items) => {
  if (items.length === 1) packageId.value = items[0].customerPackageId
  else if (!items.some((item) => item.customerPackageId === packageId.value)) packageId.value = ''
})
watch(packageId, (value) => emit('select-package', value))

function submit() {
  if (submitDisabled.value || props.submitting) return
  emit('submit', { customerPackageId: packageId.value, ...(hasNoRate.value ? { manualCredits: usageCredits.value } : {}) })
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
        <fieldset :disabled="loading || packages.length <= 1" class="min-w-0 border-0 p-0">
          <FormPicker
            id="order-usage-package"
            v-model="packageId"
            label="Package"
            :options="packageOptions"
            :searchable="false"
            placeholder="Select a package"
          />
        </fieldset>
        <p v-if="loading" class="mt-2 text-sm text-on-surface-variant">Loading packages…</p>
        <p v-else-if="packages.length === 0" class="mt-2 text-sm text-on-surface-variant">No active packages</p>
      </section>
      <section class="space-y-2 rounded-xl bg-surface-container-low px-4 py-3 font-body text-sm">
        <p v-if="previewLoading">Calculating order credits…</p>
        <template v-if="preview">
          <p v-for="item in preview.items" :key="item.sourceItemId">{{ item.description || item.sourceItemId }} · {{ item.quantity }} {{ item.unit || '' }} · {{ item.credits == null ? item.noRateReason + ' (manual total)' : item.credits + ' credits (' + item.creditsPerUnit + '/unit)' }}</p>
          <div v-if="hasNoRate">
            <FormLabel input-id="order-usage-manual-credits">Credits for this order</FormLabel>
            <input id="order-usage-manual-credits" v-model="manualCredits" type="number" inputmode="decimal" min="0" step="any" class="block h-[47px] w-full rounded-[10px] border border-outline-variant bg-white px-3 font-body text-sm text-on-surface" />
          </div>
          <p class="font-semibold">Total {{ hasNoRate ? manualCredits || '—' : preview.totalCredits }} credits · Balance {{ preview.balance }} → {{ preview.balance - usageCredits }}</p>
          <p v-if="preview.alreadyUsed" class="text-error">Usage for this order was already recorded.</p>
        </template>
      </section>
      <p v-if="error" role="alert" class="rounded-xl bg-error-container px-4 py-3 font-body text-sm text-on-error-container">{{ error }}</p>
    </fieldset>
  </FormOverlay>
</template>
