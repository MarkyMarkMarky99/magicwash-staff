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
import type { AppointmentDetailDto, AppointmentListDto } from '../services/appointment.service'
import AppointmentDatePicker from './AppointmentDatePicker.vue'

const props = withDefaults(defineProps<{
  mode: 'create' | 'reschedule'
  customer?: SelectedCustomer | null
  appointment?: AppointmentDetailDto | null
  fixedAppointmentType?: AppointmentListDto['appointmentType'] | null
  deliveryOrderId?: string | null
}>(), {
  customer: null,
  appointment: null,
  fixedAppointmentType: null,
  deliveryOrderId: null,
})

const appointmentTypes = [
  { value: 'PICKUP', label: 'Pickup', icon: 'local_laundry_service' },
  { value: 'DELIVERY', label: 'Delivery', icon: 'local_shipping' },
  { value: 'PICKUP_DELIVERY', label: 'Round', icon: 'sync_alt' },
] as const
const timeSlots = ['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00'] as const

const selectedDate = ref('')
const selectedTime = ref<string | null>(null)
const selectedType = ref<AppointmentListDto['appointmentType']>('PICKUP')
const notes = ref('')
const today = getBangkokClock().date

const isCreate = computed(() => props.mode === 'create')
const selectedTypeIndex = computed(() => appointmentTypes.findIndex((type) => type.value === selectedType.value))
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
      appointmentType: selectedType.value,
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
  ? hasCustomerSnapshot.value && Boolean(selectedDate.value && selectedTime.value && selectedType.value)
  : Boolean(props.appointment?.appointmentId && selectedDate.value && selectedTime.value),
)

function initialise() {
  if (!isCreate.value && props.appointment) {
    selectedDate.value = normalizeSheetDate(props.appointment.appointmentDate)
      ?? props.appointment.appointmentDate
    selectedTime.value = props.appointment.timeSlot
    selectedType.value = props.appointment.appointmentType
    notes.value = props.appointment.notes ?? ''
    return
  }

  selectedDate.value = smartDefaultDate()
  selectedTime.value = firstAvailableSlot(selectedDate.value)
  selectedType.value = props.fixedAppointmentType ?? 'PICKUP'
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
  () => [props.mode, props.appointment?.appointmentId, props.fixedAppointmentType],
  initialise,
  { immediate: true },
)

defineExpose({ data, isValid })
</script>

<template>
  <div class="px-6 py-5 space-y-5 pb-6">
    <section class="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined fill-icon text-[42px] text-outline-variant">account_circle</span>
        </div>
        <div class="min-w-0">
          <h2 class="font-headline font-bold text-base text-primary leading-tight truncate">
            {{ isCreate ? customer?.customerName || 'No customer selected' : appointment?.customerName || appointment?.customerId || 'Loading appointment…' }}
          </h2>
          <p class="font-body text-xs text-on-surface-variant mt-0.5 truncate">{{ isCreate ? customer?.address : appointment?.address }}</p>
        </div>
      </div>
      <p v-if="isCreate && !hasCustomerSnapshot" class="mt-4 rounded-xl bg-error-container px-4 py-3 text-sm font-body text-on-error-container">
        {{ customerBookingMessage }}
      </p>
    </section>

    <section v-if="isCreate && !fixedAppointmentType" class="flex justify-center">
      <div class="relative inline-flex rounded-[14px] bg-surface-container p-1 gap-1">
        <div class="absolute top-1 bottom-1 rounded-[10px] bg-primary shadow-sm pointer-events-none" :style="{ width: `calc((100% - 0.5rem) / ${appointmentTypes.length})`, transform: `translateX(calc(${selectedTypeIndex} * 100%))`, transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)' }" />
        <button v-for="type in appointmentTypes" :key="type.value" type="button" class="relative z-10 rounded-lg py-2 px-4 text-[11px] font-label font-bold uppercase tracking-wide focus:outline-none transition-colors duration-200" :class="type.value === selectedType ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'" @click="selectedType = type.value">
          {{ type.label }}
        </button>
      </div>
    </section>
    <section v-else-if="isCreate && fixedAppointmentType" class="flex justify-center">
      <div class="inline-flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-[11px] font-label font-bold uppercase tracking-wide text-on-surface-variant">
        <span class="material-symbols-outlined text-[16px] leading-none text-primary">local_shipping</span>Delivery — linked to this order
      </div>
    </section>

    <AppointmentDatePicker :selected-date="selectedDate" :title="isCreate ? 'Select Date' : 'Select New Date'" :include-today="isCreate" :disabled-days-of-week="isCreate ? [2] : []" @select="selectDate" />

    <FormOptionGrid v-model="selectedTime" label="Available Timeslots" :options="timeSlotOptions" variant="compact" />
    <FormTextarea id="appointment-notes" v-model="notes" :label="isCreate ? 'Notes' : 'Reschedule Reason & Notes'" :placeholder="isCreate ? 'Any special instructions or notes...' : 'Please provide a brief reason for rescheduling...'" icon="edit_note" />
  </div>
</template>
