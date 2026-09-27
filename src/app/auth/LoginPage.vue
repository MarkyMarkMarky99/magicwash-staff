<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/data/auth/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { status, error, signingIn } = storeToRefs(authStore)

const busy = computed(() => signingIn.value || status.value === 'loading')

function redirectTarget(): string {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
}

watch(status, (value) => {
  if (value === 'signedIn') void router.replace(redirectTarget())
}, { immediate: true })
</script>

<template>
  <main class="flex h-full flex-col items-center justify-center gap-8 bg-primary px-6 text-on-primary">
    <div class="text-center">
      <p class="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-mint">Staff sign-in</p>
      <h1 class="mt-2 font-headline text-3xl font-bold tracking-tight">Magicwash Laundry</h1>
    </div>

    <div class="flex w-full max-w-xs flex-col items-center gap-3">
      <button
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 font-label text-sm font-semibold text-primary shadow-lg transition-all hover:bg-surface-container-low active:scale-[0.98] disabled:opacity-60"
        :disabled="busy"
        @click="authStore.signIn"
      >
        <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">login</span>
        {{ busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Google' }}
      </button>
      <p v-if="error" role="alert" class="text-center font-body text-sm text-lime">{{ error }}</p>
    </div>
  </main>
</template>
