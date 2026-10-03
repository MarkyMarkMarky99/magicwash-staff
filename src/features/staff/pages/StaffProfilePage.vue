<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { bangkokToday } from '@shared/utils/bangkok-datetime'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import { staffEditRoute } from '@/shared/navigation/form-routes'
import { useAuthStore } from '@/data/auth/auth.store'
import { useStaffStore } from '@/data/staff/staff.store'
import { listWorkTransactions, type WorkTransactionDto } from '@/data/work-transactions/work-transaction.service'
import {
  averageWorkedDay,
  dailyMinutes,
  daysEndingAt,
  rankStaff,
  summarizeDay,
} from '../utils/staff-performance'

defineOptions({ name: 'StaffProfilePage' })

const props = defineProps<{ staffId: string }>()

type ProfileView = 'day' | 'week'

const DEPARTMENT_LABELS: Record<string, string> = {
  Tagging: 'Tagging',
  Washing: 'Washing',
  DryCleaning: 'Dry cleaning',
  Ironing: 'Ironing',
  Packaging: 'Packing',
  Logistics: 'Delivery',
}
const HERO_RADIUS = 81
const MINI_RADIUS = 23

const authStore = useAuthStore()
const staffStore = useStaffStore()
const { isAdmin } = storeToRefs(authStore)

const today = bangkokToday()
const fortnight = daysEndingAt(today, 14)
const previousWeek = fortnight.slice(0, 7)
const week = fortnight.slice(7)

const rows = ref<WorkTransactionDto[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const view = ref<ProfileView>('day')
const selectedDay = ref(today)
let latestLoad = 0

const member = computed(() => staffStore.items.find((row) => row.staffId === props.staffId) ?? null)
const displayName = computed(() => member.value?.name || staffStore.nameOf(props.staffId))
const initial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || '?')
const subtitle = computed(() => {
  const parts = [member.value?.position, member.value?.role === 'admin' ? 'Admin' : 'Staff']
  if (member.value?.startDate) parts.push(`Since ${formatMonth(member.value.startDate)}`)
  return parts.filter(Boolean).join(' · ')
})

const weekMinutes = computed(() => dailyMinutes(rows.value, props.staffId, week))
const previousWeekMinutes = computed(() => dailyMinutes(rows.value, props.staffId, previousWeek))
const average = computed(() => averageWorkedDay(weekMinutes.value))

const day = computed(() => summarizeDay(rows.value, props.staffId, selectedDay.value))
const dayRanking = computed(() => rankStaff(rows.value, [selectedDay.value]))
const dayRank = computed(() => dayRanking.value.findIndex((total) => total.staffId === props.staffId) + 1)
const versusAverage = computed(() => {
  if (day.value.minutes === 0) return 'No work recorded'
  if (average.value === 0) return 'First day with work this week'
  return `${Math.round(day.value.minutes / average.value * 100)}% of 7-day average (${average.value} min)`
})

const heroDash = computed(() => ringDash(HERO_RADIUS, average.value === 0 ? 0 : day.value.minutes / average.value))
const jobsDash = computed(() => ringDash(MINI_RADIUS, day.value.jobs === 0 ? 0 : 1))
const rankDash = computed(() => ringDash(
  MINI_RADIUS,
  dayRank.value === 0 ? 0 : (dayRanking.value.length - dayRank.value + 1) / dayRanking.value.length,
))

const dateTabs = computed(() => week.map((date, index) => ({
  date,
  weekday: weekdayLabel(date),
  dayOfMonth: Number(date.slice(8, 10)),
  label: date === today ? `Today, ${shortDate(date)}` : `${weekdayLabel(date)}, ${shortDate(date)}`,
  hasWork: weekMinutes.value[index]! > 0,
})))
const selectedLabel = computed(() => dateTabs.value.find((tab) => tab.date === selectedDay.value)?.label ?? selectedDay.value)
const monthLabel = computed(() => formatMonth(selectedDay.value, 'long'))

