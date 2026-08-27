<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import type { z } from 'zod'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
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
const serviceDays = customerPackageServiceDaySchema.options
const timeSlots = customerPackageTimeSlotSchema.options
const valid = computed(() => Boolean(customerId.value.trim() && packageCode.value.trim() && createdBy.value.trim()))
function queryString(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
onMounted(() => {
  customerId.value = queryString(route.query.customerId)
  createdBy.value = queryString(route.query.by)
  void customerStore.loadCustomers()
  void packageStore.load()
})
async function submit() {
  if (!valid.value || submitting.value) return
  submitting.value = true; result.value = null
  result.value = await createCustomerPackage({ customerId: customerId.value.trim(), packageCode: packageCode.value.trim(), invoiceId: invoiceId.value.trim() || null, startDate: startDate.value || null, expiryDate: expiryDate.value || null, serviceDay: serviceDay.value || null, timeSlot: timeSlot.value || null, notes: notes.value.trim() || null, createdBy: createdBy.value.trim() })
  submitting.value = false
}
</script>

<template>
  <AppLayout><main class="flex-1 overflow-y-auto bg-surface pb-20"><div v-if="result" class="space-y-4 px-4 py-5"><section v-if="result.kind === 'created'" class="rounded-2xl bg-secondary-container/20 p-5"><h1 class="font-headline font-bold">Customer package created</h1><p class="mt-2 font-body text-sm">{{ result.customerPackageId }} · {{ result.packageCode }} · {{ result.openingCredit }} opening credit</p><p class="font-body text-xs text-on-surface-variant">Transaction {{ result.transactionId }} · {{ result.createdAt }}</p></section><section v-else-if="result.kind === 'validation_error'" class="rounded-2xl bg-error-container/20 p-5"><h1 class="font-headline font-bold">Fix these fields</h1><p v-for="issue in result.issues" :key="issue.path" class="font-body text-sm">{{ issue.path }}: {{ issue.message }}</p></section><section v-else-if="result.kind === 'catalog_read_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h1 class="font-headline font-bold">Package catalog unavailable</h1><p class="font-body text-sm">{{ result.packageCode }} · {{ result.message }}</p></section><section v-else-if="result.kind === 'opening_transaction_write_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h1 class="font-headline font-bold">Outcome needs reconciliation</h1><p class="font-body text-sm">{{ result.customerPackageId }} · {{ result.message }} · {{ result.certainty }}</p></section><section v-else-if="result.kind === 'package_write_failed'" class="rounded-2xl bg-tertiary-container/20 p-5"><h1 class="font-headline font-bold">Package write failed after opening transaction</h1><p class="font-body text-sm">{{ result.customerPackageId }} · {{ result.transactionId }} · {{ result.openingCredit }} · {{ result.message }} · {{ result.certainty }}</p></section><button type="button" class="w-full rounded-xl bg-primary px-4 py-2.5 font-label text-xs text-on-primary" @click="result = null">Back to form</button><button type="button" class="w-full rounded-xl bg-surface-container px-4 py-2.5 font-label text-xs text-primary" @click="router.push({ name: 'customer-package-list' })">View packages</button></div><form v-else class="space-y-4 px-4 py-5" @submit.prevent="submit"><h1 class="font-headline text-xl font-bold">Create customer package</h1><CustomerPicker v-model="customerId" :customers="customers" :loading="customersLoading" :error="customersError" /><div><label for="customer-package-code" class="mb-1.5 block font-label text-xs text-on-surface-variant">แพ็กเกจ *</label><select id="customer-package-code" v-model="packageCode" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm" :disabled="packagesLoading"><option value="" disabled>เลือกแพ็กเกจ</option><option v-for="packageItem in activePackages" :key="packageItem.packageCode" :value="packageItem.packageCode">{{ packageItem.packageCode }} — {{ packageItem.name }} ({{ packageItem.includedCredit }} เครดิต)</option></select><p v-if="packagesError" class="mt-1 font-body text-xs text-error">{{ packagesError }}</p></div><FormInput id="customer-package-invoice" v-model="invoiceId" label="Invoice ID" /><div class="grid grid-cols-2 gap-3"><FormInput id="customer-package-start" v-model="startDate" type="date" label="Start date" /><FormInput id="customer-package-expiry" v-model="expiryDate" type="date" label="Expiry date" /></div><select v-model="serviceDay" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm"><option value="">Service day (optional)</option><option v-for="day in serviceDays" :key="day" :value="day">{{ day }}</option></select><select v-model="timeSlot" class="w-full rounded-xl bg-surface-container px-3 py-2 font-body text-sm"><option value="">Time slot (optional)</option><option v-for="slot in timeSlots" :key="slot" :value="slot">{{ slot }}</option></select><FormTextarea id="customer-package-notes" v-model="notes" label="Notes" /><FormInput id="customer-package-created-by" v-model="createdBy" label="Staff identity" /><button type="submit" class="w-full rounded-xl bg-primary px-4 py-3 font-label text-sm font-semibold text-on-primary disabled:opacity-40" :disabled="!valid || submitting">{{ submitting ? 'Creating…' : 'Create package' }}</button></form></main></AppLayout>
</template>
