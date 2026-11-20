<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import FormInput from '@/shared/components/FormInput.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import { useStockTakeStore } from '@/data/stock-takes/stock-take.store'
import type { StockTakeResolution } from '@/data/stock-takes/stock-take.service'
import { formatSheetDateTime } from '@/shared/utils/sheet-date'
import MissingGarmentCard from '../components/MissingGarmentCard.vue'
import {
  accountedSummary, canConfirmGap, codeLabel, conflictAction, errorText, linkConfirmation, sessionActions, taskPick,
  type ReportConflict, type ReportGap,
} from '../stock-take-report'

type Confirming = 'finish' | 'cancel' | null

const store = useStockTakeStore()
const busy = ref<string | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const notes = ref('')
const confirming = ref<Confirming>(null)
const expandedOrders = ref(new Set<string>())

const session = computed(() => store.active ?? (store.report?.session ?? null))
const report = computed(() => store.report && (!store.active || store.report.session.id === store.active.id) ? store.report : null)
const actions = computed(() => sessionActions(session.value))
const summary = computed(() => report.value ? accountedSummary(report.value) : null)
const statusTone = computed(() => {
  const status = session.value?.status
  return status === 'OPEN' ? 'success' : status === 'CLOSED' ? 'warning' : status === 'APPLIED' ? 'brand' : 'neutral'
})
const issueSections = computed(() => {
  const current = report.value
  if (!current) return []
  const rows = (items: readonly { orderId: string; tag: string; code: string; ticketIds: string[] }[]) => items.map(item => ({ orderId: item.orderId, tag: item.tag, text: codeLabel(item.code), ticketIds: item.ticketIds }))
  return [
    { title: 'Backward cases', icon: 'undo', rows: rows(current.backward) },
    { title: 'Blocked', icon: 'block', rows: rows(current.blocked) },
    { title: 'Packing exceptions', icon: 'inventory_2', rows: rows(current.packingExceptions) },
    { title: 'Dispatch exceptions', icon: 'local_shipping', rows: rows(current.dispatchExceptions) },
    { title: 'Skipped', icon: 'skip_next', rows: current.skipped.map(item => ({ orderId: item.orderId, tag: item.tag, text: 'Skipped during apply', ticketIds: [] })) },
  ]
})

async function run(name: string, task: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = name
  error.value = null
  notice.value = null
  try {
    await task()
  } catch (reason) {
    error.value = errorText(reason)
  } finally {
    busy.value = null
  }
}

function load(): Promise<void> {
  return run('load', async () => { await store.refreshActive() })
}

function loadReport(): Promise<void> {
  const id = session.value?.id
  if (!id) return Promise.resolve()
  return run('report', async () => { await store.refreshReport(id) })
}

function open(): Promise<void> {
  return run('open', async () => {
    const value = notes.value.trim()
    await store.open(value ? { notes: value } : {})
    notes.value = ''
    notice.value = 'Stock-take opened. Staff can start counting'
  })
}

function confirmed(): Promise<void> {
  const action = confirming.value
  const id = session.value?.id
  confirming.value = null
  if (!id || !action) return Promise.resolve()
  return run(action, async () => {
    if (action === 'finish') {
      await store.finish(id)
      notice.value = 'Stock-take finished. Job tickets now match the scans'
    } else {
      await store.cancel(id)
      notice.value = 'Stock-take cancelled'
    }
  })
}

function resolve(resolutions: StockTakeResolution[]): Promise<void> {
  const id = session.value?.id
  if (!id) return Promise.resolve()
  return run('resolve', async () => {
    const result = await store.resolve(id, resolutions)
    await store.refreshReport(id)
    notice.value = `Recorded ${result.recorded} resolution${result.recorded === 1 ? '' : 's'}`
  })
}

function toggleOrder(orderId: string): void {
  const next = new Set(expandedOrders.value)
  if (!next.delete(orderId)) next.add(orderId)
  expandedOrders.value = next
}

function confirmGap(gap: ReportGap & { tag: string }): void {
  void resolve([linkConfirmation(gap.orderId, gap.tag)])
}

function conflictOwner(conflict: ReportConflict): void {
  if (conflict.orderId) void resolve([linkConfirmation(conflict.orderId, conflict.tag)])
}

function conflictTask(conflict: ReportConflict, ticketId: string): void {
  if (conflict.orderId) void resolve([taskPick(conflict.orderId, conflict.tag, ticketId)])
}

onActivated(() => { void load() })
</script>

