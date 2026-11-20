<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import { useAuthStore } from '@/data/auth/auth.store'
import { useOperatorStore } from '@/data/operator/operator.store'
import { useStockTakeStore } from '@/data/stock-takes/stock-take.store'
import type { StockTakeScan } from '@/data/stock-takes/stock-take.service'
import { useScannerGunInput } from '@/shared/composables/useScannerGunInput'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { formatSheetDateTime } from '@/shared/utils/sheet-date'
import {
  bagLabel, buildScan, classifySendFailure, countDepartments, countStatuses, departmentZone, MAX_RECENT_SCANS, packedZone,
  readCountInput, removeSent, restoreScanQueue, retryDelayMs, sameZone, scanKey, takeBatch, zoneLabel,
  type BagContext, type CountDepartment, type CountStatus, type CountZone,
} from '../stock-take-count'
import { errorText } from '../stock-take-report'

type Ack = { title: string; message: string; tone: 'success' | 'warning' | 'error' }
type RecentScan = { key: string; tag: string; detail: string; state: 'waiting' | 'saved' }

const route = useRoute()
const router = useRouter()
const store = useStockTakeStore()
const authStore = useAuthStore()
const operatorStore = useOperatorStore()

const loading = ref(false)
const loadError = ref<string | null>(null)
const zone = ref<CountZone>(departmentZone('Washing', 'Pending'))
const bag = ref<BagContext>({ mode: 'unset' })
const queue = ref<StockTakeScan[]>([])
const recent = ref<RecentScan[]>([])
const scannedCount = ref(0)
const ack = ref<Ack | null>(null)
const sendNotice = ref<string | null>(null)
const sending = ref(false)
const pageActive = ref(true)
let seen = new Set<string>()
let trackedSessionId: string | null = null
let attempts = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
let pushedScanner = false

const session = computed(() => store.active)
const counting = computed(() => session.value?.status === 'OPEN')
const isDevice = computed(() => authStore.staff?.role === 'device')
const needsCard = computed(() => isDevice.value && !operatorStore.staffId)
const canScan = computed(() => counting.value && !needsCard.value)
const scannerOpen = computed(() => canScan.value && route.query.scan === '1')
const inPacked = computed(() => zone.value.department === null)

useScannerGunInput(value => handleInput(value, 'gun'), () => pageActive.value && canScan.value && !scannerOpen.value)

function queueStorageKey(sessionId: string): string {
  return `stock-take:scan-queue:${sessionId}`
}

function persistQueue(): void {
  const sessionId = trackedSessionId
  if (!sessionId) return
  try {
    if (queue.value.length) localStorage.setItem(queueStorageKey(sessionId), JSON.stringify(queue.value))
    else localStorage.removeItem(queueStorageKey(sessionId))
  } catch { /* storage unavailable */ }
}

function setQueue(next: StockTakeScan[]): void {
  queue.value = next
  persistQueue()
}

function resetForSession(sessionId: string | null): void {
  trackedSessionId = sessionId
  clearTimeout(retryTimer)
  attempts = 0
  seen = new Set()
  recent.value = []
  scannedCount.value = 0
  ack.value = null
  sendNotice.value = null
  bag.value = { mode: 'unset' }
  queue.value = []
  if (!sessionId) return
  try {
    const restored = restoreScanQueue(JSON.parse(localStorage.getItem(queueStorageKey(sessionId)) ?? 'null'))
    queue.value = restored
    for (const scan of restored) seen.add(scanKey(scan))
    scannedCount.value = restored.length
    recent.value = restored.slice(-MAX_RECENT_SCANS).map(scan => ({ key: scanKey(scan), tag: scan.tag, detail: scanDetail(scan), state: 'waiting' }))
  } catch { /* storage unavailable */ }
  if (queue.value.length) void flush()
}

watch(() => session.value?.id ?? null, id => { if (id !== trackedSessionId) resetForSession(id) }, { immediate: true })
watch(() => operatorStore.staffId, () => { void refresh() })
watch(counting, open => { if (!open && route.query.scan === '1') closeScanner() })

