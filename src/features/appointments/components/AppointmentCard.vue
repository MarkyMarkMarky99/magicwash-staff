<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import type { AppointmentListDto } from '../services/appointment.service'

type AppointmentStatus = AppointmentListDto['status']

const statusConfig: Record<AppointmentStatus, { icon: string; label: string; badgeClass: string; avatarClass: string }> = {
  PENDING: { icon: 'schedule', label: 'Pending', badgeClass: 'bg-gray-100 text-gray-600', avatarClass: 'bg-gray-100 text-gray-500' },
  CONFIRMED: { icon: 'event_available', label: 'Confirmed', badgeClass: 'bg-teal-50 text-teal-700', avatarClass: 'bg-teal-50 text-teal-700' },
  IN_TRANSIT: { icon: 'local_shipping', label: 'En Route', badgeClass: 'bg-amber-100 text-amber-700', avatarClass: 'bg-amber-50 text-amber-600' },
  COMPLETED: { icon: 'task_alt', label: 'Completed', badgeClass: 'bg-green-100 text-green-700', avatarClass: 'bg-green-50 text-green-700' },
  CANCELLED: { icon: 'cancel', label: 'Cancelled', badgeClass: 'bg-red-100 text-red-700', avatarClass: 'bg-red-50 text-red-700' },
  NO_SHOW: { icon: 'person_off', label: 'No Show', badgeClass: 'bg-red-100 text-red-700', avatarClass: 'bg-red-50 text-red-700' },
}

const nextStatus: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'IN_TRANSIT',
  IN_TRANSIT: 'COMPLETED',
}

const actionLabels: Partial<Record<AppointmentStatus, { icon: string; label: string }>> = {
  CONFIRMED: { icon: 'thumb_up', label: 'Confirm' },
  IN_TRANSIT: { icon: 'local_shipping', label: 'En Route' },
  COMPLETED: { icon: 'check_circle', label: 'Complete' },
}

const props = withDefaults(defineProps<{
  appointment: AppointmentListDto
  variant?: 'daily' | 'pending'
  onStatusUpdate: (appointmentId: string, status: AppointmentStatus) => Promise<unknown>
}>(), {
  variant: 'daily',
})

const emit = defineEmits<{
  reschedule: [appointmentId: string]
}>()

const baseCard = ref<InstanceType<typeof BaseSwipeCard> | null>(null)
const updating = ref(false)
const toast = ref<{ ok: boolean; message: string } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

const config = computed(() => statusConfig[props.appointment.status])
const next = computed(() => nextStatus[props.appointment.status])
const action = computed(() => next.value ? actionLabels[next.value] : null)
const canReschedule = computed(() => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(props.appointment.status))
const formattedDate = computed(() => formatSheetDate(props.appointment.appointmentDate))

onUnmounted(() => clearTimeout(toastTimer))

async function advanceStatus() {
  if (!next.value) {
    baseCard.value?.snapCard('none')
    return
  }

  updating.value = true
  toast.value = null
  try {
    await props.onStatusUpdate(props.appointment.appointmentId, next.value)
    baseCard.value?.snapCard('none')
    toast.value = { ok: true, message: `→ ${statusConfig[next.value].label}` }
    toastTimer = setTimeout(() => { toast.value = null }, 2500)
  } catch (reason) {
    baseCard.value?.snapCard('none')
    toast.value = { ok: false, message: reason instanceof Error ? reason.message : 'Unable to update appointment' }
  } finally {
    updating.value = false
  }
}

function callCustomer() {
  if (props.appointment.phone) window.location.href = `tel:${props.appointment.phone}`
}

function openMaps() {
  const destination = props.appointment.location || props.appointment.address
  if (!destination) return
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`,
    '_blank',
  )
}
</script>

<template>
  <div class="relative">
    <div v-if="toast" class="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-1.5 py-1.5 px-4 text-[11px] font-bold text-white shadow-sm" :class="toast.ok ? 'bg-primary' : 'bg-error'">
      <span class="material-symbols-outlined fill-icon" style="font-size:14px">{{ toast.ok ? 'check_circle' : 'error' }}</span>
      {{ toast.message }}
    </div>

    <BaseSwipeCard ref="baseCard" :disabled="updating" @swipe-right="advanceStatus">
      <template #right-panel>
        <div class="absolute inset-0 bg-primary flex items-center px-5 text-on-primary">
          <div class="flex items-center gap-2" :class="!next ? 'opacity-50' : ''">
            <span class="material-symbols-outlined text-[20px]" :class="updating ? 'animate-spin' : 'fill-icon'">{{ updating ? 'sync' : action?.icon || 'check_circle' }}</span>
            <span class="font-label text-[8px] font-bold uppercase tracking-wide">{{ updating ? 'Saving…' : action ? `Swipe to ${action.label}` : 'Done' }}</span>
          </div>
        </div>
      </template>

      <template #left-panel>
        <div class="absolute inset-0 bg-primary/80 flex items-center justify-end px-5 text-on-primary gap-5">
          <button :disabled="!appointment.phone" :class="['flex flex-col items-center gap-0.5 transition-all', appointment.phone ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']" @click="callCustomer">
            <span class="material-symbols-outlined text-[20px]">call</span><span class="font-label text-[8px] font-bold uppercase">Call</span>
          </button>
          <button :disabled="!canReschedule" :class="['flex flex-col items-center gap-0.5 transition-all', canReschedule ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']" @click="canReschedule && emit('reschedule', appointment.appointmentId)">
            <span class="material-symbols-outlined text-[20px]">event_repeat</span><span class="font-label text-[8px] font-bold uppercase">Reschedule</span>
          </button>
          <button :disabled="!(appointment.location || appointment.address)" :class="['flex flex-col items-center gap-0.5 transition-all', appointment.location || appointment.address ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']" @click="openMaps">
            <span class="material-symbols-outlined text-[20px]">near_me</span><span class="font-label text-[8px] font-bold uppercase">Route</span>
          </button>
        </div>
      </template>

      <div class="px-4 py-3 flex gap-3" :class="variant === 'pending' ? 'py-4' : ''">
        <div :class="['w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-outline-variant/10', config.avatarClass]">
          <span v-if="updating" class="material-symbols-outlined text-[22px] animate-spin">sync</span>
          <span v-else class="material-symbols-outlined fill-icon text-[22px]">{{ config.icon }}</span>
        </div>
        <div class="flex-grow min-w-0 flex flex-col justify-center">
          <div class="flex items-center justify-between gap-2 mb-0.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <h3 class="font-headline font-bold text-primary text-[14px] leading-tight truncate">{{ appointment.customerName || appointment.customerId }}</h3>
              <span :class="['inline-flex items-center px-1.5 py-px rounded-full font-label text-[9px] font-bold uppercase tracking-wide shrink-0', config.badgeClass]">{{ config.label }}</span>
            </div>
            <span v-if="variant === 'daily'" class="font-body text-[11px] font-semibold text-on-surface-variant shrink-0">{{ appointment.timeSlot }}</span>
          </div>
          <p v-if="appointment.address" class="font-body text-xs text-on-surface-variant truncate">{{ appointment.address }}</p>
          <div v-if="variant === 'pending'" class="flex items-center gap-2 mt-1 text-xs text-on-surface-variant">
            <span class="material-symbols-outlined text-primary text-[11px]">calendar_today</span><span>{{ formattedDate }}</span>
            <span class="material-symbols-outlined text-primary text-[11px]">schedule</span><span>{{ appointment.timeSlot }}</span>
          </div>
        </div>
      </div>
    </BaseSwipeCard>
  </div>
</template>
