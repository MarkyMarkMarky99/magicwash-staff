<script setup lang="ts">
import { computed, ref } from 'vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { formatSheetDate, formatSheetDateTime } from '@/shared/utils/sheet-date'
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
              <span class="shrink-0 rounded-full bg-secondary-container px-2 py-1 font-label text-[9px] font-bold uppercase tracking-wide text-on-secondary-container">{{ sourcePackage.status }}</span>
            </div>
            <p class="mt-1 text-xs text-on-surface-variant">{{ sourcePackage.customerId }} · {{ sourcePackage.customerPhone || 'No phone on file' }}</p>
            <p v-if="sourcePackage.customerAddress" class="mt-1 text-xs text-on-surface-variant"><span class="material-symbols-outlined mr-1 align-middle text-[14px]" aria-hidden="true">location_on</span>{{ sourcePackage.customerAddress }}</p>
          </div>
          <a v-if="sourcePackage.customerPhone" :href="`tel:${sourcePackage.customerPhone}`" class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary shadow-sm transition hover:opacity-90"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">call</span><span class="hidden sm:inline">Call customer</span></a>
        </div>
      </div>
    </div>

    <section class="mx-4 rounded-2xl bg-primary p-4 text-on-primary shadow-md">
      <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
        <p class="min-w-0 truncate font-label text-[10px] font-bold uppercase tracking-[0.18em] text-on-primary/70">Package detail</p>
        <p class="shrink-0 text-right font-label text-[10px] font-bold uppercase tracking-[0.18em] text-on-primary/70">Credits remaining</p>
        <h3 class="mt-1 min-w-0 truncate self-center font-headline text-xl font-extrabold leading-tight tracking-tight">{{ sourcePackage.packageName }}</h3>
        <p class="mt-1 shrink-0 self-center text-right font-headline text-4xl font-extrabold leading-none text-secondary-container">{{ sourcePackage.remainingCredit }}</p>
        <p class="mt-1 min-w-0 truncate font-body text-xs capitalize leading-tight text-on-primary/75">{{ sourcePackage.packageCode }} · {{ sourcePackage.packageEligibleService }}</p>
        <p class="mt-1 shrink-0 text-right font-body text-xs leading-tight text-on-primary/75">of {{ sourcePackage.totalCredit }} included</p>
      </div>
      <div class="mt-5 grid grid-cols-2 gap-3 border-t border-on-primary/20 pt-3"><div><p class="font-label text-[9px] uppercase tracking-wide text-on-primary/65">Valid until</p><p class="mt-0.5 font-headline text-[12px] font-bold">{{ formatSheetDate(sourcePackage.expiryDate ?? '') }}</p></div><div><p class="font-label text-[9px] uppercase tracking-wide text-on-primary/65">Pickup window</p><p class="mt-0.5 truncate font-headline text-[12px] font-bold">{{ sourcePackage.serviceDay || 'Flexible' }} · {{ sourcePackage.timeSlot || 'By appointment' }}</p></div></div>
    </section>

    <ListContainer class="mt-3" title="Recent activity" icon="history" :count="sourcePackage.transactions.length" count-label="events" top-divider>
      <template #actions><button class="text-button" type="button" @click="showAllTransactions = !showAllTransactions">{{ showAllTransactions ? 'Show less' : 'View all' }}</button></template>
        <ol class="timeline px-4"><li v-for="transaction in visibleTransactions" :key="transaction.id"><span class="timeline-dot" :class="{ credit: transaction.creditChange > 0 }" /><div class="transaction-copy"><strong>{{ transaction.type }}</strong><small>{{ transaction.referenceSource }} · {{ transaction.referenceId }}<template v-if="transaction.notes"> · {{ transaction.notes }}</template></small></div><div class="text-right"><time class="block">{{ formatSheetDateTime(transaction.createdAt) }}</time><small v-if="transaction.creditChange !== 0" class="mt-1 block text-[10px] font-semibold" :class="transaction.creditChange > 0 ? 'text-secondary' : 'text-tertiary'">{{ formatCreditChange(transaction.creditChange) }}</small></div></li></ol>
    </ListContainer>

  </main>
