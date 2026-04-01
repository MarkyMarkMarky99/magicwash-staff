<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { toDateStr } from '../utils/gviz'
import { useSelectedAppointment } from '../composables/useSelectedAppointment'
import { useAppointments } from '../composables/useAppointments'
import FormLayout from '../layouts/FormLayout.vue'
import AppointmentSummaryCard from '../components/AppointmentSummaryCard.vue'
import DateStrip from '../components/DateStrip.vue'

const TIME_SLOTS = ['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00']

const router = useRouter()
const { appointment, currentDate } = useSelectedAppointment()
const { rescheduleAppointment } = useAppointments()

const tomorrow = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateStr(d)
})

const selectedDate = ref(tomorrow.value)
const selectedTime = ref(null)
const reason       = ref('')
const submitting   = ref(false)
const error        = ref(null)

const canConfirm = computed(() => selectedDate.value && selectedTime.value && !submitting.value)

async function handleConfirm() {
  if (!canConfirm.value) return
  error.value      = null
  submitting.value = true
  try {
    await rescheduleAppointment(appointment.value.appointmentId, selectedDate.value, selectedTime.value, reason.value)
    router.back()
  } catch (err) {
    error.value      = err.message || 'Failed to reschedule. Please try again.'
    submitting.value = false
  }
}
</script>

<template>
  <FormLayout title="Reschedule Appointment" @back="router.back()">

    <div class="px-6 py-5 space-y-5 pb-6">

      <!-- Current appointment summary -->
      <section aria-label="Current Appointment">
        <AppointmentSummaryCard
          :customer="appointment.customer"
          :time="appointment.time"
          :date="currentDate"
          :address="appointment.address"
        />
      </section>

      <!-- Date picker -->
      <section>
        <DateStrip :selected-date="selectedDate" @select="selectedDate = $event" />
      </section>

      <!-- Time slots -->
      <section class="space-y-3">
        <h2 class="font-headline font-bold text-base text-primary">Available Timeslots</h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="slot in TIME_SLOTS"
            :key="slot"
            class="rounded-lg font-body py-2 px-3 text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary"
            :class="slot === selectedTime
              ? 'border-[1.5px] border-primary bg-primary text-on-primary font-semibold shadow-sm'
              : 'border border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'"
            @click="selectedTime = slot"
          >
            <span
              class="material-symbols-outlined text-[14px]"
              :class="slot === selectedTime ? 'opacity-80' : 'text-on-surface-variant'"
            >schedule</span>
            <span :class="slot === selectedTime ? '' : 'font-medium'">{{ slot }}</span>
          </button>
        </div>
      </section>

      <!-- Reason -->
      <section class="space-y-3 pb-4">
        <label for="reschedule-reason" class="font-headline font-bold text-base text-primary block">
          Reschedule Reason &amp; Notes
        </label>
        <div class="relative group">
          <textarea
            id="reschedule-reason"
            v-model="reason"
            class="w-full h-32 p-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 resize-none transition-colors"
            placeholder="Please provide a brief reason for rescheduling…"
          />
          <div v-if="!reason" class="absolute bottom-3 right-3 pointer-events-none">
            <span class="material-symbols-outlined text-on-surface-variant/40 text-[20px]" aria-hidden="true">edit_note</span>
          </div>
        </div>
      </section>

      <!-- Inline error -->
      <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body">
        <span class="material-symbols-outlined text-[18px] shrink-0">error</span>
        {{ error }}
      </div>

    </div>

    <!-- Footer -->
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
