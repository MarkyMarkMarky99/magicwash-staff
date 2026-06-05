<script setup>
defineProps({
  tabs: {
    type: Array,
    required: true,
  },
  activeKey: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['select'])
</script>

<template>
  <div class="flex items-center bg-primary w-full overflow-hidden">
    <div class="flex items-center gap-1 px-4 pt-2 pb-0 overflow-x-auto no-scrollbar w-full">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex-none flex items-center gap-1.5 px-3 pb-1.5 pt-1 transition-all focus:outline-none border-b-2"
        :class="tab.key === activeKey ? 'border-white text-on-primary' : 'border-transparent text-on-primary/70'"
        @click="emit('select', tab.key)"
      >
        <span class="font-label text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap">
          {{ tab.label }}
        </span>
        <span
          v-if="tab.count !== undefined"
          class="text-[9px] font-bold bg-white/20 rounded-full px-1.5 py-0.5 leading-none"
        >
          {{ tab.count }}
        </span>
      </button>
    </div>
  </div>
</template>