</template>

<style scoped>
.package-page { width: 100%; max-width: 720px; margin: 0 auto; padding: 0 0 34px; color: #202124; font-family: Inter, Roboto, ui-sans-serif, system-ui, sans-serif; }
.page-bar { display: flex; align-items: center; gap: 10px; min-height: 64px; }.page-title { flex: 1; display: flex; align-items: baseline; gap: 8px; color: #202124; font-size: 16px; font-weight: 700; }.page-title small { color: #76777b; font-size: 11px; font-weight: 500; }.icon-button { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; color: #3f4145; background: transparent; font-size: 29px; line-height: 1; cursor: pointer; }.icon-button:hover,.icon-button:focus-visible { background: #f0f1f2; outline: none; }.menu-wrap { position: relative; }.action-menu { position: absolute; top: 46px; right: 0; z-index: 4; width: 170px; overflow: hidden; border: 1px solid #e1e2e5; border-radius: 12px; background: #fff; box-shadow: 0 8px 22px rgba(0,0,0,.13); }.action-menu button { width: 100%; border: 0; background: #fff; color: #37383c; padding: 12px 14px; text-align: left; font-size: 12px; cursor: pointer; }.action-menu button:hover { background: #f6f7f7; }
.page-bar,.customer-card,.balance-card,.quick-grid,.references-section,.page-actions { margin-right: 16px; margin-left: 16px; }
.customer-card,.balance-card,.quick-item,.activity-section,.references-section { border: 1px solid #e4e5e7; border-radius: 16px; background: #fff; }.customer-card { padding: 20px; }.customer-head { display: flex; align-items: center; gap: 12px; }.avatar { display: grid; place-items: center; flex: none; width: 46px; height: 46px; border-radius: 50%; color: #345f56; background: #dceee9; font-size: 13px; font-weight: 750; }.customer-head h1 { margin: 0; color: #242528; font-size: 20px; letter-spacing: -.02em; }.customer-head p { margin: 4px 0 0; color: #77797d; font-size: 12px; }.status { margin-left: auto; border-radius: 999px; padding: 6px 9px; color: #227153; background: #ddf3e9; font-size: 11px; font-weight: 700; }.status.expiring-soon { color: #8a651f; background: #fff0cb; }.status.paused { color: #5b6877; background: #e9edf2; }.package-type { display: flex; align-items: center; gap: 10px; margin-top: 20px; border-top: 1px solid #edf0f1; padding-top: 16px; }.service-icon { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 9px; color: #23725d; background: #e5f5ef; }.package-type strong,.package-type small { display: block; }.package-type strong { color: #3a3c40; font-size: 13px; }.package-type small { margin-top: 3px; color: #818388; font-size: 11px; }
.balance-card { margin-top: 12px; padding: 20px; color: #fff; background: #326b61; border-color: #326b61; }.balance-heading { display: flex; align-items: flex-start; justify-content: space-between; }.section-label { margin: 0 0 7px; color: #7a7c80; font-size: 11px; font-weight: 650; letter-spacing: .01em; }.balance-card .section-label { color: #c2e0d8; }.balance-number { font-size: 42px; font-weight: 760; letter-spacing: -.06em; line-height: .98; }.balance-number span { color: #a9cdc4; font-size: 16px; font-weight: 500; letter-spacing: -.01em; }.balance-percent { color: #fff; font-size: 18px; font-weight: 750; text-align: right; }.balance-percent small { display: block; margin-top: 3px; color: #b4d3cc; font-size: 10px; font-weight: 500; }.progress-track { height: 8px; margin-top: 21px; overflow: hidden; border-radius: 99px; background: #6d9d93; }.progress-track span { display: block; height: 100%; border-radius: inherit; background: #d0f4e5; }.balance-foot { display: flex; justify-content: space-between; margin-top: 10px; color: #c1dcd6; font-size: 11px; }
.quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 12px; }.quick-item { display: flex; align-items: center; gap: 10px; padding: 14px; }.quick-icon { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 8px; color: #3e776c; background: #eef7f4; font-size: 15px; }.quick-item small,.quick-item strong { display: block; }.quick-item small { color: #85868a; font-size: 10px; }.quick-item strong { margin-top: 4px; color: #3b3d40; font-size: 12px; }
.activity-section,.references-section { margin-top: 12px; padding: 19px 20px; }.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.section-heading h2 { margin: 0; color: #292a2e; font-size: 17px; letter-spacing: -.02em; }.text-button { border: 0; color: #3b776d; background: transparent; padding: 4px 0; font-size: 11px; font-weight: 700; cursor: pointer; }.timeline { list-style: none; margin: 17px 0 0; padding: 0 16px; }.timeline li { position: relative; display: flex; align-items: flex-start; gap: 11px; padding: 0 0 18px; }.timeline li:last-child { padding-bottom: 0; }.timeline li:not(:last-child)::before { position: absolute; top: 17px; bottom: 0; left: 5px; width: 1px; background: #e4e8e7; content: ''; }.timeline-dot { z-index: 1; width: 11px; height: 11px; margin-top: 3px; border: 3px solid #d4ece4; border-radius: 50%; background: #3c8d7b; }.timeline-dot.credit { border-color: #d8e6f7; background: #5f8fbd; }.transaction-copy { flex: 1; }.transaction-copy strong,.transaction-copy small { display: block; }.transaction-copy strong { color: #34363a; font-size: 12px; }.transaction-copy small { margin-top: 4px; color: #888b8f; font-size: 10px; }.timeline time { color: #8b8d90; font-size: 10px; white-space: nowrap; }
.reference-list { margin-top: 15px; }.reference-list button { display: flex; align-items: center; width: 100%; gap: 10px; border: 0; border-top: 1px solid #eff0f1; background: transparent; padding: 13px 0; text-align: left; cursor: pointer; }.reference-list button:first-child { border-top: 0; }.doc-icon { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 8px; color: #63728d; background: #eff2f7; }.reference-list strong,.reference-list small { display: block; }.reference-list strong { color: #3b3d40; font: 700 11px ui-monospace, monospace; }.reference-list small { margin-top: 3px; color: #898c90; font-size: 10px; }.reference-arrow { margin-left: auto; color: #8a8c90; font-size: 23px; }.page-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 16px; }.page-actions button { min-height: 45px; border-radius: 11px; font-size: 12px; font-weight: 700; cursor: pointer; }.secondary-action { border: 1px solid #d8dcde; color: #48615d; background: #fff; }.primary-action { border: 1px solid #326b61; color: #fff; background: #326b61; }.primary-action span { margin-left: 6px; }.toast { position: fixed; left: 50%; bottom: 22px; z-index: 10; transform: translateX(-50%); margin: 0; border-radius: 99px; color: #fff; background: #252b2c; box-shadow: 0 5px 15px rgba(0,0,0,.18); padding: 10px 15px; font-size: 11px; }
@media (min-width: 760px) { .customer-card { padding: 24px; }.quick-grid { grid-template-columns: repeat(4, 1fr); }.quick-item { padding: 13px; } }
@media (max-width: 420px) { .page-bar,.customer-card,.balance-card,.quick-grid,.references-section,.page-actions { margin-right: 12px; margin-left: 12px; }.customer-card,.balance-card,.activity-section,.references-section { padding: 16px; }.customer-head h1 { font-size: 18px; }.status { padding-right: 7px; padding-left: 7px; font-size: 10px; }.balance-number { font-size: 38px; }.quick-item { padding: 11px 10px; }.quick-item strong { font-size: 11px; }.timeline time { font-size: 9px; }.page-actions { grid-template-columns: 1fr; }}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; } }
/* Material Symbols keep icons consistent with the host app's icon font. */
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
