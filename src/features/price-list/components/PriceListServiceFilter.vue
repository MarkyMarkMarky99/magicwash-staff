<script setup lang="ts">
import { computed } from 'vue'
import { serviceTypeOptions } from '@/shared/utils/service-type-labels'

const props = defineProps<{
  serviceType: string | null
  open: boolean
  // Disable while loading because ListContainer hides the panel content.
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const activeLabel = computed(
  () => serviceTypeOptions.find((option) => option.value === props.serviceType)?.label ?? null,
)
</script>

<template>
  <button
    type="button"
    class="-my-0.5 inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="props.open || props.serviceType
      ? 'bg-primary/10 text-primary'
      : 'text-primary hover:bg-primary/10 active:bg-primary/20'"
    :aria-disabled="props.disabled"
    :aria-label="props.open ? 'ซ่อนตัวกรองบริการ' : 'กรองตามประเภทบริการ'"
    :aria-expanded="props.open"
    :disabled="props.disabled"
    @click="emit('update:open', !props.open)"
  >
    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">tune</span>
    <span v-if="activeLabel" class="font-label text-[11px] font-bold">{{ activeLabel }}</span>
  </button>
</template>
