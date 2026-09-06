<script setup lang="ts">
import BaseDropdown from '@/shared/components/BaseDropdown.vue'

const emit = defineEmits<{
  addItem: []
  openAlbum: []
}>()

function select(action: 'addItem' | 'openAlbum', close: () => void): void {
  close()
  emit(action)
}
</script>

<template>
  <BaseDropdown panel-class="w-52 overflow-y-auto no-scrollbar rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl">
    <template #trigger="{ open, setTrigger, toggle, triggerAttrs }">
      <button
        :ref="setTrigger"
        v-bind="triggerAttrs"
        type="button"
        class="-my-0.5 inline-flex min-h-10 items-center justify-center rounded-full px-2 text-primary transition-colors hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="จัดการรายการสินค้า"
        @click.stop="toggle"
      >
        <span class="material-symbols-outlined text-[20px]" :class="open ? 'rotate-45' : ''" aria-hidden="true">add</span>
      </button>
    </template>

    <template #default="{ close }">
      <div class="py-1">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          @click="select('addItem', close)"
        >
          <span class="material-symbols-outlined text-[16px] leading-none text-primary" aria-hidden="true">playlist_add</span>
          เพิ่มรายการสินค้า
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          @click="select('openAlbum', close)"
        >
          <span class="material-symbols-outlined text-[16px] leading-none text-primary" aria-hidden="true">photo_library</span>
          อัลบั้มรูปผ้า
        </button>
      </div>
    </template>
  </BaseDropdown>
</template>
