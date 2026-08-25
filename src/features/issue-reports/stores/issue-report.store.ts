import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createIssueReport,
  listIssueReports,
  updateIssueReport,
  type IssueReportCreatePayload,
  type IssueReportDto,
  type IssueReportUpdatePayload,
} from '../services/issue-report.service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export const useIssueReportStore = defineStore('issue-reports', () => {
  const items = ref<IssueReportDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)
  let loadPromise: Promise<void> | null = null

  async function load(): Promise<void> {
    if (loaded.value) return
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      loading.value = true
      error.value = null
      try {
        items.value = await listIssueReports({ perPage: 500 })
        loaded.value = true
      } catch (reason) {
        error.value = errorMessage(reason, 'Unable to load issue reports')
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  async function reload(): Promise<void> {
    loaded.value = false
    await load()
  }

  async function create(payload: IssueReportCreatePayload): Promise<IssueReportDto> {
    loading.value = true
    error.value = null
    try {
      const created = await createIssueReport(payload)
      items.value = [created, ...items.value]
      return created
    } catch (reason) {
      error.value = errorMessage(reason, 'Unable to create issue report')
      throw reason
    } finally {
      loading.value = false
    }
  }

  async function update(id: string, payload: IssueReportUpdatePayload): Promise<IssueReportDto> {
    loading.value = true
    error.value = null
    try {
      const updated = await updateIssueReport(id, payload)
      items.value = items.value.map((item) => (item.issueReportId === id ? updated : item))
      return updated
    } catch (reason) {
      error.value = errorMessage(reason, 'Unable to update issue report')
      throw reason
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, loaded, load, reload, create, update }
})
