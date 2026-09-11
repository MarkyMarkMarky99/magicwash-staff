<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import FormInput from '@/shared/components/FormInput.vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useGoBack } from '@/shared/composables/use-go-back'
import { useIssueReportActor } from '../composables/use-issue-report-actor'
import { useScreenshotUpload } from '../composables/use-screenshot-upload'
import { useIssueReportStore } from '../stores/issue-report.store'

defineOptions({ name: 'IssueReportFormPage' })

const router = useRouter()
const { goBack } = useGoBack()
const issueReportStore = useIssueReportStore()
const { actor, persist } = useIssueReportActor()
const { screenshot, imageUrl, isBusy, select, clear } = useScreenshotUpload()
const report = reactive({ title: '', description: '' })
const screenshotInput = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)
const canSubmit = computed(() => !submitting.value && !isBusy.value && report.title.trim() && report.description.trim() && actor.value.trim())

function formatSize(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function createPayload() {
  return {
    title: report.title.trim(),
    description: report.description.trim(),
    screenshotUrl: imageUrl.value,
    createdBy: actor.value.trim(),
  }
}

function pickScreenshot(): void {
  screenshotInput.value?.click()
}

function handleScreenshotPick(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void select(file)
  // Clear the control so re-picking the same file still fires `change`.
  input.value = ''
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

onBeforeUnmount(clear)
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

      <section>
        <FormLabel input-id="issue-report-screenshot">ภาพหน้าจอ</FormLabel>

        <div v-if="screenshot" class="space-y-2">
          <div class="relative overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-variant">
            <img :src="screenshot.previewUrl" alt="ภาพหน้าจอที่แนบ" class="max-h-56 w-full object-contain" />
            <div
              v-if="isBusy"
              class="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white"
            >
              {{ screenshot.status === 'compressing' ? 'กำลังบีบอัด...' : 'กำลังอัปโหลด...' }}
            </div>
          </div>

          <p v-if="screenshot.status === 'error'" class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
            {{ screenshot.errorMessage }}
          </p>
          <p v-else-if="screenshot.status === 'done' && screenshot.compressedSize !== null" class="text-xs text-on-surface-variant">
            บีบอัด {{ formatSize(screenshot.originalSize) }} → {{ formatSize(screenshot.compressedSize) }}
          </p>

          <div class="flex gap-2">
            <button type="button" class="flex-1 rounded-xl bg-surface-variant py-2.5 text-sm font-medium text-on-surface-variant" @click="pickScreenshot">
              เปลี่ยนรูป
            </button>
            <button type="button" class="flex-1 rounded-xl bg-surface-variant py-2.5 text-sm font-medium text-on-surface-variant" @click="clear">
              ลบรูป
            </button>
          </div>
        </div>

        <button
          v-else
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant py-6 text-sm font-medium text-on-surface-variant"
          @click="pickScreenshot"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add_photo_alternate</span>
          แนบภาพหน้าจอ (ไม่บังคับ)
        </button>

        <input
          id="issue-report-screenshot"
          ref="screenshotInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleScreenshotPick"
        />
      </section>

      <FormInput id="issue-report-actor" v-model="actor" label="ผู้แจ้ง *" placeholder="ชื่อพนักงาน" autocomplete="name" />
      <p v-if="formError" class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">{{ formError }}</p>
    </div>
  </FormOverlay>
</template>
