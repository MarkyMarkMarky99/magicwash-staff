<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import type { z } from 'zod'
import FormInput from '@/shared/components/FormInput.vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { addSheetDateDays, todaySheetDate } from '@/shared/utils/sheet-date'
import CustomerPicker from '../components/CustomerPicker.vue'
import { useCustomerStore } from '@/features/customers/stores/customer.store'
import type { CustomerDetailDto } from '@/features/customers/services/customer.service'
import { usePackageStore } from '@/features/packages/stores/package.store'
import {
  customerPackageServiceDaySchema,
  customerPackageTimeSlotSchema,
  createCustomerPackageResponseSchema,
} from '@contracts/customer-packages/customer-package-api.schema'
import { createCustomerPackage } from '../services/customer-package.service'
import { canResumePackagePurchase, useCustomerPackagePurchaseStore } from '../stores/customer-package-purchase.store'

defineOptions({ name: 'CustomerPackageCreatePage' })

// Supplying customerId mounts this form over the customer's page. Its owner
// controls the query entry and dismissal; the standalone route remains usable.
const props = defineProps<{ customerId?: string; customer?: CustomerDetailDto | null }>()
const emit = defineEmits<{ close: []; created: [] }>()

type CreateCustomerPackageResponse = z.infer<typeof createCustomerPackageResponseSchema>

const route = useRoute()
const router = useRouter()
const customerStore = useCustomerStore()
const packageStore = usePackageStore()
const purchaseStore = useCustomerPackagePurchaseStore()
const autoInvoice = computed(() => props.customerId !== undefined)
const attempt = computed(() => purchaseStore.attempts[props.customerId ?? ''])
const purchaseRetryAllowed = computed(() => attempt.value ? canResumePackagePurchase(attempt.value) : false)
const { customers, loading: customersLoading, error: customersError } = storeToRefs(customerStore)
const { activePackages, loading: packagesLoading, error: packagesError } = storeToRefs(packageStore)
const customerId = ref('')
const packageCode = ref('')
const invoiceId = ref('')
const startDate = ref(todaySheetDate())
const expiryDate = ref(addSheetDateDays(startDate.value, 30))
const serviceDay = ref<z.infer<typeof customerPackageServiceDaySchema> | ''>('')
const timeSlot = ref<z.infer<typeof customerPackageTimeSlotSchema> | ''>('')
const notes = ref('')
// Temporary actor until authentication supplies staff metadata.
const createdBy = 'admin'
const submitting = ref(false)
const result = ref<CreateCustomerPackageResponse | null>(null)
const formError = ref<string | null>(null)
const serviceDays = customerPackageServiceDaySchema.options
const timeSlots = customerPackageTimeSlotSchema.options
const serviceDayOptions = serviceDays.map((day) => ({ value: day, label: day }))
const timeSlotOptions = timeSlots.map((slot) => ({ value: slot, label: slot }))
const valid = computed(() => Boolean(customerId.value.trim() && packageCode.value.trim()
  && startDate.value && expiryDate.value && expiryDate.value >= startDate.value
  && (!autoInvoice.value || (props.customer?.customerId === props.customerId
    && activePackages.value.some((item) => item.packageCode === packageCode.value)))))
const purchaseMessage = computed(() => {
  const current = attempt.value
  if (!current) return ''
  if (current.submitting) return current.invoiceResult?.kind === 'created' ? 'Invoice created. Creating package…' : 'Creating invoice…'
  const outcome = current.invoiceResult?.kind === 'created' ? current.packageResult : current.invoiceResult
  if (!outcome) return ''
  if (outcome.kind === 'created') return 'Invoice and customer package created.'
  if (outcome.kind === 'validation_error') return outcome.issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ')
  return 'message' in outcome ? outcome.message : 'Some records may already have been saved. Check this invoice before continuing.'
})

watch(startDate, (value) => {
  expiryDate.value = addSheetDateDays(value, 30)
})

