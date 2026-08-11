<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import FormLayout from '@/layouts/FormLayout.vue'
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

onActivated(() => {
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
  <FormLayout title="New Booking" @back="router.back()">
    <AppointmentForm ref="form" mode="create" :customer="customer" :fixed-appointment-type="deliveryOrderId ? 'DELIVERY' : null" :delivery-order-id="deliveryOrderId" />
    <div v-if="error" class="mx-6 mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body">
      <span class="material-symbols-outlined text-[18px] shrink-0">error</span>{{ error }}
    </div>
    <template #footer>
      <button :disabled="!canConfirm" class="w-full font-headline font-bold text-[15px] py-4 rounded-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface transition-all" :class="canConfirm ? 'bg-primary hover:brightness-110 text-on-primary shadow-[0_4px_12px_rgba(0,79,69,0.2)] active:scale-[0.98]' : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'" @click="submit">
        <template v-if="submitting"><span class="material-symbols-outlined text-[20px] animate-spin">sync</span>Booking…</template>
        <template v-else><span class="material-symbols-outlined text-[20px]">add_circle</span>Confirm Booking</template>
      </button>
    </template>
  </FormLayout>
</template>
