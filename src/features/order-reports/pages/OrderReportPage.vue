<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import { bangkokToday } from '@shared/utils/bangkok-datetime'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import { getOrderReport, type OrderReportDto } from '@/data/order-reports/order-report.service'
import OrderReportChart from '../components/OrderReportChart.vue'
import OrderReportDayPicker from '../components/OrderReportDayPicker.vue'
import OrderReportCompletion from '../components/OrderReportCompletion.vue'
import OrderReportPeriodToggle from '../components/OrderReportPeriodToggle.vue'
import OrderReportServices from '../components/OrderReportServices.vue'
import {
  ORDER_REPORT_ROUTE_NAME,
  canStepForward,
  changePercent,
  chartBars,
  dayColumns,
  formatCount,
  monthLabel,
  parseReportQuery,
  reportQueryFor,
  serviceRows,
  shiftDate,
  shortDate,
  stepDate,
  tileLabel,
  type ReportPeriod,
  type ReportView,
} from '../utils/order-report'

defineOptions({ name: 'OrderReportPage' })

const route = useRoute()
const router = useRouter()

const today = ref(bangkokToday())
const view = ref<ReportView>(parseReportQuery(route.query, today.value))
const report = ref<OrderReportDto | null>(null)
const loadedKey = ref<string | null>(null)
const dayReport = ref<OrderReportDto | null>(null)
const error = ref<string | null>(null)
let latestLoad = 0
let latestDayLoad = 0

const viewKey = computed(() => `${view.value.period}:${view.value.date}`)
const loaded = computed(() => (report.value !== null && loadedKey.value === viewKey.value && !error.value ? report.value : null))
const loadedDay = computed(() => (view.value.day !== null && dayReport.value?.date === view.value.day && !error.value ? dayReport.value : null))
const focus = computed(() => (view.value.day === null ? loaded.value : loadedDay.value))

const canForward = computed(() => canStepForward(view.value.period, view.value.date, today.value))
const weekFrom = computed(() => shiftDate(view.value.date, -6))
const change = computed(() => (loaded.value ? changePercent(loaded.value.totals.orders, loaded.value.previousTotals.orders) : null))
const previousLabel = computed(() => (view.value.period === 'month' ? 'Previous month' : 'Previous 7 days'))
const days = computed(() => (loaded.value && view.value.period === 'week' ? dayColumns(loaded.value) : []))
const bars = computed(() => (loaded.value ? chartBars(loaded.value, today.value) : []))
const services = computed(() => (focus.value ? serviceRows(focus.value) : []))
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

async function load(): Promise<void> {
  const id = ++latestLoad
  const { period, date } = view.value
  error.value = null
  try {
    const result = await getOrderReport(period, date)
    if (id !== latestLoad) return
    report.value = result
    loadedKey.value = `${period}:${date}`
  } catch {
    if (id === latestLoad) error.value = 'Could not load the report'
  }
}

async function loadDay(): Promise<void> {
  const id = ++latestDayLoad
  const { day } = view.value
  if (day === null) return
  try {
    const result = await getOrderReport('day', day)
    if (id === latestDayLoad) dayReport.value = result
  } catch {
    if (id === latestDayLoad) error.value = 'Could not load the report'
  }
}

function reload(): void {
  void load()
  void loadDay()
}

watch(() => route.query, (query) => {
  if (route.name === ORDER_REPORT_ROUTE_NAME) view.value = parseReportQuery(query, today.value)
})

watch(viewKey, () => void load())
watch(() => view.value.day, () => void loadDay())

onActivated(() => {
  today.value = bangkokToday()
  const next = parseReportQuery(route.query, today.value)
  const changed = next.period !== view.value.period || next.date !== view.value.date || next.day !== view.value.day
  view.value = next
  if (!changed) reload()
})
</script>

<template>
  <AppLayout>
    <ScrollRegion as="main" class="bg-on-surface pb-28 font-body text-on-primary">
      <section class="px-5 pb-1 pt-5" aria-label="Report title">
        <h2 class="font-headline text-[20px] font-bold leading-tight">Orders report</h2>
        <p class="text-[13px] text-on-primary/60">Orders received, by service and status</p>
      </section>

      <section v-if="view.period === 'week'" class="px-4 pt-4" aria-label="Week">
        <div class="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
          <button type="button" aria-label="Previous 7 days" class="flex h-11 w-11 items-center justify-center rounded-xl text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="step(-1)">
            <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          </button>
          <span class="text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-on-primary/60">Last 7 days · {{ shortDate(weekFrom) }} – {{ shortDate(view.date) }}</span>
          <button type="button" aria-label="Next 7 days" :disabled="!canForward" class="flex h-11 w-11 items-center justify-center rounded-xl text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-30" @click="step(1)">
            <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      </section>

      <section v-else class="px-4 pt-4" aria-label="Month">
        <div class="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center rounded-2xl border border-on-primary/10 bg-on-primary/5">
          <button type="button" aria-label="Previous month" class="flex h-11 w-11 items-center justify-center rounded-xl text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="step(-1)">
            <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          </button>
          <span class="text-center text-[13px] font-bold">{{ monthLabel(view.date) }}</span>
          <button type="button" aria-label="Next month" :disabled="!canForward" class="flex h-11 w-11 items-center justify-center rounded-xl text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-30" @click="step(1)">
            <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      </section>

      <p v-if="error" class="mx-4 mt-4 rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
        {{ error }}
        <button type="button" class="ml-2 min-h-11 min-w-11 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="reload">Retry</button>
      </p>

      <p v-else-if="!loaded" class="px-5 pt-8 text-center text-[13px] text-on-primary/60" aria-live="polite">Loading report…</p>

      <template v-else>
        <section class="flex flex-col gap-1 px-5 pt-3" aria-label="Total orders">
          <div class="flex items-baseline gap-2.5">
            <span class="font-headline text-[52px] font-extrabold leading-none tracking-[-0.02em]">{{ formatCount(loaded.totals.orders) }}</span>
            <span class="text-[14px] text-on-primary/60">orders</span>
            <span v-if="change" class="ml-auto rounded-full bg-secondary-container px-2.5 py-1 font-headline text-[13px] font-bold text-on-secondary-container">{{ change }}</span>
          </div>
          <span class="text-[13px] text-on-primary/60">{{ previousLabel }} · {{ formatCount(loaded.previousTotals.orders) }} orders</span>
        </section>

        <p v-if="focusLabel" class="px-5 pt-4 text-[13px] font-bold text-lime">{{ focusLabel }}</p>
        <OrderReportCompletion v-if="focus" :report="focus" />
        <p v-else class="px-5 pt-8 text-center text-[13px] text-on-primary/60" aria-live="polite">Loading day…</p>

        <OrderReportDayPicker v-if="view.period === 'week'" :days="days" :selected="view.day" :today="today" @select="selectDay" />
        <OrderReportChart v-else title="Orders per week" :bars="bars" />

        <template v-if="focus">
          <p v-if="focus.totals.orders === 0" class="mx-4 mt-3 rounded-[20px] border border-on-primary/10 bg-on-primary/5 px-4 py-6 text-center text-[13px] text-on-primary/60">{{ view.day ? 'No orders this day.' : 'No orders in this period.' }}</p>
          <OrderReportServices v-else :rows="services" />
        </template>
      </template>
    </ScrollRegion>

    <OrderReportPeriodToggle :period="view.period" @select="selectPeriod" />
  </AppLayout>
</template>
