<script setup lang="ts">
import { ref } from 'vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'

defineOptions({ name: 'FormOverlayPreviewPage' })

const isOpen = ref(true)
const isSubmitting = ref(false)
const submitStatus = ref<string | null>(null)

function openPreview() {
  submitStatus.value = null
  isOpen.value = true
}

function closePreview() {
  isOpen.value = false
}

async function submitPreview() {
  isSubmitting.value = true
  submitStatus.value = null

  await new Promise((resolve) => window.setTimeout(resolve, 700))

  isSubmitting.value = false
  submitStatus.value = 'บันทึกตัวอย่างสำเร็จแล้ว (ข้อมูลนี้ไม่ได้ถูกบันทึกจริง)'
}
</script>

<template>
  <main class="preview-page">
    <section class="preview-card" aria-labelledby="preview-title">
      <p class="preview-card__eyebrow">Development preview</p>
      <h1 id="preview-title">Form Overlay</h1>
      <p>หน้านี้ใช้สำหรับตรวจสอบ FormOverlay ระหว่างพัฒนาเท่านั้น</p>

      <button class="preview-card__open" type="button" @click="openPreview">
        เปิด Form Overlay
      </button>

      <p v-if="submitStatus" class="preview-card__status" role="status">
        {{ submitStatus }}
      </p>
    </section>

    <FormOverlay
      :open="isOpen"
      title="เพิ่มข้อมูลตัวอย่าง"
      eyebrow="Development preview"
      helper-text="ตัวอย่างโครงสร้าง header สำหรับการพัฒนา"
      aria-label="ตัวอย่างแบบฟอร์ม"
      submit-label="บันทึกตัวอย่าง"
      :is-submitting="isSubmitting"
      @close="closePreview"
      @submit="submitPreview"
    >
      <div class="sample-form">
        <p class="sample-form__intro">ตัวอย่างเนื้อหาที่ component อื่นสามารถส่งเข้ามาทาง default slot ได้</p>

        <label class="sample-form__field">
          <span>ชื่อรายการ</span>
          <input type="text" placeholder="เช่น บริการตัวอย่าง" />
        </label>

        <label class="sample-form__field">
          <span>รายละเอียด</span>
          <textarea rows="4" placeholder="เพิ่มรายละเอียดสั้น ๆ"></textarea>
        </label>

        <label class="sample-form__field">
          <span>สถานะ</span>
          <select>
            <option>เปิดใช้งาน</option>
            <option>ปิดใช้งาน</option>
          </select>
        </label>
      </div>
    </FormOverlay>
  </main>
</template>

<style scoped>
.preview-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  color: var(--color-on-surface);
  background: linear-gradient(145deg, var(--color-surface-variant) 0%, var(--color-surface) 58%, var(--color-secondary-container) 100%);
  font-family: "Noto Sans Thai", system-ui, sans-serif;
}

.preview-card {
  width: min(100%, 430px);
  padding: 28px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  box-shadow: 0 16px 45px color-mix(in srgb, var(--color-primary) 13%, transparent);
}

.preview-card__eyebrow {
  margin: 0 0 6px;
  color: var(--color-secondary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.preview-card h1 {
  margin: 0;
  font-size: 26px;
}

.preview-card > p:not(.preview-card__eyebrow):not(.preview-card__status) {
  margin: 10px 0 22px;
  color: var(--color-on-surface-variant);
  font-size: 14px;
  line-height: 1.55;
}

.preview-card__open {
  width: 100%;
  min-height: 48px;
  color: var(--color-on-surface);
  border: 1px solid var(--color-lime);
  border-radius: 10px;
  background: var(--color-lime);
  box-shadow: 0 4px 0 var(--color-on-secondary-container);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.preview-card__status {
  margin: 20px 0 0;
  padding: 10px 12px;
  color: var(--color-secondary);
  border-radius: 8px;
  background: var(--color-secondary-container);
  font-size: 13px;
  line-height: 1.45;
}

.sample-form {
  display: grid;
  gap: 18px;
}

.sample-form__intro {
  margin: 0 0 2px;
  color: var(--color-on-surface-variant);
  font-size: 13px;
  line-height: 1.5;
}

.sample-form__field {
  display: grid;
  gap: 7px;
  color: var(--color-on-surface);
  font-size: 13px;
  font-weight: 700;
}

.sample-form input,
.sample-form textarea,
.sample-form select {
  width: 100%;
  padding: 12px;
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: 10px;
  outline: 0;
  background: white;
  font: inherit;
  font-weight: 400;
  resize: vertical;
}

.sample-form input:focus,
.sample-form textarea:focus,
.sample-form select:focus,
.preview-card__open:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-secondary) 25%, transparent);
  outline-offset: 2px;
}
</style>
