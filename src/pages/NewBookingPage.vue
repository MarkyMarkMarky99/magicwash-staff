<script setup>
import { ref, computed, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { toDateStr } from '../utils/gviz'
import { useSelectedCustomer } from '../composables/useSelectedCustomer'
import { useAppointmentStore } from '../composables/useAppointmentStore'
import FormLayout from '../layouts/FormLayout.vue'
import AppointmentSummaryCard from '../components/AppointmentSummaryCard.vue'
import DateStrip from '../components/DateStrip.vue'

const SERVICE_TYPES = [
  { value: 'PICKUP',          label: 'Pickup',   icon: 'local_laundry_service' },
  { value: 'DELIVERY',        label: 'Delivery', icon: 'local_shipping' },
  { value: 'PICKUP_DELIVERY', label: 'Round',    icon: 'sync_alt' },
]

const TIME_SLOTS = ['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00']

function getSlotStartMinutes(slot) {
  const [h, m] = slot.split('-')[0].split(':').map(Number)
  return h * 60 + m
}

const router = useRouter()
const { customer } = useSelectedCustomer()
const { createAppointment } = useAppointmentStore()

const todayStr = toDateStr(new Date())

function smartDefaultDate() {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  if (now.getDay() !== 2 && TIME_SLOTS.some(s => getSlotStartMinutes(s) > nowMinutes)) {
    return todayStr
  }
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 2) d.setDate(d.getDate() + 1)
  return toDateStr(d)
}

function firstAvailableSlot(dateStr) {
  if (dateStr !== todayStr) return null
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  return TIME_SLOTS.find(s => getSlotStartMinutes(s) > nowMinutes) || null
}

const selectedDate    = ref(smartDefaultDate())
const selectedTime    = ref(firstAvailableSlot(selectedDate.value))
const selectedService = ref('PICKUP')
const selectedServiceIndex = computed(() =>
  SERVICE_TYPES.findIndex(s => s.value === selectedService.value)
)
const notes      = ref('')
const submitting = ref(false)
const error      = ref(null)

onActivated(() => {
  submitting.value = false
  error.value = null
})

function isSlotDisabled(slot) {
  if (selectedDate.value !== todayStr) return false
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  return getSlotStartMinutes(slot) <= nowMinutes
}

function handleDateSelect(ds) {
  selectedDate.value = ds
  if (selectedTime.value && isSlotDisabled(selectedTime.value)) {
    selectedTime.value = firstAvailableSlot(ds)
  }
}

const canConfirm = computed(() =>
  selectedDate.value && selectedTime.value && selectedService.value && !submitting.value
)

async function handleConfirm() {
  if (!canConfirm.value) return
  error.value      = null
  submitting.value = true
  try {
    await createAppointment(
      customer.value?.id,
      selectedDate.value,
      selectedTime.value,
      selectedService.value,
      notes.value,
    )
    await router.back()
  } catch (err) {
    error.value = err.message || 'Failed to book. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormLayout title="New Booking" @back="router.back()">

    <div class="px-6 py-5 space-y-5 pb-6">

      <!-- Customer summary -->
      <section aria-label="Customer">
        <AppointmentSummaryCard
          :customer="customer?.name"
          :time="selectedTime"
          :date="selectedDate"
          :address="customer?.address"
        />
      </section>

      <!-- Service type -->
      <section class="flex justify-center">
        <div class="relative inline-flex rounded-[14px] bg-surface-container p-1 gap-1">
          <!-- sliding pill -->
          <div
            class="absolute top-1 bottom-1 rounded-[10px] bg-primary shadow-sm pointer-events-none"
            :style="{
              width: `calc((100% - 0.5rem) / ${SERVICE_TYPES.length})`,
              transform: `translateX(calc(${selectedServiceIndex} * 100%))`,
              transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            }"
          />
          <button
            v-for="svc in SERVICE_TYPES"
            :key="svc.value"
            class="relative z-10 rounded-lg py-2 px-4 text-[11px] font-label font-bold uppercase tracking-wide focus:outline-none transition-colors duration-200"
            :class="svc.value === selectedService ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'"
            @click="selectedService = svc.value"
          >
            {{ svc.label }}
          </button>
        </div>
      </section>

      <!-- Date picker -->
      <section>
        <DateStrip
          :selected-date="selectedDate"
          title="Select Date"
          :include-today="true"
          :disabled-days-of-week="[2]"
          @select="handleDateSelect"
        />
      </section>

      <!-- Time slots -->
      <section class="space-y-3">
        <h2 class="font-headline font-bold text-base text-primary">Available Timeslots</h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="slot in TIME_SLOTS"
            :key="slot"
            :disabled="isSlotDisabled(slot)"
            class="rounded-lg font-body py-2 px-3 text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary"
            :class="isSlotDisabled(slot)
              ? 'border border-outline-variant/20 bg-surface-container opacity-40 cursor-not-allowed'
              : slot === selectedTime
                ? 'border-[1.5px] border-primary bg-primary text-on-primary font-semibold shadow-sm'
                : 'border border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'"
            @click="!isSlotDisabled(slot) && (selectedTime = slot)"
          >
            <span
              class="material-symbols-outlined text-[14px]"
              :class="slot === selectedTime ? 'opacity-80' : 'text-on-surface-variant'"
            >schedule</span>
            <span :class="slot === selectedTime ? '' : 'font-medium'">{{ slot }}</span>
          </button>
        </div>
      </section>

      <!-- Notes -->
      <section class="space-y-3 pb-4">
        <label for="booking-notes" class="font-headline font-bold text-base text-primary block">
          Notes
        </label>
        <div class="relative group">
          <textarea
            id="booking-notes"
            v-model="notes"
            class="w-full h-28 p-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 resize-none transition-colors"
            placeholder="Any special instructions or notes…"
          />
          <div v-if="!notes" class="absolute bottom-3 right-3 pointer-events-none">
            <span class="material-symbols-outlined text-on-surface-variant/40 text-[20px]" aria-hidden="true">edit_note</span>
          </div>
        </div>
      </section>

      <!-- Inline error -->
      <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body">
        <span class="material-symbols-outlined text-[18px] shrink-0">error</span>
        {{ error }}
      </div>

    </div>

    <!-- Footer -->
    <template #footer>
      <button
        :disabled="!canConfirm"
        class="w-full font-headline font-bold text-[15px] py-4 rounded-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface transition-all"
        :class="canConfirm
          ? 'bg-primary hover:brightness-110 text-on-primary shadow-[0_4px_12px_rgba(0,79,69,0.2)] active:scale-[0.98]'
          : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'"
        @click="handleConfirm"
      >
        <template v-if="submitting">
          <span class="material-symbols-outlined text-[20px] animate-spin">sync</span>
          Booking…
        </template>
        <template v-else>
          <span class="material-symbols-outlined text-[20px]">add_circle</span>
          Confirm Booking
        </template>
      </button>
    </template>

  </FormLayout>
</template>
