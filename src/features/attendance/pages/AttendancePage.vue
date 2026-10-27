<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, ref } from 'vue'
import { ApiError } from '@/shared/api/api-client'
import FormPageHeader from '@/shared/components/FormPageHeader.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import AttendanceBookSheet, { type BookPhase } from '../components/AttendanceBookSheet.vue'
import AttendanceLegend from '../components/AttendanceLegend.vue'
import AttendanceToast from '../components/AttendanceToast.vue'
import AttendanceWeekPanel from '../components/AttendanceWeekPanel.vue'
import AttendanceWeekRow from '../components/AttendanceWeekRow.vue'
import { useAttendanceSource } from '../composables/useAttendanceSource'
import { bookableRange, buildCalendar, weekIndexOf, type CalendarDay } from '../utils/attendance-calendar'
import { calendarTitle, fullLabel, shortLabel, weekRange } from '../utils/attendance-labels'

defineOptions({ name: 'AttendancePage' })

const TOAST_MS = 2600

const source = useAttendanceSource()
const { close } = useCloseRoute('/')

const weeks = computed(() => buildCalendar({ today: source.today.value, rows: source.rows.value, meStaffId: source.meStaffId.value }))
const range = computed(() => bookableRange(source.today.value))
const selectedIndex = ref(0)
const selectedWeek = computed(() => weeks.value[selectedIndex.value]!)
const myName = computed(() => (source.meStaffId.value ? source.staffName(source.meStaffId.value) : ''))
const opensLaterAfter = computed(() => selectedWeek.value.days.some((day) => day.state === 'outside') ? shortLabel(range.value.last) : null)

const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const sheetOpen = ref(false)
const phase = ref<BookPhase>('confirm')
const pickedDate = ref('')
const failureTitle = ref('')
const failureMessage = ref('')

function showToast(message: string): void {
  toastMessage.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, TOAST_MS)
}

function findDay(date: string): CalendarDay | undefined {
  return weeks.value.flatMap((week) => week.days).find((day) => day.date === date)
}

function selectDay(date: string): void {
  const day = findDay(date)
  if (!day) return
  const index = weekIndexOf(source.today.value, date)
  selectedIndex.value = index
  const week = weeks.value[index]!
  switch (day.state) {
    case 'free':
      pickedDate.value = date
      phase.value = 'confirm'
      sheetOpen.value = true
      return
    case 'mine':
      showToast('This is your day off. Need to change it? Ask an admin.')
      return
    case 'taken':
      showToast(`${source.staffName(day.holderStaffId ?? '')} is off on ${fullLabel(date)}. One person per day.`)
      return
    case 'locked':
      showToast(`You already have ${fullLabel(week.mineDate ?? date)} off this week.`)
      return
    case 'outside':
      showToast(`Opens later. You can book up to ${shortLabel(range.value.last)}.`)
      return
    case 'today':
      showToast("Today can't be booked. Booking starts tomorrow.")
      return
    default:
      showToast('That day has passed.')
  }
}

function stepWeek(step: number): void {
  selectedIndex.value = Math.min(weeks.value.length - 1, Math.max(0, selectedIndex.value + step))
}

async function confirmBook(): Promise<void> {
  const date = pickedDate.value
  phase.value = 'booking'
  try {
    await source.book(date)
    selectedIndex.value = weekIndexOf(source.today.value, date)
    phase.value = 'success'
  } catch (reason) {
    const conflict = reason instanceof ApiError && reason.status === 409
    failureTitle.value = conflict ? 'Too slow' : 'Could not book'
    failureMessage.value = reason instanceof Error && reason.message ? reason.message : 'Something went wrong. Try again.'
    selectedIndex.value = weekIndexOf(source.today.value, date)
    phase.value = 'failed'
    await source.reload().catch(() => undefined)
  }
}

function closeSheet(): void {
  if (phase.value === 'booking') return
  sheetOpen.value = false
}

onActivated(() => {
  void source.reload()
})

onBeforeUnmount(() => clearTimeout(toastTimer))
</script>

<template>
  <div class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <ScrollRegion>
      <FormPageHeader eyebrow="Staff" title="Day off" @close="close" />

      <main class="relative z-[1] -mt-4 rounded-t-2xl bg-surface px-4 pb-7 pt-4">

        <div class="mb-2.5 flex items-end justify-between gap-2">
          <div class="min-w-0">
            <h2 class="font-headline text-[17px] font-extrabold tracking-[-0.02em] text-on-surface">{{ calendarTitle(weeks) }}</h2>
            <p class="mt-px text-xs text-on-surface-variant">{{ myName ? `Hi ${myName}. ` : '' }}Tap a free day to book it.</p>
          </div>
          <div class="flex flex-none gap-1.5">
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-outline-variant bg-surface-container-lowest text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-35"
              aria-label="Previous week"
              :disabled="selectedIndex === 0"
              @click="stepWeek(-1)"
            ><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-outline-variant bg-surface-container-lowest text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-35"
              aria-label="Next week"
              :disabled="selectedIndex === weeks.length - 1"
              @click="stepWeek(1)"
            ><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
          </div>
        </div>

        <InlineNotice v-if="source.error.value" tone="error" icon="error" class="mb-2.5">
          <span class="flex-1">{{ source.error.value }}</span>
          <button type="button" class="min-h-11 font-bold underline focus-visible:outline-2 focus-visible:outline-lime" @click="source.reload()">Retry</button>
        </InlineNotice>

        <div class="mb-1 grid grid-cols-7 gap-[3px]" aria-hidden="true">
          <span v-for="weekday in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="weekday" class="text-center font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">{{ weekday }}</span>
        </div>
        <AttendanceWeekRow
          v-for="week in weeks"
          :key="week.monday"
          :week="week"
          :selected="week.index === selectedIndex"
          :name-of="source.staffName"
          @select-week="selectedIndex = $event"
          @select-day="selectDay"
        />

        <AttendanceLegend />

        <AttendanceWeekPanel
          :range="weekRange(selectedWeek)"
          :mine-label="selectedWeek.mineDate ? fullLabel(selectedWeek.mineDate) : null"
          :opens-later-after="opensLaterAfter"
        />
      </main>
    </ScrollRegion>

    <AttendanceToast :message="toastMessage" />

    <AttendanceBookSheet
      :open="sheetOpen"
      :phase="phase"
      :date-label="pickedDate ? fullLabel(pickedDate) : ''"
      :week-range="pickedDate ? weekRange(weeks[weekIndexOf(source.today.value, pickedDate)]!) : ''"
      :failure-title="failureTitle"
      :failure-message="failureMessage"
      @close="closeSheet"
      @confirm="confirmBook"
    />
  </div>
</template>
