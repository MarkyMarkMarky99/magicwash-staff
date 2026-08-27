<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import { ApiError } from '@/shared/api/api-client'
import { useIssueReportActor } from '../composables/use-issue-report-actor'
import IssueReportStatusBadge from '../components/IssueReportStatusBadge.vue'
import { ISSUE_REPORT_STATUS_OPTIONS } from '../components/issue-report-status'
import { getIssueReport, type IssueReportDto, type IssueReportStatus } from '../services/issue-report.service'
import { useIssueReportStore } from '../stores/issue-report.store'

defineOptions({ name: 'IssueReportDetailPage' })

const props = defineProps<{ id: string }>()
const issueReportStore = useIssueReportStore()
const { actor, persist } = useIssueReportActor()
const report = ref<IssueReportDto | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const notFound = ref(false)
const actionError = ref<string | null>(null)
const actorReady = computed(() => actor.value.trim().length > 0)
const statusOptions = computed(() => ISSUE_REPORT_STATUS_OPTIONS.map((option) => ({ ...option, disabled: !actorReady.value })))
let latestLoad = 0

async function loadDetail() {
  const request = ++latestLoad
  const id = props.id
  loading.value = true
  loadError.value = null
  notFound.value = false
  actionError.value = null
  report.value = null

  try {
    await issueReportStore.load()
    const stored = issueReportStore.items.find((item) => item.issueReportId === id)
    if (stored) {
      if (request === latestLoad) report.value = stored
      return
    }

    const fetched = await getIssueReport(id)
    if (request === latestLoad) report.value = fetched
  } catch (error) {
    if (request !== latestLoad) return
    if (error instanceof ApiError && error.status === 404) {
      notFound.value = true
    } else {
      loadError.value = error instanceof Error ? error.message : 'Unable to load issue report'
    }
  } finally {
    if (request === latestLoad) loading.value = false
  }
}

async function changeStatus(next: string) {
  if (!actorReady.value || !report.value) return

  actionError.value = null
  try {
    report.value = await issueReportStore.update(report.value.issueReportId, {
      status: next as IssueReportStatus,
      updatedBy: actor.value.trim(),
    })
    persist()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Unable to update issue report'
  }
}

watch(() => props.id, () => void loadDetail(), { immediate: true })
</script>

<template>
  <AppLayout>
    <main v-if="loading" class="flex min-h-0 flex-1 items-center justify-center" role="status">
      <span class="material-symbols-outlined animate-pulse text-5xl text-primary" aria-hidden="true">bug_report</span>
    </main>
    <main v-else-if="loadError" class="flex min-h-0 flex-1 items-center justify-center px-6 text-center" role="alert">
      <p class="text-sm text-error">{{ loadError }}</p>
    </main>
    <main v-else-if="notFound" class="flex min-h-0 flex-1 items-center justify-center" role="status">
      <p class="text-sm text-on-surface-variant">ไม่พบรายการ</p>
    </main>
    <main v-else-if="report" class="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 py-5">
      <div class="space-y-5">
        <section class="rounded-xl bg-surface-container-low p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Issue report</p>
              <h1 class="mt-1 break-words font-headline text-xl font-bold text-primary">{{ report.title }}</h1>
            </div>
            <IssueReportStatusBadge :status="report.status" />
          </div>
          <dl class="mt-4 space-y-3 text-sm">
            <div><dt class="font-semibold text-on-surface-variant">รหัส</dt><dd>{{ report.issueReportId }}</dd></div>
            <div><dt class="font-semibold text-on-surface-variant">รายละเอียด</dt><dd class="whitespace-pre-wrap">{{ report.description }}</dd></div>
            <div><dt class="font-semibold text-on-surface-variant">สถานะ</dt><dd>{{ report.status }}</dd></div>
            <div>
              <dt class="font-semibold text-on-surface-variant">ลิงก์ภาพหน้าจอ</dt>
              <dd>
                <a v-if="report.screenshotUrl" :href="report.screenshotUrl" class="break-all text-primary underline" target="_blank" rel="noopener noreferrer">{{ report.screenshotUrl }}</a>
                <template v-else>—</template>
              </dd>
            </div>
            <div><dt class="font-semibold text-on-surface-variant">สร้างเมื่อ</dt><dd>{{ report.createdAt }}</dd></div>
            <div><dt class="font-semibold text-on-surface-variant">ผู้แจ้ง</dt><dd>{{ report.createdBy ?? '—' }}</dd></div>
            <div><dt class="font-semibold text-on-surface-variant">อัปเดตเมื่อ</dt><dd>{{ report.updatedAt ?? '—' }}</dd></div>
            <div><dt class="font-semibold text-on-surface-variant">ผู้อัปเดต</dt><dd>{{ report.updatedBy ?? '—' }}</dd></div>
          </dl>
        </section>

        <section class="space-y-3 rounded-xl border border-outline-variant/30 p-4">
          <p v-if="actionError" class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">{{ actionError }}</p>
          <FormInput id="issue-report-detail-actor" v-model="actor" label="ผู้ดำเนินการ" placeholder="ชื่อพนักงาน" autocomplete="name" />
          <FormOptionGrid :model-value="report.status" label="เปลี่ยนสถานะ" :options="statusOptions" variant="compact" @update:model-value="changeStatus" />
        </section>
      </div>
    </main>
  </AppLayout>
</template>
