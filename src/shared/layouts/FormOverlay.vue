<script setup lang="ts">
import { computed } from 'vue'
import BaseFullOverlay from '@/shared/layouts/BaseFullOverlay.vue'
import brandLogo from '@/assets/logo.png'

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

const accessibleOverlayLabel = computed(() => props.ariaLabel ?? props.title)
const submitDisabled = computed(() => props.isSubmitting || props.isSubmitDisabled)

function handleSubmit() {
  if (submitDisabled.value) return

  emit('submit')
}
</script>

<template>
  <BaseFullOverlay
    :open="open"
    :aria-label="accessibleOverlayLabel"
    :close-on-backdrop="closeOnBackdrop"
    dialog-class="form-overlay-dialog"
    panel-class="form-overlay-panel"
    close-button-class="form-overlay-close"
    @close="emit('close')"
  >
    <template #close-button>
      <span class="form-overlay-close__glyph" aria-hidden="true">×</span>
    </template>

    <form class="form-overlay" @submit.prevent="handleSubmit">
      <header class="form-overlay__header">
        <div class="form-overlay__brand-row">
          <div class="form-overlay__brand-mark">
            <img :src="brandLogo" alt="Magicwash Laundry" />
          </div>
        </div>
        <p v-if="eyebrow" class="form-overlay__eyebrow">{{ eyebrow }}</p>
        <h1 class="form-overlay__title">{{ title }}</h1>
        <p v-if="helperText" class="form-overlay__helper"><b aria-hidden="true">•</b>{{ helperText }}</p>
      </header>

      <div class="form-overlay__body">
        <slot />
      </div>

      <footer class="form-overlay__footer">
        <button
          class="form-overlay__submit"
          type="submit"
          :disabled="submitDisabled"
          :aria-busy="isSubmitting"
        >
          {{ isSubmitting ? 'กำลังบันทึก...' : submitLabel }}
        </button>
        <p class="sr-only" role="status" aria-live="polite">
          {{ isSubmitting ? 'กำลังบันทึกข้อมูล' : '' }}
        </p>
      </footer>
    </form>
  </BaseFullOverlay>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

.form-overlay {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  color: #073f38;
  background: #f7fbfa;
}

.form-overlay__header {
  position: relative;
  height: 166px;
  flex: 0 0 auto;
  padding: 20px 20px 19px;
  color: white;
  background: #00564b;
  overflow: hidden;
}

.form-overlay__header::before {
  position: absolute;
  top: -112px;
  right: -138px;
  width: 270px;
  height: 270px;
  border: 34px solid rgba(157, 245, 223, 0.17);
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
  background: #b2df26;
  box-shadow: -22px -11px 0 rgba(178, 223, 38, 0.22);
  content: '';
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
  color: #9df5df;
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
  color: #d8eeea;
  font-size: 12px;
  line-height: 1.4;
}

.form-overlay__helper b {
  color: #9df5df;
  font-size: 14px;
  line-height: 1.15;
}

.form-overlay__body {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 21px 20px 0;
}

.form-overlay__footer {
  z-index: 1;
  flex: 0 0 auto;
  padding: 12px 20px 15px;
  border-top: 1px solid rgba(170, 202, 196, 0.7);
  background: rgba(247, 251, 250, 0.96);
  box-shadow: 0 -5px 18px rgba(0, 79, 69, 0.07);
  backdrop-filter: blur(10px);
}

.form-overlay__submit {
  width: 100%;
  height: 49px;
  color: #073f38;
  border: 1px solid #b2df26;
  border-radius: 10px;
  background: #b2df26;
  box-shadow: 0 4px 0 #789d0b;
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
  outline: 3px solid #eab308;
  outline-offset: 2px;
}

/* These classes are opt-in hooks passed to BaseFullOverlay, so other overlays retain their defaults. */
:global(.form-overlay-dialog::backdrop) {
  background: linear-gradient(145deg, #dcecea 0, #f6faf9 58%, #dbeee9 100%);
}

:global(.form-overlay-panel) {
  width: min(390px, 100%);
  max-width: 390px;
  color: #073f38;
  background: #f7fbfa;
  box-shadow: 0 0 0 1px rgba(0, 79, 69, 0.05), 0 12px 44px rgba(0, 66, 59, 0.16);
}

:global(.form-overlay-close) {
  top: 20px;
  right: 20px;
  width: 34px;
  height: 34px;
  padding: 0;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  background: transparent;
  transition: none;
}

:global(.form-overlay-close:hover) {
  background: transparent;
}

:global(.form-overlay-close:focus-visible) {
  outline: 3px solid #eab308;
  outline-offset: 2px;
}

:global(.form-overlay-close__glyph) {
  font-size: 23px;
  line-height: 1;
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
