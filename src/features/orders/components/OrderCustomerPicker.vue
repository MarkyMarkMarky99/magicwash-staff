<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseOverlay from '@/shared/layouts/BaseOverlay.vue'
import FormLabel from '@/shared/components/FormLabel.vue'

const props = defineProps<{ modelValue: string; customers: Array<{ customerId: string; customerName: string; phone?: string | null }> }>()
const emit = defineEmits<{ 'update:modelValue': [customerId: string] }>()
const pickerOpen = ref(false)
const keyword = ref('')
const selected = computed(() => props.customers.find((customer) => customer.customerId === props.modelValue) ?? null)
const choices = computed(() => props.customers.filter((customer) => `${customer.customerName} ${customer.phone ?? ''}`.toLocaleLowerCase('th-TH').includes(keyword.value.trim().toLocaleLowerCase('th-TH'))))
function choose(customerId: string) { emit('update:modelValue', customerId); pickerOpen.value = false }
</script>

<template>
  <section><FormLabel input-id="order-customer-picker">ลูกค้า *</FormLabel><button id="order-customer-picker" type="button" class="flex min-h-[47px] w-full items-center justify-between rounded-[10px] border border-[#a9c9c3] bg-white px-3 text-left font-body text-sm" @click="pickerOpen = true"><span :class="selected ? 'text-on-surface' : 'text-on-surface-variant'">{{ selected ? `${selected.customerName}${selected.phone ? ` · ${selected.phone}` : ''}` : 'เลือกลูกค้า' }}</span><span class="material-symbols-outlined text-on-surface-variant">search</span></button></section>
  <BaseOverlay :open="pickerOpen" aria-label="เลือกลูกค้า" @close="pickerOpen = false"><section class="min-h-full bg-surface p-5"><header class="mb-5 pr-12"><p class="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Create order</p><h2 class="font-headline text-xl font-bold text-primary">เลือกลูกค้า</h2></header><label class="sr-only" for="order-customer-search">ค้นหาลูกค้า</label><input id="order-customer-search" v-model="keyword" autofocus class="mb-3 w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-3 font-body text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="ค้นหาชื่อหรือเบอร์โทร"><div class="divide-y divide-outline-variant/20 rounded-xl border border-outline-variant/20"><button v-for="customer in choices" :key="customer.customerId" type="button" class="block w-full px-4 py-3 text-left hover:bg-surface-container-low" @click="choose(customer.customerId)"><strong class="block font-body text-sm text-on-surface">{{ customer.customerName }}</strong><span class="font-body text-xs text-on-surface-variant">{{ customer.phone ?? customer.customerId }}</span></button><p v-if="!choices.length" class="p-4 text-sm text-on-surface-variant">ไม่พบลูกค้า</p></div></section></BaseOverlay>
</template>
