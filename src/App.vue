<script setup>
import { onMounted } from 'vue'
import { useAppointmentStore } from '@/features/appointments/stores/appointment.store'

const appointmentStore = useAppointmentStore()

// Keep the schedule and pending badge ready from the same backend-backed store.
onMounted(() => void appointmentStore.loadInitial())
</script>

<template>
  <div class="w-full sm:max-w-[390px] mx-auto bg-surface h-full flex flex-col relative sm:border-x sm:border-outline-variant/30 sm:shadow-2xl">
    <RouterView v-slot="{ Component }">
      <KeepAlive>
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
</template>
