<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { useAppointmentStore } from '@/data/appointments/appointment.store'
import { appointmentWriteErrorMessage } from '@/data/appointments/appointment.service'
import { getCustomerById, type CustomerDetailDto } from '@/data/customers/customer.service'
import { listOrdersByCustomer } from '@/data/orders/order.service'
import AppointmentForm from '../components/AppointmentForm.vue'

const router = useRouter()
const route = useRoute()
const appointmentStore = useAppointmentStore()
const form = ref<InstanceType<typeof AppointmentForm> | null>(null)
const customer = ref<CustomerDetailDto | null>(null)
const deliveryOrderId = ref<string | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref<string | null>(null)
const customerId = singleQueryValue(route.query.customerId)
const orderId = singleQueryValue(route.query.orderId)
const fallback = customerId
  ? { name: 'customer-detail', params: { customerId } }
  : { name: 'appointment-schedule' }
const { close } = useCloseRoute(fallback)
const canConfirm = computed(() => Boolean(form.value?.isValid && !submitting.value))
const customerName = computed(() => customer.value?.customerName?.trim() || 'No customer selected')
const customerAddress = computed(() => customer.value?.address?.trim() || undefined)

onMounted(async () => {
  submitting.value = false
  error.value = null
  loading.value = true

  if (!customerId || route.query.customerId !== customerId) {
    error.value = 'A valid customer is required to schedule an appointment.'
    loading.value = false
    return
  }
  if (route.query.orderId !== undefined && (!orderId || route.query.orderId !== orderId)) {
    error.value = 'The delivery order id is invalid.'
    loading.value = false
    return
  }

  try {
    const loadedCustomer = await getCustomerById(customerId)
    if (orderId) {
      const orders = await listOrdersByCustomer(customerId)
      const order = orders.find((item) => item.orderId?.trim() === orderId)
      if (!order || order.customerId.trim() !== loadedCustomer.customerId.trim()) {
        error.value = 'The delivery order was not found for this customer.'
        return
      }
      deliveryOrderId.value = orderId
    }
    customer.value = loadedCustomer
  } catch (reason) {
    error.value = reason instanceof Error && reason.message
      ? reason.message
      : 'Unable to load the appointment context.'
  } finally {
    loading.value = false
  }
})

function singleQueryValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function returnAfterSave() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  void router.replace(fallback)
}

async function submit() {
  const data = form.value?.createData
  if (!canConfirm.value || !data || submitting.value) return

  submitting.value = true
  error.value = null
  try {
    await appointmentStore.createNewAppointment(data)
    returnAfterSave()
  } catch (reason) {
    error.value = appointmentWriteErrorMessage(reason, 'Failed to book. Please try again.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormOverlay
    :open="true"
    :eyebrow="deliveryOrderId ? 'SCHEDULE A DELIVERY' : 'SCHEDULE A PICKUP'"
    :title="customerName"
    :helper-text="customerAddress"
    submit-label="Confirm Booking"
    :is-submitting="submitting"
    :is-submit-disabled="!canConfirm"
    :close-on-backdrop="false"
    @close="close"
    @submit="submit"
  >
    <p v-if="loading" class="px-4 py-6 text-sm text-on-surface-variant">Loading appointment...</p>
    <AppointmentForm v-else-if="!error" ref="form" mode="create" :customer="customer" :delivery-order-id="deliveryOrderId" />
    <div v-if="error" class="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body">
      <span class="material-symbols-outlined text-[18px] shrink-0">error</span>{{ error }}
    </div>
  </FormOverlay>
</template>
