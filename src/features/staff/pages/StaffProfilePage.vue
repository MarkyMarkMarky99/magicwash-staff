<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { bangkokToday } from '@shared/utils/bangkok-datetime'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import PullToRefresh from '@/shared/components/PullToRefresh.vue'
import BaseDropdown from '@/shared/components/BaseDropdown.vue'
import AssignmentCard from '@/shared/components/AssignmentCard.vue'
import ReportBarChart from '@/shared/components/reports/ReportBarChart.vue'
import ReportBreakdownCard from '@/shared/components/reports/ReportBreakdownCard.vue'
import ReportCard from '@/shared/components/reports/ReportCard.vue'
import ReportCompletion from '@/shared/components/reports/ReportCompletion.vue'
import ReportDayPicker from '@/shared/components/reports/ReportDayPicker.vue'
import ReportEmptyCard from '@/shared/components/reports/ReportEmptyCard.vue'
import ReportFocusLabel from '@/shared/components/reports/ReportFocusLabel.vue'
import ReportHeading from '@/shared/components/reports/ReportHeading.vue'
import ReportMessage from '@/shared/components/reports/ReportMessage.vue'
import ReportPeriodHeader from '@/shared/components/reports/ReportPeriodHeader.vue'
import ReportPeriodToggle from '@/shared/components/reports/ReportPeriodToggle.vue'
import ReportTotal from '@/shared/components/reports/ReportTotal.vue'
import type { ReportOption } from '@/shared/components/reports/report-types'
import StaffPreferredLanguageSection from '../components/StaffPreferredLanguageSection.vue'
import StaffSecretarySection from '../components/StaffSecretarySection.vue'
import { personalAgentTargetRoute, staffEditRoute } from '@/shared/navigation/form-routes'
import { changePercent, formatCount, shortDate, tileLabel } from '@/shared/utils/report-format'
import { useAuthStore } from '@/data/auth/auth.store'
import { useStaffStore } from '@/data/staff/staff.store'
import { useStaffOpenAssignmentsStore } from '@/data/team-agent/staff-open-assignments.store'
import { listWorkTransactions, type WorkTransactionDto } from '@/data/work-transactions/work-transaction.service'
import {
  averageWorkedDay,
  dailyMinutes,
  daysEndingAt,
  rankStaff,
  summarizeDay,
} from '../utils/staff-performance'
import { STAFF_DEPARTMENT_LABELS } from '../utils/staff-presentation'
import {
  assignmentAccess,
  dayRing,
  dayStats,
  departmentBreakdown,
  versusAverageNote,
  weekBars,
  type StaffProfileView,
} from '../utils/staff-report'

defineOptions({ name: 'StaffProfilePage' })

const props = defineProps<{ staffId: string }>()

const DEPARTMENT_LABELS: Record<string, string> = STAFF_DEPARTMENT_LABELS
const VIEW_OPTIONS: ReportOption<StaffProfileView>[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
]

const router = useRouter()
const authStore = useAuthStore()
const staffStore = useStaffStore()
const assignmentsStore = useStaffOpenAssignmentsStore()
const { isAdmin, staff, role } = storeToRefs(authStore)
const { error: staffError, loaded: staffLoaded } = storeToRefs(staffStore)
const { items: openAssignments, error: assignmentsError } = storeToRefs(assignmentsStore)

const today = ref(bangkokToday())
const fortnight = computed(() => daysEndingAt(today.value, 14))
const previousWeek = computed(() => fortnight.value.slice(0, 7))
const week = computed(() => fortnight.value.slice(7))

const rows = ref<WorkTransactionDto[]>([])
const loading = ref(false)
const loadedFor = ref<string | null>(null)
const error = ref<string | null>(null)
const view = ref<StaffProfileView>('day')
const selectedDay = ref(today.value)
let latestLoad = 0

const member = computed(() => staffStore.items.find((row) => row.staffId === props.staffId) ?? null)
const displayName = computed(() => member.value?.name || staffStore.nameOf(props.staffId))
const initial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || '?')
const subtitle = computed(() => {
  if (!member.value) return staffLoaded.value ? 'Not in the staff list' : ''
  const parts = [member.value.position, member.value.role === 'admin' ? 'Admin' : 'Staff']
  if (member.value.startDate) parts.push(`Since ${formatMonth(member.value.startDate)}`)
  return parts.filter(Boolean).join(' · ')
})
const menuActions = computed(() => {
  const actions: { key: string; label: string; icon: string; to: RouteLocationRaw }[] = []
  if (isAdmin.value) {
    actions.push({ key: 'edit', label: 'Edit', icon: 'edit', to: staffEditRoute(props.staffId) })
    actions.push({ key: 'assistant', label: 'Open assistant', icon: 'smart_toy', to: personalAgentTargetRoute(props.staffId) })
  }
  if (isAdmin.value || staff.value?.staffId === props.staffId) {
    actions.push({ key: 'day-off', label: 'Day off', icon: 'event_busy', to: '/attendance' })
  }
  return actions
})
const resultsReady = computed(() => loadedFor.value === fortnight.value[0] && !error.value)

