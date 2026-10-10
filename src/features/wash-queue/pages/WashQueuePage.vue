<script setup lang="ts">
import type { z } from 'zod'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'
import type { washQueueRowSchema, washQueueUpdateSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import { useWashQueueStore } from '@/data/wash-queue/wash-queue.store'
import { useMachinesStore } from '@/data/machines/machines.store'
import { useAuthStore } from '@/data/auth/auth.store'
import { useStaffStore } from '@/data/staff/staff.store'
import { ApiError } from '@/shared/api/api-client'
import { uploadWashQueuePhoto } from '@/data/wash-queue/wash-queue.service'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import WeightPrompt from '@/shared/components/WeightPrompt.vue'
import { formatKg } from '../format-weights'
import { machineLabel, modeOfMachineId, type MachineMode } from '../machine-label'
import { useQueryOverlay } from '../composables/useQueryOverlay'
import { useNow } from '../composables/useNow'
import { useWeighFlow } from '../composables/useWeighFlow'
import WashQueueMachinePicker from '../components/WashQueueMachinePicker.vue'
import WashQueueModeSwitch from '../components/WashQueueModeSwitch.vue'
import WashQueueNotice from '../components/WashQueueNotice.vue'
import WashQueuePhotoButton from '../components/WashQueuePhotoButton.vue'
import WashQueueRow, { type WashQueueRowAction } from '../components/WashQueueRow.vue'
import WashQueueSection from '../components/WashQueueSection.vue'

type WashQueueUpdate = z.infer<typeof washQueueUpdateSchema>
type WashQueueDto = z.infer<typeof washQueueRowSchema>

const route = useRoute()
const router = useRouter()
const store = useWashQueueStore()
const machines = useMachinesStore()
const auth = useAuthStore()
const staff = useStaffStore()
const weigh = useWeighFlow()
const now = useNow()
const photo = useQueryOverlay('photo')
const photoUrl = ref('')
const draftWeight = ref<number | null>(null)
const draftMachineId = ref<string | null>(null)
const instruction = ref('')
const draftOpen = ref(false)
const uploading = ref(false)
const saving = ref(false)
const busyIds = ref(new Set<string>())
const cancelRow = ref<WashQueueDto | null>(null)
const errorMessage = ref<string | null>(null)
const bookError = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const unloadRowId = computed(() => weigh.target.value?.startsWith('unload:') ? weigh.target.value.slice('unload:'.length) : null)
const weighTitle = computed(() => unloadRowId.value ? 'Weigh the washed basket' : 'Weigh the basket')
const weighDescription = computed(() => `Put the ${unloadRowId.value ? 'washed ' : ''}basket on the scale and enter its weight. The photo you take next must show the basket on the scale.`)
const activePhoto = computed(() => photo.id.value)

const mode = computed<MachineMode>(() => {
  const raw = route.query.mode
  return (Array.isArray(raw) ? raw[0] : raw) === 'dryer' ? 'dryer' : 'washer'
})
const modeRows = computed(() => store.items.filter(row => modeOfMachineId(row.machineId) === mode.value))
const inMachine = computed(() => modeRows.value.filter(row => row.status === 'In Progress'))
const waiting = computed(() => modeRows.value.filter(row => row.status === 'Pending'))
const ready = computed(() => modeRows.value.filter(row => row.status === 'Completed'))
// FIFO is per machine: a basket's position is counted among the waiting baskets of its own machine.
const waitingPosition = computed(() => {
  const seen = new Map<string, number>()
  const positions = new Map<string, number>()
  for (const row of waiting.value) {
    const key = row.machineId ?? ''
    const position = (seen.get(key) ?? 0) + 1
    seen.set(key, position)
    positions.set(row.id, position)
  }
  return positions
})
const pickerMachines = computed(() => machines.items.filter(machine => machine.status === 'ACTIVE' && machine.type === (mode.value === 'dryer' ? 'DRY' : 'WSH')))
const machineChosen = computed(() => pickerMachines.value.some(machine => machine.id === draftMachineId.value))
const tabKeys = ['all', 'waiting', 'in-machine', 'ready'] as const
type TabKey = typeof tabKeys[number]
const activeTab = computed<TabKey>(() => {
  const raw = route.query.tab
  const first = Array.isArray(raw) ? raw[0] : raw
  return tabKeys.find(key => key === first) ?? 'all'
})
const tabs = computed(() => [
  { key: 'all', label: 'All', count: inMachine.value.length + waiting.value.length + ready.value.length },
  { key: 'waiting', label: 'Waiting', count: waiting.value.length },
  { key: 'in-machine', label: 'In machine', count: inMachine.value.length },
  { key: 'ready', label: 'Ready', count: ready.value.length },
])
const tabEmptyText = { all: '', waiting: 'No baskets waiting.', 'in-machine': 'No baskets in the machine.', ready: 'No baskets ready for pickup.' } as const
const showMachine = computed(() => (activeTab.value === 'all' || activeTab.value === 'in-machine') && inMachine.value.length > 0)
const showWaiting = computed(() => (activeTab.value === 'all' || activeTab.value === 'waiting') && waiting.value.length > 0)
const showReady = computed(() => (activeTab.value === 'all' || activeTab.value === 'ready') && ready.value.length > 0)
const topSection = computed(() => showMachine.value ? 'machine' : showWaiting.value ? 'waiting' : showReady.value ? 'ready' : null)
const queueEmpty = computed(() => !inMachine.value.length && !waiting.value.length && !ready.value.length)
const images = computed(() => ['In Progress', 'Pending', 'Completed'].flatMap(status => store.items.filter(row => row.status === status)).flatMap(row => [
  { id: row.id, src: row.photoUrl, alt: 'Basket on the scale before washing' },
  ...(row.unloadPhotoUrl ? [{ id: `${row.id}:after`, src: row.unloadPhotoUrl, alt: 'Basket on the scale after washing' }] : []),
]))
const cancelDescription = computed(() => cancelRow.value?.status === 'Pending'
  ? 'This basket will leave the wash queue.'
  : `This basket is already ${cancelRow.value?.status === 'Completed' ? 'ready for pickup' : 'in a machine'}. Cancelling closes it and removes it from the queue.`)
const notice = computed(() => errorMessage.value ?? (store.items.length ? store.error : null))
const showPlaceholder = computed(() => (store.loading && !store.items.length) || (Boolean(store.error) && !store.items.length) || queueEmpty.value)
const tabEmpty = computed(() => !showPlaceholder.value && !showMachine.value && !showWaiting.value && !showReady.value)
const swipeHint = computed(() => {
  const rights: string[] = []
  if (showWaiting.value) rights.push('load')
  if (showMachine.value) rights.push('unload')
  if (showReady.value) rights.push('pick up')
  const left = showWaiting.value || showMachine.value || showReady.value
  return rights.length || left ? { left, right: rights.join(' / ') } : null
})
let timer: ReturnType<typeof setInterval> | undefined
const rowHandles = new Map<string, { close: () => void; contains: (target: Node) => boolean }>()
let openRowId: string | null = null
let successTimer: ReturnType<typeof setTimeout> | undefined

function isMine(row: WashQueueDto): boolean {
  return row.createdBy === auth.staff?.staffId
}
// Right swipe: Load, Unload or Pick up.
function primaryAction(row: WashQueueDto): 'load' | 'unload' | 'collect' | null {
  if (row.status === 'Pending') return 'load'
  if (row.status === 'In Progress') return 'unload'
  return row.status === 'Completed' ? 'collect' : null
}
function bindRow(id: string, handle: unknown): void {
  if (handle) rowHandles.set(id, handle as { close: () => void; contains: (target: Node) => boolean })
  else rowHandles.delete(id)
}
function rowOpened(id: string): void {
  if (openRowId && openRowId !== id) rowHandles.get(openRowId)?.close()
  openRowId = id
}
function closeOpenRow(event: PointerEvent): void {
  const handle = openRowId ? rowHandles.get(openRowId) : undefined
  if (!handle || (event.target instanceof Node && handle.contains(event.target))) return
  handle.close()
  openRowId = null
}
function machineOf(row: WashQueueDto): string {
  return machineLabel(row.machineId, machines.items)
}
function changeTab(key: string): void {
  if (!tabKeys.includes(key as TabKey)) return
  const query: LocationQueryRaw = { ...route.query }
  if (key === 'all') delete query.tab
  else query.tab = key
  void router.replace({ query })
}
function changeMode(next: MachineMode): void {
  const query: LocationQueryRaw = { ...route.query }
  if (next === 'washer') delete query.mode
  else query.mode = next
  void router.replace({ query })
}
function chooseMachine(machineId: string): void {
  draftMachineId.value = machineId
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
  if (row.status !== 'In Progress') return
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
  draftMachineId.value = null
  instruction.value = ''
  bookError.value = null
}
function reweigh(): void {
  if (saving.value) return
  discardDraft()
  weigh.open('book')
}
async function submit(): Promise<void> {
  const machineId = draftMachineId.value
  if (!photoUrl.value || draftWeight.value === null || !machineId || !machineChosen.value || saving.value) return
  saving.value = true
  bookError.value = null
  try {
    await store.create({ machineId, photoUrl: photoUrl.value, instruction: instruction.value.trim() || null, weightBeforeKg: draftWeight.value })
    draftOpen.value = false
    photoUrl.value = ''
    draftWeight.value = null
    draftMachineId.value = null
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
  if (row) void act(row, 'cancel')
}
function refresh(): void {
  if (!store.loading && !busyIds.value.size && !saving.value) void store.load()
}
function refreshVisible(): void {
  if (document.visibilityState === 'visible') refresh()
}
onMounted(() => {
  void store.load()
  void machines.load()
  if (!staff.loaded) void staff.load()
  timer = setInterval(refresh, 30_000)
  document.addEventListener('visibilitychange', refreshVisible)
  document.addEventListener('pointerdown', closeOpenRow, true)
})
onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(successTimer)
  document.removeEventListener('visibilitychange', refreshVisible)
  document.removeEventListener('pointerdown', closeOpenRow, true)
})
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <GenericTabs :tabs="tabs" :active-key="activeTab" @select="changeTab" />
    </template>

    <div v-if="notice || staff.error || machines.error" class="space-y-2 px-4 pt-3">
      <WashQueueNotice v-if="notice" tone="error" :message="notice" :dismissible="Boolean(errorMessage)" @dismiss="errorMessage = null" />
      <WashQueueNotice v-if="staff.error" tone="warning" message="Could not load staff names." />
      <WashQueueNotice v-if="machines.error" tone="warning" :message="machines.error" />
    </div>

    <div v-if="!topSection" class="flex justify-end px-4 pt-3">
      <WashQueuePhotoButton :saving="uploading" :disabled="saving" @click="weigh.open('book')" />
    </div>

    <ListContainer
      v-if="showPlaceholder"
      title="Wash queue" icon="local_laundry_service" count-label="baskets"
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

    <ListContainer v-else-if="tabEmpty" :title="tabs.find(tab => tab.key === activeTab)?.label ?? 'Wash queue'" icon="local_laundry_service" count-label="baskets" empty :empty-text="tabEmptyText[activeTab]" />

    <template v-else>
      <p v-if="swipeHint" class="mx-4 mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2 font-label text-[10px] font-bold uppercase leading-tight tracking-wider text-on-surface-variant">
        <span v-if="swipeHint.left" class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">swipe_left</span>Left: cancel</span>
        <span v-if="swipeHint.right" class="ml-auto inline-flex items-center gap-1">Right: {{ swipeHint.right }}<span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">swipe_right</span></span>
      </p>

      <WashQueueSection v-if="showMachine" title="In machine" subtitle="Unload when the cycle ends" framed>
        <template v-if="topSection === 'machine'" #action>
          <WashQueuePhotoButton :saving="uploading" :disabled="saving" @click="weigh.open('book')" />
        </template>
        <WashQueueRow v-for="row in inMachine" :key="row.id" :ref="(handle) => bindRow(row.id, handle)" :row="row" :sender="staff.nameOf(row.createdBy)" :machine="machineOf(row)" :now="now" :mine="isMine(row)" :busy="busyIds.has(row.id)" :primary="primaryAction(row)" :cancellable="true" @photo="photo.open" @action="rowAction(row, $event)" @opened="rowOpened(row.id)" />
      </WashQueueSection>

      <WashQueueSection v-if="showWaiting" title="Waiting" subtitle="First in, first washed">
        <template v-if="topSection === 'waiting'" #action>
          <WashQueuePhotoButton :saving="uploading" :disabled="saving" @click="weigh.open('book')" />
        </template>
        <WashQueueRow v-for="row in waiting" :key="row.id" :ref="(handle) => bindRow(row.id, handle)" :row="row" :sender="staff.nameOf(row.createdBy)" :machine="machineOf(row)" :position="waitingPosition.get(row.id)" :mine="isMine(row)" :busy="busyIds.has(row.id)" :primary="primaryAction(row)" :cancellable="true" @photo="photo.open" @action="rowAction(row, $event)" @opened="rowOpened(row.id)" />
      </WashQueueSection>

      <WashQueueSection v-if="showReady" title="Ready for pickup" subtitle="Dry weight in, wet weight out" collapsible>
        <template v-if="topSection === 'ready'" #action>
          <WashQueuePhotoButton :saving="uploading" :disabled="saving" @click="weigh.open('book')" />
        </template>
        <WashQueueRow v-for="row in ready" :key="row.id" :ref="(handle) => bindRow(row.id, handle)" :row="row" :sender="staff.nameOf(row.createdBy)" :machine="machineOf(row)" :mine="isMine(row)" :busy="busyIds.has(row.id)" :primary="primaryAction(row)" :cancellable="true" @photo="photo.open" @action="rowAction(row, $event)" @opened="rowOpened(row.id)" />
      </WashQueueSection>
    </template>
    <div class="h-12" aria-hidden="true" />

    <WashQueueModeSwitch :mode="mode" @select="changeMode" />
    <div v-if="successMessage" class="pointer-events-none absolute inset-x-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5.25rem)] z-20 flex justify-center">
      <div class="pointer-events-auto w-full max-w-sm rounded-xl shadow-lg"><WashQueueNotice tone="success" :message="successMessage" dismissible @dismiss="successMessage = null" /></div>
    </div>

    <WeightPrompt :open="weigh.promptOpen.value" input-id="wash-queue-weight" :title="weighTitle" :description="weighDescription" @submit="weigh.submit" @close="weigh.close" />
    <CameraOverlay :open="weigh.cameraOpen.value" @close="weigh.close" @capture="capture" />
    <PhotoViewer v-if="activePhoto" :images="images" :active-id="activePhoto" @change="photo.change" @close="photo.close" />
    <ConfirmOverlay :open="draftOpen" title="Book this basket?" cancel-label="Discard" confirm-label="Book" :confirm-disabled="saving || !photoUrl || draftWeight === null || !machineChosen" @close="discardDraft" @confirm="submit">
      <img v-if="photoUrl" :src="photoUrl" alt="Basket on the scale preview" class="mb-3 h-40 w-full rounded-xl object-cover" />
      <div v-if="draftWeight !== null" class="mb-3 flex items-center justify-between gap-3">
        <p class="font-headline text-lg font-bold text-primary">{{ formatKg(draftWeight) }}</p>
        <button type="button" class="flex h-11 items-center justify-center rounded-full border border-outline-variant px-5 font-label text-sm text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50" :disabled="saving" @click="reweigh">Re-weigh</button>
      </div>
      <WashQueueMachinePicker :machines="pickerMachines" :model-value="draftMachineId" @update:model-value="chooseMachine" />
      <FormTextarea id="wash-instruction" label="Note / wash program (optional)" :model-value="instruction" @update:model-value="inputInstruction" />
      <WashQueueNotice v-if="bookError" class="mb-3" tone="error" :message="bookError" />
    </ConfirmOverlay>
    <ConfirmOverlay :open="Boolean(cancelRow)" title="Cancel this booking?" :description="cancelDescription" cancel-label="Keep booking" confirm-label="Cancel booking" @close="cancelRow = null" @confirm="confirmCancel" />
  </ListPageLayout>
</template>
