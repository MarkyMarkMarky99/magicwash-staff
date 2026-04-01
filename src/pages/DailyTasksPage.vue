<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toDateStr } from '../utils/gviz'
import { useAppointments } from '../composables/useAppointments'
import { useSelectedAppointment } from '../composables/useSelectedAppointment'
import AppLayout from '../layouts/AppLayout.vue'
import DateTabs from '../components/DateTabs.vue'
import CardContainer from '../components/CardContainer.vue'

const today = new Date()

const router   = useRouter()
const navYear  = ref(today.getFullYear())
const navMonth = ref(today.getMonth())
const selected = ref(toDateStr(today))

const {
  allItems,
  loading, error,
  slots,
  fetchAppointments,
  handleStatusUpdate,
} = useAppointments()

const { appointment: selectedAppt, currentDate: selectedDate } = useSelectedAppointment()

watch(selected, (dateStr) => fetchAppointments(dateStr), { immediate: true })

function prevMonth() {
  if (navMonth.value === 0) { navYear.value--;  navMonth.value = 11 }
  else                       { navMonth.value-- }
}
function nextMonth() {
  if (navMonth.value === 11) { navYear.value++;  navMonth.value = 0 }
  else                        { navMonth.value++ }
}

function handleReschedule(appointmentId) {
  const appt = allItems.value.find(a => a.appointmentId === appointmentId)
  if (!appt) return
  selectedAppt.value  = appt
  selectedDate.value  = selected.value
  router.push('/reschedule')
}
</script>

<template>
  <AppLayout>

    <!-- Date navigation -->
    <div class="flex-none bg-primary text-on-primary w-full min-w-0">
      <DateTabs
        :year="navYear"
        :month="navMonth"
        :selected-date="selected"
        @date-select="selected = $event"
        @prev-month="prevMonth"
        @next-month="nextMonth"
      />
    </div>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">

      <CardContainer
        v-for="(slot, i) in slots"
        :key="slot.label"
        :title="slot.label"
        :icon="slot.icon"
        :items="slot.items"
        :loading="loading"
        :error="error"
        :top-divider="i > 0 || (!loading && pending.length > 0)"
        :on-status-update="handleStatusUpdate"
        :on-reschedule="handleReschedule"
      />

    </main>

  </AppLayout>
</template>
