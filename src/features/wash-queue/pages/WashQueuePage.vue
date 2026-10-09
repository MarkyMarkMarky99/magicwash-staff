<script setup lang="ts">
import type { z } from 'zod'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { washQueueRowSchema, washQueueUpdateSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import { useWashQueueStore } from '@/data/wash-queue/wash-queue.store'
import { useAuthStore } from '@/data/auth/auth.store'
import { useStaffStore } from '@/data/staff/staff.store'
import { getMyStaff, type StaffDto } from '@/data/staff/staff.service'
import { ApiError } from '@/shared/api/api-client'
import { uploadWashQueuePhoto } from '@/data/wash-queue/wash-queue.service'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import WeightPrompt from '@/shared/components/WeightPrompt.vue'
import { formatKg } from '../format-weights'
import { useQueryOverlay } from '../composables/useQueryOverlay'
import { useWeighFlow } from '../composables/useWeighFlow'
import WashQueueActionButton from '../components/WashQueueActionButton.vue'
import WashQueueNextCard from '../components/WashQueueNextCard.vue'
import WashQueueNotice from '../components/WashQueueNotice.vue'
import WashQueueRow, { type WashQueueRowAction } from '../components/WashQueueRow.vue'

type WashQueueUpdate = z.infer<typeof washQueueUpdateSchema>
type WashQueueDto = z.infer<typeof washQueueRowSchema>

const store = useWashQueueStore()
const auth = useAuthStore()
const staff = useStaffStore()
const weigh = useWeighFlow()
const photo = useQueryOverlay('photo')
const currentStaff = ref<StaffDto | null>(auth.pendingStaff)
const photoUrl = ref('')
const draftWeight = ref<number | null>(null)
const instruction = ref('')
const draftOpen = ref(false)
const uploading = ref(false)
const saving = ref(false)
const busyIds = ref(new Set<string>())
const cancelRow = ref<WashQueueDto | null>(null)
const errorMessage = ref<string | null>(null)
const bookError = ref<string | null>(null)
const roleWarning = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const unloadRowId = computed(() => weigh.target.value?.startsWith('unload:') ? weigh.target.value.slice('unload:'.length) : null)
const weighTitle = computed(() => unloadRowId.value ? 'Weigh the washed basket' : 'Weigh the basket')
const weighDescription = computed(() => `Put the ${unloadRowId.value ? 'washed ' : ''}basket on the scale and enter its weight. The photo you take next must show the basket on the scale.`)
const activePhoto = computed(() => photo.id.value)

const inMachine = computed(() => store.items.filter(row => row.status === 'In Progress'))
const waiting = computed(() => store.items.filter(row => row.status === 'Pending'))
const ready = computed(() => store.items.filter(row => row.status === 'Completed'))
const queueEmpty = computed(() => !inMachine.value.length && !waiting.value.length && !ready.value.length)
const images = computed(() => [...inMachine.value, ...waiting.value, ...ready.value].flatMap(row => [
  { id: row.id, src: row.photoUrl, alt: 'Basket on the scale before washing' },
  ...(row.unloadPhotoUrl ? [{ id: `${row.id}:after`, src: row.unloadPhotoUrl, alt: 'Basket on the scale after washing' }] : []),
]))
const isOperator = computed(() => auth.isAdmin || (currentStaff.value?.position ?? '').trim().toLowerCase() === 'washoperator')
const notice = computed(() => errorMessage.value ?? (store.items.length ? store.error : null))
const showPlaceholder = computed(() => (store.loading && !store.items.length) || (Boolean(store.error) && !store.items.length) || queueEmpty.value)
let timer: ReturnType<typeof setInterval> | undefined
let successTimer: ReturnType<typeof setTimeout> | undefined

function isMine(row: WashQueueDto): boolean {
  return row.createdBy === auth.staff?.staffId
}
function canCancel(row: WashQueueDto): boolean {
  return row.status === 'Pending' && (isMine(row) || isOperator.value)
}
function canCollect(row: WashQueueDto): boolean {
  return row.status === 'Completed' && (isMine(row) || isOperator.value)
}
function rowActions(row: WashQueueDto): WashQueueRowAction[] {
  const actions: WashQueueRowAction[] = []
  if (row.status === 'In Progress' && isOperator.value) actions.push('unload')
  if (canCollect(row)) actions.push('collect')
  if (canCancel(row)) actions.push('cancel')
  return actions
}
function showSuccess(text: string): void {
  clearTimeout(successTimer)
  successMessage.value = text
  successTimer = setTimeout(() => { successMessage.value = null }, 5000)
}
function setBusy(id: string, busy: boolean): void {
  const next = new Set(busyIds.value)
  if (busy) next.add(id)
  else next.delete(id)
  busyIds.value = next
}
function inputInstruction(value: string): void {
  instruction.value = value
}
async function capture(file: File): Promise<void> {
  const target = weigh.target.value
  const weight = weigh.weight.value
  if (!target || weight === null) return
  const unloadId = unloadRowId.value
  const row = unloadId ? store.items.find(item => item.id === unloadId) : null
  if (unloadId ? !row || busyIds.value.has(unloadId) : uploading.value) return
  weigh.close()
  errorMessage.value = null
  if (row) {
    await unload(row, weight, file)
    return
  }
  uploading.value = true
  bookError.value = null
  photoUrl.value = ''
  try {
    photoUrl.value = await uploadWashQueuePhoto(file)
    draftWeight.value = weight
    draftOpen.value = true
  } catch {
    errorMessage.value = 'Photo upload failed. Weigh the basket and take another photo.'
  } finally {
    uploading.value = false
  }
}
async function unload(row: WashQueueDto, weight: number, file: File): Promise<void> {
  if (!isOperator.value || row.status !== 'In Progress') return
  setBusy(row.id, true)
  try {
    const unloadPhotoUrl = await uploadWashQueuePhoto(file)
    await store.action(row.id, { action: 'unload', weightAfterKg: weight, unloadPhotoUrl })
    showSuccess(`Basket unloaded at ${formatKg(weight)}. Ready for pickup.`)
  } catch (reason) {
    errorMessage.value = reason instanceof ApiError ? reason.message : 'Unload failed. Nothing was saved. Weigh the basket and try again.'
    await store.load()
  } finally {
    setBusy(row.id, false)
  }
}
function discardDraft(): void {
  if (saving.value) return
  draftOpen.value = false
  photoUrl.value = ''
  draftWeight.value = null
  instruction.value = ''
  bookError.value = null
}
function reweigh(): void {
  if (saving.value) return
  discardDraft()
  weigh.open('book')
}
async function submit(): Promise<void> {
  if (!photoUrl.value || draftWeight.value === null || saving.value) return
  saving.value = true
  bookError.value = null
  try {
    await store.create({ photoUrl: photoUrl.value, instruction: instruction.value.trim() || null, weightBeforeKg: draftWeight.value })
    draftOpen.value = false
    photoUrl.value = ''
    draftWeight.value = null
    instruction.value = ''
    showSuccess(`Basket booked. ${waiting.value.length} waiting in the queue.`)
  } catch (reason) {
    bookError.value = reason instanceof ApiError ? reason.message : 'Booking failed. Check your connection and try again.'
  } finally {
    saving.value = false
  }
}
const successText = {
  load: 'Basket loaded into the machine.',
  collect: 'Basket picked up.',
  cancel: 'Booking cancelled.',
} as const
async function act(row: WashQueueDto, kind: keyof typeof successText): Promise<void> {
  if (busyIds.value.has(row.id)) return
  setBusy(row.id, true)
  errorMessage.value = null
  try {
    await store.action(row.id, { action: kind } satisfies WashQueueUpdate)
    showSuccess(successText[kind])
  } catch (reason) {
    errorMessage.value = reason instanceof ApiError ? reason.message : 'Action failed. The queue was reloaded; try again.'
    await store.load()
  } finally {
    setBusy(row.id, false)
  }
}
function rowAction(row: WashQueueDto, kind: WashQueueRowAction): void {
  if (kind === 'cancel') cancelRow.value = row
  else if (kind === 'unload') weigh.open(`unload:${row.id}`)
  else void act(row, kind)
}
function confirmCancel(): void {
  const row = cancelRow.value
  cancelRow.value = null
  if (row && canCancel(row)) void act(row, 'cancel')
}
function refresh(): void {
  if (!store.loading && !busyIds.value.size && !saving.value) void store.load()
}
function refreshVisible(): void {
  if (document.visibilityState === 'visible') refresh()
}
onMounted(() => {
  void store.load()
  if (!staff.loaded) void staff.load()
  void getMyStaff().then(row => { currentStaff.value = row }).catch(() => { roleWarning.value = 'Could not check your role. Operator buttons may be hidden.' })
  timer = setInterval(refresh, 30_000)
  document.addEventListener('visibilitychange', refreshVisible)
})
onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(successTimer)
  document.removeEventListener('visibilitychange', refreshVisible)
})
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <div class="bg-primary px-4 pb-3 pt-1 font-body text-xs font-bold text-on-primary/80" role="status" aria-label="Queue summary">
        Waiting <span class="text-lime">{{ waiting.length }}</span> · In machine <span class="text-lime">{{ inMachine.length }}</span> · Ready <span class="text-lime">{{ ready.length }}</span>
      </div>
    </template>

    <div v-if="notice || roleWarning || staff.error" class="space-y-2 px-4 pt-3">
      <WashQueueNotice v-if="notice" tone="error" :message="notice" :dismissible="Boolean(errorMessage)" @dismiss="errorMessage = null" />
      <WashQueueNotice v-if="roleWarning" tone="warning" :message="roleWarning" dismissible @dismiss="roleWarning = null" />
      <WashQueueNotice v-if="staff.error" tone="warning" message="Could not load staff names." />
    </div>

    <ListContainer
      v-if="showPlaceholder"
      title="Wash queue" icon="local_laundry_service" count-label="baskets" :count="0"
      :loading="store.loading && !store.items.length" :error="store.items.length ? null : store.error" :empty="queueEmpty"
      empty-text="No baskets in the queue. Tap Photo to book one." :skeleton-rows="3" skeleton-avatar-class="h-14 w-14"
    >
      <template #error>
        <div class="px-4 py-6 text-center">
          <p role="alert" class="text-sm text-error">{{ store.error }}</p>
          <button type="button" class="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="store.load()">Try again</button>
        </div>
      </template>
    </ListContainer>

    <template v-else>
      <ListContainer v-if="inMachine.length" title="In machine" icon="local_laundry_service" :count-label="inMachine.length === 1 ? 'basket' : 'baskets'" :count="inMachine.length">
        <WashQueueRow v-for="row in inMachine" :key="row.id" :row="row" :sender="staff.nameOf(row.createdBy)" :mine="isMine(row)" :busy="busyIds.has(row.id)" :actions="rowActions(row)" @photo="photo.open" @action="rowAction(row, $event)" />
      </ListContainer>

      <ListContainer v-if="waiting.length" title="Waiting" icon="hourglass_top" :count-label="waiting.length === 1 ? 'basket' : 'baskets'" :count="waiting.length">
        <template v-for="(row, index) in waiting" :key="row.id">
          <WashQueueNextCard v-if="index === 0" :row="row" :sender="staff.nameOf(row.createdBy)" :mine="isMine(row)" :busy="busyIds.has(row.id)" :can-load="isOperator" :can-cancel="canCancel(row)" @photo="photo.open" @load="act(row, 'load')" @cancel="cancelRow = row" />
          <WashQueueRow v-else :row="row" :sender="staff.nameOf(row.createdBy)" :position="index + 1" :mine="isMine(row)" :busy="busyIds.has(row.id)" :actions="rowActions(row)" @photo="photo.open" @action="rowAction(row, $event)" />
        </template>
      </ListContainer>

      <ListContainer v-if="ready.length" title="Ready for pickup" icon="check_circle" :count-label="ready.length === 1 ? 'basket' : 'baskets'" :count="ready.length" collapsible>
        <WashQueueRow v-for="row in ready" :key="row.id" :row="row" :sender="staff.nameOf(row.createdBy)" :mine="isMine(row)" :busy="busyIds.has(row.id)" :actions="rowActions(row)" @photo="photo.open" @action="rowAction(row, $event)" />
      </ListContainer>
    </template>
    <div class="h-8" aria-hidden="true" />

    <StickerFab class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10" label="Photo" aria-label="Book a basket: take photo" saving-label="Upload" :saving="uploading" :disabled="saving" @click="weigh.open('book')">
      <span class="material-symbols-outlined text-[36px]" aria-hidden="true">photo_camera</span>
    </StickerFab>
    <div v-if="successMessage" class="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 right-28 z-20">
      <div class="pointer-events-auto rounded-xl shadow-lg"><WashQueueNotice tone="success" :message="successMessage" dismissible @dismiss="successMessage = null" /></div>
    </div>

    <WeightPrompt :open="weigh.promptOpen.value" input-id="wash-queue-weight" :title="weighTitle" :description="weighDescription" @submit="weigh.submit" @close="weigh.close" />
    <CameraOverlay :open="weigh.cameraOpen.value" @close="weigh.close" @capture="capture" />
    <PhotoViewer v-if="activePhoto" :images="images" :active-id="activePhoto" @change="photo.change" @close="photo.close" />
    <ConfirmOverlay :open="draftOpen" title="Book this basket?" cancel-label="Discard" confirm-label="Book" :confirm-disabled="saving || !photoUrl || draftWeight === null" @close="discardDraft" @confirm="submit">
      <img v-if="photoUrl" :src="photoUrl" alt="Basket on the scale preview" class="mb-3 h-40 w-full rounded-xl object-cover" />
      <div v-if="draftWeight !== null" class="mb-3 flex items-center justify-between gap-3">
        <p class="font-headline text-lg font-bold text-primary">{{ formatKg(draftWeight) }}</p>
        <WashQueueActionButton variant="quiet" label="Re-weigh" :disabled="saving" @click="reweigh" />
      </div>
      <FormTextarea id="wash-instruction" label="Note / wash program (optional)" :model-value="instruction" @update:model-value="inputInstruction" />
      <WashQueueNotice v-if="bookError" class="mb-3" tone="error" :message="bookError" />
    </ConfirmOverlay>
    <ConfirmOverlay :open="Boolean(cancelRow)" title="Cancel this booking?" description="This basket will leave the wash queue." cancel-label="Keep booking" confirm-label="Cancel booking" @close="cancelRow = null" @confirm="confirmCancel" />
  </ListPageLayout>
</template>