const weekMinutes = computed(() => dailyMinutes(rows.value, props.staffId, week.value))
const previousWeekMinutes = computed(() => dailyMinutes(rows.value, props.staffId, previousWeek.value))
const average = computed(() => averageWorkedDay(weekMinutes.value))

const day = computed(() => summarizeDay(rows.value, props.staffId, selectedDay.value))
const rankingRows = computed(() => rows.value.filter((row) => !staffStore.isAssistant(row.staffId)))
const dayRanking = computed(() => rankStaff(rankingRows.value, [selectedDay.value]))
const dayRank = computed(() => dayRanking.value.findIndex((total) => total.staffId === props.staffId) + 1)

const rangeLabel = computed(() => `Last 7 days · ${shortDate(week.value[0]!)} – ${shortDate(today.value)}`)
const pickerDays = computed(() => week.value.map((date, index) => ({ date, value: weekMinutes.value[index]! })))
const selectedLabel = computed(() => tileLabel(selectedDay.value, today.value))
const ring = computed(() => dayRing(day.value.minutes, average.value))
const stats = computed(() => dayStats(day.value.jobs, dayRank.value, dayRanking.value.length, average.value))
const dayNote = computed(() => versusAverageNote(day.value.minutes, average.value))
const departmentRows = computed(() => departmentBreakdown(day.value, DEPARTMENT_LABELS))

