<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import {
  appointmentWriteErrorMessage,
  getAppointment,
  type AppointmentDetailDto,
} from '../services/appointment.service'
import { useAppointmentStore } from '../stores/appointment.store'
import AppointmentForm from '../components/AppointmentForm.vue'

const props = defineProps<{ appointmentId: string }>()
const router = useRouter()
const appointmentStore = useAppointmentStore()
const appointment = ref<AppointmentDetailDto | null>(null)
const loading = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)
const form = ref<InstanceType<typeof AppointmentForm> | null>(null)
const canConfirm = computed(() => Boolean(form.value?.isValid && !submitting.value))
const customerName = computed(() => {
  if (!appointment.value) return 'Loading appointment…'
  return appointment.value.customerName?.trim() || appointment.value.customerId?.trim() || 'Appointment'
})
const customerAddress = computed(() => appointment.value?.address?.trim() || undefined)
let latestRequest = 0

async function loadAppointment() {
  const request = ++latestRequest
  loading.value = true
  error.value = null
  appointment.value = null
  try {
    const result = await getAppointment(props.appointmentId)
    if (request !== latestRequest) return
    appointment.value = result
  } catch (reason) {
    if (request !== latestRequest) return
    error.value = reason instanceof Error ? reason.message : 'Unable to load appointment'
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

async function submit() {
  if (!canConfirm.value || !form.value?.data || submitting.value) return

  submitting.value = true
  error.value = null
  try {
    const data = form.value.data
    await appointmentStore.rescheduleAppointment(data.appointmentId, {
      appointmentDate: data.appointmentDate,
      timeSlot: data.timeSlot,
      notes: data.notes,
    })
    router.back()
  } catch (reason) {
    error.value = appointmentWriteErrorMessage(
      reason,
      'Failed to reschedule. Please try again.',
    )
  } finally {
    submitting.value = false
  }
}

watch(() => props.appointmentId, () => void loadAppointment(), { immediate: true })
</script>

<template>
  <FormOverlay
    :open="true"
    eyebrow="Reschedule Appointment"
    :title="customerName"
    :helper-text="customerAddress"
    submit-label="Confirm Reschedule"
    :is-submitting="submitting"
    :is-submit-disabled="!canConfirm"
    :close-on-backdrop="false"
    @close="router.back()"
    @submit="submit"
  >
    <p v-if="loading" class="py-5 text-sm text-on-surface-variant">Loading appointment…</p>
    <AppointmentForm v-else-if="appointment" ref="form" mode="reschedule" :appointment="appointment" />
    <div v-if="error" class="my-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body">
      <span class="material-symbols-outlined text-[18px] shrink-0">error</span>{{ error }}
    </div>
  </FormOverlay>
</template>
