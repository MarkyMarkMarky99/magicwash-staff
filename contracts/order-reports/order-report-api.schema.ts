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

export const orderReportResponseSchema = z.object({
  period: orderReportPeriodSchema,
  date: z.string().date(),
  range: dayRangeSchema,
  previousRange: dayRangeSchema,
  totals: z.object({ orders: count, pieces: z.number().nonnegative(), cancelled: count }),
  previousTotals: z.object({ orders: count, pieces: z.number().nonnegative() }),
  status: z.object({ pending: count, inProgress: count, completed: count }),
  byService: z.array(z.object({
    serviceType: orderReportServiceTypeSchema,
    orders: count,
    pieces: z.number().nonnegative(),
  })),
  series: z.array(dayRangeSchema.extend({ label: z.string(), orders: count })),
  sevenDayAverage: z.number().nonnegative(),
})
