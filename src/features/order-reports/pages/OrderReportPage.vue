<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import { bangkokToday } from '@shared/utils/bangkok-datetime'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import PullToRefresh from '@/shared/components/PullToRefresh.vue'
import { useOrderSnapshotStore } from '@/data/order-snapshots/order-snapshot.store'
import { buildOrderReport } from '@shared/reports/order-report.aggregate'
import ReportBarChart from '@/shared/components/reports/ReportBarChart.vue'
import ReportBreakdownCard from '@/shared/components/reports/ReportBreakdownCard.vue'
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
import { changePercent, formatCount, monthLabel, shiftDate, shortDate, tileLabel } from '@/shared/utils/report-format'
import {
  ORDER_REPORT_ROUTE_NAME,
  canStepForward,
  chartBars,
  completionNote,
  completionRing,
  dayColumns,
  dayFocus,
  parseReportQuery,
  previousPeriodLabel,
  reportQueryFor,
  serviceBreakdown,
  serviceRows,
  statusStats,
  stepDate,
  type ReportPeriod,
  type ReportView,
} from '../utils/order-report'

defineOptions({ name: 'OrderReportPage' })

const route = useRoute()
const router = useRouter()

const PERIOD_OPTIONS: ReportOption<ReportPeriod>[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const today = ref(bangkokToday())
const view = ref<ReportView>(parseReportQuery(route.query, today.value))
const snapshotStore = useOrderSnapshotStore()
const report = computed(() => snapshotStore.orders === null
  ? null
  : buildOrderReport(snapshotStore.orders, view.value.period, view.value.date, today.value))
const loaded = report
const error = computed(() => snapshotStore.orders === null ? snapshotStore.error : null)
const focus = computed(() => {
  if (loaded.value === null) return null
  return view.value.day === null ? loaded.value : dayFocus(loaded.value, view.value.day)
})

const canForward = computed(() => canStepForward(view.value.period, view.value.date, today.value))
const weekFrom = computed(() => shiftDate(view.value.date, -6))
const change = computed(() => (loaded.value ? changePercent(loaded.value.totals.orders, loaded.value.previousTotals.orders) : null))
const previousLabel = computed(() => (loaded.value
  ? previousPeriodLabel(view.value.period, loaded.value.previousRange)
  : view.value.period === 'month' ? 'Previous month' : 'Previous 7 days'))
const days = computed(() => (loaded.value && view.value.period === 'week'
  ? dayColumns(loaded.value).map((column) => ({ date: column.date, value: column.orders }))
  : []))
const bars = computed(() => (loaded.value ? chartBars(loaded.value, today.value) : []))
const services = computed(() => (focus.value ? serviceBreakdown(serviceRows(focus.value)) : []))
const focusLabel = computed(() => (view.value.day === null ? null : tileLabel(view.value.day, today.value)))

function updateQuery(next: ReportView): void {
  const query: LocationQueryRaw = { ...route.query, ...reportQueryFor(next, today.value) }
  for (const key of Object.keys(query)) if (query[key] === undefined) delete query[key]
  void router.replace({ query })
}

function selectPeriod(period: ReportPeriod): void {
  updateQuery({ period, date: today.value, day: null })
}

function selectDay(date: string): void {
  updateQuery({ ...view.value, day: view.value.day === date ? null : date })
}

function step(direction: -1 | 1): void {
  const { period, date } = view.value
  updateQuery({ period, date: stepDate(period, date, direction, today.value), day: null })
}

async function refresh(): Promise<void> {
  await snapshotStore.load()
}

watch(() => route.query, (query) => {
  if (route.name === ORDER_REPORT_ROUTE_NAME) view.value = parseReportQuery(query, today.value)
})

onActivated(() => {
  today.value = bangkokToday()
  view.value = parseReportQuery(route.query, today.value)
  void snapshotStore.load()
})
</script>

<template>
  <AppLayout>
    <PullToRefresh as="main" class="bg-on-surface pb-28 font-body text-on-primary" :refresh="refresh">
      <ReportHeading title="Orders report" subtitle="Orders received, by service and status" section-label="Report title" />

      <ReportPeriodHeader
        v-if="view.period === 'week'"
        variant="range"
        section-label="Week"
        :label="`Last 7 days · ${shortDate(weekFrom)} – ${shortDate(view.date)}`"
        previous-label="Previous 7 days"
        next-label="Next 7 days"
        :can-next="canForward"
        @step="step"
      />
      <ReportPeriodHeader
        v-else
        variant="navigator"
        section-label="Month"
        :label="monthLabel(view.date)"
        previous-label="Previous month"
        next-label="Next month"
        :can-next="canForward"
        @step="step"
      />

      <ReportMessage v-if="error" kind="error" @retry="snapshotStore.load()">{{ error }}</ReportMessage>

      <ReportMessage v-else-if="!loaded" kind="loading">Loading report…</ReportMessage>

      <template v-else>
        <ReportTotal
          section-label="Total orders"
          :value="formatCount(loaded.totals.orders)"
          unit="orders"
          :change="change"
          :comparison="`${previousLabel} · ${formatCount(loaded.previousTotals.orders)} orders`"
        />

        <ReportFocusLabel v-if="focusLabel">{{ focusLabel }}</ReportFocusLabel>
        <ReportCompletion v-if="focus" section-label="Order status" :ring="completionRing(focus)" :stats="statusStats(focus)" :note="completionNote(focus)" />

        <ReportDayPicker v-if="view.period === 'week'" section-label="Orders per day, choose a day" unit="orders" :days="days" :selected="view.day" :today="today" @select="selectDay" />
        <ReportBarChart v-else title="Orders per week" :bars="bars" />

        <template v-if="focus">
          <ReportEmptyCard v-if="focus.totals.orders === 0">{{ view.day ? 'No orders this day.' : 'No orders in this period.' }}</ReportEmptyCard>
          <ReportBreakdownCard v-else title="By service" hint="orders · pieces" heading-id="order-report-by-service" :rows="services" />
        </template>
      </template>
    </PullToRefresh>

    <ReportPeriodToggle :options="PERIOD_OPTIONS" :active="view.period" group-label="Report period" @select="selectPeriod" />
  </AppLayout>
</template>
