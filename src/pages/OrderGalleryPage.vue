<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getBeforePhotoCollections, getPhotos } from '../api/photos'
import PhotoGallery from '../components/photo-gallery/PhotoGallery.vue'

function parseKey(key) {
  const parts = String(key ?? '').split('-')
  return { type: parts[0], orderId: parts[1], orderitemId: parts[2] ?? null }
}

const route = useRoute()
const fetchedPhotos = ref([])
const fetchStatus = ref('loading')

const galleryKey = computed(() => parseKey(route.params.key))
const title = computed(() => (galleryKey.value.type === 'BEF' ? 'รูปก่อนซัก' : 'รูปหลังซัก'))

const allPhotos = computed(() => fetchedPhotos.value.map((photo, index) => ({
  id: photo.id ?? `remote-${index}`,
  src: photo.image_url,
  label: photo.notes || null,
  removable: false,
})))

const galleryPhotos = computed(() => (
  galleryKey.value.type === 'BEF' ? fetchedPhotos.value : allPhotos.value
))

watch(
  () => route.params.key,
  async () => {
    const { type, orderId, orderitemId } = galleryKey.value

    fetchStatus.value = 'loading'
    fetchedPhotos.value = []

    try {
      fetchedPhotos.value = type === 'BEF'
        ? await getBeforePhotoCollections(orderId, orderitemId)
        : await getPhotos(type, orderId, orderitemId)
      fetchStatus.value = 'done'
    } catch {
      fetchStatus.value = 'error'
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-screen overflow-hidden">
    <div v-if="fetchStatus === 'loading'" class="h-full flex flex-col items-center justify-center gap-3">
      <span class="material-symbols-outlined text-primary text-5xl animate-pulse">local_laundry_service</span>
      <p class="font-body text-on-surface-variant text-sm">กำลังโหลดรูปภาพ…</p>
    </div>

    <div v-else-if="fetchStatus === 'error'" class="h-full flex flex-col items-center justify-center gap-3">
      <span class="material-symbols-outlined text-error text-5xl">error_outline</span>
      <p class="font-body text-on-surface-variant text-sm">โหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
    </div>

    <PhotoGallery
      v-else
      :photos="galleryPhotos"
      :title="title"
      empty-text="ยังไม่มีรูปภาพ"
      :show-action="false"
      :show-secondary-action="false"
    />
  </div>
</template>
