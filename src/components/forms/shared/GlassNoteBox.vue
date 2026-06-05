<script setup>
defineProps({
  id: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: 'Notes',
  },
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  rows: {
    type: [Number, String],
    default: 2,
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="rounded-2xl border border-white/25 bg-white/15 p-3 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
    <label class="block text-xs font-semibold text-white/80" :for="id">
      {{ label }}
    </label>
    <div class="mt-2 h-px bg-white/25" aria-hidden="true"></div>
    <textarea
      :id="id"
      :value="modelValue"
      :rows="rows"
      class="glass-notes-scroll mt-2 w-full resize-none border-0 bg-transparent px-0 py-1 text-sm text-white outline-none placeholder:text-white/45"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
    ></textarea>
  </div>
</template>

<style scoped>
.glass-notes-scroll {
  scrollbar-color: rgb(255 255 255 / 0.32) transparent;
  scrollbar-width: thin;
}

.glass-notes-scroll::-webkit-scrollbar {
  width: 6px;
}

.glass-notes-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.glass-notes-scroll::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 9999px;
  background-clip: content-box;
  background-color: rgb(255 255 255 / 0.34);
}

.glass-notes-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgb(255 255 255 / 0.5);
}
</style>
