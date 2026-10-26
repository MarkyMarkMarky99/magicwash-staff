<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import CloseButton from '@/shared/components/CloseButton.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import PriceListItemPicker from '@/features/price-list/components/PriceListItemPicker.vue'
import SectionHeader from '@/shared/components/SectionHeader.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import LaundryItemPhotoControls from './LaundryItemPhotoControls.vue'
import PaperCard from '@/shared/components/PaperCard.vue'
import { useLaundryItemDetail, type GarmentPrefetch } from '../composables/useLaundryItemDetail'
import { useLaundryItemDetailOverlayRoute } from '../composables/useLaundryItemDetailOverlayRoute'
import { useLaundryItemPhotoCapture } from '../composables/useLaundryItemPhotoCapture'
import { garmentAlbum, garmentCurrentPlace, garmentDate, garmentInOrder, garmentLastSeen, garmentOrderRows, garmentPhotoPreview, garmentPhotoTypeOptions, garmentSharedHistory, garmentTimeline } from '../utils/laundry-item-detail'
import type { LaundryItemDto } from '@/data/laundry-items/laundry-item.service'
import type { ItemDto } from '@/data/items/items.service'

const props = withDefaults(defineProps<{ tagId: string, orderId?: string | null, readonly?: boolean, initialGarment?: LaundryItemDto | null, initialLoads?: GarmentPrefetch | null }>(), { orderId: null, readonly: false })
const emit = defineEmits<{ typeChanged: [itemId: string] }>()
const detail = useLaundryItemDetail(() => props.tagId, itemId => emit('typeChanged', itemId), () => props.initialGarment, () => props.initialLoads)
const { garment, loading, error, saving, saveError, item, customerName, programName } = detail
const overlay = useLaundryItemDetailOverlayRoute()
const expanded = ref<string | null>(null)
const rows = computed(() => garmentOrderRows(props.tagId, detail.tickets.value, props.orderId))
const inOrder = computed(() => props.orderId === null || (detail.ticketsLoaded.value && garmentInOrder(props.tagId, props.orderId, detail.tickets.value)))
const history = computed(() => garmentSharedHistory(props.tagId, detail.photos.value))
const canAdd = computed(() => !props.readonly && inOrder.value && garment.value !== null)
const photoTypes = garmentPhotoTypeOptions()
const cameraType = computed(() => {
  const value = overlay.value.value
  if (!canAdd.value || !value?.startsWith('camera:')) return null
  return photoTypes.find(option => option.value === value.slice(7))?.value ?? null
})
const destination = computed(() => props.orderId === null ? 'Garment history' : 'This order')
const capture = useLaundryItemPhotoCapture({ orderId: () => props.orderId, save: request => detail.addPhoto(request) })
const { items: captured, problems, saving: capturing } = capture
const stamp = computed(() => garmentCurrentPlace(props.tagId, rows.value[0]?.orderId, detail.tickets.value))
const lastSeen = computed(() => garmentLastSeen(props.tagId, detail.tickets.value))
const album = computed(() => garment.value ? garmentAlbum(garment.value, detail.photos.value, detail.tickets.value, props.orderId) : [])
const images = computed(() => album.value.flatMap(section => section.photos))
const preview = computed(() => [...captured.value, ...(garment.value ? garmentPhotoPreview(garment.value, album.value, detail.photos.value) : [])])
const activePhoto = computed(() => overlay.value.value?.startsWith('photo:') ? overlay.value.value.slice(6) : null)
const albumOpen = computed(() => overlay.value.value === 'album' || activePhoto.value !== null)
const title = computed(() => item.value ? item.value.displayNameEn?.trim() || item.value.displayNameTh : 'Uncategorized')
const titleHead = computed(() => { const i = title.value.lastIndexOf(' '); return i < 0 ? '' : title.value.slice(0, i + 1) })
const titleTail = computed(() => title.value.slice(titleHead.value.length))
const metadata = computed(() => [
  { label: 'Customer', value: customerName.value },
  { label: 'Registered', value: garmentDate(garment.value?.createdAt, true) },
  { label: 'Wash program', value: programName.value },
  { label: 'Last seen', value: garmentDate(lastSeen.value, true) },
  { label: 'Note', value: garment.value?.notes || '–', full: true },
])

function defects(orderId: string) {
  return album.value.find(section => section.type === 'DEFECT')?.photos.filter(photo => photo.orderId === orderId) ?? []
}

