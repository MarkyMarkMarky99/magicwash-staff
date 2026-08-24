<script setup lang="ts">
import type { AppointmentListDto } from '../services/waiting-pickup.service'
import { formatSheetDate } from '@/shared/utils/sheet-date'

const props = defineProps<{
  appointment: AppointmentListDto
}>()

</script>

<template>
  <div class="flex gap-3 px-4 py-3">
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/10 bg-amber-50 text-amber-600">
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">local_shipping</span>
    </div>

    <div class="min-w-0 flex-grow">
      <div class="mb-0.5 flex items-center gap-1.5">
        <h3 class="font-headline text-[14px] font-bold leading-tight text-primary">
          {{ formatSheetDate(appointment.appointmentDate) }}
        </h3>
        <span class="shrink-0 rounded-full bg-amber-100 px-1.5 py-px font-label text-[9px] font-bold uppercase tracking-wide text-amber-700">
          Waiting pickup
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[13px] text-on-surface-variant" aria-hidden="true">schedule</span>
        <p class="truncate font-body text-xs text-on-surface-variant">{{ appointment.timeSlot || '—' }}</p>
      </div>
    </div>
  </div>
</template>
