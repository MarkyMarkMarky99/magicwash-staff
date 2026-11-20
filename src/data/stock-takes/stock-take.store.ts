import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  loadActiveStockTake, loadStockTakeReport, openStockTake, stockTakeAction,
  type StockTakeOpenPayload, type StockTakeReport, type StockTakeResolution, type StockTakeScan, type StockTakeSession,
} from './stock-take.service'

export const useStockTakeStore = defineStore('stock-takes', () => {
  const active = ref<StockTakeSession | null>(null)
  const report = ref<StockTakeReport | null>(null)
  let activeRevision = 0
  let reportRevision = 0

  async function refreshActive() {
    const revision = ++activeRevision
    const session = await loadActiveStockTake()
    if (revision === activeRevision) active.value = session
    return session
  }

  async function refreshReport(sessionId: string) {
    const revision = ++reportRevision
    const result = await loadStockTakeReport(sessionId)
    if (revision === reportRevision) report.value = result
    return result
  }

  function saveSession(session: StockTakeSession) {
    activeRevision++
    active.value = session.status === 'OPEN' || session.status === 'CLOSED' ? session : null
    if (report.value?.session.id === session.id) {
      reportRevision++
      report.value = { ...report.value, session }
    }
    return session
  }

  async function open(data: StockTakeOpenPayload = {}) {
    return saveSession(await openStockTake(data))
  }

  async function close(sessionId: string) {
    return saveSession(await stockTakeAction('close', { sessionId }))
  }

  async function cancel(sessionId: string) {
    return saveSession(await stockTakeAction('cancel', { sessionId }))
  }

  async function preview(sessionId: string) {
    const revision = ++reportRevision
    const result = await stockTakeAction('preview', { sessionId })
    if (revision === reportRevision) report.value = result.report
    return result
  }

  async function finish(sessionId: string) {
    return saveSession(await stockTakeAction('finish', { sessionId }))
  }

  function scan(sessionId: string, scans: StockTakeScan[]) {
    return stockTakeAction('scans', { sessionId, scans })
  }

  function resolve(sessionId: string, resolutions: StockTakeResolution[]) {
    return stockTakeAction('resolutions', { sessionId, resolutions })
  }

  function apply(sessionId: string) {
    return stockTakeAction('apply', { sessionId })
  }

  return { active, report, refreshActive, refreshReport, open, close, cancel, scan, resolve, preview, apply, finish }
})
