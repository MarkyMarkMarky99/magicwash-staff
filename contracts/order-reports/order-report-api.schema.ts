import { z } from 'zod'

export const orderReportPeriodSchema = z.enum(['day', 'week', 'month'])

export const orderReportServiceTypeSchema = z.enum(['WSIR', 'DRCL', 'IRON', 'WASH', 'OTHER'])

export const orderReportQuerySchema = z.object({
  period: orderReportPeriodSchema,
  date: z.string().date().optional(),
})

const dayRangeSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
})

const count = z.number().int().nonnegative()

const totalsSchema = z.object({ orders: count, pieces: z.number().nonnegative(), cancelled: count })

const statusSchema = z.object({ pending: count, inProgress: count, completed: count })

const byServiceSchema = z.array(z.object({
  serviceType: orderReportServiceTypeSchema,
  orders: count,
  pieces: z.number().nonnegative(),
}))

const orderReportDaySchema = z.object({
  date: z.string().date(),
  totals: totalsSchema,
  status: statusSchema,
  byService: byServiceSchema,
  sevenDayAverage: z.number().nonnegative(),
})

export const orderReportResponseSchema = z.object({
  period: orderReportPeriodSchema,
  date: z.string().date(),
  range: dayRangeSchema,
  previousRange: dayRangeSchema,
  totals: totalsSchema,
  previousTotals: z.object({ orders: count, pieces: z.number().nonnegative() }),
  status: statusSchema,
  byService: byServiceSchema,
  series: z.array(dayRangeSchema.extend({ label: z.string(), orders: count })),
  sevenDayAverage: z.number().nonnegative(),
  days: z.array(orderReportDaySchema),
})
