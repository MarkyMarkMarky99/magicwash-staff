<script setup lang="ts">
// Sits inside the square photo preview (position: relative). The tag arrives filled in; staff may type over it.
defineProps<{ modelValue: string | null; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [tagCode: string] }>()
</script>

<template>
  <label class="wq-tag" :class="{ need: !modelValue }">
    <span class="wq-tag__cap">Tag</span>
    <input
      class="wq-tag__input"
      :value="modelValue ?? ''"
      :disabled="disabled"
      maxlength="4"
      autocapitalize="characters"
      autocomplete="off"
      spellcheck="false"
      placeholder="?"
      aria-label="Tag"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </label>
</template>

<style scoped>
/* Same sticker family as the weight field's kg badge. */
.wq-tag {
  position: absolute;
  z-index: 3;
  left: 12px;
  top: 12px;
  height: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  background: #fff;
  color: var(--color-primary);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(-4deg);
}

.wq-tag:focus-within {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.wq-tag__cap {
  position: absolute;
  top: 6px;
  font: 800 9px/1 var(--font-body);
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

.wq-tag__input {
  width: 4.2ch;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: 800 30px/1 var(--font-headline);
  text-align: center;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
  outline: none;
}

.wq-tag.need .wq-tag__input::placeholder {
  color: var(--color-warning);
  opacity: 1;
}
</style>
