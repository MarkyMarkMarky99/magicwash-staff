<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FormLabel from './FormLabel.vue'
import ScrollRegion from './ScrollRegion.vue'

const props = defineProps({
  id:                { type: String, required: true },
  label:             { type: String, required: true },
  modelValue:        { type: String, default: '' },
  options:           { type: Array, required: true },
  placeholder:       { type: String, default: '' },
  searchPlaceholder: { type: String, default: '' },
  searchable:        { type: Boolean, default: true },
  loading:           { type: Boolean, default: false },
  error:             { type: String, default: '' },
  emptyText:         { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const search = ref('')
const activeIndex = ref(-1)
const pickerRoot = ref(null)
const trigger = ref(null)
const searchInput = ref(null)
const optionElements = ref([])

const selectedOption = computed(() => {
  if (props.modelValue === '') {
    return undefined
  }

  return props.options.find(option => option.value === props.modelValue)
})
const filteredOptions = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()

  if (!query) {
    return props.options
  }

  return props.options.filter((option) => {
    const optionLabel = String(option.label || '').toLocaleLowerCase()
    const optionDescription = String(option.description || '').toLocaleLowerCase()

    return optionLabel.includes(query) || optionDescription.includes(query)
  })
})

function firstEnabledIndex() {
  return filteredOptions.value.findIndex(option => !option.disabled)
}

function lastEnabledIndex() {
  for (let index = filteredOptions.value.length - 1; index >= 0; index -= 1) {
    if (!filteredOptions.value[index].disabled) {
      return index
    }
  }

  return -1
}

function openPicker() {
  isOpen.value = true
  activeIndex.value = firstEnabledIndex()

  if (props.searchable) {
    nextTick(() => searchInput.value?.focus())
  } else {
    focusOption(activeIndex.value)
  }
}

function closePicker() {
  isOpen.value = false
  search.value = ''
  activeIndex.value = -1
}

function handleDocumentPointerdown(event) {
  if (isOpen.value && !pickerRoot.value?.contains(event.target)) {
    closePicker()
  }
}

function handleFocusout(event) {
  if (isOpen.value && !pickerRoot.value?.contains(event.relatedTarget)) {
    closePicker()
  }
}

function closeAndFocusTrigger() {
  closePicker()
  nextTick(() => trigger.value?.focus())
}

function selectOption(option) {
  if (option.disabled) {
    return
  }

  emit('update:modelValue', option.value)
  closePicker()
  nextTick(() => trigger.value?.focus())
}

function focusOption(index) {
  activeIndex.value = index
  nextTick(() => optionElements.value[index]?.focus())
}

function moveActiveOption(direction) {
  const options = filteredOptions.value

  if (!options.length) {
    return
  }

  let index = activeIndex.value

  for (let count = 0; count < options.length; count += 1) {
    index = (index + direction + options.length) % options.length

    if (!options[index].disabled) {
      focusOption(index)
      return
    }
  }
}

function handleTriggerKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openPicker()
  }
}

function handleSearchKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeAndFocusTrigger()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActiveOption(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActiveOption(-1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    focusOption(firstEnabledIndex())
  } else if (event.key === 'End') {
    event.preventDefault()
    focusOption(lastEnabledIndex())
  }
}

function handleOptionKeydown(event, option, index) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeAndFocusTrigger()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActiveOption(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActiveOption(-1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    focusOption(firstEnabledIndex())
  } else if (event.key === 'End') {
    event.preventDefault()
    focusOption(lastEnabledIndex())
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectOption(option)
  } else {
    activeIndex.value = index
  }
}

watch(filteredOptions, () => {
  activeIndex.value = firstEnabledIndex()
})

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerdown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerdown, true))
</script>

