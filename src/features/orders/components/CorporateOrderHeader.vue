<script setup lang="ts">
import CloseButton from '@/shared/components/CloseButton.vue'

defineProps<{ customerName: string | null, customerSub: string | null, loading: boolean, problem: string | null }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <header class="hdr">
    <div class="relative z-[1] flex items-start justify-between">
      <div>
        <p class="font-label text-[10px] font-extrabold uppercase tracking-[0.12em] text-secondary-container">New laundry intake</p>
        <h1 class="font-headline text-[23px] font-extrabold leading-[1.2] tracking-[-0.03em]">New order</h1>
      </div>
      <CloseButton tone="onDark" @click="emit('close')" />
    </div>
    <div class="cust">
      <span class="cust__tab">Customer</span>
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
    </div>
  </header>
</template>

<style scoped>
.hdr {
  position: relative;
  flex: none;
  padding: calc(16px + env(safe-area-inset-top)) 16px 36px;
  background: var(--color-primary);
  color: white;
  overflow: hidden;
}

.hdr::before {
  position: absolute;
  top: -100px;
  right: -130px;
  width: 250px;
  height: 250px;
  border: 32px solid color-mix(in srgb, var(--color-lime) 17%, transparent);
  border-radius: 50%;
  content: '';
}

.hdr::after {
  position: absolute;
  right: 30px;
  bottom: -14px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--color-lime);
  box-shadow: -22px -11px 0 color-mix(in srgb, var(--color-lime) 22%, transparent);
  content: '';
}

.cust {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 22px;
  padding: 15px 10px 10px 12px;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  background: white;
  color: var(--color-on-surface);
  box-shadow: 4px 4px 0 color-mix(in srgb, black 35%, transparent);
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
