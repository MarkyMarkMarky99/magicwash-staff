<script setup lang="ts">
import { computed } from 'vue'
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  ariaLabel?: string
  cancelLabel?: string
  confirmLabel?: string
  confirmDisabled?: boolean
}>(), {
  description: '',
  ariaLabel: '',
  cancelLabel: 'ยกเลิก',
  confirmLabel: 'ยืนยัน',
  confirmDisabled: false,
})

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const accessibleLabel = computed(() => props.ariaLabel || props.title)
</script>

<template>
  <BaseOverlayFrame
    :open="open"
    placement="center"
    size="22rem"
    backdrop="translucent"
    :draggable="false"
    :close-button="false"
    panel-class="confirm-overlay-panel"
    :ariaLabel="accessibleLabel"
    @close="emit('close')"
  >
    <form class="flex min-h-0 flex-col" @submit.prevent="emit('confirm')">
      <header class="flex-none px-5 pb-3 pt-5">
        <h2 class="font-headline text-xl font-bold text-primary">{{ title }}</h2>
        <p v-if="description" class="mt-2 font-body text-sm leading-relaxed text-on-surface-variant">
          {{ description }}
        </p>
      </header>

      <ScrollRegion sizing="auto" class="px-5">
        <slot />
      </ScrollRegion>

      <footer class="flex flex-none justify-end gap-2 px-5 pb-5 pt-4">
        <button
          type="button"
          class="rounded-full border border-outline-variant px-4 py-2 font-body text-sm text-on-surface"
          @click="emit('close')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="submit"
          class="rounded-full bg-primary px-4 py-2 font-body text-sm font-bold text-on-primary disabled:opacity-50"
          :disabled="confirmDisabled"
        >
          {{ confirmLabel }}
        </button>
      </footer>
    </form>
  </BaseOverlayFrame>
</template>
