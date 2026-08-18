<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { useAppointmentStore } from '../stores/appointment.store'
import { appointmentDateFromString, toAppointmentDate } from '../utils/appointment-date'
import AppointmentCard from '../components/AppointmentCard.vue'
import AppointmentDateTabs from '../components/AppointmentDateTabs.vue'

const router = useRouter()
const store = useAppointmentStore()
const { dailyItems, error, loading, selectedDate } = storeToRefs(store)
const initialDate = appointmentDateFromString(selectedDate.value)
const navYear = ref(initialDate.getFullYear())
const navMonth = ref(initialDate.getMonth())
const slots = [
  { value: '10:00-12:00', label: '10:00–12:00', icon: 'wb_twilight' },
  { value: '13:00-15:00', label: '13:00–15:00', icon: 'wb_sunny' },
  { value: '15:00-17:00', label: '15:00–17:00', icon: 'light_mode' },
  { value: '18:00-20:00', label: '18:00–20:00', icon: 'nights_stay' },
] as const

const itemsBySlot = computed(() => Object.fromEntries(
  slots.map((slot) => [slot.value, dailyItems.value.filter((item) => item.timeSlot === slot.value)]),
))

onMounted(() => void store.loadDate(selectedDate.value))

function selectDate(date: string) {
  void store.loadDate(date)
}

function previousMonth() {
  if (navMonth.value === 0) {
    navYear.value -= 1
    navMonth.value = 11
  } else {
    navMonth.value -= 1
  }
  selectDate(`${navYear.value}-${String(navMonth.value + 1).padStart(2, '0')}-01`)
}

function nextMonth() {
  if (navMonth.value === 11) {
    navYear.value += 1
    navMonth.value = 0
  } else {
    navMonth.value += 1
  }
  selectDate(`${navYear.value}-${String(navMonth.value + 1).padStart(2, '0')}-01`)
}

function openReschedule(appointmentId: string) {
  router.push({ name: 'appointment-reschedule', params: { appointmentId } })
}
</script>

<template>
  <AppLayout>
    <div class="flex-none bg-primary text-on-primary w-full min-w-0">
      <AppointmentDateTabs :year="navYear" :month="navMonth" :selected-date="selectedDate" @date-select="selectDate" @prev-month="previousMonth" @next-month="nextMonth" />
    </div>

    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">
      <ListContainer
        v-for="(slot, index) in slots"
        :key="slot.value"
        :title="slot.label"
        :icon="slot.icon"
        :count="itemsBySlot[slot.value].length"
        count-label="Tasks"
        :top-divider="index > 0"
        :loading="loading"
        :error="error"
        :empty="itemsBySlot[slot.value].length === 0"
        empty-text="No appointments"
        collapsible
        :skeleton-rows="2"
        skeleton-avatar-class="w-12 h-12"
      >
        <AppointmentCard
          v-for="appointment in itemsBySlot[slot.value]"
          :key="appointment.appointmentId"
          :appointment="appointment"
          :on-status-update="store.updateStatus"
          @reschedule="openReschedule"
        />
      </ListContainer>
    </main>
  </AppLayout>
</template>
