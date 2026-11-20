import { getStockTakesRepository } from '../../../server/sheets/StockTakes/StockTakes.repository.js'

/** These isolated route tests exercise normal writes with no active count. */
export function stubClearStockTake(): void {
  process.env.JOB_TICKETS_SPREADSHEET_ID ??= 'dry-test-job-tickets'
  getStockTakesRepository().readFresh = async () => []
}
