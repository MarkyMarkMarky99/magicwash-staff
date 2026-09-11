<script setup>
import { ref, computed, onActivated, onBeforeUnmount, onDeactivated, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePhotoUpload } from '@/composables/usePhotoUpload'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import PickerOverlay from '@/shared/layouts/PickerOverlay.vue'
import LightboxOverlay from '@/shared/layouts/LightboxOverlay.vue'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import { currentActor } from '@/shared/config/actor'
import { getWorkOrder } from '@/features/orders/services/work-order.service'
import { listGalleryPhotos, reassignPhoto } from '@/features/gallery/services/laundry-photo.service'

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
const itemId = computed(() => {
  const rawItemId = route.query.itemId
  const value = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId
  const normalizedItemId = typeof value === 'string' ? value.trim() : ''
  return normalizedItemId && normalizedItemId !== 'null' ? normalizedItemId : null
})
const createdBy = computed(() => {
  const raw = route.query.by
  return currentActor(Array.isArray(raw) ? raw[0] : raw)
})
const photoTabs = [
  { key: 'BEF', label: 'รูปก่อนซัก' },
  { key: 'AFT', label: 'รูปหลังซัก' },
]

const { images, addFiles, remove, clearAll } = usePhotoUpload(type, orderId, orderitemId, createdBy, itemId)

const showPicker = ref(false)
const showCamera = ref(route.meta.openCamera === true)
const albumInputRef = ref(null)
const lightbox = ref(null)
const reassigning = ref(false)
const reassignError = ref(null)
const orderItems = ref([])
const orderItemsStatus = ref('idle')
const orderItemsOrderId = ref(null)
let reassignRouteEntry = false

const IN_PROGRESS = new Set(['compressing', 'uploading', 'saving'])

const fetchedPhotos = ref([])
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
  reassignError.value = null
  orderItems.value = []
  orderItemsStatus.value = 'idle'
  orderItemsOrderId.value = null
  reassigning.value = false

  try {
    const photos = await listGalleryPhotos(
      parsed.type,
      parsed.orderId,
      parsed.orderitemId,
      (freshPhotos) => {
        if (sequence !== fetchSequence) return
        fetchedPhotos.value = freshPhotos
      },
    )
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
  ...fetchedPhotos.value.map(p => ({
    src: p.imageUrl,
    label: p.notes || null,
    id: p.id,
    isSaved: true,
  })),
  ...images.value.map(p  => ({
    src: p.previewUrl,
    label: null,
    id: null,
    isSaved: false,
  })),
])

const currentPhoto = computed(() => (
  lightbox.value === null ? null : allPhotos.value[lightbox.value] ?? null
))
const reassignPhotoId = computed(() => {
  const value = Array.isArray(route.query.reassignPhoto)
    ? route.query.reassignPhoto[0]
    : route.query.reassignPhoto
  return typeof value === 'string' && value.trim() ? value.trim() : null
})
const reassignPhotoIndex = computed(() => (
  reassignPhotoId.value
    ? allPhotos.value.findIndex(photo => photo.isSaved && photo.id === reassignPhotoId.value)
    : -1
))
const showReassignPicker = computed(() => reassignPhotoIndex.value >= 0)
const reassignPhotoTarget = computed(() => (
  reassignPhotoIndex.value >= 0 ? allPhotos.value[reassignPhotoIndex.value] : null
))

watch([reassignPhotoId, reassignPhotoIndex], ([photoId, photoIndex]) => {
  if (!photoId) {
    reassignRouteEntry = false
    return
  }
  if (photoIndex >= 0) {
    lightbox.value = photoIndex
    if (orderItemsStatus.value === 'idle') void loadOrderItems()
  }
})

const isEmpty = computed(
  () => fetchStatus.value === 'done' && fetchedPhotos.value.length === 0 && images.value.length === 0,
)

function openPicker() {
  showPicker.value = true
}

function openReassignPicker() {
  if (!currentPhoto.value?.isSaved || !currentPhoto.value.id) return

  reassignError.value = null
  reassignRouteEntry = true
  void router.push({ query: { ...route.query, reassignPhoto: currentPhoto.value.id } })
  if (orderItemsStatus.value === 'idle') {
    void loadOrderItems()
  }
}

function closeReassignPicker() {
  if (!reassignPhotoId.value) return

  if (reassignRouteEntry) {
    reassignRouteEntry = false
    router.back()
    return
  }

  const query = { ...route.query }
  delete query.reassignPhoto
  void router.replace({ query })
}

