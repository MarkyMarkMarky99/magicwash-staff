<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { customerCreateSchema } from '@contracts/customers/customer-api.schema'
import { ApiError } from '@/shared/api/api-client'
import { createCustomer } from '@/data/customers/customer.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import CustomerCreateForm from '../components/CustomerCreateForm.vue'
import type { CustomerCreateFormData } from '../components/CustomerCreateForm.vue'
import { currentActor } from '@/shared/config/actor'

defineOptions({ name: 'CustomerCreatePage' })

const { close } = useCloseRoute({ name: 'customer-list' })
const router = useRouter()
const customerStore = useCustomerStore()
const saving = ref(false)
const phoneError = ref<string | null>(null)
const formError = ref<string | null>(null)

const customer = reactive<CustomerCreateFormData>({
  customerName: '',
  phone: '',
  address: '',
  facebook: '',
  lineId: '',
  whatsapp: '',
  email: '',
  updatedBy: currentActor(),
})

function updateCustomer(value: CustomerCreateFormData) {
  Object.assign(customer, value)
  phoneError.value = null
  formError.value = null
}

const parsed = computed(() => customerCreateSchema.safeParse({
  customerName: customer.customerName.trim(),
  phone: customer.phone,
  address: customer.address.trim() || null,
  facebook: customer.facebook.trim() || null,
  lineId: customer.lineId.trim() || null,
  whatsapp: customer.whatsapp.trim() || null,
  email: customer.email.trim() || null,
  updatedBy: customer.updatedBy,
}))
const canSubmit = computed(() => parsed.value.success && !saving.value)

async function submit() {
  const result = parsed.value
  if (!canSubmit.value || !result.success) return
  phoneError.value = null
  formError.value = null

  saving.value = true
  try {
    const created = await createCustomer(result.data)
    customerStore.addCustomer(created)
    await router.replace({ name: 'customer-detail', params: { customerId: created.customerId } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.message === 'duplicate_phone') {
      phoneError.value = 'This phone number already belongs to a customer'
    } else {
      formError.value = error instanceof Error ? error.message : 'Could not save the customer'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormOverlay
    :open="true"
    eyebrow="CUSTOMERS / NEW RECORD"
    title="New customer"
    helper-text="Enter the customer details to register"
    submit-label="Save customer"
    submitting-label="Saving..."
    :is-submitting="saving"
    :is-submit-disabled="!canSubmit"
    :close-on-backdrop="false"
    @close="close"
    @submit="submit"
  >
    <CustomerCreateForm :model-value="customer" :phone-error="phoneError" :disabled="saving" @update:model-value="updateCustomer" />
    <p v-if="formError" class="mt-3 text-sm text-error" role="alert">{{ formError }}</p>
  </FormOverlay>
</template>