let taken = false

function onCapture(file: File): void {
  if (cameraType.value === null || taken) return
  taken = true
  void capture.add(file, cameraType.value)
  overlay.close()
}

watch(cameraType, () => { taken = false })

async function selectType(selected: ItemDto): Promise<void> {
  await detail.changeType(selected.id)
  if (overlay.value.value === 'type') overlay.close()
}
</script>

<template>
  <main class="garment-detail px-4 pb-10 pt-4">
    <p v-if="loading" role="status" class="py-12 text-center text-on-surface-variant">Loading garment…</p>
    <div v-else-if="error" role="alert" class="rounded-xl bg-error-container p-4 text-on-error-container">
      <p>{{ error }}</p>
      <button type="button" class="mt-3 rounded-full border-2 border-current px-4 py-2 font-bold" @click="detail.load">Retry</button>
    </div>
    <template v-else-if="garment">
      <div class="hero" role="img" :aria-label="`Registration photo of ${garment.id}`">
        <ImageOrIcon :image-url="garment.imageUrl" icon="checkroom" class="h-full w-full" />
        <div class="tag"><small>TAG</small><strong>{{ garment.id }}</strong></div>
      </div>
      <section class="flex items-center gap-3 px-0.5 pt-4">
        <div class="min-w-0 flex-1 break-words">
          <h1 class="font-headline text-xl font-extrabold leading-[1.1]" :class="item ? 'text-primary' : 'text-warning'">
            {{ titleHead }}<span class="whitespace-nowrap">{{ titleTail }}<button type="button" aria-label="Change type" class="ml-1 inline-grid h-8 w-8 place-items-center rounded-lg border-0 align-[-4px] text-on-surface-variant" :disabled="saving" @click="overlay.open('type')"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span></button></span>
          </h1>
          <p v-if="item?.displayNameTh" lang="th" class="mt-[3px] font-label text-[10px] font-extrabold leading-none text-on-surface-variant">{{ item.displayNameTh }}</p>
        </div>
        <LaundryItemPhotoControls class="shrink-0" :class="{ 'photos-pending': !detail.photosLoaded.value }" :photos="preview" :can-add="canAdd" :saving="capturing" :destination="destination" @view="overlay.open('album')" @select="overlay.open(`camera:${$event}`)" />
      </section>
      <div v-if="problems.length" class="mt-4 flex flex-col gap-2">
        <InlineNotice v-for="problem in problems" :key="problem.key" :tone="problem.kind === 'upload' ? 'warning' : 'error'" :dismissible="!problem.busy" @dismiss="capture.dismiss(problem)">
          <span class="min-w-0 flex-1">{{ problem.message }}</span>
          <button type="button" class="shrink-0 rounded-full border-2 border-current px-3 py-1 font-bold focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="problem.busy" @click="capture.retry(problem)">{{ problem.busy ? 'Retrying…' : 'Retry' }}</button>
        </InlineNotice>
      </div>
      <p v-if="saveError" role="alert" class="mt-4 rounded-xl bg-error-container p-3 text-on-error-container">{{ saveError }}</p>
      <InlineNotice v-if="detail.photoError.value" tone="error" class="mt-4">{{ detail.photoError.value }}</InlineNotice>
      <InlineNotice v-if="detail.items.error" tone="error" class="mt-4">{{ detail.items.error }}</InlineNotice>
      <InlineNotice v-if="detail.programs.error" tone="error" class="mt-4">{{ detail.programs.error }}</InlineNotice>
      <InlineNotice v-if="detail.staff.error" tone="error" class="mt-4">{{ detail.staff.error }}</InlineNotice>
      <dl class="metadata">
        <div v-for="cell in metadata" :key="cell.label" class="metadata-cell" :class="{ full: cell.full }"><dt>{{ cell.label }}</dt><dd>{{ cell.value }}</dd></div>
      </dl>
      <template v-if="history.length">
        <SectionHeader class="!mb-6 !mt-7" title="Garment history" subtitle="Shared by all orders" />
        <PaperCard tab="History" class="!m-0">
          <ul class="grid grid-cols-3 gap-2 px-3.5 pb-4 pt-5">
            <li v-for="photo in history" :key="photo.id" class="min-w-0">
              <button type="button" class="relative block w-full overflow-hidden rounded-[10px_12px_10px_11px] border-2 border-primary" :aria-label="`View ${photo.alt}`" @click="overlay.open(`photo:${photo.id}`)">
                <ImageOrIcon :image-url="photo.src" icon="image" class="aspect-square w-full" />
                <span class="absolute bottom-1 left-1 rounded-[7px] bg-primary px-1.5 text-[11px] font-extrabold text-on-primary">{{ photo.label }}</span>
              </button>
            </li>
          </ul>
        </PaperCard>
      </template>
      <InlineNotice v-if="detail.ticketError.value" tone="error" class="mt-4">{{ detail.ticketError.value }}</InlineNotice>
      <template v-if="detail.ticketsLoaded.value">
        <SectionHeader class="!mb-6 !mt-7" :title="orderId === null ? 'Order history' : 'This order'" :subtitle="orderId === null ? 'Newest first · tap to see steps' : 'Tap to see steps'" />
        <InlineNotice v-if="!inOrder" tone="warning" icon="info">This garment is not in this order</InlineNotice>
        <PaperCard v-else tab="Orders" class="!m-0">
          <p v-if="rows.length === 0" class="px-4 py-8 text-center text-on-surface-variant">Not in any order yet</p>
          <ul v-else class="order-list">
            <li v-for="(order, index) in rows" :key="order.orderId" class="order-entry">
              <button :id="`garment-order-${order.orderId}`" type="button" class="order-row" :aria-expanded="expanded === order.orderId" :aria-controls="`garment-steps-${order.orderId}`" @click="expanded = expanded === order.orderId ? null : order.orderId">
                <span class="order-date">{{ garmentDate(order.createdAt) }}</span>
                <span v-if="index === 0 && stamp" class="place-stamp"><span class="material-symbols-outlined text-[13px]" aria-hidden="true">autorenew</span>{{ stamp }}</span>
                <span class="material-symbols-outlined chevron" :class="{ 'rotate-180': expanded === order.orderId }" aria-hidden="true">expand_more</span>
              </button>
              <div v-if="expanded === order.orderId" :id="`garment-steps-${order.orderId}`" role="region" :aria-labelledby="`garment-order-${order.orderId}`" class="timeline-panel">
                <div v-if="defects(order.orderId).length" class="mb-4 flex flex-wrap gap-2">
                  <button v-for="photo in defects(order.orderId)" :key="photo.id" type="button" aria-label="View defect photo" @click="overlay.open(`photo:${photo.id}`)"><ImageOrIcon :image-url="photo.src" icon="image" class="h-14 w-14 rounded-lg" /></button>
                </div>
                <ol class="timeline">
                  <li v-for="step in garmentTimeline(tagId, order.orderId, detail.tickets.value)" :key="step.id" :class="step.state">
                    <span class="dot" aria-hidden="true" />
                    <div class="step-name">{{ step.departmentLabel }}<span v-if="step.status === 'In Progress'"> · In progress</span><span v-if="step.status === 'Cancelled'"> · Cancelled</span></div>
                    <p v-for="event in step.events" :key="event.label" class="step-time">{{ event.label }} <b>{{ garmentDate(event.at, true) }}</b> · {{ detail.staff.nameOf(event.staff) || '–' }}</p>
                    <p v-if="step.status === 'Pending'" class="step-time">Not started yet</p>
                  </li>
                </ol>
                <p v-if="garmentTimeline(tagId, order.orderId, detail.tickets.value).length === 0" class="text-sm text-on-surface-variant">No steps yet</p>
              </div>
            </li>
          </ul>
        </PaperCard>
      </template>
    </template>
    <DetailOverlay :open="albumOpen" :ariaLabel="`Photos · ${images.length}`" :close-button="false" @close="overlay.close">
      <template #header><div class="flex items-center justify-between px-4 pb-2"><h2 class="font-headline text-[22px] font-extrabold text-primary">Photos · {{ images.length }}</h2><CloseButton label="Close photos" @click="overlay.close" /></div></template>
      <div class="px-4 pb-7">
        <section v-for="section in album" :key="section.type" class="mt-5">
          <SectionHeader :title="section.title" :subtitle="`${section.photos.length} ${section.photos.length === 1 ? 'photo' : 'photos'}`" />
          <div class="grid grid-cols-3 gap-2">
            <button v-for="photo in section.photos" :key="photo.id" type="button" class="relative min-w-0 overflow-hidden rounded-[10px_12px_10px_11px] border-2 border-primary" :aria-label="`View ${photo.alt}`" @click="overlay.open(`photo:${photo.id}`)">
              <ImageOrIcon :image-url="photo.src" icon="image" class="aspect-square w-full" />
              <span v-if="section.type !== 'REGISTRATION'" class="absolute bottom-1 left-1 rounded-[7px] bg-primary px-1.5 text-[11px] font-extrabold text-on-primary">{{ garmentDate(photo.date) }}</span>
            </button>
          </div>
        </section>
        <p v-if="images.length === 0" class="py-8 text-center text-on-surface-variant">No photos yet</p>
      </div>
    </DetailOverlay>
    <PriceListItemPicker selection-mode="item" :open="overlay.value.value === 'type'" :detail="customerName" :items="detail.items.items" :loading="detail.items.loading || saving" :error="detail.items.error" :truncated="detail.items.truncated" @close="overlay.close" @retry="detail.items.load" @select="selectType" />
    <CameraOverlay :open="cameraType !== null" @close="overlay.close" @capture="onCapture" />
    <PhotoViewer v-if="activePhoto" :images="images" :active-id="activePhoto" @change="overlay.open(`photo:${$event}`, true)" @close="overlay.close" />
  </main>
