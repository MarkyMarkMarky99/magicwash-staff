<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  remaining: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['close', 'capture'])

const videoRef = ref(null)
const stream = ref(null)
const errorMessage = ref('')
const isStarting = ref(false)
const isCapturing = ref(false)
const capturedCount = ref(0)

const canCapture = computed(
  () => props.open && !errorMessage.value && !isStarting.value && !isCapturing.value && props.remaining > 0,
)

async function startCamera() {
  if (!props.open || stream.value || isStarting.value) return

  errorMessage.value = ''

  if (!navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = 'กล้องใช้ได้เมื่อเปิดผ่าน HTTPS หรือ localhost'
    return
  }

  isStarting.value = true

  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    })

    stream.value = mediaStream
    await nextTick()

    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
      await videoRef.value.play()
    }
  } catch (err) {
    errorMessage.value = err?.name === 'NotAllowedError'
      ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง'
      : 'เปิดกล้องไม่สำเร็จ'
  } finally {
    isStarting.value = false
  }
}

function stopCamera() {
  if (videoRef.value) videoRef.value.srcObject = null
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
  isStarting.value = false
  isCapturing.value = false
}

function closeCamera() {
  stopCamera()
  emit('close')
}

async function capturePhoto() {
  if (!canCapture.value || !videoRef.value) return

  const video = videoRef.value
  const width = video.videoWidth
  const height = video.videoHeight

  if (!width || !height) {
    errorMessage.value = 'กล้องยังไม่พร้อม'
    return
  }

  isCapturing.value = true

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, width, height)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error('Unable to create image')

    const filename = `camera_${Date.now()}.jpg`
    const file = new File([blob], filename, { type: 'image/jpeg' })

    capturedCount.value += 1
    emit('capture', file)
  } catch {
    errorMessage.value = 'ถ่ายภาพไม่สำเร็จ'
  } finally {
    isCapturing.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      capturedCount.value = 0
      startCamera()
    } else {
      stopCamera()
    }
  },
  { immediate: true },
)

onBeforeUnmount(stopCamera)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[60] bg-black text-white">
    <video
      ref="videoRef"
      class="absolute inset-0 h-full w-full object-cover"
      autoplay
      muted
      playsinline
    />

    <div class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-4">
      <div class="flex items-center justify-between gap-3">
        <button
          class="h-11 w-11 rounded-full bg-black/45 flex items-center justify-center active:opacity-80"
          aria-label="ปิดกล้อง"
          @click="closeCamera"
        >
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>

        <div class="min-w-0 rounded-full bg-black/45 px-3 py-1.5 font-body text-xs">
          {{ capturedCount }} รูป / เหลือ {{ remaining }}
        </div>
      </div>
    </div>

    <div v-if="isStarting || errorMessage" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
      <span
        class="material-symbols-outlined text-5xl"
        :class="{ 'animate-spin': isStarting }"
      >
        {{ isStarting ? 'progress_activity' : 'photo_camera' }}
      </span>
      <p class="font-body text-sm text-white/80">
        {{ isStarting ? 'กำลังเปิดกล้อง…' : errorMessage }}
      </p>
      <button
        v-if="errorMessage"
        class="mt-2 rounded-full bg-white px-5 py-2.5 font-body text-sm font-medium text-black"
        @click="startCamera"
      >
        ลองใหม่
      </button>
    </div>

    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
      <div class="flex items-center justify-center gap-8">
        <button
          class="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center active:opacity-80"
          aria-label="ปิดกล้อง"
          @click="closeCamera"
        >
          <span class="material-symbols-outlined text-2xl">check</span>
        </button>

        <button
          class="h-20 w-20 rounded-full border-4 border-white bg-white/20 p-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!canCapture"
          aria-label="ถ่ายภาพ"
          @click="capturePhoto"
        >
          <span class="block h-full w-full rounded-full bg-white" />
        </button>

        <div class="h-12 w-12 flex items-center justify-center rounded-full bg-white/15 font-body text-sm">
          {{ remaining }}
        </div>
      </div>
    </div>
  </div>
</template>
