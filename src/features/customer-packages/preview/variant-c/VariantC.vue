<script setup lang="ts">
import { computed, ref } from 'vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { formatSheetDateTime } from '@/shared/utils/sheet-date'
import CustomerPackageSummaryCard from '../../components/CustomerPackageSummaryCard.vue'
import { CUSTOMER_PACKAGES } from '../customer-packages.fixture'

const sourcePackage = CUSTOMER_PACKAGES[0]

const showAllTransactions = ref(false)
const visibleTransactions = computed(() => showAllTransactions.value ? sourcePackage.transactions : sourcePackage.transactions.slice(0, 2))

function formatCreditChange(value: number) {
  return `${value > 0 ? '+' : ''}${value} credit${Math.abs(value) === 1 ? '' : 's'}`
}
</script>

<template>
  <main class="package-page">
    <div class="px-8 py-4">
      <div>
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" aria-hidden="true">person</span>
              <h1 class="truncate font-headline text-lg font-bold text-primary">{{ sourcePackage.customerName }}</h1>
              <BaseBadge :label="sourcePackage.status" size="lg" :uppercase="true" tone="accent" />
            </div>
            <p class="mt-1 text-xs text-on-surface-variant">{{ sourcePackage.customerId }} · {{ sourcePackage.customerPhone || 'No phone on file' }}</p>
            <p v-if="sourcePackage.customerAddress" class="mt-1 text-xs text-on-surface-variant"><span class="material-symbols-outlined mr-1 align-middle text-[14px]" aria-hidden="true">location_on</span>{{ sourcePackage.customerAddress }}</p>
          </div>
          <a v-if="sourcePackage.customerPhone" :href="`tel:${sourcePackage.customerPhone}`" class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary shadow-sm transition hover:opacity-90"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">call</span><span class="hidden sm:inline">Call customer</span></a>
        </div>
      </div>
    </div>

    <CustomerPackageSummaryCard :customer-package="sourcePackage" />

    <ListContainer class="mt-3" title="Recent activity" icon="history" :count="sourcePackage.transactions.length" count-label="events" top-divider>
      <template #actions><button class="text-button" type="button" @click="showAllTransactions = !showAllTransactions">{{ showAllTransactions ? 'Show less' : 'View all' }}</button></template>
        <ol class="timeline px-4"><li v-for="transaction in visibleTransactions" :key="transaction.id"><span class="timeline-dot" :class="{ credit: transaction.creditChange > 0 }" /><div class="transaction-copy"><strong>{{ transaction.type }}</strong><small>{{ transaction.referenceSource }} · {{ transaction.referenceId }}<template v-if="transaction.notes"> · {{ transaction.notes }}</template></small></div><div class="text-right"><time class="block">{{ formatSheetDateTime(transaction.createdAt) }}</time><small v-if="transaction.creditChange !== 0" class="mt-1 block text-[10px] font-semibold" :class="transaction.creditChange > 0 ? 'text-secondary' : 'text-primary'">{{ formatCreditChange(transaction.creditChange) }}</small></div></li></ol>
    </ListContainer>

  </main>
</template>