async function refresh(): Promise<void> {
  if (needsCard.value) {
    loadError.value = 'Scan your staff card to start counting'
    return
  }
  loading.value = true
  try {
    await store.refreshActive()
    loadError.value = null
  } catch (error) {
    loadError.value = errorText(error)
  } finally {
    loading.value = false
  }
}

function scanDetail(scan: StockTakeScan): string {
  const base = scan.department === null ? 'Packed' : zoneLabel({ department: scan.department, status: scan.status as CountStatus })
  return scan.bagId ? `${base} · Bag ${scan.bagId}` : base
}

function showAck(next: Ack, outcome: 'success' | 'failure'): void {
  ack.value = next
  feedback(outcome)
}

function selectZone(department: CountDepartment | null, status: CountStatus | 'Packed'): void {
  void primeFeedbackAudio()
  const next = department === null ? packedZone : departmentZone(department, status as CountStatus)
  if (sameZone(next, zone.value)) return
  zone.value = next
  bag.value = { mode: 'unset' }
}

function chooseNoBag(): void {
  bag.value = bag.value.mode === 'none' ? { mode: 'unset' } : { mode: 'none' }
}

function handleInput(value: string, source: 'gun' | 'camera'): void {
  if (!canScan.value) return
  const input = readCountInput(value)
  if (input.kind === 'staff') {
    if (source === 'camera' && isDevice.value) void operatorStore.scanCard(value)
    return
  }
  if (input.kind === 'invalid') {
    showAck({ title: value, message: input.message, tone: 'error' }, 'failure')
    return
  }
  if (input.kind === 'bag') {
    if (!inPacked.value) {
      showAck({ title: `Bag ${input.bagId}`, message: 'Choose the Packed zone to count a bag', tone: 'error' }, 'failure')
      return
    }
    bag.value = { mode: 'bag', bagId: input.bagId }
    showAck({ title: `Bag ${input.bagId}`, message: 'Bag selected. Scan its garments', tone: 'success' }, 'success')
    return
  }
  const built = buildScan(input.tag, zone.value, bag.value)
  if ('error' in built) {
    showAck({ title: input.tag, message: built.error, tone: 'error' }, 'failure')
    return
  }
  const key = scanKey(built.scan)
  if (seen.has(key)) {
    showAck({ title: input.tag, message: 'Already scanned here', tone: 'warning' }, 'failure')
    return
  }
  seen.add(key)
  scannedCount.value += 1
  setQueue([...queue.value, built.scan])
  recent.value = [...recent.value, { key, tag: input.tag, detail: scanDetail(built.scan), state: 'waiting' as const }].slice(-MAX_RECENT_SCANS)
  showAck({ title: input.tag, message: scanDetail(built.scan), tone: 'success' }, 'success')
  void flush()
}

function markSaved(sent: readonly StockTakeScan[]): void {
  const keys = new Set(sent.map(scanKey))
  recent.value = recent.value.map(entry => keys.has(entry.key) ? { ...entry, state: 'saved' as const } : entry)
}

async function flush(): Promise<void> {
  clearTimeout(retryTimer)
  const sessionId = trackedSessionId
  if (!sessionId || sending.value || !counting.value) return
  sending.value = true
  try {
    while (queue.value.length && trackedSessionId === sessionId) {
      const batch = takeBatch(queue.value)
      try {
        await store.scan(sessionId, batch)
      } catch (error) {
        if (trackedSessionId !== sessionId) return
        const failure = classifySendFailure(error)
        sendNotice.value = failure.message
        if (failure.action === 'retry') {
          attempts += 1
          retryTimer = setTimeout(() => { void flush() }, retryDelayMs(attempts))
        } else if (failure.action === 'drop') {
          const dropped = new Set(batch.map(scanKey))
          for (const key of dropped) seen.delete(key)
          recent.value = recent.value.filter(entry => !dropped.has(entry.key))
          scannedCount.value = Math.max(0, scannedCount.value - dropped.size)
          setQueue(removeSent(queue.value, batch))
          void refresh()
        }
        return
      }
      if (trackedSessionId !== sessionId) return
      attempts = 0
      sendNotice.value = null
      setQueue(removeSent(queue.value, batch))
      markSaved(batch)
    }
  } finally {
    sending.value = false
  }
}

