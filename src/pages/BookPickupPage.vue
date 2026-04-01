<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toDateStr, gvizQuery } from '../utils/gviz'
import { useAppointments } from '../composables/useAppointments'
import { APP_CONFIG } from '../utils/constants'
import FormLayout from '../layouts/FormLayout.vue'
import AppointmentSummaryCard from '../components/AppointmentSummaryCard.vue'
import DateStrip from '../components/DateStrip.vue'

const TIME_SLOTS = ['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00']

const route = useRoute()
const { createAppointment } = useAppointments()

// ── Customer loading ──
const customer     = ref(null)   // { name, address }
const loadingCust  = ref(true)
const custError    = ref(null)

// ── Form state ──
const tomorrow = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateStr(d)
})()

const selectedDate = ref(tomorrow)
const selectedTime = ref(null)
const notes        = ref('')
const submitting   = ref(false)
const formError    = ref(null)
const success      = ref(false)

const customerId = computed(() => route.query.customerId || '')

const canConfirm = computed(() =>
  !!customer.value && selectedDate.value && selectedTime.value && !submitting.value
)

// ── Live summary props ──
const summaryCustomer = computed(() => customer.value?.name || '—')
const summaryAddress  = computed(() => customer.value?.address || '')
const summaryTime     = computed(() =>
  selectedTime.value ? selectedTime.value.split('-')[0] : ''
)

onMounted(async () => {
  if (!customerId.value) {
    custError.value = 'No customer ID provided in the URL.'
    loadingCust.value = false
    return
  }
  try {
    const rows = await gvizQuery(
      APP_CONFIG.CUSTOMERS_SPREADSHEET_ID,
      'Customers',
      `SELECT B, D, F WHERE B = '${customerId.value.replace(/'/g, "\\'")}'`
    )
    if (!rows.length) {
      custError.value = `Customer "${customerId.value}" not found.`
    } else {
      const r = rows[0]
      customer.value = { name: r.CustomerName || customerId.value, address: r.Address || '' }
    }
  } catch (err) {
    custError.value = err.message || 'Failed to load customer data.'
  } finally {
    loadingCust.value = false
  }
})

async function handleConfirm() {
  if (!canConfirm.value) return
  formError.value  = null
  submitting.value = true
  try {
    await createAppointment(customerId.value, selectedDate.value, selectedTime.value, notes.value)
    success.value = true
  } catch (err) {
    formError.value  = err.message || 'Failed to book appointment. Please try again.'
    submitting.value = false
  }
}

function handleClose() {
  window.close()
}
</script>

<template>
  <FormLayout title="Book Pickup" close-mode @close="handleClose">

    <!-- ── Success screen ── -->
    <!-- ── Success screen ── -->
    <div v-if="success" class="flex flex-col items-center justify-center h-full px-8 text-center gap-5">
      <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <span class="material-symbols-outlined text-primary text-[48px]">check_circle</span>
      </div>
      <div class="space-y-1">
        <h2 class="font-headline font-bold text-xl text-primary">Booking Confirmed</h2>
        <p class="font-body text-sm text-on-surface-variant">
          Pickup for <span class="font-semibold text-on-surface">{{ summaryCustomer }}</span>
          has been scheduled on
          <span class="font-semibold text-on-surface">{{ selectedDate }}</span>
          at <span class="font-semibold text-on-surface">{{ selectedTime }}</span>.
        </p>
      </div>
      <button
        class="mt-2 w-full font-headline font-bold text-[15px] py-4 rounded-xl bg-primary text-on-primary shadow-[0_4px_12px_rgba(0,79,69,0.2)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        @click="handleClose"
      >
        <span class="material-symbols-outlined text-[20px]">close</span>
        Close
      </button>
    </div>

    <!-- ── Form ── -->
    <div v-else class="px-6 py-5 space-y-5 pb-6">

      <!-- Customer card — skeleton while loading -->
      <section aria-label="Customer">
        <!-- Loading skeleton -->
        <div v-if="loadingCust" class="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 space-y-3 animate-pulse">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-surface-container-high flex-shrink-0" />
            <div class="space-y-2 flex-1">
              <div class="h-4 w-2/3 rounded bg-surface-container-high" />
              <div class="h-3 w-1/2 rounded bg-surface-container-high" />
            </div>
          </div>
          <div class="h-px bg-outline-variant/20" />
          <div class="flex justify-between">
            <div class="h-3 w-1/3 rounded bg-surface-container-high" />
            <div class="h-3 w-1/4 rounded bg-surface-container-high" />
          </div>
        </div>

        <!-- Customer error -->
        <div
          v-else-if="custError"
          class="flex items-center gap-3 px-4 py-4 rounded-xl bg-error-container text-on-error-container text-sm font-body"
        >
          <span class="material-symbols-outlined text-[22px] shrink-0">person_off</span>
          <span>{{ custError }}</span>
        </div>

        <!-- Live summary card -->
        <AppointmentSummaryCard
          v-else
          :customer="summaryCustomer"
          :time="summaryTime"
          :date="selectedDate"
          :address="summaryAddress"
        />
      </section>

      <!-- Date picker -->
      <section>
        <DateStrip :selected-date="selectedDate" @select="selectedDate = $event" />
      </section>

      <!-- Time slots -->
      <section class="space-y-3">
        <h2 class="font-headline font-bold text-base text-primary">Available Timeslots</h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="slot in TIME_SLOTS"
            :key="slot"
            class="rounded-lg font-body py-2 px-3 text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary"
            :class="slot === selectedTime
              ? 'border-[1.5px] border-primary bg-primary text-on-primary font-semibold shadow-sm'
              : 'border border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'"
            @click="selectedTime = slot"
          >
            <span
              class="material-symbols-outlined text-[14px]"
              :class="slot === selectedTime ? 'opacity-80' : 'text-on-surface-variant'"
            >schedule</span>
            <span :class="slot === selectedTime ? '' : 'font-medium'">{{ slot }}</span>
          </button>
        </div>
      </section>

      <!-- Notes (optional) -->
      <section class="space-y-3 pb-4">
        <label for="booking-notes" class="font-headline font-bold text-base text-primary block">
          Notes <span class="font-normal text-on-surface-variant text-sm">(optional)</span>
        </label>
        <div class="relative group">
          <textarea
            id="booking-notes"
            v-model="notes"
            class="w-full h-28 p-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 resize-none transition-colors"
            placeholder="Any special instructions for this pickup…"
          />
          <div v-if="!notes" class="absolute bottom-3 right-3 pointer-events-none">
            <span class="material-symbols-outlined text-on-surface-variant/40 text-[20px]" aria-hidden="true">edit_note</span>
          </div>
        </div>
      </section>

      <!-- Inline error -->
      <div
        v-if="formError"
        class="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body"
      >
        <span class="material-symbols-outlined text-[18px] shrink-0">error</span>
        {{ formError }}
      </div>

    </div>

    <!-- ── Footer (hidden on success screen) ── -->
    <template v-if="!success" #footer>
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
          <span class="material-symbols-outlined text-[20px]">local_laundry_service</span>
          Confirm Booking
        </template>
      </button>
    </template>

  </FormLayout>
</template>
