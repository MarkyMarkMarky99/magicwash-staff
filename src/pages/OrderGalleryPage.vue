<script setup>
import { ref, computed, onActivated, onBeforeUnmount, onDeactivated, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePhotoUpload } from '../composables/usePhotoUpload'
import { getPhotos } from '../api/photos'
import AppLayout from '../layouts/AppLayout.vue'
import CameraOverlayPage from './CameraOverlayPage.vue'

function parseKey(key) {
  const parts = String(key ?? '').split('-')
  return { type: parts[0], orderId: parts[1], orderitemId: parts[2] ?? null }
}

const route = useRoute()
const router = useRouter()
const routeKey = computed(() => (
  typeof route.params.key === 'string' ? route.params.key : ''
))
const galleryKey = computed(() => parseKey(routeKey.value))
const type = computed(() => galleryKey.value.type)
const orderId = computed(() => galleryKey.value.orderId)
const orderitemId = computed(() => galleryKey.value.orderitemId)
const createdBy = computed(() => (
  typeof route.query.by === 'string' ? route.query.by : ''
))
const title = computed(() => type.value === 'BEF' ? 'รูปก่อนซัก' : 'รูปหลังซัก')

const { images, addFiles, remove, clearAll } = usePhotoUpload(type, orderId, orderitemId, createdBy)

const showPicker = ref(false)
const showCamera = ref(route.meta.openCamera === true)
const albumInputRef = ref(null)
const lightbox = ref(null)

const IN_PROGRESS = new Set(['compressing', 'uploading', 'saving'])

// --- Fetch existing photos from GViz ---
const fetchedPhotos = ref([])  // [{ id, image_url, notes }]
const fetchStatus = ref('loading')
let fetchSequence = 0
let requestedKey = ''

async function loadFetchedPhotos(key) {
  const parsed = parseKey(key)
  if (!parsed.type || !parsed.orderId) {
    fetchedPhotos.value = []
    fetchStatus.value = 'error'
    return
  }

  const sequence = ++fetchSequence
  requestedKey = key
  clearAll()
  fetchedPhotos.value = []
  fetchStatus.value = 'loading'
  lightbox.value = null

  try {
    const photos = await getPhotos(parsed.type, parsed.orderId, parsed.orderitemId)
    if (sequence !== fetchSequence) return
    fetchedPhotos.value = photos
    fetchStatus.value = 'done'
  } catch {
    if (sequence !== fetchSequence) return
    fetchStatus.value = 'error'
  }
}

watch(
  routeKey,
  (key) => {
    if (key) {
      void loadFetchedPhotos(key)
    }
  },
  { immediate: true },
)

onActivated(() => {
  const key = routeKey.value
  if (key && requestedKey !== key) {
    void loadFetchedPhotos(key)
  }
})

onDeactivated(() => {
  requestedKey = ''
  fetchSequence += 1
})

onBeforeUnmount(() => {
  clearAll()
})

watch(
  () => route.meta.openCamera === true,
  (openCamera) => {
    showCamera.value = openCamera
  },
)

// Unified flat list used by the lightbox
const allPhotos = computed(() => [
  ...fetchedPhotos.value.map(p => ({ src: p.image_url, label: p.notes || null })),
  ...images.value.map(p  => ({ src: p.previewUrl,  label: null })),
])

const isEmpty = computed(
  () => fetchStatus.value === 'done' && fetchedPhotos.value.length === 0 && images.value.length === 0,
)

function openPicker() {
  showPicker.value = true
}

function pickAlbum() {
  showPicker.value = false
  albumInputRef.value.click()
}

function pickCamera() {
  showPicker.value = false
  showCamera.value = true
}

function handleFiles(event) {
  addFiles(event.target.files)
  event.target.value = ''
}

function handleCameraCapture(file, options) {
  addFiles([file], options)
}

function galleryLocation() {
  const query = { ...route.query }
  delete query.camera
  return { path: `/gallery/${route.params.key}`, query }
}

function handleCameraClose() {
  showCamera.value = false
  if (route.meta.openCamera === true) {
    router.replace(galleryLocation())
  }
}
</script>

