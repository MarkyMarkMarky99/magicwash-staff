<script setup>
import { computed, ref, watch } from 'vue'
import { toDateStr } from '../../utils/gviz'
import { useSelectedCustomer } from '../../composables/useSelectedCustomer'
import { useSelectedAppointment } from '../../composables/useSelectedAppointment'
import AppointmentSummaryCard from '../AppointmentSummaryCard.vue'
import DateStrip from '../DateStrip.vue'
import FormOptionGrid from './shared/FormOptionGrid.vue'
import FormTextarea from './shared/FormTextarea.vue'

const props = defineProps({
  mode: {
    type: String,
    default: 'new-booking',
    validator: value => ['new-booking', 'reschedule'].includes(value),
  },
})

const SERVICE_TYPES = [
  { value: 'PICKUP',          label: 'Pickup',   icon: 'local_laundry_service' },
  { value: 'DELIVERY',        label: 'Delivery', icon: 'local_shipping' },
  { value: 'PICKUP_DELIVERY', label: 'Round',    icon: 'sync_alt' },
]

const TIME_SLOTS = ['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00']

function getSlotStartMinutes(slot) {
  const [h, m] = slot.split('-')[0].split(':').map(Number)
  return h * 60 + m
}

function tomorrowDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateStr(d)
}

const { customer } = useSelectedCustomer()
const { appointment, currentDate } = useSelectedAppointment()

const todayStr = toDateStr(new Date())
const isNewBooking = computed(() => props.mode === 'new-booking')

function smartDefaultDate() {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  if (now.getDay() !== 2 && TIME_SLOTS.some(s => getSlotStartMinutes(s) > nowMinutes)) {
    return todayStr
  }
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 2) d.setDate(d.getDate() + 1)
  return toDateStr(d)
}

function firstAvailableSlot(dateStr) {
  if (dateStr !== todayStr) return null
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  return TIME_SLOTS.find(s => getSlotStartMinutes(s) > nowMinutes) || null
}

const selectedDate = ref('')
const selectedTime = ref(null)
const selectedService = ref('PICKUP')
const notes = ref('')

watch(() => props.mode, (mode) => {
  selectedDate.value = mode === 'new-booking' ? smartDefaultDate() : tomorrowDate()
  selectedTime.value = mode === 'new-booking' ? firstAvailableSlot(selectedDate.value) : null
  selectedService.value = 'PICKUP'
  notes.value = ''
}, { immediate: true })

const selectedServiceIndex = computed(() =>
  SERVICE_TYPES.findIndex(s => s.value === selectedService.value)
)

const timeSlotOptions = computed(() =>
  TIME_SLOTS.map(slot => ({
    value: slot,
    label: slot,
    icon: 'schedule',
    disabled: isNewBooking.value && isSlotDisabled(slot),
  }))
)

const notesLabel = computed(() => isNewBooking.value ? 'Notes' : 'Reschedule Reason & Notes')
const notesPlaceholder = computed(() =>
  isNewBooking.value
    ? 'Any special instructions or notes...'
    : 'Please provide a brief reason for rescheduling...'
)

const data = computed(() => {
  if (isNewBooking.value) {
    return {
      mode: 'new-booking',
      customerId: customer.value?.id ?? null,
      date: selectedDate.value,
      time: selectedTime.value,
      serviceType: selectedService.value,
      notes: notes.value,
    }
  }

  return {
    mode: 'reschedule',
    appointmentId: appointment.value?.appointmentId ?? null,
    currentDate: currentDate.value,
    date: selectedDate.value,
    time: selectedTime.value,
    reason: notes.value,
  }
})

const isValid = computed(() => {
  if (isNewBooking.value) {
    return Boolean(selectedDate.value && selectedTime.value && selectedService.value)
  }

  return Boolean(appointment.value?.appointmentId && selectedDate.value && selectedTime.value)
})

function isSlotDisabled(slot) {
  if (selectedDate.value !== todayStr) return false
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  return getSlotStartMinutes(slot) <= nowMinutes
}

function handleDateSelect(ds) {
  selectedDate.value = ds
  if (isNewBooking.value && selectedTime.value && isSlotDisabled(selectedTime.value)) {
    selectedTime.value = firstAvailableSlot(ds)
  }
}

defineExpose({ data, isValid })
</script>

<template>
  <div class="px-6 py-5 space-y-5 pb-6">

    <section v-if="isNewBooking" aria-label="Customer">
      <AppointmentSummaryCard
        :customer="customer?.name"
        :time="selectedTime"
        :date="selectedDate"
        :address="customer?.address"
      />
    </section>

    <section v-else aria-label="Current Appointment">
      <AppointmentSummaryCard
        v-if="appointment"
        :customer="appointment.customer"
        :time="appointment.time"
        :date="currentDate"
        :address="appointment.address"
      />
      <div v-else class="flex items-start gap-3 rounded-xl bg-surface-container border border-outline-variant/30 px-4 py-3 text-sm text-on-surface-variant">
        <span class="material-symbols-outlined text-[20px] text-primary shrink-0">info</span>
        <p>ยังไม่มี appointment ที่ถูกเลือก ฟอร์มนี้ต้องเปิดจากรายการ appointment ก่อนจึงจะบันทึกได้</p>
      </div>
    </section>

    <section v-if="isNewBooking" class="flex justify-center">
      <div class="relative inline-flex rounded-[14px] bg-surface-container p-1 gap-1">
        <div
          class="absolute top-1 bottom-1 rounded-[10px] bg-primary shadow-sm pointer-events-none"
          :style="{
            width: `calc((100% - 0.5rem) / ${SERVICE_TYPES.length})`,
            transform: `translateX(calc(${selectedServiceIndex} * 100%))`,
            transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }"
        />
        <button
          v-for="svc in SERVICE_TYPES"
          :key="svc.value"
          type="button"
          class="relative z-10 rounded-lg py-2 px-4 text-[11px] font-label font-bold uppercase tracking-wide focus:outline-none transition-colors duration-200"
          :class="svc.value === selectedService ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'"
          @click="selectedService = svc.value"
        >
          {{ svc.label }}
        </button>
      </div>
    </section>

    <section>
      <DateStrip
        :selected-date="selectedDate"
        :title="isNewBooking ? 'Select Date' : 'Select New Date'"
        :include-today="isNewBooking"
        :disabled-days-of-week="isNewBooking ? [2] : []"
        @select="handleDateSelect"
      />
    </section>

    <FormOptionGrid
      v-model="selectedTime"
      label="Available Timeslots"
      :options="timeSlotOptions"
      variant="compact"
    />

    <FormTextarea
      id="appointment-notes"
      v-model="notes"
      :label="notesLabel"
      :placeholder="notesPlaceholder"
      icon="edit_note"
    />

  </div>
</template>
