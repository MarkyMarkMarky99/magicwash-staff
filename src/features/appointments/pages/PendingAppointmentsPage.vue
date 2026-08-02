<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAppointmentStore } from '../stores/appointment.store'
import AppointmentCard from '../components/AppointmentCard.vue'

const router = useRouter()
const store = useAppointmentStore()
const { pendingItems, loading, error } = storeToRefs(store)

onMounted(() => void store.loadPending())

function openReschedule(appointmentId: string) {
  router.push({ name: 'appointment-reschedule', params: { appointmentId } })
}
</script>

<template>
  <AppLayout>
    <main class="flex-1 overflow-y-auto no-scrollbar pb-6 w-full bg-surface min-w-0">
      <div class="px-4 py-2 bg-surface-container-low text-primary flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-primary text-[16px]">pending_actions</span>
          <h2 class="font-headline font-bold text-[13px] tracking-tight">Pending Requests</h2>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 bg-surface-container rounded-full px-2.5 py-1">
            <span class="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">{{ pendingItems.length }} Requests</span>
          </div>
          <button class="flex items-center gap-1 text-primary text-[11px] font-semibold py-1 px-2.5 rounded-full bg-primary/10 active:bg-primary/20 transition-colors disabled:opacity-40" :disabled="loading" @click="store.loadPending(true)">
            <span class="material-symbols-outlined text-[13px]" :class="loading ? 'animate-spin' : ''">refresh</span>{{ loading ? 'Loading…' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="divide-y divide-outline-variant/10">
        <div v-for="index in 3" :key="index" class="px-4 py-4 flex gap-3 animate-pulse">
          <div class="w-11 h-11 rounded-full bg-surface-container shrink-0" />
          <div class="flex-grow flex flex-col gap-2 justify-center"><div class="h-4 bg-surface-container rounded w-3/4" /><div class="h-3 bg-surface-container rounded w-full" /></div>
        </div>
      </div>
      <p v-else-if="error" class="px-6 py-4 text-sm text-error">{{ error }}</p>
      <p v-else-if="pendingItems.length === 0" class="px-6 py-4 text-sm text-on-surface-variant italic">No pending requests</p>
      <div v-else class="divide-y divide-outline-variant/10">
        <AppointmentCard
          v-for="appointment in pendingItems"
          :key="appointment.appointmentId"
          :appointment="appointment"
          variant="pending"
          :on-status-update="store.updateStatus"
          @reschedule="openReschedule"
        />
      </div>
    </main>
  </AppLayout>
</template>
