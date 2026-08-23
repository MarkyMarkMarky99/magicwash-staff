<script setup lang="ts">
import { computed } from 'vue'
import BaseFullOverlay from '@/shared/layouts/BaseFullOverlay.vue'

const props = withDefaults(
  defineProps({
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
  }),
  {},
)

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
    @close="emit('close')"
  >
    <form class="form-overlay" @submit.prevent="handleSubmit">
      <header class="form-overlay__header">
        <h1 class="form-overlay__title">{{ title }}</h1>
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
.form-overlay {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  color: #073f38;
  background: #f7fbfa;
}

.form-overlay__header {
  display: flex;
  min-height: 72px;
  flex: 0 0 auto;
  align-items: center;
  padding: 16px 72px 16px 20px;
  color: white;
  background: #00564b;
}

.form-overlay__title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.25;
}

.form-overlay__body {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px;
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
    padding-right: 64px;
    padding-left: 16px;
  }

  .form-overlay__body,
  .form-overlay__footer {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>