const departmentRows = computed(() => day.value.byDepartment.map((share) => ({
  key: share.department ?? 'other',
  label: share.department ? DEPARTMENT_LABELS[share.department] ?? share.department : 'Other',
  jobs: share.jobs,
  minutes: share.minutes,
  width: `${day.value.minutes > 0 ? Math.max(0, Math.round(share.minutes / day.value.minutes * 100)) : 0}%`,
})))

const weekTotal = computed(() => weekMinutes.value.reduce((sum, minutes) => sum + minutes, 0))
const previousWeekTotal = computed(() => previousWeekMinutes.value.reduce((sum, minutes) => sum + minutes, 0))
const weekChange = computed(() => {
  if (previousWeekTotal.value === 0) return null
  const change = Math.round((weekTotal.value - previousWeekTotal.value) / previousWeekTotal.value * 100)
  return `${change > 0 ? '+' : ''}${change}%`
})
const weekBars = computed(() => {
  const max = Math.max(...weekMinutes.value, 1)
  return week.map((date, index) => ({
    date,
    weekday: weekdayLabel(date),
    minutes: weekMinutes.value[index]!,
    height: `${Math.max(4, Math.round(weekMinutes.value[index]! / max * 118))}px`,
    isToday: date === today,
  }))
})
const leaderboard = computed(() => {
  const ranking = rankStaff(rows.value, week)
  const top = ranking[0]?.minutes ?? 1
  return ranking.map((total, index) => ({
    staffId: total.staffId,
    rank: index + 1,
    name: staffStore.nameOf(total.staffId),
    minutes: total.minutes,
    width: `${Math.round(total.minutes / top * 100)}%`,
    isSelf: total.staffId === props.staffId,
  }))
})

function ringDash(radius: number, fraction: number): string {
  const circumference = 2 * Math.PI * radius
  return `${(circumference * Math.min(1, Math.max(0, fraction))).toFixed(1)} ${circumference.toFixed(1)}`
}

function weekdayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function formatMonth(date: string, month: 'short' | 'long' = 'short'): string {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { month, year: 'numeric', timeZone: 'UTC' })
}

async function load(): Promise<void> {
  const id = ++latestLoad
  loading.value = true
  error.value = null
  try {
    const result = await listWorkTransactions(fortnight[0]!, today)
    if (id === latestLoad) rows.value = result
  } catch {
    if (id === latestLoad) error.value = 'Could not load work scores'
  } finally {
    if (id === latestLoad) loading.value = false
  }
}

watch(() => props.staffId, () => {
  selectedDay.value = today
  void load()
}, { immediate: true })

if (!staffStore.loaded) void staffStore.load()
</script>

