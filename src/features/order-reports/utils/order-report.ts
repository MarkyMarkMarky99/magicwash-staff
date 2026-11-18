import type { OrderReportDto } from '@/data/order-reports/order-report.service'
import type { ReportBreakdownRow, ReportRing, ReportStat } from '@/shared/components/reports/report-types'
import { formatCount, percentOf, shiftDate } from '@/shared/utils/report-format'

export const ORDER_REPORT_ROUTE_NAME = 'order-report'

export type ReportPeriod = 'week' | 'month'

export interface ReportView {
  period: ReportPeriod
  date: string
  day: string | null
}

export type ReportFocus = Pick<OrderReportDto, 'period' | 'totals' | 'status' | 'byService' | 'sevenDayAverage'>

export interface DayColumn {
  date: string
  orders: number
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

const WEEK_DAYS = 7

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

export function parseReportQuery(query: Record<string, unknown>, today: string): ReportView {
  const period: ReportPeriod = firstValue(query.period) === 'month' ? 'month' : 'week'
  const rawDate = firstValue(query.date)
  const date = isRealDate(rawDate) && rawDate <= today ? rawDate : today
  const rawDay = firstValue(query.day)
  const inWeek = isRealDate(rawDay) && rawDay <= date && rawDay >= shiftDate(date, -(WEEK_DAYS - 1))
  return { period, date, day: period === 'week' && inWeek ? rawDay : null }
}

export function reportQueryFor(view: ReportView, today: string): { period: string | undefined; date: string | undefined; day: string | undefined } {
  return {
    period: view.period === 'week' ? undefined : view.period,
    date: view.date === today ? undefined : view.date,
    day: view.period === 'week' && view.day !== null ? view.day : undefined,
  }
}

function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function canStepForward(period: ReportPeriod, date: string, today: string): boolean {
  return period === 'week' ? date < today : monthOf(date) < monthOf(today)
}

export function stepDate(period: ReportPeriod, date: string, direction: -1 | 1, today: string): string {
  if (period === 'week') {
    const next = shiftDate(date, 7 * direction)
    return next > today ? today : next
  }
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const target = new Date(Date.UTC(year, month - 1 + direction, 1)).toISOString().slice(0, 10)
  return monthOf(target) >= monthOf(today) ? today : target
}

export function previousPeriodLabel(period: ReportPeriod, previousRange: OrderReportDto['previousRange']): string {
  if (period === 'week') return 'Previous 7 days'
  const year = Number(previousRange.to.slice(0, 4))
  const month = Number(previousRange.to.slice(5, 7))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Number(previousRange.to.slice(8)) < lastDay ? 'Same days last month' : 'Previous month'
}

export function completionNote(report: ReportFocus): string {
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

export function serviceRows(report: ReportFocus): ServiceRow[] {
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

export function dayColumns(report: OrderReportDto): DayColumn[] {
  return report.series.filter((entry) => entry.from === entry.to).map((entry) => ({ date: entry.from, orders: entry.orders }))
}

export function dayFocus(report: OrderReportDto, date: string): ReportFocus | null {
  const entry = report.days.find((day) => day.date === date)
  if (entry === undefined) return null
  return {
    period: 'day',
    totals: entry.totals,
    status: entry.status,
    byService: entry.byService,
    sevenDayAverage: entry.sevenDayAverage,
  }
}

export function completionRing(report: ReportFocus): ReportRing {
  const orders = report.totals.orders
  return {
    percentage: percentOf(report.status.completed, orders),
    completed: report.status.completed,
    total: orders,
    label: String(orders),
  }
}

export function statusStats(report: ReportFocus): ReportStat[] {
  const orders = report.totals.orders
  const stats: Omit<ReportStat, 'share'>[] = [
    { key: 'pending', label: 'Pending', icon: 'schedule', value: report.status.pending, tone: 'warning' },
    { key: 'in-progress', label: 'In progress', icon: 'autorenew', value: report.status.inProgress, tone: 'info' },
    { key: 'completed', label: 'Completed', icon: 'check_circle', value: report.status.completed, tone: 'lime' },
  ]
  return stats.map((stat) => ({ ...stat, share: percentOf(Number(stat.value), orders) }))
}

export function serviceBreakdown(rows: readonly ServiceRow[]): ReportBreakdownRow[] {
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.orders,
    suffix: `orders · ${formatCount(row.pieces)} pcs`,
    width: row.width,
  }))
}
