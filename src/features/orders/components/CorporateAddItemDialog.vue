<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CloseButton from '@/shared/components/CloseButton.vue'
import FormInput from '@/shared/components/FormInput.vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import CountStepper from '@/features/orders/components/CountStepper.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [], add: [name: string, counted: number | null] }>()

const name = ref('')
const counted = ref<number | null>(null)
const canAdd = computed(() => name.value.trim().length > 0)

watch(() => props.open, (open) => {
  if (!open) return
  name.value = ''
  counted.value = null
})

function submit(): void {
  if (!canAdd.value) return
  emit('add', name.value.trim(), counted.value)
}
</script>

<template>
  <ConfirmOverlay
    :open="open"
    title="Add item"
    description="For something this round that is not on the customer's list."
    cancel-label="Cancel"
    confirm-label="Add item"
    :confirm-disabled="!canAdd"
    @close="emit('close')"
    @confirm="submit"
  >
    <template #header-action>
      <CloseButton class="absolute right-4 top-3 text-on-surface-variant" @click="emit('close')" />
    </template>
    <div class="space-y-4 pb-2">
      <FormInput id="corporate-add-item-name" v-model="name" label="Item name *" placeholder="e.g. Curtain" autocomplete="off" autofocus />
      <div class="relative flex items-center justify-center rounded-[11px_15px_12px_14px] border-2 border-primary bg-white p-3.5 shadow-[4px_4px_0_color-mix(in_srgb,var(--color-primary)_70%,black)]">
        <span class="absolute -top-3 left-2.5 -rotate-3 rounded-[6px_8px_6px_7px] bg-primary px-[9px] pb-1 pt-[3px] font-label text-[11px] font-bold leading-[1.1] text-on-primary">Counted</span>
        <CountStepper v-model="counted" label="new item" size="large" />
      </div>
    </div>
  </ConfirmOverlay>
</template>
