<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import type { MachineDto } from '@/data/machines/machines.service'
import { machineLabel } from '../machine-label'

const props = defineProps<{ machines: readonly MachineDto[]; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [machineId: string] }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function outside(event: PointerEvent): void {
  if (event.target instanceof Node && root.value?.contains(event.target)) return
  open.value = false
}
function escape(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.stopPropagation(); open.value = false }
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', outside, true)
  else document.removeEventListener('pointerdown', outside, true)
})
onUnmounted(() => document.removeEventListener('pointerdown', outside, true))
function choose(machineId: string): void {
  emit('update:modelValue', machineId)
  open.value = false
}
</script>

<template>
  <div ref="root" class="wq-mmenu" @keydown="escape">
    <button
      type="button"
      class="wq-mmenu__btn"
      :class="{ open, need: modelValue === null }"
      :aria-label="modelValue ? `Washer: ${machineLabel(modelValue, props.machines)}. Change` : 'Choose a washer'"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="material-symbols-outlined" aria-hidden="true">local_laundry_service</span>
    </button>
    <ul v-if="open" class="wq-mmenu__list" role="listbox" aria-label="Washer">
      <li v-if="!machines.length" class="wq-mmenu__empty">No washers available.</li>
      <li v-for="machine in machines" :key="machine.id" role="option" :aria-selected="machine.id === modelValue">
        <button type="button" class="wq-mmenu__item" :class="{ sel: machine.id === modelValue }" @click="choose(machine.id)">
          <span class="material-symbols-outlined fill" aria-hidden="true">local_laundry_service</span>
          <span class="min-w-0 flex-1 truncate">{{ machineLabel(machine.id, machines) }}</span>
          <span v-if="machine.id === modelValue" class="material-symbols-outlined" aria-hidden="true">check</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.wq-mmenu {
  position: relative;
  align-self: center;
  margin-left: 8px;
}

/* Same sticker as the weight field's "kg" badge: white, primary edge and icon, small hard shadow. */
.wq-mmenu__btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-right: 4px;
  border: 2px solid var(--color-primary);
  border-radius: 10px 12px 10px 11px;
  background: #fff;
  color: var(--color-primary);
  box-shadow: 2px 2px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(-7deg);
}

.wq-mmenu__btn .material-symbols-outlined {
  font-size: 24px;
  transform: rotate(7deg);
}

.wq-mmenu__btn.open {
  background: var(--color-primary);
  color: var(--color-lime);
}

.wq-mmenu__btn:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

/* Draws the eye while no washer is chosen: a wiggle and a lime ring every 2.4s. */
.wq-mmenu__btn.need:not(.open) {
  animation: wq-mmenu-nudge 2.4s ease-in-out infinite;
}

.wq-mmenu__btn.need:not(.open)::after {
  content: "";
  position: absolute;
  inset: -6px;
  border: 2.5px solid var(--color-lime);
  border-radius: 13px 15px 13px 14px;
  opacity: 0;
  pointer-events: none;
  animation: wq-mmenu-ring 2.4s ease-out infinite;
}

@keyframes wq-mmenu-nudge {
  0%, 58%, 100% { transform: rotate(-7deg) scale(1); }
  64% { transform: rotate(-15deg) scale(1.1); }
  70% { transform: rotate(2deg) scale(1.1); }
  76% { transform: rotate(-12deg) scale(1.05); }
  84% { transform: rotate(-7deg) scale(1); }
}

@keyframes wq-mmenu-ring {
  0%, 58% { opacity: 0; transform: scale(.9); }
  62% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.45); }
}

.wq-mmenu__list {
  position: absolute;
  z-index: 20;
  right: 0;
  top: calc(100% + 8px);
  display: grid;
  gap: 4px;
  width: 232px;
  margin: 0;
  padding: 6px;
  list-style: none;
  border: 2px solid var(--color-primary);
  border-radius: 14px 11px 15px 12px;
  background: #fff;
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black), 0 14px 28px rgb(0 0 0 / 18%);
}

.wq-mmenu__list li + li {
  padding-top: 4px;
  border-top: 1px dashed var(--color-outline-variant);
}

.wq-mmenu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border-radius: 9px 11px 9px 10px;
  color: var(--color-primary);
  font: 700 14px/1.2 var(--font-headline);
  text-align: left;
}

.wq-mmenu__item .material-symbols-outlined {
  font-size: 18px;
}

.wq-mmenu__item .fill {
  color: var(--color-on-surface-variant);
  font-variation-settings: "FILL" 1;
}

.wq-mmenu__item:hover,
.wq-mmenu__item:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--color-lime) 35%, white);
}

.wq-mmenu__item.sel {
  background: var(--color-lime);
}

.wq-mmenu__item.sel .fill {
  color: var(--color-primary);
}

.wq-mmenu__empty {
  padding: 10px;
  color: var(--color-on-surface-variant);
  font: 600 13px/1.3 var(--font-body);
}

@media (prefers-reduced-motion: reduce) {
  .wq-mmenu__btn.need:not(.open),
  .wq-mmenu__btn.need:not(.open)::after {
    animation: none;
  }
}
</style>
