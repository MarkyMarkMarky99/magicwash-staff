<script setup lang="ts">
import { computed } from 'vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'
import brandLogo from '@/assets/logo.png'
import { useSoftKeyboard } from '@/shared/layouts/use-soft-keyboard'

const props = defineProps({
    open: {
      type: Boolean,
      required: true,
    },
    title: {
      type: String,
      required: true,
      validator: (value: string) => value.trim().length > 0,
    },
    ariaLabel: {
      type: String,
      default: undefined,
      validator: (value: string | undefined) => value === undefined || value.trim().length > 0,
    },
    eyebrow: {
      type: String,
      default: undefined,
      validator: (value: string | undefined) => value === undefined || value.trim().length > 0,
    },
    helperText: {
      type: String,
      default: undefined,
      validator: (value: string | undefined) => value === undefined || value.trim().length > 0,
    },
    submitLabel: {
      type: String,
      default: 'บันทึก',
      validator: (value: string) => value.trim().length > 0,
    },
    isSubmitting: {
      type: Boolean,
      default: false,
    },
    submittingLabel: {
      type: String,
      default: 'กำลังบันทึก...',
    },
    isSubmitDisabled: {
      type: Boolean,
      default: false,
    },
    closeOnBackdrop: {
      type: Boolean,
      default: true,
    },
})

const emit = defineEmits<{
  close: []
  submit: []
}>()

const softKeyboardOpen = useSoftKeyboard()
const accessibleOverlayLabel = computed(() => props.ariaLabel ?? props.title)
const submitDisabled = computed(() => props.isSubmitting || props.isSubmitDisabled)

function handleSubmit() {
  if (submitDisabled.value) return

  emit('submit')
}
</script>

<template>
  <BaseOverlayFrame
    :open="open"
    placement="bottom"
    size="full"
    backdrop="translucent"
    :draggable="false"
    close-button
    close-button-tone="onDark"
    close-button-class="text-white"
    :ariaLabel="accessibleOverlayLabel"
    :close-on-backdrop="closeOnBackdrop"
    :panel-class="softKeyboardOpen ? 'form-overlay-panel form-overlay-panel--compact' : 'form-overlay-panel'"
    @close="emit('close')"
  >
    <form class="form-overlay" @submit.prevent="handleSubmit">
      <header class="form-overlay__header" :class="{ 'form-overlay__header--compact': softKeyboardOpen }">
        <div class="form-overlay__brand-row">
          <div class="form-overlay__brand-mark">
            <img :src="brandLogo" alt="Magicwash Laundry" />
          </div>
        </div>
        <p v-if="eyebrow" class="form-overlay__eyebrow">{{ eyebrow }}</p>
        <h1 class="form-overlay__title">{{ title }}</h1>
        <p v-if="helperText" class="form-overlay__helper"><b aria-hidden="true">•</b>{{ helperText }}</p>
      </header>

      <ScrollRegion class="form-overlay__body">
        <slot />
      </ScrollRegion>

      <footer class="form-overlay__footer">
        <button
          class="form-overlay__submit"
          type="submit"
          :disabled="submitDisabled"
          :aria-busy="isSubmitting"
        >
          {{ isSubmitting ? submittingLabel : submitLabel }}
        </button>
        <p class="sr-only" role="status" aria-live="polite">
          {{ isSubmitting ? submittingLabel : '' }}
        </p>
      </footer>
    </form>
  </BaseOverlayFrame>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

.form-overlay {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  color: var(--color-on-surface);
  background: var(--color-surface);
}

.form-overlay__header {
  position: relative;
  height: calc(166px + env(safe-area-inset-top));
  transition: height 150ms ease;
  flex: 0 0 auto;
  padding: calc(20px + env(safe-area-inset-top)) 20px 19px;
  color: white;
  background: var(--color-primary);
  overflow: hidden;
}

