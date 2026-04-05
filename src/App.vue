<script setup>
import { onMounted } from 'vue'
import { useAppointmentStore } from './composables/useAppointmentStore'
import { toDateStr } from './utils/gviz'

const { loadMonth } = useAppointmentStore()
const today = new Date()

// Pre-load today's month (includes all PENDING) so the badge count is ready
onMounted(() => loadMonth(today.getFullYear(), today.getMonth(), toDateStr(today)))
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
