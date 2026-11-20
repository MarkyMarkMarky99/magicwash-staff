import type { z } from 'zod'
import { stockTakeApiContract as api } from '@contracts/stock-takes/stock-take-api.schema'
import { apiGet, apiPost } from '@/shared/api/api-client'

type Request = typeof api.request
type Response = typeof api.response
export type StockTakeSession = z.infer<Response['create']>
export type StockTakeReport = z.infer<Response['report']>
export type StockTakePreview = z.infer<Response['preview']>
export type StockTakeApply = z.infer<Response['apply']>
export type StockTakeOpenPayload = z.input<Request['create']>
export type StockTakeScan = z.input<Request['scans']>['scans'][number]
export type StockTakeResolution = z.input<Request['resolutions']>['resolutions'][number]

const endpoint = '/api/stock-takes'

export function loadActiveStockTake() {
  return apiGet<z.infer<Response['active']>>(endpoint)
}

export function loadStockTakeReport(sessionId: string) {
  const query = api.query.report.parse({ sessionId })
  return apiGet<StockTakeReport>(endpoint + '/report?' + new URLSearchParams(query))
}

export function openStockTake(data: StockTakeOpenPayload = {}) {
  return apiPost<StockTakeSession>(endpoint, { data, requestSchema: api.request.create })
}

type Action = 'close' | 'cancel' | 'scans' | 'resolutions' | 'preview' | 'apply' | 'finish'

export function stockTakeAction<K extends Action>(action: K, data: z.input<Request[K]>) {
  return apiPost<z.infer<Response[K]>>(endpoint + '/' + action, { data, requestSchema: api.request[action] })
}
