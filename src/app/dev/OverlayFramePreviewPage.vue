<script setup lang="ts">
import { ref } from 'vue'
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'

defineOptions({ name: 'OverlayFramePreviewPage' })

type Placement = 'bottom' | 'center'
type Backdrop = 'opaque' | 'translucent' | 'none'

const primaryOpen = ref(false)
const secondaryOpen = ref(false)
const placement = ref<Placement>('bottom')
const size = ref('84vh')
const backdrop = ref<Backdrop>('translucent')
const draggable = ref(true)
const closeButton = ref(true)
const leadingControlActivated = ref(false)

function openPrimary() {
  leadingControlActivated.value = false
  primaryOpen.value = true
}

function openNested() {
  secondaryOpen.value = true
}
</script>

<template>
  <main class="flex h-full items-center justify-center bg-surface-container-low p-5 text-on-surface">
    <section class="w-full max-w-sm rounded-2xl border border-outline-variant bg-surface p-5 shadow-xl">
      <p class="mb-1 text-xs font-bold uppercase tracking-widest text-secondary">Development preview</p>
      <h1 class="text-2xl font-bold">Base Overlay Frame</h1>
      <p class="mb-5 mt-2 text-sm text-on-surface-variant">
        Configure every supported frame option, then open a second frame to verify stacking.
      </p>

      <div class="grid grid-cols-2 gap-3">
        <label class="grid gap-1 text-sm font-semibold">
          Placement
          <select v-model="placement" class="rounded-lg border border-outline-variant bg-white p-2">
            <option value="bottom">Bottom</option>
            <option value="center">Center</option>
          </select>
        </label>

        <label class="grid gap-1 text-sm font-semibold">
          Size
          <select v-model="size" class="rounded-lg border border-outline-variant bg-white p-2">
            <option value="84vh">84vh</option>
            <option value="50%">50%</option>
            <option value="full">Full</option>
          </select>
        </label>

        <label class="col-span-2 grid gap-1 text-sm font-semibold">
          Backdrop
          <select v-model="backdrop" class="rounded-lg border border-outline-variant bg-white p-2">
            <option value="opaque">Opaque</option>
            <option value="translucent">Translucent</option>
            <option value="none">None</option>
          </select>
        </label>

        <label class="flex items-center gap-2 text-sm font-semibold">
          <input v-model="draggable" type="checkbox" />
          Draggable
        </label>

        <label class="flex items-center gap-2 text-sm font-semibold">
          <input v-model="closeButton" type="checkbox" />
          Close button
        </label>
      </div>

      <button
        type="button"
        class="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-bold text-on-primary shadow-md"
        @click="openPrimary"
      >
        Open frame
      </button>
    </section>

    <BaseOverlayFrame
      :open="primaryOpen"
      :placement="placement"
      :size="size"
      :backdrop="backdrop"
      :draggable="draggable"
      :close-button="closeButton"
      ariaLabel="Configurable overlay frame preview"
      @close="primaryOpen = false"
    >
      <div class="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6">
        <button
          type="button"
          class="relative z-20 h-11 w-32 self-start rounded-lg border border-primary bg-surface px-3 text-sm font-bold text-primary"
          :class="{ '-mt-11': draggable && placement === 'bottom' }"
          @click="leadingControlActivated = true"
        >
          Edge control
        </button>
        <p v-if="leadingControlActivated" role="status" class="mt-4 text-sm font-semibold text-secondary">
          Edge control activated
        </p>
        <h2 class="text-xl font-bold">Primary frame</h2>
        <label class="grid gap-1 text-sm font-semibold">
          Autofocused search
          <input
            autofocus
            type="search"
            class="rounded-lg border border-outline-variant bg-white p-3"
            placeholder="Open the keyboard"
          />
        </label>
        <div class="w-[150%] rounded-lg bg-surface-container-high p-3 text-sm">
          Over-wide child clipped by the frame
        </div>
        <div class="mt-auto grid gap-3">
          <button
            type="button"
            class="rounded-xl border border-primary px-4 py-3 font-bold text-primary"
            @click="openNested"
          >
            Open second frame
          </button>
          <button
            type="button"
            class="rounded-xl bg-primary px-4 py-3 font-bold text-on-primary"
            @click="primaryOpen = false"
          >
            Bottom-anchored action
          </button>
        </div>
      </div>
    </BaseOverlayFrame>

    <BaseOverlayFrame
      :open="secondaryOpen"
      placement="center"
      size="20rem"
      backdrop="opaque"
      :draggable="false"
      :close-button="true"
      ariaLabel="Nested overlay frame preview"
      panel-class="p-6 pt-16"
      @close="secondaryOpen = false"
    >
      <div class="grid gap-4">
        <h2 class="text-xl font-bold">Second frame</h2>
        <p class="text-sm text-on-surface-variant">
          Close this frame and confirm the primary frame remains open and the page remains locked.
        </p>
        <button
          type="button"
          class="rounded-xl bg-primary px-4 py-3 font-bold text-on-primary"
          @click="secondaryOpen = false"
        >
          Close second frame
        </button>
      </div>
    </BaseOverlayFrame>
  </main>
</template>
