<script setup lang="ts">
import CloseButton from '@/shared/components/CloseButton.vue'

defineProps<{
  eyebrow: string
  title: string
}>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <header class="hdr">
    <div class="relative z-[1] flex items-start justify-between">
      <div>
        <p class="font-label text-[10px] font-extrabold uppercase tracking-[0.12em] text-secondary-container">{{ eyebrow }}</p>
        <h1 class="font-headline text-[23px] font-extrabold leading-[1.2] tracking-[-0.03em]">{{ title }}</h1>
      </div>
      <CloseButton tone="onDark" @click="emit('close')" />
    </div>
    <slot />
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
</style>
