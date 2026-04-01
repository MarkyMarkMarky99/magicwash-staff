<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePendingAppointments } from '../composables/usePendingAppointments'
import { useSelectedAppointment } from '../composables/useSelectedAppointment'
import AppLayout from '../layouts/AppLayout.vue'
import CardContainer from '../components/CardContainer.vue'

const router = useRouter()
const { pendingItems, loading, error, fetchPending, handleStatusUpdate } = usePendingAppointments()
const { appointment: selectedAppt, currentDate: selectedDate } = useSelectedAppointment()

onMounted(() => fetchPending())

function handleReschedule(appointmentId) {
  const appt = pendingItems.value.find(a => a.appointmentId === appointmentId)
  if (!appt) return
  selectedAppt.value = appt
  selectedDate.value = ''
  router.push('/reschedule')
}
</script>

<template>
  <AppLayout>
    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">

      <!-- Refresh bar -->
      <div class="px-4 pt-3 pb-1 flex items-center justify-between">
        <p class="text-xs text-on-surface-variant">
          {{ pendingItems.length }} request{{ pendingItems.length !== 1 ? 's' : '' }} waiting
        </p>
        <button
          class="flex items-center gap-1.5 text-primary text-xs font-semibold py-1.5 px-3 rounded-full bg-primary/10 active:bg-primary/20 transition-colors disabled:opacity-40"
          :disabled="loading"
          @click="fetchPending"
        >
          <span class="material-symbols-outlined text-[14px]" :class="loading ? 'animate-spin' : ''">refresh</span>
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>

      <CardContainer
        title="Pending Requests"
        icon="pending_actions"
        :items="pendingItems"
        :loading="loading"
        :error="error"
        :on-status-update="handleStatusUpdate"
        :on-reschedule="handleReschedule"
      />

    </main>
  </AppLayout>
</template>
