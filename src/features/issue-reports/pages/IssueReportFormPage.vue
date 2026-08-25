<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import FormInput from '@/shared/components/FormInput.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useGoBack } from '@/shared/composables/use-go-back'
import { useIssueReportActor } from '../composables/use-issue-report-actor'
import { useIssueReportStore } from '../stores/issue-report.store'

defineOptions({ name: 'IssueReportFormPage' })

const router = useRouter()
const { goBack } = useGoBack()
const issueReportStore = useIssueReportStore()
const { actor, persist } = useIssueReportActor()
const report = reactive({ title: '', description: '', screenshotUrl: '' })
const submitting = ref(false)
const formError = ref<string | null>(null)
const canSubmit = computed(() => !submitting.value && report.title.trim() && report.description.trim() && actor.value.trim())

function createPayload() {
  return {
    title: report.title.trim(),
    description: report.description.trim(),
    screenshotUrl: report.screenshotUrl.trim() || null,
    createdBy: actor.value.trim(),
  }
}

async function submit() {
  if (!canSubmit.value) return

  formError.value = null
  submitting.value = true
  try {
    await issueReportStore.create(createPayload())
    persist()
    await router.replace({ name: 'issue-reports' })
  } catch (reason) {
    formError.value = reason instanceof Error ? reason.message : 'Unable to create issue report'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormOverlay
    :open="true"
    title="แจ้งปัญหา"
    submit-label="ส่ง"
    :is-submitting="submitting"
    :is-submit-disabled="!canSubmit"
    @close="goBack"
    @submit="submit"
  >
    <div class="space-y-4">
      <FormInput id="issue-report-title" v-model="report.title" label="หัวข้อ *" placeholder="สรุปปัญหาที่พบ" />
      <FormTextarea id="issue-report-description" v-model="report.description" label="รายละเอียด *" placeholder="อธิบายปัญหา" />
      <FormInput id="issue-report-screenshot" v-model="report.screenshotUrl" label="ลิงก์ภาพหน้าจอ" placeholder="วางลิงก์ได้ (ไม่บังคับ)" />
      <FormInput id="issue-report-actor" v-model="actor" label="ผู้แจ้ง *" placeholder="ชื่อพนักงาน" autocomplete="name" />
      <p v-if="formError" class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">{{ formError }}</p>
    </div>
  </FormOverlay>
</template>
