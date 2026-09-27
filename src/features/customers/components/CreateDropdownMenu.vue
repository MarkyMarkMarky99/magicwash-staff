<script setup lang="ts">
import BaseDropdown from '@/shared/components/BaseDropdown.vue'
import DropdownPillTrigger from '@/shared/components/DropdownPillTrigger.vue'

type CreateItem = { key: string; label: string; disabled?: boolean }

withDefaults(defineProps<{
  label?: string
  ariaLabel?: string
  items: CreateItem[]
}>(), { label: 'Create' })

const emit = defineEmits<{ select: [key: string] }>()
</script>

<template>
  <BaseDropdown panel-class="w-64 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl">
    <template #trigger="{ open, setTrigger, toggle, triggerAttrs }">
      <DropdownPillTrigger
        :label="label"
        :aria-label="ariaLabel"
        :open="open"
        :set-trigger="setTrigger"
        :toggle="toggle"
        :trigger-attrs="triggerAttrs"
        @click.stop
      />
    </template>
    <template #default="{ close }">
      <ul>
        <li v-for="item in items" :key="item.key">
          <button
            type="button"
            class="w-full px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="item.disabled"
            @click="close(); emit('select', item.key)"
          >{{ item.label }}</button>
        </li>
      </ul>
    </template>
  </BaseDropdown>
</template>