<template>
  <section ref="pickerRoot" @focusout="handleFocusout">
    <FormLabel :input-id="id">
      {{ label }}
    </FormLabel>

    <div class="picker">
      <button
        :id="id"
        ref="trigger"
        type="button"
        class="picker__trigger"
        :class="{ 'picker__trigger--placeholder': !selectedOption }"
        :aria-expanded="isOpen"
        aria-haspopup="listbox"
        @click="isOpen ? closePicker() : openPicker()"
        @keydown="handleTriggerKeydown"
      >
        <span class="picker__trigger-label">{{ selectedOption?.label || placeholder }}</span>
        <span class="material-symbols-outlined picker__icon" aria-hidden="true">expand_more</span>
      </button>

      <div v-if="isOpen" class="picker__dropdown">
        <input
          v-if="searchable"
          ref="searchInput"
          :value="search" @input="search = $event.target.value"
          type="search"
          class="picker__search"
          :placeholder="searchPlaceholder"
          @keydown="handleSearchKeydown"
        >

        <p v-if="error" class="picker__message picker__message--error" role="alert">
          {{ error }}
        </p>
        <p v-else-if="loading" class="picker__message">
          Loading...
        </p>
        <p v-else-if="!filteredOptions.length" class="picker__message">
          {{ emptyText }}
        </p>
        <ScrollRegion v-else sizing="auto" class="picker__options" role="listbox" :aria-labelledby="id">
          <button
            v-for="(option, index) in filteredOptions"
            :key="option.value"
            :ref="element => optionElements[index] = element"
            type="button"
            class="picker__option"
            :class="[
              option.disabled
                ? 'picker__option--disabled'
                : option.value === modelValue
                  ? 'picker__option--selected'
                  : 'picker__option--unselected',
            ]"
            :disabled="option.disabled"
            :tabindex="index === activeIndex ? 0 : -1"
            role="option"
            :aria-selected="option.value === modelValue"
            @click="selectOption(option)"
            @keydown="handleOptionKeydown($event, option, index)"
          >
            <slot name="option" :option="option">
              <span class="picker__option-text">
                <span class="picker__option-label">{{ option.label }}</span>
                <span v-if="option.description" class="picker__option-description">{{ option.description }}</span>
              </span>
            </slot>
            <span v-if="option.value === modelValue" class="material-symbols-outlined picker__option-check" aria-hidden="true">check</span>
          </button>
        </ScrollRegion>
      </div>
    </div>
  </section>
</template>

<style scoped>
.picker {
  position: relative;
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
}

.picker__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 47px;
  padding: 0 12px;
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: 10px;
  outline: 0;
  background: white;
  box-shadow: 0 1px 0 color-mix(in srgb, var(--color-primary) 2%, transparent);
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  transition: border-color 150ms, box-shadow 150ms;
}

.picker__search {
  display: block;
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  color: var(--color-on-surface);
  border: 0;
  border-bottom: 1px solid var(--color-surface-variant);
  border-radius: 0;
  outline: 0;
  background: white;
  font-family: inherit;
  font-size: 14px;
  transition: border-color 150ms;
}

.picker__trigger--placeholder,
.picker__search::placeholder {
  color: var(--color-on-surface-variant);
}

.picker__trigger:focus {
  border-color: var(--color-lime);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-lime) 14%, transparent);
}

.picker__search:focus {
  border-bottom-color: var(--color-lime);
}

.picker__icon {
  flex: 0 0 auto;
  color: var(--color-on-surface-variant);
  font-size: 20px;
}

.picker__dropdown {
  position: absolute;
  z-index: 10;
  overflow: hidden;
  width: 100%;
  margin-top: 6px;
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  background: white;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.picker__options {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  max-height: 288px;
  padding: 4px;
}

.picker__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 9px 10px;
  color: var(--color-on-surface);
  border: 0;
  border-radius: 8px;
  outline: 0;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.3;
  text-align: left;
  transition: background-color 120ms, color 120ms;
}

.picker__option--unselected:hover:not(:disabled) {
  background: var(--color-surface-container-low);
}

.picker__option--selected {
  color: var(--color-primary);
  background: var(--color-surface-container);
  font-weight: 600;
}

.picker__option:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-lime);
}

.picker__option-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.picker__option-check {
  flex: 0 0 auto;
  color: var(--color-secondary);
  font-size: 18px;
}

.picker__option--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.picker__option-label,
.picker__option-description {
  min-width: 0;
  /* Addresses and phone strings have few break opportunities. */
  overflow-wrap: anywhere;
}

.picker__option-description {
  margin-top: 2px;
  color: var(--color-on-surface-variant);
  font-size: 12px;
  font-weight: 400;
}

.picker__message {
  margin: 0;
  padding: 12px;
  color: var(--color-on-surface-variant);
  font-size: 14px;
}

.picker__message--error {
  color: var(--color-error);
}
</style>
