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
  color: #073f38;
  background: linear-gradient(145deg, #dcecea 0%, #f6faf9 58%, #dbeee9 100%);
  font-family: "Noto Sans Thai", system-ui, sans-serif;
}

.preview-card {
  width: min(100%, 430px);
  padding: 28px;
  border: 1px solid rgba(0, 86, 75, 0.1);
  border-radius: 16px;
  background: rgba(247, 251, 250, 0.94);
  box-shadow: 0 16px 45px rgba(0, 66, 59, 0.13);
}

.preview-card__eyebrow {
  margin: 0 0 6px;
  color: #007a69;
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
  color: #5f7772;
  font-size: 14px;
  line-height: 1.55;
}

.preview-card__open {
  width: 100%;
  min-height: 48px;
  color: #073f38;
  border: 1px solid #b2df26;
  border-radius: 10px;
  background: #b2df26;
  box-shadow: 0 4px 0 #789d0b;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.preview-card__status {
  margin: 20px 0 0;
  padding: 10px 12px;
  color: #075f51;
  border-radius: 8px;
  background: #dff6ef;
  font-size: 13px;
  line-height: 1.45;
}

.sample-form {
  display: grid;
  gap: 18px;
}

.sample-form__intro {
  margin: 0 0 2px;
  color: #5f7772;
  font-size: 13px;
  line-height: 1.5;
}

.sample-form__field {
  display: grid;
  gap: 7px;
  color: #234f49;
  font-size: 13px;
  font-weight: 700;
}

.sample-form input,
.sample-form textarea,
.sample-form select {
  width: 100%;
  padding: 12px;
  color: #073f38;
  border: 1px solid #a9c9c3;
  border-radius: 10px;
  outline: 0;
  background: #fff;
  font: inherit;
  font-weight: 400;
  resize: vertical;
}

.sample-form input:focus,
.sample-form textarea:focus,
.sample-form select:focus,
.preview-card__open:focus-visible {
  outline: 3px solid rgba(0, 122, 105, 0.25);
  outline-offset: 2px;
}
</style>
