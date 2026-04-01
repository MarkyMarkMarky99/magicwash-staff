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
  pending, morning, afternoon,
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
        v-if="loading || pending.length > 0"
        title="Pending Confirmation"
        icon="pending_actions"
        :items="pending"
        :loading="loading"
        :error="error"
        :on-status-update="handleStatusUpdate"
        :on-reschedule="handleReschedule"
      />

      <CardContainer
        title="Morning Collection"
        icon="wb_twilight"
        :items="morning"
        :loading="loading"
        :error="error"
        :top-divider="!loading && pending.length > 0"
        :on-status-update="handleStatusUpdate"
        :on-reschedule="handleReschedule"
      />

      <CardContainer
        title="Afternoon Delivery"
        icon="wb_sunny"
        :items="afternoon"
        :loading="loading"
        :error="error"
        :top-divider="true"
        :on-status-update="handleStatusUpdate"
        :on-reschedule="handleReschedule"
      />

    </main>

    <!-- FAB -->
    <button
      aria-label="Add appointment"
      class="absolute bottom-6 right-5 w-[56px] h-[56px] bg-secondary text-on-secondary rounded-xl shadow-[0_4px_12px_rgba(0,107,95,0.3)] flex items-center justify-center active:scale-95 transition-transform z-40"
    >
      <span class="material-symbols-outlined text-[28px]">add</span>
    </button>

  </AppLayout>
</template>
