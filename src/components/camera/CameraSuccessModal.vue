<script setup>
defineProps({
  title: {
    type: String,
    default: 'ส่งรูปภาพสำเร็จ',
  },
  message: {
    type: String,
    default: 'ระบบได้รับรูปภาพแล้ว',
  },
  actionLabel: {
    type: String,
    default: 'ปิด',
  },
})

defineEmits(['close'])
</script>

<template>
  <section class="flex h-full flex-col items-center justify-center bg-surface px-6 text-center text-on-surface">
    <div class="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-on-primary">
      <span class="material-symbols-outlined text-[36px]">check</span>
    </div>
    <h1 class="mt-7 font-headline text-2xl font-bold tracking-tight">
      {{ title }}
    </h1>
    <p class="mt-3 max-w-[18rem] text-sm leading-6 text-on-surface-variant">
      {{ message }}
    </p>
    <button
      class="mt-8 h-14 rounded-full bg-primary px-7 text-base font-semibold text-on-primary active:scale-[0.98]"
      @click="$emit('close')"
    >
      {{ actionLabel }}
    </button>
  </section>
</template>
