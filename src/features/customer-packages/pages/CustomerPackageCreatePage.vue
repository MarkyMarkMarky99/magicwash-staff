<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import type { z } from 'zod'
import FormInput from '@/shared/components/FormInput.vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import CustomerPicker from '../components/CustomerPicker.vue'
import { useCustomerStore } from '@/features/customers/stores/customer.store'
import { usePackageStore } from '@/features/packages/stores/package.store'
import {
  customerPackageServiceDaySchema,
  customerPackageTimeSlotSchema,
  createCustomerPackageResponseSchema,
} from '@contracts/customer-packages/customer-package-api.schema'
import { createCustomerPackage } from '../services/customer-package.service'

defineOptions({ name: 'CustomerPackageCreatePage' })

type CreateCustomerPackageResponse = z.infer<typeof createCustomerPackageResponseSchema>

const route = useRoute()
const router = useRouter()
const customerStore = useCustomerStore()
const packageStore = usePackageStore()
const { customers, loading: customersLoading, error: customersError } = storeToRefs(customerStore)
const { activePackages, loading: packagesLoading, error: packagesError } = storeToRefs(packageStore)
const customerId = ref('')
const packageCode = ref('')
const invoiceId = ref('')
const startDate = ref('')
const expiryDate = ref('')
const serviceDay = ref('')
const timeSlot = ref('')
const notes = ref('')
const createdBy = ref('')
const submitting = ref(false)
const result = ref<CreateCustomerPackageResponse | null>(null)
const formError = ref<string | null>(null)
const serviceDays = customerPackageServiceDaySchema.options
const timeSlots = customerPackageTimeSlotSchema.options
const serviceDayOptions = [
  { value: '', label: 'Service day (optional)' },
  ...serviceDays.map((day) => ({ value: day, label: day })),
]
const timeSlotOptions = [
  { value: '', label: 'Time slot (optional)' },
  ...timeSlots.map((slot) => ({ value: slot, label: slot })),
]
const valid = computed(() => Boolean(customerId.value.trim() && packageCode.value.trim() && createdBy.value.trim()))

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
    createdBy: createdBy.value.trim(),
  }
}

function returnToList() {
  const parent = typeof route.meta.parent === 'string' ? route.meta.parent : 'customer-package-list'
  void router.push({ name: parent })
}

onMounted(() => {
  customerId.value = queryString(route.query.customerId)
  createdBy.value = queryString(route.query.by)
  void customerStore.loadCustomers()
  void packageStore.load()
})

async function submitForm() {
  if (!valid.value || submitting.value) return

  formError.value = null
  result.value = null
  submitting.value = true
  try {
    result.value = await createCustomerPackage(createPayload())
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
    submit-label="Create package"
    :is-submitting="submitting"
    :is-submit-disabled="!valid || Boolean(result)"
    :close-on-backdrop="false"
    @close="returnToList"
    @submit="submitForm"
  >
    <div v-if="result" class="space-y-4 pb-5">
      <section v-if="result.kind === 'created'" class="rounded-2xl bg-secondary-container/20 p-5"><h2 class="font-headline font-bold">Customer package created</h2><p class="mt-2 font-body text-sm">{{ result.customerPackageId }} · {{ result.packageCode }} · {{ result.openingCredit }} opening credit</p><p class="font-body text-xs text-on-surface-variant">Transaction {{ result.transactionId }} · {{ result.createdAt }}</p></section>
      <section v-else-if="result.kind === 'validation_error'" class="rounded-2xl bg-error-container/20 p-5"><h2 class="font-headline font-bold">Fix these fields</h2><p v-for="issue in result.issues" :key="issue.path" class="font-body text-sm">{{ issue.path }}: {{ issue.message }}</p></section>
      <section v-else-if="result.kind === 'catalog_read_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h2 class="font-headline font-bold">Package catalog unavailable</h2><p class="font-body text-sm">{{ result.packageCode }} · {{ result.message }}</p></section>
      <section v-else-if="result.kind === 'opening_transaction_write_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h2 class="font-headline font-bold">Outcome needs reconciliation</h2><p class="font-body text-sm">{{ result.customerPackageId }} · {{ result.message }} · {{ result.certainty }}</p></section>
      <section v-else-if="result.kind === 'package_write_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h2 class="font-headline font-bold">Package write failed after opening transaction</h2><p class="font-body text-sm">{{ result.customerPackageId }} · {{ result.transactionId }} · {{ result.openingCredit }} · {{ result.message }} · {{ result.certainty }}</p></section>
      <button type="button" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-xs text-on-primary" @click="result = null">Back to form</button>
      <button type="button" class="w-full rounded-xl bg-surface-container px-4 py-2.5 font-label text-xs text-primary" @click="returnToList">View packages</button>
    </div>

    <div v-else class="space-y-4 pb-5">
      <CustomerPicker v-model="customerId" :customers="customers" :loading="customersLoading" :error="customersError" />
      <div>
        <FormLabel input-id="customer-package-code">แพ็กเกจ *</FormLabel>
        <select id="customer-package-code" v-model="packageCode" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" :disabled="packagesLoading">
          <option value="" disabled>เลือกแพ็กเกจ</option>
          <option v-for="packageItem in activePackages" :key="packageItem.packageCode" :value="packageItem.packageCode">{{ packageItem.packageCode }} — {{ packageItem.name }} ({{ packageItem.includedCredit }} เครดิต)</option>
        </select>
        <p v-if="packagesError" class="mt-1 font-body text-xs text-error">{{ packagesError }}</p>
      </div>
      <FormInput id="customer-package-invoice" v-model="invoiceId" label="Invoice ID" />
      <div class="grid grid-cols-2 gap-3">
        <FormInput id="customer-package-start" v-model="startDate" type="date" label="Start date" />
        <FormInput id="customer-package-expiry" v-model="expiryDate" type="date" label="Expiry date" />
      </div>
      <FormOptionGrid v-model="serviceDay" label="Service day" :options="serviceDayOptions" variant="compact" />
      <FormOptionGrid v-model="timeSlot" label="Time slot" :options="timeSlotOptions" variant="compact" />
      <FormTextarea id="customer-package-notes" v-model="notes" label="Notes" />
      <FormInput id="customer-package-created-by" v-model="createdBy" label="Staff identity" />
      <p v-if="formError" class="font-body text-sm text-error">{{ formError }}</p>
    </div>
  </FormOverlay>
</template>
