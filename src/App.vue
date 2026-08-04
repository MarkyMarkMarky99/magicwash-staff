<script setup>
import { onMounted } from 'vue'
import { useAppointmentStore } from '@/features/appointments/stores/appointment.store'

const appointmentStore = useAppointmentStore()

// Keep the schedule and pending badge ready from the same backend-backed store.
onMounted(() => void appointmentStore.loadInitial())
</script>

<template>
  <div
    class="relative mx-auto flex h-full w-full flex-col overflow-y-auto bg-surface sm:max-w-[390px] sm:border-x sm:border-outline-variant/30 sm:shadow-2xl"
  >
    <RouterView v-slot="{ Component }">
      <KeepAlive>
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
</template>
