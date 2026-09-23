<script setup lang="ts">
import BaseDropdown from '@/shared/components/BaseDropdown.vue'

const emit = defineEmits<{
  addItem: []
  openAlbum: []
  openLibrary: []
  registerGarments: []
}>()

function select(action: 'addItem' | 'openAlbum' | 'openLibrary' | 'registerGarments', close: () => void): void {
  close()
  if (action === 'addItem') emit('addItem')
  else if (action === 'openAlbum') emit('openAlbum')
  else if (action === 'openLibrary') emit('openLibrary')
  else emit('registerGarments')
}
</script>

<template>
  <BaseDropdown panel-class="w-52 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl">
    <template #trigger="{ open, setTrigger, toggle, triggerAttrs }">
      <button
        :ref="setTrigger"
        v-bind="triggerAttrs"
        type="button"
        class="relative -my-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-primary transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Manage items"
        @click.stop="toggle"
      >
        <span class="material-symbols-outlined text-[18px]" :class="open ? 'rotate-45' : ''" aria-hidden="true">add</span>
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
          Add item
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          @click="select('openAlbum', close)"
        >
          <span class="material-symbols-outlined text-[16px] leading-none text-primary" aria-hidden="true">photo_library</span>
          Garment album
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          @click="select('openLibrary', close)"
        >
          <span class="material-symbols-outlined text-[16px] leading-none text-primary" aria-hidden="true">grid_view</span>
          Photo library
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          @click="select('registerGarments', close)"
        >
          <span class="material-symbols-outlined text-[16px] leading-none text-primary" aria-hidden="true">qr_code_scanner</span>
          Register garments
        </button>
      </div>
    </template>
  </BaseDropdown>
</template>
