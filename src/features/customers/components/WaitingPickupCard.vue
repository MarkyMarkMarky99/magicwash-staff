<script setup lang="ts">
import type { AppointmentListDto } from '@/data/appointments/waiting-pickup.service'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'

const props = defineProps<{
  appointment: AppointmentListDto
}>()

</script>

<template>
  <BaseSwipeCard :swipeable="false" :pressable="false">
    <BaseRowCard :line1="formatSheetDate(appointment.appointmentDate)">
      <template #lead>
        <CardLeadingIcon icon="local_shipping" tone="warning" label="Waiting pickup" />
      </template>
      <template #line1>
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate">
            {{ formatSheetDate(appointment.appointmentDate) }}
          </span>
          <BaseBadge label="Waiting pickup" size="xs" :uppercase="true" tone="warning" />
        </span>
      </template>
      <template #line2>
        <span class="flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[13px] text-on-surface-variant" aria-hidden="true">schedule</span>
          <span class="truncate">{{ appointment.timeSlot || '—' }}</span>
        </span>
      </template>
    </BaseRowCard>
  </BaseSwipeCard>
</template>