function retryNow(): void {
  attempts = 0
  void flush()
}

function openScanner(): void {
  if (!canScan.value || scannerOpen.value) return
  void primeFeedbackAudio()
  void router.push({ query: { ...route.query, scan: '1' } }).then(() => { pushedScanner = scannerOpen.value })
}

function closeScanner(): void {
  if (route.query.scan !== '1') return
  if (pushedScanner) {
    pushedScanner = false
    router.back()
    return
  }
  const query: LocationQueryRaw = { ...route.query }
  delete query.scan
  void router.replace({ query })
}

function openManage(): void {
  void router.push({ name: 'stock-take-manage' })
}

function online(): void {
  if (queue.value.length) retryNow()
}

window.addEventListener('online', online)
onBeforeUnmount(() => {
  window.removeEventListener('online', online)
  clearTimeout(retryTimer)
})
onActivated(() => {
  pageActive.value = true
  void refresh()
  if (queue.value.length) retryNow()
})
onDeactivated(() => { pageActive.value = false })
</script>

<template>
  <ListPageLayout>
    <section class="pb-24">
      <div class="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
        <div class="min-w-0 border-l-4 border-lime pl-2">
          <h2 class="font-headline text-xl font-bold leading-tight text-primary">Stock-take</h2>
          <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">Scan every garment where it sits</span>
        </div>
        <button v-if="authStore.isAdmin" type="button" class="flex-none rounded-full border border-outline-variant px-4 py-2 font-label text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-lime" @click="openManage">Manage</button>
      </div>

      <div class="flex flex-col gap-3 px-4 pb-4">
        <InlineNotice v-if="loadError" tone="error" icon="error">
          <span class="min-w-0 flex-1">{{ loadError }}</span>
          <button v-if="!needsCard" type="button" class="flex-none rounded-full border border-current px-3 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-lime" @click="refresh">Try again</button>
        </InlineNotice>
        <p v-else-if="loading && !session" class="text-sm italic text-on-surface-variant">Loading…</p>
        <InlineNotice v-else-if="!session" tone="info" icon="inventory">
          <span class="min-w-0 flex-1">No stock-take in progress</span>
          <button type="button" class="flex-none rounded-full border border-current px-3 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-lime" @click="refresh">Refresh</button>
        </InlineNotice>
        <InlineNotice v-else-if="!counting" tone="warning" icon="lock">
          <span class="min-w-0 flex-1">Counting has ended. An admin is reviewing the results</span>
        </InlineNotice>

        <template v-if="counting">
          <div class="flex items-center justify-between gap-2">
            <span class="min-w-0 truncate font-label text-xs text-on-surface-variant">Opened {{ formatSheetDateTime(session?.openedAt) }}</span>
            <BaseBadge label="Counting" tone="success" size="lg" />
          </div>

          <section aria-label="Zone" class="flex flex-col gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-3">
            <h3 class="font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant">Zone</h3>
            <div v-for="department in countDepartments" :key="department.code" class="grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
              <span class="truncate font-label text-xs font-semibold text-on-surface">{{ department.label }}</span>
              <button v-for="status in countStatuses" :key="status" type="button" class="rounded-full px-2 py-2 font-label text-xs focus-visible:outline-2 focus-visible:outline-lime" :class="sameZone(zone, departmentZone(department.code, status)) ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'" :aria-pressed="sameZone(zone, departmentZone(department.code, status))" @click="selectZone(department.code, status)">{{ status }}</button>
            </div>
            <button type="button" class="rounded-full px-3 py-2 font-label text-xs focus-visible:outline-2 focus-visible:outline-lime" :class="inPacked ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'" :aria-pressed="inPacked" @click="selectZone(null, 'Packed')">Packed</button>
          </section>

          <section v-if="inPacked" aria-label="Bag" class="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-3">
            <div class="min-w-0">
              <h3 class="font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant">Bag</h3>
              <p class="truncate font-body text-sm font-semibold text-on-surface">{{ bagLabel(bag) }}</p>
              <p v-if="bag.mode === 'unset'" class="font-label text-xs text-on-surface-variant">Scan the bag QR first</p>
            </div>
            <button type="button" class="flex-none rounded-full border px-3 py-2 font-label text-xs focus-visible:outline-2 focus-visible:outline-lime" :class="bag.mode === 'none' ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface'" :aria-pressed="bag.mode === 'none'" @click="chooseNoBag">Bag has no QR</button>
          </section>

          <p class="font-body text-sm text-on-surface">Counting <strong>{{ zoneLabel(zone) }}</strong></p>

          <InlineNotice v-if="needsCard" tone="warning" icon="badge">Scan your staff card to start counting</InlineNotice>
          <InlineNotice v-else-if="ack" :tone="ack.tone" :icon="ack.tone === 'success' ? 'check_circle' : 'error'" dismissible @dismiss="ack = null">
            <span class="min-w-0 flex-1"><strong class="block truncate">{{ ack.title }}</strong><span class="block">{{ ack.message }}</span></span>
          </InlineNotice>

          <InlineNotice v-if="sendNotice" tone="warning" icon="sync_problem">
            <span class="min-w-0 flex-1">{{ sendNotice }}</span>
            <button type="button" class="flex-none rounded-full border border-current px-3 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-lime" @click="retryNow">Retry now</button>
          </InlineNotice>

          <div class="flex items-center gap-2">
            <BaseBadge :label="`${scannedCount} scanned`" tone="brand" size="lg" />
            <BaseBadge v-if="queue.length" :label="`${queue.length} waiting to send`" tone="warning" size="lg" />
          </div>

          <ul v-if="recent.length" class="flex flex-col divide-y divide-outline-variant/10 rounded-2xl border border-outline-variant/30 bg-white" aria-label="Recent scans">
            <li v-for="entry in [...recent].reverse()" :key="entry.key" class="flex items-center gap-3 px-3 py-2">
              <span class="material-symbols-outlined text-[18px]" :class="entry.state === 'saved' ? 'text-primary' : 'text-on-surface-variant'" aria-hidden="true">{{ entry.state === 'saved' ? 'check_circle' : 'schedule' }}</span>
              <span class="min-w-0 flex-1">
                <strong class="block truncate font-label text-sm text-on-surface">{{ entry.tag }}</strong>
                <span class="block truncate font-label text-xs text-on-surface-variant">{{ entry.detail }}</span>
              </span>
              <span class="font-label text-[10px] uppercase text-on-surface-variant">{{ entry.state === 'saved' ? 'Saved' : 'Waiting' }}</span>
            </li>
          </ul>
        </template>
      </div>
    </section>

    <StickerFab v-if="canScan" class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10" label="Scan" aria-label="Scan tag" @click="openScanner">
      <span class="material-symbols-outlined" style="font-size: 36px; font-variation-settings: 'wght' 600" aria-hidden="true">qr_code_scanner</span>
    </StickerFab>

    <QrScannerOverlay :open="scannerOpen" title="Stock-take" @close="closeScanner" @scan="value => handleInput(value, 'camera')">
      <template #result>
        <p class="mb-1 font-label text-sm font-bold">{{ zoneLabel(zone) }}<template v-if="inPacked"> · {{ bagLabel(bag) }}</template></p>
        <p class="mb-2 font-label text-xs">{{ scannedCount }} scanned · {{ queue.length }} waiting</p>
        <InlineNotice v-if="ack" :tone="ack.tone" size="sm">{{ ack.title }} · {{ ack.message }}</InlineNotice>
      </template>
    </QrScannerOverlay>
  </ListPageLayout>
</template>