<template>
  <AppLayout>
    <ScrollRegion as="main" class="bg-on-surface pb-8 font-body text-white">
      <section class="flex items-center gap-3.5 px-5 pb-1 pt-5" aria-label="Staff member">
        <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-lime bg-white/5 font-headline text-[22px] font-bold text-lime">
          {{ initial }}
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="truncate font-headline text-[20px] font-bold leading-tight">{{ displayName }}</h2>
          <p class="truncate text-[13px] text-white/60">{{ subtitle }}</p>
        </div>
        <RouterLink
          v-if="isAdmin"
          :to="staffEditRoute(props.staffId)"
          class="flex min-h-11 shrink-0 items-center rounded-[14px] border border-white/10 bg-white/5 px-3.5 font-label text-[13px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
        >
          Edit
        </RouterLink>
      </section>

      <div class="mx-4 mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Period">
        <button
          v-for="option in (['day', 'week'] as const)"
          :key="option"
          type="button"
          :aria-pressed="view === option"
          class="min-h-11 rounded-xl font-label text-[14px] font-bold capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
          :class="view === option ? 'bg-lime text-on-surface' : 'text-white'"
          @click="view = option"
        >
          {{ option }}
        </button>
      </div>

      <p v-if="error" class="mx-4 mt-4 rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
        {{ error }}
        <button type="button" class="ml-2 font-bold underline" @click="load">Retry</button>
      </p>

      <template v-if="view === 'day'">
        <section class="px-4 pt-4" aria-label="Choose a day">
          <div class="flex items-baseline justify-between px-1 pb-2">
            <span class="text-[13px] font-bold">{{ monthLabel }}</span>
            <span class="text-[12px] text-white/60">{{ selectedLabel }}</span>
          </div>
          <div class="grid grid-cols-7 gap-1.5">
            <button
              v-for="tab in dateTabs"
              :key="tab.date"
              type="button"
              :aria-label="tab.label"
              :aria-pressed="tab.date === selectedDay"
              class="flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[14px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
              :class="tab.date === selectedDay ? 'border-lime bg-lime text-on-surface' : 'border-white/10 bg-white/5 text-white'"
              @click="selectedDay = tab.date"
            >
              <span class="text-[11px] font-semibold opacity-80">{{ tab.weekday }}</span>
              <span class="font-headline text-[17px] font-extrabold leading-none">{{ tab.dayOfMonth }}</span>
              <span
                class="h-[5px] w-[5px] rounded-full"
                :class="!tab.hasWork ? 'bg-transparent' : tab.date === selectedDay ? 'bg-on-surface' : 'bg-info-container'"
              />
            </button>
          </div>
        </section>

        <section class="flex flex-col items-center px-5 pt-4" aria-label="Work score">
          <div class="relative h-[188px] w-[188px]" :aria-busy="loading">
            <svg width="188" height="188" viewBox="0 0 188 188" class="-rotate-90" aria-hidden="true">
              <circle cx="94" cy="94" :r="HERO_RADIUS" fill="none" stroke-width="14" class="stroke-white/10" />
              <circle cx="94" cy="94" :r="HERO_RADIUS" fill="none" stroke-width="14" stroke-linecap="round" class="stroke-lime" :stroke-dasharray="heroDash" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span class="text-[12px] font-semibold tracking-[0.12em] text-white/60">WORK SCORE</span>
              <span class="font-headline text-[54px] font-extrabold leading-none tracking-[-0.02em]">{{ loading ? '–' : day.minutes }}</span>
              <span class="text-[14px] text-white/60">standard minutes</span>
            </div>
          </div>
          <p class="mt-2 flex items-center gap-2 text-[13px] text-white/60">
            <span class="inline-block h-2 w-2 rounded-full bg-lime" />
            {{ versusAverage }}
          </p>
        </section>

        <section class="grid grid-cols-2 gap-3 px-4 pt-3" aria-label="Day summary">
          <div class="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 p-3.5">
            <svg width="56" height="56" viewBox="0 0 56 56" class="shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="28" cy="28" :r="MINI_RADIUS" fill="none" stroke-width="6" class="stroke-white/10" />
              <circle cx="28" cy="28" :r="MINI_RADIUS" fill="none" stroke-width="6" stroke-linecap="round" class="stroke-info-container" :stroke-dasharray="jobsDash" />
            </svg>
            <div class="min-w-0">
              <div class="font-headline text-[24px] font-extrabold leading-tight">{{ day.jobs }}</div>
              <div class="text-[12px] text-white/60">Jobs completed</div>
            </div>
          </div>
          <div class="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 p-3.5">
            <svg width="56" height="56" viewBox="0 0 56 56" class="shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="28" cy="28" :r="MINI_RADIUS" fill="none" stroke-width="6" class="stroke-white/10" />
              <circle cx="28" cy="28" :r="MINI_RADIUS" fill="none" stroke-width="6" stroke-linecap="round" class="stroke-lime" :stroke-dasharray="rankDash" />
            </svg>
            <div class="min-w-0">
              <div class="font-headline text-[24px] font-extrabold leading-tight">{{ dayRank ? `#${dayRank}` : '–' }}</div>
              <div class="text-[12px] text-white/60">Rank of {{ dayRanking.length }} that day</div>
            </div>
          </div>
        </section>

        <section class="mx-4 mt-3 flex flex-col gap-2.5 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3.5" aria-labelledby="profile-by-task">
          <div class="flex items-baseline justify-between">
            <h3 id="profile-by-task" class="text-[15px] font-bold">By task</h3>
            <span class="text-[12px] text-white/60">jobs · minutes</span>
          </div>
          <p v-if="!departmentRows.length" class="text-[13px] text-white/60">No completed jobs this day.</p>
          <div v-for="row in departmentRows" :key="row.key" class="flex flex-col gap-1.5">
            <div class="flex justify-between text-[13px]">
              <span>{{ row.label }} <span class="text-white/60">{{ row.jobs }} jobs</span></span>
              <span class="font-headline font-bold">{{ row.minutes }}</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div class="h-1.5 rounded-full bg-lime" :style="{ width: row.width }" />
            </div>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="flex flex-col gap-1 px-5 pt-5" aria-label="Week total">
          <span class="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">Last 7 days · {{ shortDate(week[0]!) }} – {{ shortDate(today) }}</span>
          <div class="flex items-baseline gap-2.5">
            <span class="font-headline text-[52px] font-extrabold leading-none tracking-[-0.02em]">{{ weekTotal.toLocaleString('en-US') }}</span>
            <span class="text-[14px] text-white/60">minutes</span>
            <span v-if="weekChange" class="ml-auto rounded-full bg-secondary-container px-2.5 py-1 font-headline text-[13px] font-bold text-on-secondary-container">{{ weekChange }}</span>
          </div>
          <span class="text-[13px] text-white/60">Previous 7 days · {{ previousWeekTotal.toLocaleString('en-US') }} min</span>
        </section>

        <section class="mx-4 mt-4 rounded-[20px] border border-white/10 bg-white/5 px-3.5 pb-3 pt-4" aria-label="Minutes per day">
          <div class="grid h-[150px] grid-cols-7 items-end gap-2.5">
            <div v-for="bar in weekBars" :key="bar.date" class="flex h-[150px] flex-col items-center justify-end gap-1.5">
              <span class="font-headline text-[11px] font-bold" :class="bar.isToday ? 'text-lime' : 'text-white/60'">{{ bar.minutes || '–' }}</span>
              <div class="w-full rounded-lg" :class="bar.isToday ? 'bg-lime' : bar.minutes ? 'bg-white/25' : 'bg-white/10'" :style="{ height: bar.height }" />
            </div>
          </div>
          <div class="mt-2 grid grid-cols-7 gap-2.5">
            <span v-for="bar in weekBars" :key="bar.date" class="text-center text-[12px]" :class="bar.isToday ? 'text-lime' : 'text-white/60'">{{ bar.weekday }}</span>
          </div>
        </section>

        <section class="mx-4 mt-3 flex flex-col gap-2.5 rounded-[20px] border border-white/10 bg-white/5 p-4" aria-labelledby="profile-leaderboard">
          <div class="flex items-baseline justify-between">
            <h3 id="profile-leaderboard" class="text-[15px] font-bold">All staff</h3>
            <span class="text-[12px] text-white/60">min / 7 days</span>
          </div>
          <p v-if="!leaderboard.length" class="text-[13px] text-white/60">No work recorded in the last 7 days.</p>
          <div
            v-for="entry in leaderboard"
            :key="entry.staffId"
            class="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
            :class="entry.isSelf ? 'bg-white/10' : ''"
          >
            <span class="w-5 font-headline text-[13px] font-extrabold text-white/60">{{ entry.rank }}</span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[13px] font-semibold">{{ entry.name }}<span v-if="entry.isSelf" class="text-white/60"> (this profile)</span></div>
              <div class="mt-1 h-[5px] overflow-hidden rounded-full bg-white/10">
                <div class="h-[5px] rounded-full" :class="entry.isSelf ? 'bg-lime' : 'bg-white/30'" :style="{ width: entry.width }" />
              </div>
            </div>
            <span class="w-12 text-right font-headline text-[14px] font-bold">{{ entry.minutes.toLocaleString('en-US') }}</span>
          </div>
        </section>
      </template>
    </ScrollRegion>
  </AppLayout>
</template>