</template>

<style scoped>
.photos-pending :deep(.badge) {
  display: none;
}
.garment-detail :focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}
.hero {
  position: relative;
  aspect-ratio: 1;
  border-radius: 22px 26px 22px 24px;
  overflow: hidden;
  border: 2px solid var(--color-primary);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}
.tag {
  position: absolute;
  left: 12px;
  top: 12px;
    display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 2px solid var(--color-primary);
  border-radius: 14px 16px 13px 15px;
  background: white;
  color: var(--color-primary);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(-4deg);
}
.tag small {
  position: absolute;
  top: 6px;
  font: 800 10px/1 var(--font-body);
  letter-spacing: .2em;
  color: var(--color-on-surface-variant);
}
.tag strong {
  margin-top: 8px;
  font: 800 24px/1.1 var(--font-headline);
  letter-spacing: .04em;
}
.metadata {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  margin-top: 16px;
  background: var(--color-outline-variant);
  border-radius: 14px;
  overflow: hidden;
}
.metadata-cell {
  background: white;
  padding: 12px 16px;
  min-width: 0;
}
.metadata-cell.full {
  grid-column: 1 / -1;
}
.metadata dt {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}
.metadata dd {
  margin-top: 2px;
  font-size: 16px;
  font-weight: 800;
  color: var(--color-primary);
  line-height: 1.3;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.order-list {
  padding-top: 8px;
}
.order-entry + .order-entry {
  border-top: 1px dashed var(--color-outline-variant);
}
.order-row {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: 'date stamp';
  gap: 2px 10px;
  align-items: center;
  padding: 12px 46px 12px 14px;
  text-align: left;
}
.order-date {
  grid-area: date;
  font-size: 16px;
  font-weight: 800;
  color: var(--color-primary);
}
.place-stamp {
  grid-area: stamp;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: .06em;
  text-transform: uppercase;
  border: 2px solid var(--color-primary);
  border-radius: 7px 9px 7px 8px;
  background: var(--color-lime);
  color: var(--color-primary);
  box-shadow: 2px 2px 0 var(--color-primary);
  transform: rotate(-2deg);
}
.chevron {
  position: absolute;
  right: 12px;
  top: 50%;
  margin-top: -12px;
  color: var(--color-primary);
}
.timeline-panel {
  padding: 6px 14px 16px;
  background: var(--color-surface-container-low);
}
.timeline li {
  position: relative;
  padding: 0 0 16px 28px;
}
.timeline li:last-child {
  padding-bottom: 0;
}
.timeline li::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 16px;
  bottom: -2px;
  width: 2px;
  background: var(--color-outline);
}
.timeline li:last-child::before {
  display: none;
}
.timeline li.done::before {
  background: var(--color-primary);
}
.dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--color-outline);
  background: var(--color-surface-container-low);
}
.done .dot {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.current .dot {
  background: var(--color-lime);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-lime) 40%, transparent);
}
.step-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
}
.step-time {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  overflow-wrap: anywhere;
}
.step-time b {
  color: var(--color-on-surface);
}
.future .step-name, .future .step-time {
  color: var(--color-outline);
  font-weight: 600;
}
</style>
