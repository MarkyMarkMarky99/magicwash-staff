<script setup lang="ts">
withDefaults(defineProps<{
  customerName: string | null
  customerSub: string | null
  loading: boolean
  problem: string | null
  invalid?: boolean
  tabLabel?: string
}>(), { invalid: false, tabLabel: 'Customer' })
</script>

<template>
  <div class="cust" :class="{ 'cust--bad': invalid }">
    <span class="cust__tab">{{ tabLabel }}</span>
    <div class="flex min-w-0 flex-1 flex-col self-stretch">
      <div class="flex items-start gap-1">
        <div class="min-w-0 flex-1">
          <template v-if="customerName">
            <p class="text-sm font-extrabold leading-tight text-primary">{{ customerName }}</p>
            <p v-if="customerSub" class="mt-px text-[11px] text-on-surface-variant">{{ customerSub }}</p>
          </template>
          <template v-else-if="loading">
            <div class="h-4 w-40 animate-pulse rounded bg-surface-container" />
            <div class="mt-1.5 h-3 w-24 animate-pulse rounded bg-surface-container" />
          </template>
          <p v-else class="text-sm font-extrabold leading-tight text-error" role="alert">{{ problem }}</p>
        </div>
        <slot name="name-aside" />
      </div>
      <slot />
    </div>
    <slot name="aside" />
  </div>
</template>

<style scoped>
.cust {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin-top: 22px;
  padding: 15px 10px 10px 12px;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  background: white;
  color: var(--color-on-surface);
  box-shadow: 4px 4px 0 color-mix(in srgb, black 35%, transparent);
}

.cust:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.cust__tab {
  position: absolute;
  top: -11px;
  left: 10px;
  z-index: 2;
  padding: 3px 9px 4px;
  border-radius: 6px 8px 6px 7px;
  background: var(--color-lime);
  color: var(--color-primary);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
  transform: rotate(-3deg);
  pointer-events: none;
}
</style>
