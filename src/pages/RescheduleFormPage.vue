<script setup>
import { computed, defineAsyncComponent, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppointmentStore } from '../composables/useAppointmentStore'
import FormLayout from '../layouts/FormLayout.vue'

const AppointmentScheduleForm = defineAsyncComponent(() =>
  import('../components/forms/AppointmentScheduleForm.vue')
)

const router = useRouter()
const { rescheduleAppointment } = useAppointmentStore()

const formRef = ref(null)
const submitting = ref(false)
const error = ref(null)

onActivated(() => {
  submitting.value = false
  error.value = null
})

const canConfirm = computed(() =>
  Boolean(formRef.value?.isValid) && !submitting.value
)

async function handleConfirm() {
  if (!canConfirm.value || !formRef.value?.data) return

  const data = formRef.value.data
  error.value = null
  submitting.value = true

  try {
    await rescheduleAppointment(
      data.appointmentId,
      data.date,
      data.time,
      data.reason,
    )
    router.back()
  } catch (err) {
    error.value = err.message || 'Failed to reschedule. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormLayout title="Reschedule Appointment" @back="router.back()">
    <AppointmentScheduleForm ref="formRef" mode="reschedule" />

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
          Saving…
        </template>
        <template v-else>
          <span class="material-symbols-outlined text-[20px]">check_circle</span>
          Confirm Reschedule
        </template>
      </button>
    </template>
  </FormLayout>
</template>
