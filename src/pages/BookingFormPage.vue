<script setup>
import { computed, defineAsyncComponent, onActivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppointmentStore } from '../composables/useAppointmentStore'
import FormLayout from '../layouts/FormLayout.vue'

const AppointmentScheduleForm = defineAsyncComponent(() =>
  import('../components/forms/AppointmentScheduleForm.vue')
)

const props = defineProps({
  mode: {
    type: String,
    default: 'new-booking',
    validator: value => ['new-booking', 'reschedule'].includes(value),
  },
})

const router = useRouter()
const { createAppointment, rescheduleAppointment } = useAppointmentStore()

const formRef = ref(null)
const submitting = ref(false)
const error = ref(null)

const isReschedule = computed(() => props.mode === 'reschedule')
const title = computed(() => isReschedule.value ? 'Reschedule Appointment' : 'New Booking')
const submitLabel = computed(() => isReschedule.value ? 'Confirm Reschedule' : 'Confirm Booking')
const submitIcon = computed(() => isReschedule.value ? 'check_circle' : 'add_circle')
const submittingLabel = computed(() => isReschedule.value ? 'Saving…' : 'Booking…')
const fallbackError = computed(() =>
  isReschedule.value
    ? 'Failed to reschedule. Please try again.'
    : 'Failed to book. Please try again.'
)

onActivated(resetTransientState)
watch(() => props.mode, resetTransientState)

const canConfirm = computed(() =>
  Boolean(formRef.value?.isValid) && !submitting.value
)

function resetTransientState() {
  submitting.value = false
  error.value = null
}

async function handleConfirm() {
  if (!canConfirm.value || !formRef.value?.data) return

  const data = formRef.value.data
  error.value = null
  submitting.value = true

  try {
    if (isReschedule.value) {
      await rescheduleAppointment(
        data.appointmentId,
        data.date,
        data.time,
        data.reason,
      )
    } else {
      await createAppointment(
        data.customerId,
        data.date,
        data.time,
        data.serviceType,
        data.notes,
      )
    }

    await router.back()
  } catch (err) {
    error.value = err.message || fallbackError.value
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormLayout :title="title" @back="router.back()">
    <AppointmentScheduleForm ref="formRef" :mode="mode" />

    <div
      v-if="error"
      class="mx-6 mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body"
    >
      <span class="material-symbols-outlined text-[18px] shrink-0">error</span>
      {{ error }}
    </div>

    <template #footer>
      <button
        :disabled="!canConfirm"
        class="w-full font-headline font-bold text-[15px] py-4 rounded-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface transition-all"
        :class="canConfirm
          ? 'bg-primary hover:brightness-110 text-on-primary shadow-[0_4px_12px_rgba(0,79,69,0.2)] active:scale-[0.98]'
          : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'"
        @click="handleConfirm"
      >
        <template v-if="submitting">
          <span class="material-symbols-outlined text-[20px] animate-spin">sync</span>
          {{ submittingLabel }}
        </template>
        <template v-else>
          <span class="material-symbols-outlined text-[20px]">{{ submitIcon }}</span>
          {{ submitLabel }}
        </template>
      </button>
    </template>
  </FormLayout>
</template>
