<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
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
      <ListContainer
        title="Pending Requests"
        icon="pending_actions"
        :count="pendingItems.length"
        count-label="requests"
        :loading="loading"
        :error="error"
        :empty="pendingItems.length === 0"
        empty-text="No pending requests"
        :skeleton-rows="3"
        skeleton-avatar-class="w-11 h-11"
      >
        <template #actions>
          <button
            type="button"
            class="flex h-[22px] w-[22px] items-center justify-center rounded-full transition-all hover:bg-surface-container active:scale-95 disabled:opacity-50"
            aria-label="Refresh pending requests"
            :disabled="loading"
            @click.stop="store.loadPending(true)"
          >
            <span
              class="material-symbols-outlined text-[16px] text-primary"
              :class="loading ? 'animate-spin' : ''"
              aria-hidden="true"
            >refresh</span>
          </button>
        </template>
        <AppointmentCard
          v-for="appointment in pendingItems"
          :key="appointment.appointmentId"
          :appointment="appointment"
          variant="pending"
          :on-status-update="store.updateStatus"
          @reschedule="openReschedule"
        />
      </ListContainer>
    </main>
  </AppLayout>
</template>
