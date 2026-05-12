<script setup>
import { ref, computed, onUnmounted } from 'vue'
import BaseSwipeCard from './BaseSwipeCard.vue'

const STATUS_CONFIG = {
  PENDING:    { icon: 'schedule',        label: 'Pending',   badgeCls: 'bg-gray-100 text-gray-600',   avatarCls: 'bg-gray-100 text-gray-500'   },
  CONFIRMED:  { icon: 'event_available', label: 'Confirmed', badgeCls: 'bg-teal-50 text-teal-700',    avatarCls: 'bg-teal-50 text-teal-700'    },
  IN_TRANSIT: { icon: 'local_shipping',  label: 'En Route',  badgeCls: 'bg-amber-100 text-amber-700', avatarCls: 'bg-amber-50 text-amber-600'  },
  COMPLETED:  { icon: 'task_alt',        label: 'Completed', badgeCls: 'bg-green-100 text-green-700', avatarCls: 'bg-green-50 text-green-700'  },
  CANCELLED:  { icon: 'cancel',          label: 'Cancelled', badgeCls: 'bg-red-100 text-red-700',     avatarCls: 'bg-red-50 text-red-700'      },
  NO_SHOW:    { icon: 'person_off',      label: 'No Show',   badgeCls: 'bg-red-100 text-red-700',     avatarCls: 'bg-red-50 text-red-700'      },
}
const NEXT_STATUS = { PENDING: 'CONFIRMED', CONFIRMED: 'IN_TRANSIT', IN_TRANSIT: 'COMPLETED' }
const ACTION_META = {
  CONFIRMED:  { icon: 'thumb_up',       label: 'Confirm'  },
  IN_TRANSIT: { icon: 'local_shipping', label: 'En Route' },
  COMPLETED:  { icon: 'check_circle',   label: 'Complete' },
}

const props = defineProps({
  appointmentId:  { type: String,   required: true },
  rawStatus:      { type: String,   required: true },
  date:           { type: String,   default: '' },
  timeSlot:       { type: String,   default: '' },
  customer:       { type: String,   default: '' },
  address:        { type: String,   default: '' },
  icon:           { type: String,   default: 'event' },
  status:         { type: String,   default: 'default' },
  type:           { type: String,   default: '' },
  onStatusUpdate: { type: Function, required: true },
  onReschedule:   { type: Function, default: null },
})

const baseRef  = ref(null)
const updating = ref(false)
const toast    = ref(null)
let toastTimer = null

onUnmounted(() => clearTimeout(toastTimer))

const cfg        = computed(() => STATUS_CONFIG[props.rawStatus] || STATUS_CONFIG.PENDING)
const nextStatus = computed(() => NEXT_STATUS[props.rawStatus])
const actionMeta = computed(() => nextStatus.value ? ACTION_META[nextStatus.value] : null)

const contact = computed(() => {
  if (!props.address) return {}
  try {
    const obj = JSON.parse(props.address)
    if (obj && typeof obj === 'object') return obj
  } catch (_) {}
  return { Address: props.address }
})
const displayName    = computed(() => {
  const c = contact.value
  return c.CustomerName
    ? `${c.CustomerName}${c.CustomerLabel ? ` (${c.CustomerLabel})` : ''}`
    : props.customer
})
const displayAddress = computed(() => (contact.value.Address || '').split(',')[0].trim())
const phone          = computed(() => contact.value.Phone || null)
const location       = computed(() => contact.value.Location || contact.value.Address || null)
const canReschedule  = computed(() => props.onReschedule && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(props.rawStatus))

