<script setup lang="ts">
import type { AppointmentListDto } from '../services/waiting-pickup.service'
import { normalizeAppointmentDate } from '../utils/waiting-pickup.filter'

defineProps<{
  appointment: AppointmentListDto
}>()

const STATUS_CLASSES: Record<string, string> = {
  CONFIRMED: 'bg-blue-50 text-blue-700',
  IN_TRANSIT: 'bg-amber-50 text-amber-700',
}

function statusLabel(status: string) {
  return status === 'IN_TRANSIT' ? 'In transit' : status === 'CONFIRMED' ? 'Confirmed' : status
}
</script>

<template>
  <article class="rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <span class="material-symbols-outlined text-primary" aria-hidden="true">local_shipping</span>
        <div class="min-w-0">
          <p class="font-headline text-sm font-bold text-on-surface">Waiting pickup</p>
          <p class="text-xs text-on-surface-variant">
            {{ normalizeAppointmentDate(appointment.appointmentDate) || '—' }}
            <span aria-hidden="true"> · </span>
            {{ appointment.timeSlot }}
          </p>
        </div>
      </div>

      <span
        class="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
        :class="STATUS_CLASSES[appointment.status] || 'bg-surface-container-high text-on-surface-variant'"
      >
        {{ statusLabel(appointment.status) }}
      </span>
    </div>
  </article>
</template>