const weekTotal = computed(() => weekMinutes.value.reduce((sum, minutes) => sum + minutes, 0))
const previousWeekTotal = computed(() => previousWeekMinutes.value.reduce((sum, minutes) => sum + minutes, 0))
const weekChange = computed(() => changePercent(weekTotal.value, previousWeekTotal.value))
const bars = computed(() => weekBars(week.value, weekMinutes.value, today.value))
const leaderboard = computed(() => {
  const ranking = rankStaff(rankingRows.value, week.value)
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

const access = computed(() => assignmentAccess(role.value, staff.value?.staffId ?? null, props.staffId))
const showAdminSettings = computed(() => isAdmin.value && member.value?.active === true && (member.value.role === 'admin' || member.value.role === 'staff'))
const assignmentTarget = computed(() => (access.value.visible ? (access.value.staffId ?? 'self') : null))

function formatMonth(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

async function load(): Promise<void> {
  const id = ++latestLoad
  const from = fortnight.value[0]!
  loading.value = true
  error.value = null
  try {
    const result = await listWorkTransactions(from, today.value)
    if (id !== latestLoad) return
    rows.value = result
    loadedFor.value = from
  } catch {
    if (id === latestLoad) error.value = 'Could not load work scores'
  } finally {
    if (id === latestLoad) loading.value = false
  }
}

function loadAssignments(): Promise<void> {
  if (!access.value.visible) {
    assignmentsStore.reset()
    return Promise.resolve()
  }
  return assignmentsStore.load(access.value.staffId)
}

function refresh(): Promise<void> {
  return Promise.all([load(), loadAssignments()]).then(() => undefined)
}

function openAssignmentsPage(): void {
  void router.push({ name: 'personal-assignments' })
}

// The page stays cached; re-read on every visit so new scores and a new Bangkok day show up.
onActivated(() => {
  const now = bangkokToday()
  if (now !== today.value) {
    today.value = now
    selectedDay.value = now
  }
  void load()
  void loadAssignments()
  if (!staffStore.loaded) void staffStore.load()
})

watch(() => props.staffId, () => {
  selectedDay.value = today.value
})

// The viewer's role arrives after sign-in and the profile can change while the page is cached.
watch([assignmentTarget, () => props.staffId], () => {
  void loadAssignments()
})
</script>

<template>
  <AppLayout>
    <PullToRefresh as="main" class="bg-on-surface pb-28 font-body text-on-primary" :refresh="refresh">
      <ReportHeading :title="displayName" :subtitle="subtitle" section-label="Staff member">
        <template #leading>
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-lime bg-on-primary/5 font-headline text-[22px] font-bold text-lime">
            {{ initial }}
          </div>
        </template>

        <ul v-if="member?.departments.length" class="mt-1.5 flex flex-wrap gap-1.5" aria-label="Departments">
          <li
            v-for="department in member.departments"
            :key="department"
            class="rounded-full border border-on-primary/10 bg-on-primary/5 px-2.5 py-0.5 text-[11px] font-semibold text-on-primary/75"
          >
            {{ DEPARTMENT_LABELS[department] ?? department }}
          </li>
        </ul>
        <p v-if="staffError && !staffLoaded" class="text-[13px] text-on-primary/60">
          Could not load staff details
          <button type="button" class="ml-1 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="staffStore.load()">Retry</button>
        </p>

        <template #action>
          <BaseDropdown
            v-if="menuActions.length"
            panel-class="w-48 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl"
          >
            <template #trigger="{ setTrigger, toggle, triggerAttrs }">
              <button
                :ref="setTrigger"
                v-bind="triggerAttrs"
                type="button"
                class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[14px] border border-on-primary/10 bg-on-primary/5 text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
                aria-label="Staff actions"
                aria-haspopup="menu"
                @click="toggle"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">more_vert</span>
              </button>
            </template>

            <template #default="{ close }">
              <div class="py-1" role="menu" aria-label="Staff actions">
                <RouterLink
                  v-for="action in menuActions"
                  :key="action.key"
                  :to="action.to"
                  role="menuitem"
                  class="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
                  @click="close()"
                >
                  <span class="material-symbols-outlined text-[16px] leading-none text-primary" aria-hidden="true">{{ action.icon }}</span>
                  {{ action.label }}
                </RouterLink>
              </div>
            </template>
          </BaseDropdown>
        </template>
      </ReportHeading>

      <ReportPeriodHeader variant="range" section-label="Last 7 days" :label="rangeLabel" :navigable="false" />

      <ReportMessage v-if="error" kind="error" @retry="load">{{ error }}</ReportMessage>

      <ReportMessage v-else-if="!resultsReady" kind="loading">Loading work scores…</ReportMessage>

      <template v-else-if="view === 'day'">
        <ReportFocusLabel>{{ selectedLabel }}</ReportFocusLabel>
        <ReportCompletion section-label="Work score" :ring="ring" :stats="stats" :note="dayNote" />

        <ReportDayPicker section-label="Minutes per day, choose a day" unit="minutes" :days="pickerDays" :selected="selectedDay" :today="today" @select="selectedDay = $event" />

        <ReportEmptyCard v-if="!departmentRows.length">No completed jobs this day.</ReportEmptyCard>
        <ReportBreakdownCard v-else title="By task" hint="jobs · minutes" heading-id="profile-by-task" :rows="departmentRows" />
      </template>

      <template v-else>
        <ReportTotal
          section-label="Week total"
          :value="formatCount(weekTotal)"
          unit="minutes"
          :change="weekChange"
          :comparison="`Previous 7 days · ${formatCount(previousWeekTotal)} min`"
        />

        <ReportBarChart title="Minutes per day" :bars="bars" />

        <ReportCard title="All staff" hint="min / 7 days" heading-id="profile-leaderboard">
          <p v-if="!leaderboard.length" class="text-[13px] text-on-primary/60">No work recorded in the last 7 days.</p>
          <div
            v-for="entry in leaderboard"
            :key="entry.staffId"
            class="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
            :class="entry.isSelf ? 'bg-on-primary/10' : ''"
          >
            <span class="w-5 font-headline text-[13px] font-extrabold" :class="entry.isSelf ? 'text-on-primary/75' : 'text-on-primary/60'">{{ entry.rank }}</span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[13px] font-semibold">{{ entry.name }}<span v-if="entry.isSelf" class="text-on-primary/75"> (this profile)</span></div>
              <div class="mt-1 h-[5px] overflow-hidden rounded-full bg-on-primary/10">
                <div class="h-[5px] rounded-full" :class="entry.isSelf ? 'bg-lime' : 'bg-on-primary/30'" :style="{ width: entry.width }" />
              </div>
            </div>
            <span class="w-12 text-right font-headline text-[14px] font-bold">{{ entry.minutes.toLocaleString('en-US') }}</span>
          </div>
        </ReportCard>
      </template>

      <ReportCard v-if="openAssignments.length" title="Open assignments" :hint="`${openAssignments.length} open`" heading-id="profile-open-assignments">
        <ul class="grid gap-2.5">
          <AssignmentCard
            v-for="assignment in openAssignments"
            :key="assignment.id"
            :assignment="assignment"
            :show-assignee="false"
            :tappable="isAdmin"
            @select="openAssignmentsPage"
          />
        </ul>
      </ReportCard>
      <p v-else-if="assignmentsError" class="mx-4 mt-3 text-[13px] text-on-primary/60" role="status">
        {{ assignmentsError }}
        <button type="button" class="ml-1 min-h-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="loadAssignments()">Retry</button>
      </p>

      <StaffPreferredLanguageSection v-if="showAdminSettings" :staff-id="staffId" />
      <StaffSecretarySection v-if="showAdminSettings" :staff-id="staffId" />
    </PullToRefresh>

    <ReportPeriodToggle :options="VIEW_OPTIONS" :active="view" group-label="Period" @select="view = $event" />
  </AppLayout>
</template>