<template>
  <AppLayout>
    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="flex-none border-b border-outline-variant/20 bg-surface-container-low px-4 py-2">
        <h1 class="font-headline text-[13px] font-bold tracking-tight text-primary">{{ title }}</h1>
      </div>

      <!-- Body -->
      <div class="gallery-scroll flex-1 overflow-y-auto">
        <div class="flex min-h-full flex-col py-1">

        <!-- Loading -->
        <div v-if="fetchStatus === 'loading'" class="flex-1 flex flex-col items-center justify-center gap-3">
          <span class="material-symbols-outlined text-primary text-5xl animate-pulse">local_laundry_service</span>
          <p class="font-body text-on-surface-variant text-sm">กำลังโหลดรูปภาพ…</p>
        </div>

        <!-- Error -->
        <div v-else-if="fetchStatus === 'error'" class="flex-1 flex flex-col items-center justify-center gap-3">
          <span class="material-symbols-outlined text-error text-5xl">error_outline</span>
          <p class="font-body text-on-surface-variant text-sm">โหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
        </div>

        <template v-else>
          <!-- Empty state -->
          <div v-if="isEmpty" class="flex-1 flex flex-col items-center justify-center gap-3">
            <span class="material-symbols-outlined text-on-surface-variant text-5xl">image_not_supported</span>
            <p class="font-body text-on-surface-variant text-sm">ยังไม่มีรูปภาพ</p>
          </div>

          <!-- Photo grid -->
          <div v-else class="grid grid-cols-3 gap-[2px]">

            <!-- Remote photos (already saved) -->
            <button
              v-for="(photo, i) in fetchedPhotos"
              :key="photo.id"
              @click="lightbox = i"
              class="aspect-square overflow-hidden rounded-[3px] bg-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <img
                :src="photo.image_url"
                :alt="photo.notes || `รูปที่ ${i + 1}`"
                class="w-full h-full object-cover"
              />
            </button>

            <!-- Local upload queue -->
            <button
              v-for="(img, i) in images"
              :key="img.id"
              @click="lightbox = fetchedPhotos.length + i"
              class="relative aspect-square overflow-hidden rounded-[3px] bg-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <!-- Error state -->
              <div
                v-if="img.status === 'error'"
                class="w-full h-full bg-surface-variant flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-on-surface-variant text-[22px]">close</span>
              </div>

              <!-- Image + optional in-progress overlay -->
              <template v-else>
                <img
                  :src="img.previewUrl"
                  :alt="`รูปที่ ${fetchedPhotos.length + i + 1}`"
                  class="w-full h-full object-cover"
                />
                <div
                  v-if="IN_PROGRESS.has(img.status)"
                  class="absolute inset-0 bg-black/40 flex items-center justify-center"
                >
                  <span class="material-symbols-outlined text-white text-[22px] animate-spin">progress_activity</span>
                </div>
              </template>

              <!-- Remove button -->
              <button
                @click.stop="remove(img.id)"
                class="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
            </button>

          </div>
        </template>

        </div>
      </div>

      <!-- Floating add button -->
      <div class="absolute bottom-6 right-4">
        <button
          @click="openPicker"
          class="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition active:opacity-80 bg-primary text-on-primary"
        >
          <span class="material-symbols-outlined text-2xl">add_photo_alternate</span>
        </button>
      </div>

    <!-- Lightbox -->
    <div
      v-if="lightbox !== null && allPhotos[lightbox]"
      class="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
      @click="lightbox = null"
    >
      <button class="absolute top-4 right-4 text-white" @click="lightbox = null">
        <span class="material-symbols-outlined text-3xl">close</span>
      </button>

      <img
        :src="allPhotos[lightbox].src"
        :alt="allPhotos[lightbox].label || `รูปที่ ${lightbox + 1}`"
        class="max-w-full max-h-[80dvh] rounded-2xl object-contain"
        @click.stop
      />

      <p v-if="allPhotos[lightbox].label" class="mt-3 text-white/80 font-body text-sm text-center">
        {{ allPhotos[lightbox].label }}
      </p>

      <div class="flex gap-6 mt-4">
        <button
          :disabled="lightbox === 0"
          @click.stop="lightbox--"
          class="text-white disabled:opacity-30"
        >
          <span class="material-symbols-outlined text-3xl">chevron_left</span>
        </button>
        <span class="text-white/60 font-body text-sm self-center">
          {{ lightbox + 1 }} / {{ allPhotos.length }}
        </span>
        <button
          :disabled="lightbox === allPhotos.length - 1"
          @click.stop="lightbox++"
          class="text-white disabled:opacity-30"
        >
          <span class="material-symbols-outlined text-3xl">chevron_right</span>
        </button>
      </div>
    </div>

    <!-- Source picker sheet -->
    <Transition name="sheet">
      <div v-if="showPicker" class="fixed inset-0 z-50 flex flex-col justify-end">
        <div class="absolute inset-0 bg-black/40" @click="showPicker = false" />
        <div class="relative bg-surface rounded-t-2xl p-5 space-y-3">
          <p class="text-center font-body text-on-surface-variant text-sm mb-1">เลือกแหล่งที่มาของภาพ</p>
          <button
            @click="pickCamera"
            class="w-full py-3.5 rounded-xl bg-primary text-on-primary font-body text-sm font-medium flex items-center justify-center gap-2"
          >
            <span class="material-symbols-outlined text-[18px]">photo_camera</span> เปิดกล้อง
          </button>
          <button
            @click="pickAlbum"
            class="w-full py-3.5 rounded-xl bg-surface-variant text-on-surface-variant font-body text-sm font-medium flex items-center justify-center gap-2"
          >
            <span class="material-symbols-outlined text-[18px]">photo_library</span> เลือกจาก Album
          </button>
          <button @click="showPicker = false" class="w-full py-2 font-body text-sm text-on-surface-variant">
            ยกเลิก
          </button>
        </div>
      </div>
    </Transition>

    <!-- Hidden inputs -->
    <input ref="albumInputRef" type="file" accept="image/*" multiple class="hidden" @change="handleFiles" />

      <CameraOverlayPage
        :open="showCamera"
        @capture="handleCameraCapture"
        @close="handleCameraClose"
      />
    </div>
  </AppLayout>
</template>

<style scoped>
.gallery-scroll {
  scrollbar-width: none;
}

.gallery-scroll::-webkit-scrollbar {
  display: none;
}

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .relative, .sheet-leave-active .relative { transition: transform 0.25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .relative { transform: translateY(100%); }
</style>
