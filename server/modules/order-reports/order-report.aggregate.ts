import type { z } from 'zod'
import {
  orderReportQuerySchema,
  orderReportResponseSchema,
  orderReportServiceTypeSchema,
} from '../../../contracts/order-reports/order-report-api.schema.js'
import { normalizeSheetTimestamp, toNumber } from '../../../shared/utils/bangkok-datetime.js'
import type { OrderFormApiRow } from '../work-orders/work-order.mapping.js'

type OrderReportPeriod = z.infer<typeof orderReportQuerySchema>['period']
type OrderReportResponse = z.infer<typeof orderReportResponseSchema>
type OrderReportServiceType = z.infer<typeof orderReportServiceTypeSchema>
type DayRange = OrderReportResponse['range']

export type OrderReportSourceRow = Partial<
  Pick<OrderFormApiRow, 'orderId' | 'receivedDate' | 'serviceType' | 'status' | 'quantity'>
>

interface CountedOrder {
  day: string
  status: string
  serviceType: OrderReportServiceType
  pieces: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const SERVICE_ORDER: OrderReportServiceType[] = ['WSIR', 'DRCL', 'IRON', 'WASH', 'OTHER']
const IN_PROGRESS_STATUSES = new Set(['RECEIVED', 'SUBMITTED', 'APPROVED'])

function toUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(day: string, days: number): string {
  return formatDay(new Date(toUtc(day).getTime() + days * DAY_MS))
}

function isRealDay(value: string): boolean {
  return DAY_PATTERN.test(value) && formatDay(toUtc(value)) === value
}

function monthRange(day: string): DayRange {
  const [year, month] = day.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = day.slice(0, 7)
  return { from: `${prefix}-01`, to: `${prefix}-${String(last).padStart(2, '0')}` }
}

function previousMonthRange(day: string): DayRange {
  return monthRange(addDays(`${day.slice(0, 7)}-01`, -1))
}

function rangesFor(period: OrderReportPeriod, date: string): { range: DayRange; previousRange: DayRange } {
  if (period === 'day') {
    return {
      range: { from: date, to: date },
      previousRange: { from: addDays(date, -1), to: addDays(date, -1) },
    }
  }
  if (period === 'week') {
    return {
      range: { from: addDays(date, -6), to: date },
      previousRange: { from: addDays(date, -13), to: addDays(date, -7) },
    }
  }
  return { range: monthRange(date), previousRange: previousMonthRange(date) }
}

function toCountedOrder(row: OrderReportSourceRow): CountedOrder | null {
  if (typeof row.orderId !== 'string' || row.orderId.trim() === '') return null
  const day = normalizeSheetTimestamp(row.receivedDate).slice(0, 10)
  if (!isRealDay(day)) return null
  const service = orderReportServiceTypeSchema.safeParse(row.serviceType)
  return {
    day,
    status: typeof row.status === 'string' ? row.status.trim() : '',
    serviceType: service.success ? service.data : 'OTHER',
    pieces: toNumber(row.quantity),
  }
}

function within(order: CountedOrder, range: DayRange): boolean {
  return order.day >= range.from && order.day <= range.to
}

function buildSeries(
  period: OrderReportPeriod,
  date: string,
  range: DayRange,
  active: CountedOrder[],
): OrderReportResponse['series'] {
  const ordersOn = (from: string, to: string) =>
    active.filter((order) => order.day >= from && order.day <= to).length

  if (period !== 'month') {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(date, index - 6)
      return {
        from: day,
        to: day,
        label: WEEKDAYS[toUtc(day).getUTCDay()]!,
        orders: ordersOn(day, day),
      }
    })
  }

  const prefix = range.from.slice(0, 8)
  const bucketCount = Number(range.to.slice(8)) > 28 ? 5 : 4
  return Array.from({ length: bucketCount }, (_, index) => {
    const from = `${prefix}${String(index * 7 + 1).padStart(2, '0')}`
    const to = index === 4 ? range.to : `${prefix}${String(index * 7 + 7).padStart(2, '0')}`
    return { from, to, label: `W${index + 1}`, orders: ordersOn(from, to) }
  })
}

export function buildOrderReport(
  rows: OrderReportSourceRow[],
  period: OrderReportPeriod,
  date: string,
): OrderReportResponse {
  const orders = rows.flatMap((row) => {
    const counted = toCountedOrder(row)
    return counted === null ? [] : [counted]
  })
  const { range, previousRange } = rangesFor(period, date)
  const active = orders.filter((order) => order.status !== 'CANCELLED')
  const current = active.filter((order) => within(order, range))
  const previous = active.filter((order) => within(order, previousRange))
  const sumPieces = (list: CountedOrder[]) => list.reduce((total, order) => total + order.pieces, 0)
  const countStatus = (predicate: (status: string) => boolean) =>
    current.filter((order) => predicate(order.status)).length
  const sevenDayOrders = active.filter((order) => order.day >= addDays(date, -6) && order.day <= date).length

  return {
    period,
    date,
    range,
    previousRange,
    totals: {
      orders: current.length,
      pieces: sumPieces(current),
      cancelled: orders.filter((order) => order.status === 'CANCELLED' && within(order, range)).length,
    },
    previousTotals: { orders: previous.length, pieces: sumPieces(previous) },
    status: {
      pending: countStatus((status) => status === 'PENDING'),
      inProgress: countStatus((status) => IN_PROGRESS_STATUSES.has(status)),
      completed: countStatus((status) => status === 'COMPLETED'),
    },
    byService: SERVICE_ORDER.map((serviceType) => {
      const matching = current.filter((order) => order.serviceType === serviceType)
      return { serviceType, orders: matching.length, pieces: sumPieces(matching) }
    }),
    series: buildSeries(period, date, range, active),
    sevenDayAverage: Math.round((sevenDayOrders / 7) * 10) / 10,
  }
}
