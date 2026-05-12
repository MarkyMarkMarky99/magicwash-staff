<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePhotoUpload } from '../composables/usePhotoUpload'

const { params } = useRoute()
const { images, MAX_FILES, addFiles, remove, clearAll } = usePhotoUpload(params.orderId, 'dev')

const showPicker = ref(false)
const albumInputRef = ref(null)
const cameraInputRef = ref(null)

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function savings(original, compressed) {
  return Math.round((1 - compressed / original) * 100)
}

function openPicker() {
  if (images.value.length >= MAX_FILES) return
  showPicker.value = true
}

function pickAlbum() {
  showPicker.value = false
  albumInputRef.value.click()
}

function pickCamera() {
  showPicker.value = false
  cameraInputRef.value.click()
}

function handleFiles(event) {
  addFiles(event.target.files)
  event.target.value = ''
}

const STATUS_LABEL = {
  compressing: 'กำลังบีบ...',
  uploading:   'กำลังอัพโหลด...',
  saving:      'กำลังบันทึก...',
}
</script>

<template>
  <div class="h-screen bg-gray-50 flex flex-col overflow-hidden">

    <!-- Header -->
    <div class="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div>
        <h1 class="text-base font-semibold text-gray-800">ทดสอบอัพโหลดภาพ</h1>
        <p class="text-xs text-gray-400 mt-0.5">order: {{ params.orderId }} · created_by: dev</p>
      </div>
      <button
        v-if="images.length > 0"
        @click="clearAll"
        class="text-xs text-red-500 px-2 py-1 rounded border border-red-200"
      >
        ล้างทั้งหมด
      </button>
    </div>

    <!-- Image grid -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="images.length === 0" class="flex flex-col items-center justify-center h-64 text-gray-300">
        <p class="text-4xl mb-2">🖼️</p>
        <p class="text-sm">ยังไม่มีภาพ</p>
      </div>

      <div v-else class="grid grid-cols-2 gap-3">
        <div
          v-for="img in images"
          :key="img.id"
          class="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
        >
          <!-- Thumbnail -->
          <div class="relative">
            <img :src="img.previewUrl" class="w-full h-36 object-cover" />
            <button
              @click="remove(img.id)"
              class="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none"
            >
              ✕
            </button>
          </div>

          <!-- Stats -->
          <div class="px-3 py-2 space-y-1">
            <div class="flex justify-between text-xs text-gray-400">
              <span>ID</span>
              <span class="font-mono">{{ img.id }}</span>
            </div>
            <div class="flex justify-between text-xs text-gray-500">
              <span>ต้นฉบับ</span>
              <span>{{ formatBytes(img.originalSize) }}</span>
            </div>

            <!-- In-progress -->
            <div v-if="STATUS_LABEL[img.status]" class="flex justify-between text-xs text-blue-400">
              <span>{{ STATUS_LABEL[img.status] }}</span>
              <span class="animate-spin inline-block">⟳</span>
            </div>

            <!-- Error -->
            <div v-else-if="img.status === 'error'" class="text-xs text-red-500 break-words">
              {{ img.errorMsg }}
            </div>

            <!-- Done -->
            <template v-else>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">บีบแล้ว</span>
                <span :class="img.compressedSize < img.originalSize ? 'text-green-600 font-medium' : 'text-gray-500'">
                  {{ formatBytes(img.compressedSize) }}
                </span>
              </div>
              <div v-if="img.compressedSize < img.originalSize" class="text-right text-xs text-green-500 font-semibold">
                ลดลง {{ savings(img.originalSize, img.compressedSize) }}%
              </div>
              <div class="text-right text-xs text-emerald-600 font-medium">✓ บันทึกแล้ว</div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Add button -->
    <div class="p-4 bg-white border-t">
      <p class="text-center text-xs text-gray-400 mb-2">{{ images.length }}/{{ MAX_FILES }} ภาพ</p>
      <button
        @click="openPicker"
        :disabled="images.length >= MAX_FILES"
        class="w-full py-3 rounded-xl text-sm font-medium transition"
        :class="images.length >= MAX_FILES
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 text-white active:bg-blue-700'"
      >
        + เพิ่มภาพ
      </button>
    </div>

    <!-- Source picker sheet -->
    <Transition name="sheet">
      <div v-if="showPicker" class="fixed inset-0 z-50 flex flex-col justify-end">
        <div class="absolute inset-0 bg-black/40" @click="showPicker = false" />
        <div class="relative bg-white rounded-t-2xl p-5 space-y-3">
          <p class="text-center text-sm text-gray-500 mb-1">เลือกแหล่งที่มาของภาพ</p>
          <button
            @click="pickCamera"
            class="w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2"
          >
            <span>📷</span> เปิดกล้อง
          </button>
          <button
            @click="pickAlbum"
            class="w-full py-3.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <span>🖼️</span> เลือกจาก Album
          </button>
          <button @click="showPicker = false" class="w-full py-2 text-sm text-gray-400">
            ยกเลิก
          </button>
        </div>
      </div>
    </Transition>

    <!-- Hidden inputs -->
    <input ref="albumInputRef" type="file" accept="image/*" multiple class="hidden" @change="handleFiles" />
    <input ref="cameraInputRef" type="file" accept="image/*" capture="environment" class="hidden" @change="handleFiles" />
  </div>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .relative, .sheet-leave-active .relative { transition: transform 0.25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .relative { transform: translateY(100%); }
</style>