async function loadOrderItems() {
  // A concurrent call is not a failure — the in-flight request still owns the status.
  if (orderItemsStatus.value === 'loading') return

  const requestedOrderId = orderId.value
  if (!requestedOrderId) {
    orderItemsStatus.value = 'error'
    return
  }

  orderItemsStatus.value = 'loading'
  orderItemsOrderId.value = requestedOrderId

  try {
    const order = await getWorkOrder(requestedOrderId)
    if (requestedOrderId !== orderId.value) return
    orderItems.value = order.items
    orderItemsStatus.value = 'done'
  } catch {
    if (requestedOrderId !== orderId.value) return
    orderItemsStatus.value = 'error'
  }
}

function retryLoadOrderItems() {
  orderItemsStatus.value = 'idle'
  void loadOrderItems()
}

async function handleReassign(item) {
  const photo = reassignPhotoTarget.value
  if (
    reassigning.value
    || !photo?.isSaved
    || !photo.id
    || !item?.orderItemId
    || item.orderItemId === orderitemId.value
  ) return

  reassigning.value = true
  reassignError.value = null

  try {
    await reassignPhoto(type.value, photo.id, {
      orderItemId: item.orderItemId,
      updatedBy: createdBy.value,
    })
    fetchedPhotos.value = fetchedPhotos.value.filter(savedPhoto => savedPhoto.id !== photo.id)
    closeReassignPicker()
    lightbox.value = null
  } catch (error) {
    closeReassignPicker()
    reassignError.value = error instanceof Error ? error.message : 'ย้ายรูปไม่สำเร็จ กรุณาลองอีกครั้ง'
  } finally {
    reassigning.value = false
  }
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

function galleryLocation(key, openCamera = route.meta.openCamera === true) {
  return {
    path: `/gallery/${key}${openCamera ? '/camera' : ''}`,
    query: { ...route.query },
  }
}

function switchType(nextType) {
  if (nextType === type.value || !orderId.value) return

  const nextKey = [nextType, orderId.value, orderitemId.value].filter(Boolean).join('-')
  void router.replace(galleryLocation(nextKey))
}

function handleCameraClose() {
  showCamera.value = false
  if (route.meta.openCamera === true) {
    const query = { ...route.query }
    delete query.camera
    router.replace({ path: `/gallery/${routeKey.value}`, query })
  }
}
</script>

<template>
  <AppLayout>
    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="flex-none border-b border-outline-variant/20 bg-primary">
        <ScrollRegion
          axis="x"
          sizing="auto"
          class="flex items-center gap-1 px-4 pt-2"
          role="tablist"
          aria-label="เลือกประเภทภาพ"
        >
          <button
            v-for="tab in photoTabs"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="tab.key === type"
            class="flex-none border-b-2 px-3 pb-1.5 pt-1 font-label text-[11px] font-semibold tracking-wider transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
            :class="tab.key === type ? 'border-white text-on-primary' : 'border-transparent text-on-primary/70'"
            @click="switchType(tab.key)"
          >
            {{ tab.label }}
          </button>
        </ScrollRegion>
      </div>

      <ScrollRegion as="main">
        <div class="flex min-h-full flex-col py-1">

        <div v-if="fetchStatus === 'loading'" class="flex-1 flex flex-col items-center justify-center gap-3">
          <span class="material-symbols-outlined text-primary text-5xl animate-pulse">local_laundry_service</span>
          <p class="font-body text-on-surface-variant text-sm">กำลังโหลดรูปภาพ…</p>
        </div>

        <div v-else-if="fetchStatus === 'error'" class="flex-1 flex flex-col items-center justify-center gap-3">
          <span class="material-symbols-outlined text-error text-5xl">error_outline</span>
          <p class="font-body text-on-surface-variant text-sm">โหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
        </div>

        <template v-else>
          <div v-if="isEmpty" class="flex-1 flex flex-col items-center justify-center gap-3">
            <span class="material-symbols-outlined text-on-surface-variant text-5xl">image_not_supported</span>
            <p class="font-body text-on-surface-variant text-sm">ยังไม่มีรูปภาพ</p>
          </div>

          <div v-else class="grid grid-cols-3 gap-[2px]">

            <button
              v-for="(photo, i) in fetchedPhotos"
              :key="photo.id"
              @click="lightbox = i"
              class="aspect-square overflow-hidden rounded-[3px] bg-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <img
                :src="photo.imageUrl"
                :alt="photo.notes || `รูปที่ ${i + 1}`"
                class="w-full h-full object-cover"
              />
            </button>

            <button
              v-for="(img, i) in images"
              :key="img.id"
              @click="lightbox = fetchedPhotos.length + i"
              class="relative aspect-square overflow-hidden rounded-[3px] bg-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div
                v-if="img.status === 'error'"
                class="w-full h-full bg-surface-variant flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-on-surface-variant text-[22px]">close</span>
              </div>

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
      </ScrollRegion>

      <div class="absolute bottom-6 right-4">
        <button
          @click="openPicker"
          class="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition active:opacity-80 bg-primary text-on-primary"
        >
          <span class="material-symbols-outlined text-2xl">add_photo_alternate</span>
        </button>
      </div>

    <LightboxOverlay
      :open="lightbox !== null && Boolean(allPhotos[lightbox])"
      ariaLabel="ดูรูปภาพ"
      @close="lightbox = null"
    >
      <img v-if="lightbox !== null && allPhotos[lightbox]"
        :src="allPhotos[lightbox].src"
        :alt="allPhotos[lightbox].label || `รูปที่ ${lightbox + 1}`"
        class="max-w-full max-h-[80dvh] rounded-2xl object-contain"
        @click.stop
      />

      <p v-if="lightbox !== null && allPhotos[lightbox]?.label" class="mt-3 text-white/80 font-body text-sm text-center">
        {{ allPhotos[lightbox].label }}
      </p>

      <div v-if="lightbox !== null" class="flex gap-6 mt-4">
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

      <button
        v-if="lightbox !== null && allPhotos[lightbox]?.isSaved"
        type="button"
        class="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white"
        :disabled="reassigning"
        @click.stop="openReassignPicker"
      >
        <span class="material-symbols-outlined text-[18px]">swap_horiz</span>
        ย้ายไปรายการอื่น
      </button>

      <p v-if="reassignError" role="alert" class="mt-3 max-w-sm text-center text-sm text-red-200">
        {{ reassignError }}
      </p>
    </LightboxOverlay>

    <PickerOverlay
      :open="showReassignPicker"
      ariaLabel="เลือกรายการปลายทาง"
      @close="closeReassignPicker"
    >
      <template #header>
        <p class="px-5 pb-0 pt-5 text-center font-body text-sm text-on-surface-variant">เลือกรายการปลายทาง</p>
      </template>
      <div class="space-y-3 px-5 pb-5 pt-3">
          <div v-if="orderItemsStatus === 'loading'" class="flex items-center justify-center gap-2 py-6 text-on-surface-variant">
            <span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span class="font-body text-sm">กำลังโหลดรายการ…</span>
          </div>

          <div v-else-if="orderItemsStatus === 'error'" class="space-y-3 py-3 text-center">
            <p class="font-body text-sm text-error">โหลดรายการไม่สำเร็จ กรุณาลองอีกครั้ง</p>
            <button
              type="button"
              class="w-full rounded-xl bg-surface-variant py-3 font-body text-sm font-medium text-on-surface-variant"
              @click="retryLoadOrderItems"
            >
              ลองอีกครั้ง
            </button>
          </div>

          <div v-else-if="orderItemsStatus === 'done' && orderItems.length === 0" class="py-3 text-center font-body text-sm text-on-surface-variant">
            ไม่พบรายการในออเดอร์นี้
          </div>

          <template v-else-if="orderItemsStatus === 'done'">
            <button
              v-for="item in orderItems"
              :key="item.orderItemId"
              type="button"
              :disabled="reassigning || item.orderItemId === orderitemId"
              class="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              :class="item.orderItemId === orderitemId ? 'border-primary bg-primary/10' : 'border-outline-variant/30 bg-surface-variant hover:bg-surface-container'"
              @click="handleReassign(item)"
            >
              <span class="min-w-0 font-body text-sm text-on-surface">
                {{ item.description || 'ไม่ได้ระบุรายละเอียด' }}
              </span>
              <span v-if="item.orderItemId === orderitemId" class="shrink-0 font-body text-xs font-medium text-primary">
                รายการปัจจุบัน
              </span>
            </button>
          </template>

          <button
            type="button"
            class="w-full py-2 font-body text-sm text-on-surface-variant"
            :disabled="reassigning"
            @click="closeReassignPicker"
          >
            ยกเลิก
          </button>
      </div>
    </PickerOverlay>

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

    <input ref="albumInputRef" type="file" accept="image/*" multiple class="hidden" @change="handleFiles" />

      <CameraOverlay
        :open="showCamera"
        @capture="handleCameraCapture"
        @close="handleCameraClose"
      />
    </div>
  </AppLayout>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .relative, .sheet-leave-active .relative { transition: transform 0.25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .relative { transform: translateY(100%); }
</style>