<style scoped>
.package-page { width: 100%; max-width: 720px; margin: 0 auto; padding: 0 0 34px; color: var(--color-on-surface); font-family: Inter, Roboto, ui-sans-serif, system-ui, sans-serif; }
.page-bar { display: flex; align-items: center; gap: 10px; min-height: 64px; }.page-title { flex: 1; display: flex; align-items: baseline; gap: 8px; color: var(--color-on-surface); font-size: 16px; font-weight: 700; }.page-title small { color: var(--color-on-surface-variant); font-size: 11px; font-weight: 500; }.icon-button { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; color: var(--color-on-surface); background: transparent; font-size: 29px; line-height: 1; cursor: pointer; }.icon-button:hover { background: var(--color-surface-container-low); outline: none; }.icon-button:focus-visible { background: var(--color-lime); outline: none; }.menu-wrap { position: relative; }.action-menu { position: absolute; top: 46px; right: 0; z-index: 4; width: 170px; overflow: hidden; border: 1px solid var(--color-outline-variant); border-radius: 12px; background: white; box-shadow: 0 8px 22px color-mix(in srgb, black 13%, transparent); }.action-menu button { width: 100%; border: 0; background: white; color: var(--color-on-surface); padding: 12px 14px; text-align: left; font-size: 12px; cursor: pointer; }.action-menu button:hover { background: var(--color-surface); }
.page-bar,.customer-card,.balance-card,.quick-grid,.references-section,.page-actions { margin-right: 16px; margin-left: 16px; }
.customer-card,.balance-card,.quick-item,.activity-section,.references-section { border: 1px solid var(--color-outline-variant); border-radius: 16px; background: white; }.customer-card { padding: 20px; }.customer-head { display: flex; align-items: center; gap: 12px; }.avatar { display: grid; place-items: center; flex: none; width: 46px; height: 46px; border-radius: 50%; color: var(--color-primary); background: var(--color-secondary-container); font-size: 13px; font-weight: 750; }.customer-head h1 { margin: 0; color: var(--color-on-surface); font-size: 20px; letter-spacing: -.02em; }.customer-head p { margin: 4px 0 0; color: var(--color-on-surface-variant); font-size: 12px; }.status { margin-left: auto; border-radius: 999px; padding: 6px 9px; color: var(--color-success); background: var(--color-success-container); font-size: 11px; font-weight: 700; }.status.expiring-soon { color: var(--color-on-warning-container); background: var(--color-warning-container); }.status.paused { color: var(--color-on-surface-variant); background: var(--color-surface-container); }.package-type { display: flex; align-items: center; gap: 10px; margin-top: 20px; border-top: 1px solid var(--color-outline-variant); padding-top: 16px; }.service-icon { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 9px; color: var(--color-secondary); background: var(--color-secondary-container); }.package-type strong,.package-type small { display: block; }.package-type strong { color: var(--color-on-surface); font-size: 13px; }.package-type small { margin-top: 3px; color: var(--color-on-surface-variant); font-size: 11px; }
.balance-card { margin-top: 12px; padding: 20px; color: white; background: var(--color-primary); border-color: var(--color-primary); }.balance-heading { display: flex; align-items: flex-start; justify-content: space-between; }.section-label { margin: 0 0 7px; color: var(--color-on-surface-variant); font-size: 11px; font-weight: 650; letter-spacing: .01em; }.balance-card .section-label { color: color-mix(in srgb, var(--color-on-primary) 75%, transparent); }.balance-number { font-size: 42px; font-weight: 760; letter-spacing: -.06em; line-height: .98; }.balance-number span { color: color-mix(in srgb, var(--color-on-primary) 70%, transparent); font-size: 16px; font-weight: 500; letter-spacing: -.01em; }.balance-percent { color: white; font-size: 18px; font-weight: 750; text-align: right; }.balance-percent small { display: block; margin-top: 3px; color: color-mix(in srgb, var(--color-on-primary) 70%, transparent); font-size: 10px; font-weight: 500; }.progress-track { height: 8px; margin-top: 21px; overflow: hidden; border-radius: 99px; background: color-mix(in srgb, var(--color-on-primary) 35%, transparent); }.progress-track span { display: block; height: 100%; border-radius: inherit; background: var(--color-lime); }.balance-foot { display: flex; justify-content: space-between; margin-top: 10px; color: color-mix(in srgb, var(--color-on-primary) 75%, transparent); font-size: 11px; }
.quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 12px; }.quick-item { display: flex; align-items: center; gap: 10px; padding: 14px; }.quick-icon { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 8px; color: var(--color-secondary); background: var(--color-surface-container-low); font-size: 15px; }.quick-item small,.quick-item strong { display: block; }.quick-item small { color: var(--color-on-surface-variant); font-size: 10px; }.quick-item strong { margin-top: 4px; color: var(--color-on-surface); font-size: 12px; }
.activity-section,.references-section { margin-top: 12px; padding: 19px 20px; }.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.section-heading h2 { margin: 0; color: var(--color-on-surface); font-size: 17px; letter-spacing: -.02em; }.text-button { border: 0; color: var(--color-secondary); background: transparent; padding: 4px 0; font-size: 11px; font-weight: 700; cursor: pointer; }.timeline { list-style: none; margin: 17px 0 0; padding: 0 16px; }.timeline li { position: relative; display: flex; align-items: flex-start; gap: 11px; padding: 0 0 18px; }.timeline li:last-child { padding-bottom: 0; }.timeline li:not(:last-child)::before { position: absolute; top: 17px; bottom: 0; left: 5px; width: 1px; background: var(--color-outline-variant); content: ''; }.timeline-dot { z-index: 1; width: 11px; height: 11px; margin-top: 3px; border: 3px solid var(--color-secondary-container); border-radius: 50%; background: var(--color-secondary); }.timeline-dot.credit { border-color: var(--color-info-container); background: var(--color-info); }.transaction-copy { flex: 1; }.transaction-copy strong,.transaction-copy small { display: block; }.transaction-copy strong { color: var(--color-on-surface); font-size: 12px; }.transaction-copy small { margin-top: 4px; color: var(--color-on-surface-variant); font-size: 10px; }.timeline time { color: var(--color-on-surface-variant); font-size: 10px; white-space: nowrap; }
.reference-list { margin-top: 15px; }.reference-list button { display: flex; align-items: center; width: 100%; gap: 10px; border: 0; border-top: 1px solid var(--color-outline-variant); background: transparent; padding: 13px 0; text-align: left; cursor: pointer; }.reference-list button:first-child { border-top: 0; }.doc-icon { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 8px; color: var(--color-info); background: var(--color-info-container); }.reference-list strong,.reference-list small { display: block; }.reference-list strong { color: var(--color-on-surface); font: 700 11px ui-monospace, monospace; }.reference-list small { margin-top: 3px; color: var(--color-on-surface-variant); font-size: 10px; }.reference-arrow { margin-left: auto; color: var(--color-on-surface-variant); font-size: 23px; }.page-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 16px; }.page-actions button { min-height: 45px; border-radius: 11px; font-size: 12px; font-weight: 700; cursor: pointer; }.secondary-action { border: 1px solid var(--color-outline-variant); color: var(--color-on-surface-variant); background: white; }.primary-action { border: 1px solid var(--color-primary); color: white; background: var(--color-primary); }.primary-action span { margin-left: 6px; }.toast { position: fixed; left: 50%; bottom: 22px; z-index: 10; transform: translateX(-50%); margin: 0; border-radius: 99px; color: white; background: var(--color-on-surface); box-shadow: 0 5px 15px color-mix(in srgb, black 18%, transparent); padding: 10px 15px; font-size: 11px; }
@media (min-width: 760px) { .customer-card { padding: 24px; }.quick-grid { grid-template-columns: repeat(4, 1fr); }.quick-item { padding: 13px; } }
@media (max-width: 420px) { .page-bar,.customer-card,.balance-card,.quick-grid,.references-section,.page-actions { margin-right: 12px; margin-left: 12px; }.customer-card,.balance-card,.activity-section,.references-section { padding: 16px; }.customer-head h1 { font-size: 18px; }.status { padding-right: 7px; padding-left: 7px; font-size: 10px; }.balance-number { font-size: 38px; }.quick-item { padding: 11px 10px; }.quick-item strong { font-size: 11px; }.timeline time { font-size: 9px; }.page-actions { grid-template-columns: 1fr; }}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; } }
.package-page :deep(.material-symbols-outlined) { font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal; font-size: 20px; line-height: 1; letter-spacing: normal; text-transform: none; display: inline-block; white-space: nowrap; direction: ltr; -webkit-font-feature-settings: 'liga'; -webkit-font-smoothing: antialiased; font-feature-settings: 'liga'; }
.package-page .doc-icon { font-size: 0; }
.package-page .doc-icon::before { content: 'description'; font: 18px/1 'Material Symbols Rounded'; }
.package-page .reference-arrow { font-size: 0; }
.package-page .reference-arrow::before { content: 'chevron_right'; font: 22px/1 'Material Symbols Rounded'; }
.package-page .primary-action span { font-size: 0; }
.package-page .primary-action span::before { content: 'arrow_forward'; font: 16px/1 'Material Symbols Rounded'; }
.package-page .doc-icon::before { font-family: 'Material Symbols Outlined'; }
.package-page .reference-arrow::before { font-family: 'Material Symbols Outlined'; }
.package-page .primary-action span::before { font-family: 'Material Symbols Outlined'; }
</style>
