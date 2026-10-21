<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { customerCreateSchema, customerUpdateSchema } from '@contracts/customers/customer-api.schema'
import { ApiError } from '@/shared/api/api-client'
import { createCustomer, getCustomerById, updateCustomer as saveCustomer } from '@/data/customers/customer.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { useAuthStore } from '@/data/auth/auth.store'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import CustomerForm from '../components/CustomerForm.vue'
import type { CustomerFormData } from '../components/CustomerForm.vue'
import { currentActor } from '@/shared/config/actor'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'

defineOptions({ name: 'CustomerFormPage' })

const props = defineProps<{ customerId?: string }>()
const isEdit = computed(() => Boolean(props.customerId))

const { close } = useCloseRoute(props.customerId
  ? { name: 'customer-detail', params: { customerId: props.customerId } }
  : { name: 'customer-list' })
const router = useRouter()
const customerStore = useCustomerStore()
const authStore = useAuthStore()
const { status, isAdmin } = storeToRefs(authStore)
const initializing = ref(isEdit.value)
const original = ref<CustomerFormData | null>(null)
let loadStarted = false
const customerFields = ['customerName', 'phone', 'address', 'facebook', 'lineId', 'whatsapp', 'email', 'customerType'] as const
const saving = ref(false)
const phoneError = ref<string | null>(null)
const formError = ref<string | null>(null)

const customer = reactive<CustomerFormData>({
  customerName: '',
  phone: '',
  address: '',
  facebook: '',
  lineId: '',
  whatsapp: '',
  email: '',
  customerType: '',
  updatedBy: currentActor(),
})

function updateCustomer(value: CustomerFormData) {
  Object.assign(customer, value)
  phoneError.value = null
  formError.value = null
}

const payload = computed(() => ({
  customerName: customer.customerName.trim(),
  phone: customer.phone,
  address: customer.address.trim() || null,
  facebook: customer.facebook.trim() || null,
  lineId: customer.lineId.trim() || null,
  whatsapp: customer.whatsapp.trim() || null,
  email: customer.email.trim() || null,
  updatedBy: customer.updatedBy,
}))
const changes = computed(() => {
  const editPayload = { ...payload.value, customerType: customer.customerType || null }
  const changedFields = original.value
    ? customerFields.filter((field) => customer[field] !== original.value![field])
    : []
  return {
    ...Object.fromEntries(changedFields.map((field) => [field, editPayload[field]])),
    updatedBy: currentActor(),
  }
})
const parsed = computed(() => isEdit.value
  ? customerUpdateSchema.safeParse(changes.value)
  : customerCreateSchema.safeParse(payload.value))
const canSubmit = computed(() => parsed.value.success && !saving.value && !initializing.value
  && (!isEdit.value || isAdmin.value))

async function loadCustomer() {
  if (loadStarted || !props.customerId) return
  loadStarted = true
  try {
    const loaded = await getCustomerById(props.customerId)
    for (const field of customerFields) {
      customer[field] = loaded[field] ?? ''
    }
    original.value = { ...customer }
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Could not load the customer'
  } finally {
    initializing.value = false
  }
}

watch([status, isAdmin], () => {
  if (!isEdit.value || status.value === 'loading') return
  if (!isAdmin.value) void router.replace('/')
  else void loadCustomer()
}, { immediate: true })

onMounted(() => void authStore.ready())

async function submit() {
  const result = parsed.value
  if (!canSubmit.value || !result.success) return
  phoneError.value = null
  formError.value = null

  saving.value = true
  try {
    const saved = props.customerId
      ? await saveCustomer(props.customerId, customerUpdateSchema.parse(changes.value))
      : await createCustomer(customerCreateSchema.parse(payload.value))
    customerStore.addCustomer(saved)
    if (props.customerId) {
      useCustomerOrderHistoryStore().customer = saved
      if (window.history.state?.back) {
        router.back()
        return
      }
    }
    await router.replace({ name: 'customer-detail', params: { customerId: saved.customerId } })
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
    :eyebrow="isEdit ? 'CUSTOMERS / EDIT' : 'CUSTOMERS / NEW RECORD'"
    :title="isEdit ? 'Edit customer' : 'New customer'"
    :helper-text="isEdit ? 'Update the customer details' : 'Enter the customer details to register'"
    submit-label="Save customer"
    submitting-label="Saving..."
    :is-submitting="saving"
    :is-submit-disabled="!canSubmit"
    :close-on-backdrop="false"
    @close="close"
    @submit="submit"
  >
    <CustomerForm :edit-mode="isEdit" :model-value="customer" :phone-error="phoneError" :disabled="saving || initializing || (isEdit && !isAdmin)" @update:model-value="updateCustomer" />
    <p v-if="formError" class="mt-3 text-sm text-error" role="alert">{{ formError }}</p>
  </FormOverlay>
</template>
