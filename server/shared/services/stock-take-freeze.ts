import { ApiError } from '../http/api-error.js'
import { getStockTakesRepository } from '../../sheets/StockTakes/StockTakes.repository.js'

export type StockTakeSessionReader = Pick<ReturnType<typeof getStockTakesRepository>, 'readFresh'>

export async function readActiveStockTakes(repository: StockTakeSessionReader = getStockTakesRepository()) {
  const rows = await repository.readFresh()
  const sessions = rows.filter(row => row.id || row.status)
  if (sessions.some(row => !row.id || !row.status || !['OPEN', 'CLOSED', 'APPLIED', 'CANCELLED'].includes(row.status))) {
    throw ApiError.internal('The stock-take status sheet contains an invalid session.')
  }
  return sessions.filter(row => row.status === 'OPEN' || row.status === 'CLOSED')
}

let tail: Promise<unknown> = Promise.resolve()

export function serializeStockTakeWrite<T>(write: () => Promise<T>): Promise<T> {
  const result = tail.then(write)
  tail = result.catch(() => undefined)
  return result
}

export async function withStockTakeFreezeGuard<T>(write: () => Promise<T>): Promise<T> {
  if ((await readActiveStockTakes()).length) {
    throw new ApiError('STOCK_TAKE_ACTIVE', 'This operation is paused while a stock-take is active.')
  }
  return write()
}