<template>
  <ListPageLayout>
    <section class="pb-24">
      <div class="px-4 pb-2 pt-4">
        <div class="min-w-0 border-l-4 border-lime pl-2">
          <h2 class="font-headline text-xl font-bold leading-tight text-primary">Manage stock-take</h2>
          <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">Open, scan, then finish</span>
        </div>
      </div>

      <div class="flex flex-col gap-3 px-4 pb-4">
        <InlineNotice v-if="error" tone="error" icon="error" dismissible @dismiss="error = null">{{ error }}</InlineNotice>
        <InlineNotice v-if="notice" tone="success" icon="check_circle" dismissible @dismiss="notice = null">{{ notice }}</InlineNotice>

        <section class="flex flex-col gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4" aria-label="Session">
          <template v-if="session">
            <div class="flex items-center justify-between gap-2">
              <span class="font-headline text-sm font-bold text-primary">{{ session.id }}</span>
              <BaseBadge :label="session.status" :tone="statusTone" size="lg" />
            </div>
            <p class="font-label text-xs text-on-surface-variant">Opened {{ formatSheetDateTime(session.openedAt) }} by {{ session.openedBy }}</p>
            <p v-if="session.closedAt" class="font-label text-xs text-on-surface-variant">Closed {{ formatSheetDateTime(session.closedAt) }} by {{ session.closedBy }}</p>
            <p v-if="session.appliedAt" class="font-label text-xs text-on-surface-variant">Ended {{ formatSheetDateTime(session.appliedAt) }} by {{ session.appliedBy }}</p>
            <p v-if="session.notes" class="font-body text-sm text-on-surface">{{ session.notes }}</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-full bg-primary px-4 py-2 font-label text-sm text-on-primary focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="!actions.canFinish || busy !== null" @click="confirming = 'finish'">Finish</button>
              <button type="button" class="rounded-full border border-outline-variant px-4 py-2 font-label text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="!actions.canCancel || busy !== null" @click="confirming = 'cancel'">Cancel</button>
            </div>
          </template>
          <template v-else>
            <p class="font-body text-sm text-on-surface">{{ busy === 'load' ? 'Loading…' : 'No stock-take in progress' }}</p>
            <FormInput id="stock-take-notes" label="Notes (optional)" :model-value="notes" @update:model-value="notes = $event" />
            <button type="button" class="self-start rounded-full bg-primary px-4 py-2 font-label text-sm text-on-primary focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="busy !== null" @click="open">Open stock-take</button>
          </template>
        </section>

        <InlineNotice v-if="session?.status === 'OPEN'" tone="info" icon="info">Staff are counting. Job tickets, bags and garments are frozen until this ends. Press Finish when everything is scanned.</InlineNotice>
        <InlineNotice v-else-if="session?.status === 'CLOSED'" tone="warning" icon="lock">Counting is closed. Press Finish to update job tickets, or Cancel.</InlineNotice>

        <div v-if="session" class="flex flex-wrap items-center gap-2">
          <button type="button" class="rounded-full border border-outline-variant px-4 py-2 font-label text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="busy !== null" @click="loadReport">{{ report ? 'Refresh report' : 'Load report' }}</button>
          <span v-if="busy" class="font-label text-xs text-on-surface-variant" role="status">Working…</span>
        </div>

      </div>

      <template v-if="report">
        <p v-if="summary" class="px-4 pb-2 font-label text-xs font-bold text-on-surface-variant">{{ summary.accounted }} of {{ summary.orders }} orders accounted for</p>

        <ListContainer title="Orders" icon="receipt_long" :count="report.orders.length" count-label="orders" :empty="report.orders.length === 0" empty-text="No open orders">
          <div v-for="order in report.orders" :key="order.orderId" class="bg-surface px-4 py-2">
            <button type="button" class="flex w-full items-start justify-between gap-2 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-lime" :aria-expanded="expandedOrders.has(order.orderId)" @click="toggleOrder(order.orderId)">
              <span class="min-w-0">
                <strong class="block truncate font-headline text-sm text-primary">{{ order.orderId }}</strong>
                <span class="block font-label text-xs text-on-surface-variant">{{ order.status ?? 'No status' }}</span>
                <span class="block font-label text-xs text-on-surface">Found {{ order.found }} · Returned {{ order.returned }} · Off-site {{ order.offSite }} · Expected {{ order.expected }}</span>
              </span>
              <BaseBadge :label="order.accounted ? 'Accounted' : 'Review'" :tone="order.accounted ? 'success' : 'warning'" />
            </button>
            <ul v-if="expandedOrders.has(order.orderId)" class="mt-2 flex flex-col divide-y divide-outline-variant/10 rounded-xl bg-surface-container-low">
              <li v-for="garment in order.garments" :key="garment.tag" class="flex items-center justify-between gap-2 px-3 py-2 font-label text-xs">
                <span class="min-w-0 truncate">{{ garment.tag }} · {{ garment.garmentType ?? 'Unknown type' }}</span>
                <BaseBadge :label="garment.disposition" :tone="garment.disposition === 'MISSING' ? 'danger' : 'neutral'" />
              </li>
              <li v-if="!order.garments.length" class="px-3 py-2 font-label text-xs text-on-surface-variant">No garments</li>
            </ul>
          </div>
        </ListContainer>

        <ListContainer title="Missing garments" icon="search_off" :count="report.missing.length" count-label="garments" :empty="report.missing.length === 0" empty-text="Nothing missing">
          <MissingGarmentCard v-for="garment in report.missing" :key="garment.orderId + garment.tag" :garment="garment" :resolvable="actions.canResolve" :busy="busy !== null" @resolve="resolve([$event])" />
        </ListContainer>

        <ListContainer title="Membership gaps" icon="link_off" :count="report.membershipGaps.length" count-label="gaps" :empty="report.membershipGaps.length === 0" empty-text="No membership gaps">
          <div v-for="gap in report.membershipGaps" :key="gap.orderId + (gap.tag ?? '') + gap.code" class="flex items-center justify-between gap-2 px-4 py-2">
            <span class="min-w-0">
              <strong class="block truncate font-label text-sm text-on-surface">{{ gap.orderId }} · {{ gap.tag ?? 'No tag' }}</strong>
              <span class="block font-label text-xs text-on-surface-variant">{{ codeLabel(gap.code) }}</span>
            </span>
            <BaseBadge v-if="gap.confirmed" label="Confirmed" tone="success" />
            <button v-else-if="actions.canResolve && canConfirmGap(gap)" type="button" class="flex-none rounded-full border border-outline-variant px-3 py-1.5 font-label text-xs focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="busy !== null" @click="confirmGap(gap)">Confirm link</button>
          </div>
        </ListContainer>

        <ListContainer title="Conflicts" icon="warning" :count="report.conflicts.length" count-label="conflicts" :empty="report.conflicts.length === 0" empty-text="No conflicts">
          <div v-for="conflict in report.conflicts" :key="conflict.tag + (conflict.orderId ?? '') + conflict.code" class="flex flex-col gap-2 px-4 py-2">
            <span class="min-w-0">
              <strong class="block truncate font-label text-sm text-on-surface">{{ conflict.tag }}<template v-if="conflict.orderId"> · {{ conflict.orderId }}</template></strong>
              <span class="block font-label text-xs text-on-surface-variant">{{ codeLabel(conflict.code) }}</span>
            </span>
            <div v-if="actions.canResolve && conflictAction(conflict) === 'link'">
              <button type="button" class="rounded-full border border-outline-variant px-3 py-1.5 font-label text-xs focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="busy !== null" @click="conflictOwner(conflict)">This order owns the garment</button>
            </div>
            <div v-else-if="actions.canResolve && conflictAction(conflict) === 'task'" class="flex flex-wrap gap-2">
              <button v-for="ticketId in conflict.ticketIds" :key="ticketId" type="button" class="max-w-full truncate rounded-full border border-outline-variant px-3 py-1.5 font-label text-xs focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="busy !== null" @click="conflictTask(conflict, ticketId)">Use {{ ticketId }}</button>
            </div>
          </div>
        </ListContainer>

        <ListContainer title="Unexpected scans" icon="help" :count="report.unexpected.length" count-label="scans" :empty="report.unexpected.length === 0" empty-text="No unexpected scans">
          <div v-for="item in report.unexpected" :key="item.tag + item.code" class="px-4 py-2">
            <strong class="block truncate font-label text-sm text-on-surface">{{ item.tag }}</strong>
            <span class="block font-label text-xs text-on-surface-variant">{{ codeLabel(item.code) }}</span>
          </div>
        </ListContainer>

        <ListContainer v-for="section in issueSections" :key="section.title" :title="section.title" :icon="section.icon" :count="section.rows.length" count-label="items" :empty="section.rows.length === 0" empty-text="None">
          <div v-for="row in section.rows" :key="row.orderId + row.tag + row.text" class="px-4 py-2">
            <strong class="block truncate font-label text-sm text-on-surface">{{ row.orderId }} · {{ row.tag }}</strong>
            <span class="block font-label text-xs text-on-surface-variant">{{ row.text }}</span>
            <span v-if="row.ticketIds.length" class="block break-all font-label text-[11px] text-on-surface-variant">Tickets: {{ row.ticketIds.join(', ') }}</span>
          </div>
        </ListContainer>
      </template>
    </section>

    <ConfirmOverlay
      :open="confirming !== null"
      :title="confirming === 'finish' ? 'Finish the stock-take?' : 'Cancel the stock-take?'"
      :description="confirming === 'finish' ? 'Scanning stops and the job tickets of every scanned garment move to where it was found. Garments not scanned stay as they are.' : 'The count is abandoned and no ticket is changed. Job tickets, bags and garments unfreeze.'"
      :cancel-label="confirming === 'finish' ? 'Keep counting' : 'Keep stock-take'"
      :confirm-label="confirming === 'finish' ? 'Finish' : 'Cancel stock-take'"
      @close="confirming = null"
      @confirm="confirmed"
    />
  </ListPageLayout>
</template>