.form-overlay__header::before {
  position: absolute;
  top: -112px;
  right: -138px;
  width: 270px;
  height: 270px;
  border: 34px solid color-mix(in srgb, var(--color-lime) 17%, transparent);
  border-radius: 50%;
  content: '';
}

.form-overlay__header::after {
  position: absolute;
  right: 38px;
  bottom: -21px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--color-lime);
  box-shadow: -22px -11px 0 color-mix(in srgb, var(--color-lime) 22%, transparent);
  content: '';
}

.form-overlay__header--compact {
  display: flex;
  height: calc(56px + env(safe-area-inset-top));
  align-items: center;
  padding-top: calc(8px + env(safe-area-inset-top));
  padding-bottom: 8px;
}

.form-overlay__header--compact::before,
.form-overlay__header--compact::after,
.form-overlay__header--compact .form-overlay__brand-row,
.form-overlay__header--compact .form-overlay__eyebrow,
.form-overlay__header--compact .form-overlay__helper {
  display: none;
}

.form-overlay__header--compact .form-overlay__title {
  font-size: 17px;
  line-height: 1.2;
}

.form-overlay__brand-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-overlay__brand-mark {
  display: flex;
  width: 86px;
  height: 43px;
  align-items: center;
  overflow: hidden;
}

.form-overlay__brand-mark img {
  width: 59px;
  height: 42px;
  object-fit: cover;
  object-position: center;
  transform: scale(1.48);
  transform-origin: left center;
}

.form-overlay__eyebrow {
  position: relative;
  z-index: 1;
  margin: 18px 0 2px;
  color: var(--color-secondary-container);
  font-family: Manrope, sans-serif;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.form-overlay__title {
  position: relative;
  z-index: 1;
  margin: 0;
  font-family: Manrope, "Noto Sans Thai", sans-serif;
  font-size: 25px;
  font-weight: 800;
  line-height: 1.22;
  letter-spacing: -0.035em;
}

.form-overlay__helper {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 6px 0 0;
  max-width: 315px;
  color: var(--color-secondary-container);
  font-size: 12px;
  line-height: 1.4;
}

.form-overlay__helper b {
  color: var(--color-secondary-container);
  font-size: 14px;
  line-height: 1.15;
}

.form-overlay__body {
  padding: 21px 20px 0;
}

.form-overlay__footer {
  z-index: 1;
  flex: 0 0 auto;
  padding: 12px 20px 15px;
  border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  box-shadow: 0 -5px 18px color-mix(in srgb, var(--color-primary) 7%, transparent);
  backdrop-filter: blur(10px);
}

.form-overlay__submit {
  width: 100%;
  height: 49px;
  color: var(--color-on-surface);
  border: 1px solid var(--color-lime);
  border-radius: 10px;
  background: var(--color-lime);
  box-shadow: 0 4px 0 var(--color-on-secondary-container);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.form-overlay__submit:disabled {
  cursor: not-allowed;
  opacity: 0.58;
  box-shadow: none;
}

.form-overlay__submit:focus-visible {
  outline: 3px solid var(--color-lime);
  outline-offset: 2px;
}

:global(#overlay-root > div:has(> .form-overlay-panel) > [data-overlay-backdrop]) {
  background: linear-gradient(145deg, var(--color-surface-variant) 0, var(--color-surface) 58%, var(--color-secondary-container) 100%);
}

:global(.form-overlay-panel) {
  color: var(--color-on-surface);
  background: var(--color-surface);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 5%, transparent), 0 12px 44px color-mix(in srgb, var(--color-primary) 16%, transparent);
}

:global(.form-overlay-panel.form-overlay-panel--compact) {
  --form-overlay-close-top: calc(11px + env(safe-area-inset-top));
}

:global(.form-overlay-panel > button[aria-label="Close"]) {
  top: var(--form-overlay-close-top, 20px);
  right: 20px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 350px) {
  .form-overlay__header {
    padding-left: 16px;
    padding-right: 16px;
  }

  .form-overlay__body,
  .form-overlay__footer {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>
