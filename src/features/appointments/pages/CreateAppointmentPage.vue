<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useSelectedCustomerStore } from '@/shared/stores/selected-customer.store'
import { useDeliveryBookingIntentStore } from '@/shared/stores/delivery-booking-intent.store'
import { useAppointmentStore } from '../stores/appointment.store'
import { appointmentWriteErrorMessage } from '../services/appointment.service'
import AppointmentForm from '../components/AppointmentForm.vue'

const router = useRouter()
const appointmentStore = useAppointmentStore()
const { customer } = storeToRefs(useSelectedCustomerStore())
const form = ref<InstanceType<typeof AppointmentForm> | null>(null)
const deliveryOrderId = ref<string | null>(null)
const submitting = ref(false)
const error = ref<string | null>(null)
const canConfirm = computed(() => Boolean(form.value?.isValid && !submitting.value))
const customerName = computed(() => customer.value?.customerName?.trim() || 'No customer selected')
const customerAddress = computed(() => customer.value?.address?.trim() || undefined)

// This page is deliberately excluded from KeepAlive in App.vue; keep this as onMounted because it would run only once if the page were cached again.
onMounted(() => {
  deliveryOrderId.value = useDeliveryBookingIntentStore().consume()
  submitting.value = false
  error.value = null
})

async function submit() {
  if (!canConfirm.value || !form.value?.data || submitting.value) return

  submitting.value = true
  error.value = null
  try {
    await appointmentStore.createNewAppointment(form.value.data)
    router.back()
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
    @close="router.back()"
    @submit="submit"
  >
    <AppointmentForm ref="form" mode="create" :customer="customer" :delivery-order-id="deliveryOrderId" />
    <div v-if="error" class="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body">
      <span class="material-symbols-outlined text-[18px] shrink-0">error</span>{{ error }}
    </div>
  </FormOverlay>
</template>
