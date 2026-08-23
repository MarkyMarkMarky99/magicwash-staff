<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import {
  addSheetDateDays,
  getBangkokClock,
  getSheetDateCalendar,
  normalizeSheetDate,
} from '@/shared/utils/sheet-date'
import type { SelectedCustomer } from '@/shared/stores/selected-customer.store'
import type { AppointmentDetailDto } from '../services/appointment.service'
import AppointmentDatePicker from './AppointmentDatePicker.vue'

const props = withDefaults(defineProps<{
  mode: 'create' | 'reschedule'
  customer?: SelectedCustomer | null
  appointment?: AppointmentDetailDto | null
  deliveryOrderId?: string | null
}>(), {
  customer: null,
  appointment: null,
  deliveryOrderId: null,
})

const timeSlots = ['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00'] as const

const selectedDate = ref('')
const selectedTime = ref<string | null>(null)
const notes = ref('')
const today = getBangkokClock().date

const isCreate = computed(() => props.mode === 'create')
const appointmentType = computed(() => props.deliveryOrderId?.trim() ? 'DELIVERY' : 'PICKUP')
const hasCustomerSnapshot = computed(() => Boolean(
  props.customer?.customerId?.trim()
  && props.customer.customerName?.trim()
  && props.customer.customerIndex?.trim()
  && props.customer.phone?.trim()
  && props.customer.address?.trim()
  && props.customer.location?.trim(),
))
const customerBookingMessage = computed(() => {
  if (!props.customer) return 'Choose a customer from the Customers screen before creating a booking.'
  if (!hasCustomerSnapshot.value) {
    return 'This customer needs a name, customer code, phone number, and address before a booking can be created.'
  }
  return ''
})

const timeSlotOptions = computed(() => timeSlots.map((timeSlot) => ({
  value: timeSlot,
  label: timeSlot,
  icon: 'schedule',
  disabled: isCreate.value && isSlotDisabled(timeSlot),
})))

const data = computed(() => {
  if (isCreate.value) {
    return {
      customerId: props.customer?.customerId ?? '',
      customerName: props.customer?.customerName ?? '',
      customerCode: props.customer?.customerIndex ?? '',
      phone: props.customer?.phone ?? '',
      address: props.customer?.address ?? '',
      location: props.customer?.location ?? '',
      appointmentType: appointmentType.value,
      appointmentDate: selectedDate.value,
      timeSlot: selectedTime.value ?? '',
      pickupOrderId: null,
      deliveryOrderId: props.deliveryOrderId,
      notes: notes.value || null,
    }
  }

  return {
    appointmentId: props.appointment?.appointmentId ?? '',
    appointmentDate: selectedDate.value,
    timeSlot: selectedTime.value ?? '',
    notes: notes.value || null,
  }
})

const isValid = computed(() => isCreate.value
  ? hasCustomerSnapshot.value && Boolean(selectedDate.value && selectedTime.value)
  : Boolean(props.appointment?.appointmentId && selectedDate.value && selectedTime.value),
)

function initialise() {
  if (!isCreate.value && props.appointment) {
    selectedDate.value = normalizeSheetDate(props.appointment.appointmentDate)
      ?? props.appointment.appointmentDate
    selectedTime.value = props.appointment.timeSlot
    notes.value = props.appointment.notes ?? ''
    return
  }

  selectedDate.value = smartDefaultDate()
  selectedTime.value = firstAvailableSlot(selectedDate.value)
  notes.value = ''
}

function smartDefaultDate() {
  const now = getBangkokClock()
  if (now.weekday !== 2 && timeSlots.some((slot) => slotStartMinutes(slot) > now.minutes)) return today

  let next = addSheetDateDays(today, 1)
  while (getSheetDateCalendar(next)?.weekday === 2) next = addSheetDateDays(next, 1)
  return next
}

function firstAvailableSlot(date: string): string | null {
  if (date !== today) return null
  const now = getBangkokClock()
  return timeSlots.find((slot) => slotStartMinutes(slot) > now.minutes) ?? null
}

function slotStartMinutes(slot: string) {
  const [hour, minute] = slot.split('-')[0].split(':').map(Number)
  return hour * 60 + minute
}

function isSlotDisabled(slot: string) {
  if (selectedDate.value !== today) return false
  return slotStartMinutes(slot) <= getBangkokClock().minutes
}

function selectDate(date: string) {
  selectedDate.value = date
  if (isCreate.value && selectedTime.value && isSlotDisabled(selectedTime.value)) {
    selectedTime.value = firstAvailableSlot(date)
  }
}

watch(
  () => [props.mode, props.appointment?.appointmentId],
  initialise,
  { immediate: true },
)

defineExpose({ data, isValid })
</script>

<template>
  <div class="flex flex-col gap-5 py-5 pb-6">
    <p v-if="isCreate && !hasCustomerSnapshot" class="rounded-xl bg-error-container px-4 py-3 text-sm font-body text-on-error-container">
      {{ customerBookingMessage }}
    </p>

    <AppointmentDatePicker :selected-date="selectedDate" :title="isCreate ? 'Select Date' : 'Select New Date'" :include-today="isCreate" :disabled-days-of-week="isCreate ? [2] : []" @select="selectDate" />

    <FormOptionGrid v-model="selectedTime" label="Available Timeslots" :options="timeSlotOptions" variant="compact" />
    <FormTextarea id="appointment-notes" v-model="notes" :label="isCreate ? 'Notes' : 'Reschedule Reason & Notes'" :placeholder="isCreate ? 'Any special instructions or notes...' : 'Please provide a brief reason for rescheduling...'" icon="edit_note" />
  </div>
</template>
