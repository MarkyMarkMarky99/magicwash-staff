<script setup lang="ts">
import { ref } from 'vue'
import BaseOverlay from '@/shared/layouts/BaseOverlay.vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const imageType = ref('WEIGHT')
const quantity = ref('20.5')
const notes = ref('')
const imageTypes = [{ value: 'WEIGHT', label: 'น้ำหนัก', icon: 'scale' }, { value: 'BAG', label: 'ถุงผ้า', icon: 'shopping_bag' }, { value: 'DOCUMENT', label: 'เอกสาร', icon: 'description' }, { value: 'FORM', label: 'แบบฟอร์ม', icon: 'assignment' }]
</script>

<template>
  <BaseOverlay :open="open" aria-label="เพิ่มรูปภาพสำหรับออเดอร์" @close="emit('close')"><section class="min-h-full bg-surface px-5 py-7"><header class="mb-7 pr-10"><p class="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Order photo</p><h2 class="font-headline text-2xl font-bold text-primary">เพิ่มรูปภาพ</h2><p class="mt-1 font-body text-sm leading-relaxed text-on-surface-variant">เตรียมหน้าจอสำหรับถ่ายหรือเลือกรูปภาพ ยังไม่มีการอัปโหลดในต้นแบบนี้</p></header><div class="space-y-5"><label class="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-surface-container-low text-center"><span class="material-symbols-outlined text-4xl text-primary" aria-hidden="true">add_a_photo</span><strong class="mt-2 font-body text-sm text-primary">เลือกรูปภาพ</strong><span class="mt-1 font-body text-xs text-on-surface-variant">การเลือกไฟล์จะไม่อัปโหลดหรือส่งข้อมูล</span><input class="sr-only" type="file" accept="image/*"></label><FormOptionGrid v-model="imageType" label="ประเภทรูปภาพ" :options="imageTypes"/><FormInput id="order-image-weight" v-model="quantity" label="น้ำหนัก (กก.)" type="number" placeholder="เช่น 20.5"/><FormTextarea id="order-image-notes" v-model="notes" label="หมายเหตุ" placeholder="เพิ่มรายละเอียดถ้าจำเป็น"/></div><button type="button" class="mt-6 w-full rounded-xl bg-surface-container py-3 font-label text-sm font-bold text-primary" @click="emit('close')">ปิด</button></section></BaseOverlay>
</template>
