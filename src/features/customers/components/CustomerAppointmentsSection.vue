<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListContainer from '@/shared/components/ListContainer.vue'
import CreateDropdownMenu from './CreateDropdownMenu.vue'
import CustomerRecordCard from './CustomerRecordCard.vue'
import { useCustomerAppointmentsStore } from '@/data/appointments/customer-appointments.store'
import type { AppointmentListDto } from '@/data/appointments/waiting-pickup.service'
import { appointmentCreateRoute } from '@/shared/navigation/form-routes'
import { formatSheetDate, normalizeSheetDate } from '@/shared/utils/sheet-date'
import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

const STATUS_PRESENTATION: Record<AppointmentListDto['status'], { icon: string; label: string; tone: BadgeTone }> = {
  PENDING: { icon: 'schedule', label: 'Pending', tone: 'neutral' },
  CONFIRMED: { icon: 'event_available', label: 'Confirmed', tone: 'accent' },
  IN_TRANSIT: { icon: 'local_shipping', label: 'En Route', tone: 'warning' },
  COMPLETED: { icon: 'task_alt', label: 'Completed', tone: 'success' },
  CANCELLED: { icon: 'cancel', label: 'Cancelled', tone: 'danger' },
  NO_SHOW: { icon: 'person_off', label: 'No Show', tone: 'danger' },
}

const props = defineProps<{ customerId: string }>()
const router = useRouter()
const { items, loading, error } = storeToRefs(useCustomerAppointmentsStore())
const appointments = computed(() => items.value
  .filter((appointment) => appointment.customerId === props.customerId)
  .map((appointment) => ({ appointment, date: normalizeSheetDate(appointment.appointmentDate) }))
  .toSorted((a, b) => (b.date ?? '').localeCompare(a.date ?? '')
    || a.appointment.timeSlot.localeCompare(b.appointment.timeSlot))
  .map(({ appointment }) => appointment))
</script>

<template>
  <ListContainer
    title="Appointments" icon="event" count-label="appointments"
    :loading="loading" :error="error" :empty="appointments.length === 0" empty-text="No appointments" :skeleton-rows="4"
  >
    <template #actions>
      <CreateDropdownMenu
        :label="`${appointments.length} appointments`"
        aria-label="Schedule pickup"
        :items="[{ key: 'appointment', label: 'Schedule Pickup' }]"
        @select="router.push(appointmentCreateRoute({ customerId: props.customerId }))"
      />
    </template>
    <CustomerRecordCard
      v-for="appointment in appointments"
      :key="appointment.appointmentId"
      :icon="appointment.vehicle === 'VAN' ? 'local_shipping' : appointment.vehicle === 'MOTORCYCLE' ? 'two_wheeler' : STATUS_PRESENTATION[appointment.status].icon"
      :tone="STATUS_PRESENTATION[appointment.status].tone"
      icon-label="Appointment"
      :title="formatSheetDate(appointment.appointmentDate)"
      :badges="[{ label: STATUS_PRESENTATION[appointment.status].label, tone: STATUS_PRESENTATION[appointment.status].tone }]"
      :trailing="appointment.timeSlot"
      :pressable="false"
    />
  </ListContainer>
</template>
