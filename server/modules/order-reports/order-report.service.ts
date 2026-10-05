import type { z } from 'zod'
import {
  orderReportQuerySchema,
  orderReportResponseSchema,
} from '../../../contracts/order-reports/order-report-api.schema.js'
import { bangkokToday } from '../../../shared/utils/bangkok-datetime.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import {
  orderFormMapper,
  type OrderFormApiRow,
  type OrderFormDbRow,
} from '../work-orders/work-order.mapping.js'
import { buildOrderReport } from './order-report.aggregate.js'

type OrderReportResponse = z.infer<typeof orderReportResponseSchema>

export interface OrderReportReader {
  read(): Promise<Array<Partial<OrderFormDbRow>>>
}

export class OrderReportService {
  constructor(
    private readonly repository: () => OrderReportReader = getOrderFormRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(query: unknown): Promise<OrderReportResponse> {
    const { period, date } = parseOrThrow(orderReportQuerySchema, query)
    const today = bangkokToday(this.now())
    const resolvedDate = date ?? today
    const rows = await this.repository().read()
    return buildOrderReport(
      rows.map((row) => orderFormMapper.toApi<Partial<OrderFormApiRow>>(row)),
      period,
      resolvedDate,
      today,
    )
  }
}
