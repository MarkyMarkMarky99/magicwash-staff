import type { z } from 'zod'
import { orderReportQuerySchema, type orderReportPeriodSchema, type orderReportResponseSchema } from '@contracts/order-reports/order-report-api.schema'
import { apiGet } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type OrderReportDto = z.infer<typeof orderReportResponseSchema>
export type OrderReportPeriod = z.infer<typeof orderReportPeriodSchema>

export function getOrderReport(
  period: OrderReportPeriod,
  date: string,
  onFresh?: (report: OrderReportDto) => void,
): Promise<OrderReportDto> {
  const query = orderReportQuerySchema.parse({ period, date })
  return apiGet<OrderReportDto>(`/api/order-reports?period=${query.period}&date=${query.date}`, { onFresh })
}

export function invalidateOrderReports(): void {
  invalidate('/api/order-reports')
}
