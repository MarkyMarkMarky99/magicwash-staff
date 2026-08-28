<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import IssueReportCard from '../components/IssueReportCard.vue'
import { ISSUE_REPORT_TABS } from '../components/issue-report-status'
import { useIssueReportStore } from '../stores/issue-report.store'

defineOptions({ name: 'IssueReportListPage' })

const router = useRouter()
const issueReportStore = useIssueReportStore()
const { items, loading, error, loaded } = storeToRefs(issueReportStore)
const activeKey = ref('ALL')
const filteredItems = computed(() => activeKey.value === 'ALL' ? items.value : items.value.filter((r) => r.status === activeKey.value))
const listLoading = computed(() => loading.value && !loaded.value)
const listError = computed(() => loaded.value ? null : error.value)

function openCreate() {
  void router.push({ name: 'issue-report-create' })
}

function openDetail(id: string) {
  void router.push({ name: 'issue-report-detail', params: { id } })
}

onMounted(() => void issueReportStore.load())
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <div class="flex-none bg-primary text-on-primary">
        <GenericTabs :tabs="ISSUE_REPORT_TABS" :active-key="activeKey" @select="activeKey = $event" />
      </div>
    </template>

      <ListContainer
        title="แจ้งปัญหา"
        icon="bug_report"
        :count="filteredItems.length"
        count-label="รายการ"
        :loading="listLoading"
        :skeleton-rows="4"
        :error="listError"
        :empty="!listLoading && !listError && filteredItems.length === 0"
        empty-text="ไม่พบรายการ"
      >
        <template #actions>
          <button
            type="button"
            class="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 font-label text-[11px] font-bold text-on-primary shadow-sm"
            @click="openCreate"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
            <span>แจ้งปัญหาใหม่</span>
          </button>
        </template>
        <IssueReportCard v-for="report in filteredItems" :key="report.issueReportId" :report="report" @select="openDetail" />
      </ListContainer>
  </ListPageLayout>
</template>
