<script setup lang="ts">
import type { AgentId } from '../agent-chat.types'

withDefaults(defineProps<{ agentId: AgentId; size?: number }>(), { size: 56 })
</script>

<template>
  <svg viewBox="0 0 64 64" class="block shrink-0 overflow-hidden rounded-full" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <template v-if="agentId === 'register-customer'">
      <rect width="64" height="64" class="fill-secondary-container" />
      <path d="M9 40C6 14 22 6 32 6C42 6 58 14 55 40L55 50C55 55 47 55 46 50L18 50C17 55 9 55 9 50Z" class="fill-on-surface" />
      <path d="M10 66C12 54 21 51 32 51C43 51 52 54 54 66Z" class="fill-primary" />
      <path d="M26 51L32 58L38 51Z" class="fill-error-container" />
      <rect x="39" y="56" width="11" height="7" rx="2" class="fill-lime" transform="rotate(-6 44 59)" />
      <rect x="41" y="58.2" width="7" height="1.3" rx=".6" class="fill-primary" transform="rotate(-6 44 59)" />
      <rect x="41" y="60.6" width="4.5" height="1.3" rx=".6" class="fill-primary" transform="rotate(-6 44 59)" />
      <ellipse cx="32" cy="35" rx="16" ry="17" class="fill-error-container" />
      <path d="M15 33C16 14 48 14 49 33C44 26 36 22 30 22C24 22 19 26 15 33Z" class="fill-on-surface" />
      <circle cx="25.5" cy="36" r="2.3" class="fill-on-surface" />
      <circle cx="38.5" cy="36" r="2.3" class="fill-on-surface" />
      <circle cx="26.3" cy="35.2" r=".8" class="fill-white" />
      <circle cx="39.3" cy="35.2" r=".8" class="fill-white" />
      <circle cx="21.5" cy="42" r="3.2" class="fill-error" opacity=".35" />
      <circle cx="42.5" cy="42" r="3.2" class="fill-error" opacity=".35" />
      <path d="M28 43Q32 47.5 36 43" fill="none" class="stroke-on-error-container" stroke-width="2" stroke-linecap="round" />
      <path d="M50 24L55 13" class="stroke-warning" stroke-width="3.6" stroke-linecap="round" />
      <path d="M54.2 14.8L55.4 11.6" class="stroke-on-surface" stroke-width="2.6" stroke-linecap="round" />
    </template>

    <template v-else-if="agentId === 'price-check'">
      <rect width="64" height="64" class="fill-warning-container" />
      <path d="M9 66C11 54 21 51 32 51C43 51 53 54 55 66Z" class="fill-warning" />
      <path d="M25 51L32 58L39 51Z" class="fill-error-container" />
      <ellipse cx="32" cy="36" rx="16" ry="17" class="fill-error-container" />
      <ellipse cx="16" cy="38" rx="2.6" ry="4" class="fill-error-container" />
      <ellipse cx="48" cy="38" rx="2.6" ry="4" class="fill-error-container" />
      <path d="M15 28C14 8 50 8 49 28Z" class="fill-primary" />
      <path d="M14 28L50 28C52 31 48 32 46 32L18 32C16 32 12 31 14 28Z" class="fill-primary-container" />
      <circle cx="32" cy="18.5" r="6" class="fill-lime" />
      <text x="32" y="22" font-size="9.5" font-weight="800" text-anchor="middle" class="fill-primary font-headline">฿</text>
      <path d="M21.5 39Q25 34.5 28.5 39" fill="none" class="stroke-on-surface" stroke-width="2.4" stroke-linecap="round" />
      <path d="M35.5 39Q39 34.5 42.5 39" fill="none" class="stroke-on-surface" stroke-width="2.4" stroke-linecap="round" />
      <path d="M25.5 43.5Q32 52 38.5 43.5Z" class="fill-on-error-container" />
      <path d="M28 48Q32 45.5 36 48Q32 50.6 28 48Z" class="fill-error" />
      <circle cx="20.5" cy="43" r="3" class="fill-error" opacity=".35" />
      <circle cx="43.5" cy="43" r="3" class="fill-error" opacity=".35" />
      <circle cx="54" cy="52" r="7.5" class="fill-medal-gold stroke-warning" stroke-width="2" />
      <text x="54" y="55.4" font-size="9" font-weight="800" text-anchor="middle" class="fill-on-warning-container font-headline">฿</text>
    </template>

    <template v-else>
      <rect width="64" height="64" class="fill-info-container" />
      <path d="M32 14L32 7" class="stroke-on-surface-variant" stroke-width="2.6" stroke-linecap="round" />
      <circle cx="32" cy="6" r="3.8" class="fill-lime stroke-primary" stroke-width="1.6" />
      <path d="M14 66C14 52 22 47 32 47C42 47 50 52 50 66Z" class="fill-info" />
      <circle cx="32" cy="55" r="3.2" class="fill-lime" />
      <rect x="8" y="26" width="6" height="12" rx="3" class="fill-info" />
      <rect x="50" y="26" width="6" height="12" rx="3" class="fill-info" />
      <rect x="13" y="14" width="38" height="32" rx="13" class="fill-white stroke-primary" stroke-width="3" />
      <rect x="19" y="20" width="26" height="20" rx="9" class="fill-primary" />
      <circle cx="26.5" cy="29" r="3.4" class="fill-lime" />
      <circle cx="37.5" cy="29" r="3.4" class="fill-lime" />
      <circle cx="27.5" cy="28" r="1" class="fill-primary" />
      <circle cx="38.5" cy="28" r="1" class="fill-primary" />
      <path d="M28.5 34.5Q32 37.5 35.5 34.5" fill="none" class="stroke-lime" stroke-width="2" stroke-linecap="round" />
      <circle cx="46" cy="47" r="7" class="fill-white stroke-primary" fill-opacity=".55" stroke-width="3" />
      <path d="M51 52L56 57" class="stroke-primary" stroke-width="4" stroke-linecap="round" />
      <path d="M43 44.5Q44.5 42.5 47 42.5" fill="none" class="stroke-white" stroke-width="1.6" stroke-linecap="round" />
    </template>
  </svg>
</template>