function queryString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function createPayload() {
  return {
    customerId: customerId.value.trim(),
    packageCode: packageCode.value.trim(),
    invoiceId: invoiceId.value.trim() || null,
    startDate: startDate.value || null,
    expiryDate: expiryDate.value || null,
    serviceDay: serviceDay.value || null,
    timeSlot: timeSlot.value || null,
    notes: notes.value.trim() || null,
    createdBy,
  }
}

function closeForm() {
  if (props.customerId !== undefined) {
    if (attempt.value?.packageResult?.kind === 'created') purchaseStore.clear(props.customerId)
    emit('close')
    return
  }
  const sourceCustomerId = queryString(route.query.customerId)
  if (sourceCustomerId) {
    void router.replace({ name: 'customer-detail', params: { customerId: sourceCustomerId, tab: 'packages' } })
  } else {
    void router.replace({ name: 'customer-package-list' })
  }
}

onMounted(() => {
  customerId.value = props.customerId ?? queryString(route.query.customerId)
  if (!autoInvoice.value) void customerStore.loadCustomers()
  void packageStore.load()
})

async function submitForm() {
  if (autoInvoice.value) {
    if (!props.customerId || attempt.value?.submitting) return
    if (attempt.value) {
      await purchaseStore.resume(props.customerId)
      return
    }
    const packageItem = activePackages.value.find((item) => item.packageCode === packageCode.value)
    if (!valid.value || !props.customer || !packageItem) return
    formError.value = null
    try {
      await purchaseStore.start(props.customer, packageItem, createPayload())
    } catch (reason) {
      formError.value = reason instanceof Error ? reason.message : 'Unable to start package purchase'
    }
    return
  }
  if (!valid.value || submitting.value) return

  formError.value = null
  result.value = null
  submitting.value = true
  try {
    result.value = await createCustomerPackage(createPayload())
    if (result.value.kind === 'created') emit('created')
  } catch (reason) {
    formError.value = reason instanceof Error ? reason.message : 'Unable to create customer package'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormOverlay
    :open="true"
    title="Create customer package"
    :submit-label="autoInvoice ? (attempt ? 'Retry remaining step' : 'Buy package') : 'Create package'"
    :is-submitting="submitting || Boolean(attempt?.submitting)"
    :is-submit-disabled="autoInvoice && attempt ? !purchaseRetryAllowed : !valid || Boolean(result)"
    :close-on-backdrop="false"
    @close="closeForm"
    @submit="submitForm"
  >
    <div v-if="autoInvoice && attempt" class="space-y-4 pb-5">
      <p role="status" class="font-body text-sm">{{ purchaseMessage }}</p>
      <p class="break-all font-body text-sm">Invoice: {{ attempt.invoiceResult?.kind === 'created' ? attempt.invoiceResult.invoiceNumber : attempt.invoiceRequest.invoiceNumber }}</p>
      <p v-if="attempt.packageResult?.kind === 'created'" class="font-body text-sm">
        Package: {{ attempt.packageResult.customerPackageId }} · {{ attempt.packageResult.openingCredit }} credits
      </p>
      <p v-else-if="!attempt.submitting && !purchaseRetryAllowed" role="alert" class="font-body text-sm text-error">
        Retry is blocked because this purchase may already have saved records. Verify the invoice and package activity before making another purchase.
      </p>
      <button
        v-if="purchaseRetryAllowed && attempt.invoiceResult?.kind !== 'created'"
        type="button" class="w-full rounded-xl bg-surface-container px-4 py-2.5 font-label text-xs text-primary"
        @click="purchaseStore.clear(customerId)"
      >Back to form</button>
      <button type="button" class="w-full rounded-xl bg-surface-container px-4 py-2.5 font-label text-xs text-primary" @click="closeForm">Close</button>
    </div>
    <div v-else-if="result" class="space-y-4 pb-5">
      <section v-if="result.kind === 'created'" class="rounded-2xl bg-secondary-container/20 p-5"><h2 class="font-headline font-bold">Customer package created</h2><p class="mt-2 font-body text-sm">{{ result.customerPackageId }} · {{ result.packageCode }} · {{ result.openingCredit }} opening credit</p><p class="font-body text-xs text-on-surface-variant">Transaction {{ result.transactionId }} · {{ result.createdAt }}</p></section>
      <section v-else-if="result.kind === 'validation_error'" class="rounded-2xl bg-error-container/20 p-5"><h2 class="font-headline font-bold">Fix these fields</h2><p v-for="issue in result.issues" :key="issue.path" class="font-body text-sm">{{ issue.path }}: {{ issue.message }}</p></section>
      <section v-else-if="result.kind === 'catalog_read_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h2 class="font-headline font-bold">Package catalog unavailable</h2><p class="font-body text-sm">{{ result.packageCode }} · {{ result.message }}</p></section>
      <section v-else-if="result.kind === 'opening_transaction_write_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h2 class="font-headline font-bold">Outcome needs reconciliation</h2><p class="font-body text-sm">{{ result.customerPackageId }} · {{ result.message }} · {{ result.certainty }}</p></section>
      <section v-else-if="result.kind === 'package_write_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h2 class="font-headline font-bold">Package write failed after opening transaction</h2><p class="font-body text-sm">{{ result.customerPackageId }} · {{ result.transactionId }} · {{ result.openingCredit }} · {{ result.message }} · {{ result.certainty }}</p></section>
      <button type="button" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-xs text-on-primary" @click="result = null">Back to form</button>
      <button type="button" class="w-full rounded-xl bg-surface-container px-4 py-2.5 font-label text-xs text-primary" @click="closeForm">Close</button>
    </div>

    <div v-else class="space-y-4 pb-5">
      <p v-if="autoInvoice" class="font-body text-sm font-semibold">{{ customer?.customerName || customerId }}</p>
      <CustomerPicker v-else v-model="customerId" :customers="customers" :loading="customersLoading" :error="customersError" />
      <div>
        <FormLabel input-id="customer-package-code">แพ็กเกจ *</FormLabel>
        <select id="customer-package-code" v-model="packageCode" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" :disabled="packagesLoading">
          <option value="" disabled>เลือกแพ็กเกจ</option>
          <option v-for="packageItem in activePackages" :key="packageItem.packageCode" :value="packageItem.packageCode">{{ packageItem.packageCode }} — {{ packageItem.name }} ({{ packageItem.includedCredit }} เครดิต)</option>
        </select>
        <p v-if="packagesError" class="mt-1 font-body text-xs text-error">{{ packagesError }}</p>
      </div>
      <FormInput v-if="!autoInvoice" id="customer-package-invoice" v-model="invoiceId" label="Invoice ID" />
      <p v-else class="font-body text-xs text-on-surface-variant">
        An invoice will be created automatically before the package is added.
        <template v-if="packageCode">Price: {{ activePackages.find((item) => item.packageCode === packageCode)?.price }}</template>
      </p>
      <div class="grid grid-cols-2 gap-3">
        <FormInput id="customer-package-start" v-model="startDate" type="date" label="Start date" />
        <FormInput id="customer-package-expiry" v-model="expiryDate" type="date" label="Expiry date" />
      </div>
      <FormOptionGrid :model-value="serviceDay" label="Service day" :options="serviceDayOptions" variant="compact" @update:model-value="serviceDay = serviceDay === $event ? '' : $event" />
      <FormOptionGrid :model-value="timeSlot" label="Time slot" :options="timeSlotOptions" variant="compact" @update:model-value="timeSlot = timeSlot === $event ? '' : $event" />
      <FormTextarea id="customer-package-notes" v-model="notes" label="Notes" />
      <p v-if="formError" class="font-body text-sm text-error">{{ formError }}</p>
    </div>
  </FormOverlay>
</template>
