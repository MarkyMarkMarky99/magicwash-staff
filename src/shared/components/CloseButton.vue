<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  icon?: string
  label?: string
  tone?: 'onDark' | 'onLight'
}>(), {
  icon: 'close',
  label: 'Close',
  tone: 'onLight',
})

// Hand-drawn chunky glyphs (28x28 viewBox, round caps). Icons not listed fall back to Material Symbols.
const GLYPH_PATHS: Record<string, string> = {
  close: 'm8 8 12 12M20 8 8 20',
  menu: 'M5 7h18M5 14h14M5 21h9',
  arrow_back: 'M17.5 6 9.5 14l8 8',
}

const glyph = computed(() => GLYPH_PATHS[props.icon] ?? null)

const buttonRef = ref<HTMLButtonElement | null>(null)

defineExpose({
  focus: (options?: FocusOptions) => buttonRef.value?.focus(options),
})
</script>

<template>
  <button
    ref="buttonRef"
    type="button"
    :class="tone === 'onDark' ? 'sticker-button' : 'flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none hover:bg-black/5 focus:ring-2 focus:ring-lime active:ring-2 active:ring-lime'"
    :aria-label="label"
  >
    <svg v-if="glyph" class="sticker-glyph" viewBox="0 0 28 28" aria-hidden="true">
      <path :d="glyph" />
    </svg>
    <span
      v-else
      class="material-symbols-outlined [font-variation-settings:'FILL'_0,'wght'_600,'GRAD'_0,'opsz'_24]"
      aria-hidden="true"
    >{{ icon }}</span>
    <slot />
  </button>
</template>

<style scoped>
/* onDark: lime outline squircle at rest; solid lime sticker with a hard offset shadow when hovered, focused or pressed. */
@layer components {
  .sticker-button {
    position: relative;
  }
}

.sticker-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  padding: 0;
  border: 2px solid var(--color-lime);
  border-radius: 15px;
  background: transparent;
  color: var(--color-lime);
  transform: rotate(-7deg);
  transition: background-color 130ms ease, color 130ms ease, box-shadow 130ms ease, transform 130ms cubic-bezier(.2, 1.45, .45, 1);
}

.sticker-button:focus {
  outline: none;
}

.sticker-button:hover,
.sticker-button:focus,
.sticker-button:active {
  background: var(--color-lime);
  color: var(--color-primary);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  animation: sticker-pop 230ms cubic-bezier(.2, 1.45, .45, 1) both;
}

.sticker-button:active {
  transform: rotate(-7deg) scale(.92);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  animation: none;
}

@keyframes sticker-pop {
  0% { transform: rotate(-7deg) scale(.85); }
  70% { transform: rotate(-7deg) scale(1.05); }
  100% { transform: rotate(-7deg) scale(1); }
}

.sticker-glyph {
  width: 25px;
  height: 25px;
  overflow: visible;
  transform: rotate(7deg);
}

.sticker-glyph path {
  fill: none;
  stroke: currentColor;
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sticker-button .material-symbols-outlined {
  transform: rotate(7deg);
}

@media (prefers-reduced-motion: reduce) {
  .sticker-button,
  .sticker-button:hover,
  .sticker-button:focus {
    transition: none;
    animation: none;
  }
}
</style>