const formattedDate = computed(() => {
  if (!props.date) return '—'
  const d = new Date(props.date + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
})

const rightPanel = computed(() => {
  if (updating.value)   return { icon: 'sync',         label: 'Saving…',                          spin: true,  fill: false }
  if (actionMeta.value) return { icon: actionMeta.value.icon, label: `Swipe to ${actionMeta.value.label}`, spin: false, fill: true }
  return                       { icon: 'check_circle', label: 'Done',                             spin: false, fill: true, opacity: 'opacity-50' }
})

function onSwipeRight() {
  if (!nextStatus.value) { baseRef.value?.snapCard('none'); return }
  updating.value = true
  toast.value    = null
  props.onStatusUpdate(props.appointmentId, nextStatus.value)
    .then(() => {
      baseRef.value?.snapCard('none')
      const label = STATUS_CONFIG[nextStatus.value]?.label || nextStatus.value
      toast.value = { ok: true, msg: `→ ${label}` }
      toastTimer  = setTimeout(() => { toast.value = null }, 2500)
    })
    .catch(err => {
      baseRef.value?.snapCard('none')
      toast.value = { ok: false, msg: err.message }
    })
    .finally(() => { updating.value = false })
}

function openMaps(addr) {
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`,
    '_blank'
  )
}
</script>

<template>
  <div class="relative">

    <!-- Toast bar -->
    <div
      v-if="toast"
      class="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-1.5 py-1.5 px-4 text-[11px] font-bold text-white shadow-sm"
      :class="toast.ok ? 'bg-primary' : 'bg-error'"
    >
      <span class="material-symbols-outlined fill-icon" style="font-size:14px">
        {{ toast.ok ? 'check_circle' : 'error' }}
      </span>
      {{ toast.msg }}
    </div>

    <BaseSwipeCard ref="baseRef" :disabled="updating" @swipe-right="onSwipeRight">

      <!-- Right panel -->
      <template #right-panel>
        <div class="absolute inset-0 bg-primary flex items-center px-5 text-on-primary">
          <div :class="['flex items-center gap-2', rightPanel.opacity || '']">
            <span :class="['material-symbols-outlined text-[20px]', rightPanel.spin ? 'animate-spin' : '', rightPanel.fill ? 'fill-icon' : '']">
              {{ rightPanel.icon }}
            </span>
            <span class="font-label text-[8px] font-bold uppercase tracking-wide">{{ rightPanel.label }}</span>
          </div>
        </div>
      </template>

      <!-- Left panel -->
      <template #left-panel>
        <div class="absolute inset-0 bg-primary/80 flex items-center justify-end px-5 text-on-primary gap-5">
          <button
            :disabled="!phone"
            :class="['flex flex-col items-center gap-0.5 transition-all', phone ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']"
            @click="phone && (window.location.href = `tel:${phone}`)"
          >
            <span class="material-symbols-outlined text-[20px]">call</span>
            <span class="font-label text-[8px] font-bold uppercase">Call</span>
          </button>
          <button
            :disabled="!canReschedule"
            :class="['flex flex-col items-center gap-0.5 transition-all', canReschedule ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']"
            @click="canReschedule && onReschedule(appointmentId)"
          >
            <span class="material-symbols-outlined text-[20px]">event_repeat</span>
            <span class="font-label text-[8px] font-bold uppercase">Reschedule</span>
          </button>
          <button
            :disabled="!location"
            :class="['flex flex-col items-center gap-0.5 transition-all', location ? 'hover:scale-110' : 'opacity-30 cursor-not-allowed']"
            @click="location && openMaps(location)"
          >
            <span class="material-symbols-outlined text-[20px]">near_me</span>
            <span class="font-label text-[8px] font-bold uppercase">Route</span>
          </button>
        </div>
      </template>

      <!-- Card content — AppointmentSummaryCard layout -->
      <div class="px-4 py-4">

        <!-- Avatar + name + address + date/time -->
        <div class="flex items-center gap-3">
          <div :class="['w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-outline-variant/10', cfg.avatarCls]">
            <span v-if="updating" class="material-symbols-outlined text-[22px] animate-spin">sync</span>
            <span v-else class="material-symbols-outlined fill-icon text-[22px]">{{ cfg.icon }}</span>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h3 class="font-headline font-bold text-primary text-[14px] leading-tight truncate">{{ displayName }}</h3>
              <span :class="['inline-flex items-center px-1.5 py-px rounded-full font-label text-[9px] font-bold uppercase tracking-wide shrink-0', cfg.badgeCls]">
                {{ cfg.label }}
              </span>
            </div>
            <p v-if="displayAddress" class="font-body text-xs text-on-surface-variant mt-0.5 truncate">{{ displayAddress }}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="material-symbols-outlined text-primary text-[11px]">calendar_today</span>
              <span class="font-body text-xs text-on-surface-variant">{{ formattedDate }}</span>
              <span class="material-symbols-outlined text-primary text-[11px]">schedule</span>
              <span class="font-body text-xs text-on-surface-variant">{{ timeSlot || '—' }}</span>
            </div>
          </div>
        </div>

      </div>

    </BaseSwipeCard>
  </div>
</template>
