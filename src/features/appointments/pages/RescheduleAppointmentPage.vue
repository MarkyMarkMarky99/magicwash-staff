<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FormLayout from '@/layouts/FormLayout.vue'
import { getAppointment, type AppointmentDetailDto } from '../services/appointment.service'
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
    error.value = reason instanceof Error ? reason.message : 'Failed to reschedule. Please try again.'
  } finally {
    submitting.value = false
  }
}

watch(() => props.appointmentId, () => void loadAppointment(), { immediate: true })
</script>

<template>
  <FormLayout title="Reschedule Appointment" @back="router.back()">
    <p v-if="loading" class="px-6 py-5 text-sm text-on-surface-variant">Loading appointment…</p>
    <AppointmentForm v-else-if="appointment" ref="form" mode="reschedule" :appointment="appointment" />
    <div v-if="error" class="mx-6 my-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body">
      <span class="material-symbols-outlined text-[18px] shrink-0">error</span>{{ error }}
    </div>
    <template #footer>
      <button :disabled="!canConfirm" class="w-full font-headline font-bold text-[15px] py-4 rounded-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface transition-all" :class="canConfirm ? 'bg-primary hover:brightness-110 text-on-primary shadow-[0_4px_12px_rgba(0,79,69,0.2)] active:scale-[0.98]' : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'" @click="submit">
        <template v-if="submitting"><span class="material-symbols-outlined text-[20px] animate-spin">sync</span>Saving…</template>
        <template v-else><span class="material-symbols-outlined text-[20px]">check_circle</span>Confirm Reschedule</template>
      </button>
    </template>
  </FormLayout>
</template>
