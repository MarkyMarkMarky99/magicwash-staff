import { orderReportPeriodSchema } from '@contracts/order-reports/order-report-api.schema'
import type { OrderReportDto, OrderReportPeriod } from '@/data/order-reports/order-report.service'

export const ORDER_REPORT_ROUTE_NAME = 'order-report'

export interface ReportView {
  period: OrderReportPeriod
  date: string
}

export interface ChartBar {
  key: string
  label: string
  value: number
  highlight: boolean
}

export interface ServiceRow {
  key: string
  label: string
  orders: number
  pieces: number
  width: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_TILE_COUNT = 7

const SERVICE_LABELS: Record<OrderReportDto['byService'][number]['serviceType'], string> = {
  WSIR: 'Wash & iron',
  DRCL: 'Dry cleaning',
  IRON: 'Iron only',
  WASH: 'Wash only',
  OTHER: 'Other',
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
}

function firstValue(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function dayTiles(today: string): string[] {
  return Array.from({ length: DAY_TILE_COUNT }, (_value, index) => shiftDate(today, index - (DAY_TILE_COUNT - 1)))
}

export function parseReportQuery(query: Record<string, unknown>, today: string): ReportView {
  const parsedPeriod = orderReportPeriodSchema.safeParse(firstValue(query.period))
  const period = parsedPeriod.success ? parsedPeriod.data : 'day'
  const raw = firstValue(query.date)
  const earliest = period === 'day' ? shiftDate(today, -(DAY_TILE_COUNT - 1)) : null
  const valid = isRealDate(raw) && raw <= today && (earliest === null || raw >= earliest)
  return { period, date: valid ? raw : today }
}

export function reportQueryFor(view: ReportView, today: string): { period: string | undefined; date: string | undefined } {
  return {
    period: view.period === 'day' ? undefined : view.period,
    date: view.date === today ? undefined : view.date,
  }
}

function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function canStepForward(period: OrderReportPeriod, date: string, today: string): boolean {
  if (period === 'week') return date < today
  if (period === 'month') return monthOf(date) < monthOf(today)
  return false
}

export function stepDate(period: 'week' | 'month', date: string, direction: -1 | 1, today: string): string {
  if (period === 'week') {
    const next = shiftDate(date, 7 * direction)
    return next > today ? today : next
  }
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const target = new Date(Date.UTC(year, month - 1 + direction, 1)).toISOString().slice(0, 10)
  return monthOf(target) >= monthOf(today) ? today : target
}

export function percentOf(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round(count / total * 100)))
}

export function changePercent(current: number, previous: number): string | null {
  if (previous === 0) return null
  const change = Math.round((current - previous) / previous * 100)
  return `${change > 0 ? '+' : ''}${change}%`
}

export function barHeights(values: readonly number[], maxPixels: number, minPixels = 4): number[] {
  const max = Math.max(...values, 1)
  return values.map((value) => Math.max(minPixels, Math.round(value / max * maxPixels)))
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function weekdayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function tileLabel(date: string, today: string): string {
  return date === today ? `Today, ${shortDate(date)}` : `${weekdayLabel(date)}, ${shortDate(date)}`
}

export function completionNote(report: OrderReportDto): string {
  const base = `${formatCount(report.totals.pieces)} pieces · ${report.totals.cancelled} cancelled`
  if (report.period !== 'day' || report.sevenDayAverage === 0) return base
  const versusAverage = Math.round(report.totals.orders / report.sevenDayAverage * 100)
  return `${base} · ${versusAverage}% of 7-day average (${report.sevenDayAverage})`
}

export function chartBars(report: OrderReportDto, highlightDate: string): ChartBar[] {
  return report.series.map((entry) => ({
    key: entry.from,
    label: entry.label,
    value: entry.orders,
    highlight: entry.from <= highlightDate && highlightDate <= entry.to,
  }))
}

export function serviceRows(report: OrderReportDto): ServiceRow[] {
  return report.byService
    .filter((entry) => entry.serviceType !== 'OTHER' || entry.orders > 0)
    .map((entry) => ({
      key: entry.serviceType,
      label: SERVICE_LABELS[entry.serviceType],
      orders: entry.orders,
      pieces: entry.pieces,
      width: percentOf(entry.orders, report.totals.orders),
    }))
}

export function dayOrderCounts(report: OrderReportDto): Map<string, number> {
  return new Map(report.series.filter((entry) => entry.from === entry.to).map((entry) => [entry.from, entry.orders]))
}
