<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { TeamAgentCard } from '@/data/team-agent/team-agent.service'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import { useQueryPhotoRoute } from '../composables/useQueryPhotoRoute'
import AgentCardFrame from './AgentCardFrame.vue'
import AgentFlexPart, { type FlexBodyPart } from './AgentFlexPart.vue'

type FlexBubble = Extract<TeamAgentCard, { type: 'bubble' }>
type FlexImagePart = Extract<FlexBodyPart, { type: 'image' }>

const props = defineProps<{ card: TeamAgentCard; eventId: string; messageDisabled: boolean }>()
const emit = defineEmits<{
  route: [location: RouteLocationRaw]
  message: [text: string]
}>()

const viewer = useQueryPhotoRoute('cardPhoto')

const bubbles = computed<FlexBubble[]>(() => props.card.type === 'bubble' ? [props.card] : props.card.contents)

function photoImages(bubble: FlexBubble): FlexImagePart[] {
  const found: FlexImagePart[] = []
  const visit = (part: FlexBodyPart): void => {
    if (part.type === 'image' && part.action) found.push(part)
    else if (part.type === 'box') part.contents.forEach(visit)
  }
  if (bubble.hero) visit(bubble.hero)
  bubble.body.forEach(visit)
  return found
}

const viewerImages = computed(() => {
  const unique = new Map<string, FlexImagePart>()
  for (const bubble of bubbles.value) {
    for (const image of photoImages(bubble)) {
      if (!unique.has(image.source.url)) unique.set(image.source.url, image)
    }
  }
  return [...unique.values()].map((image, index) => ({
    id: `${props.eventId}~${index}`, src: image.source.url, alt: image.alt || 'Photo',
  }))
})

const activePhoto = computed(() => {
  const id = viewer.openPhotoId.value
  return id !== null && viewerImages.value.some(image => image.id === id) ? id : null
})

function openPhoto(url: string): void {
  const image = viewerImages.value.find(item => item.src === url)
  if (image) viewer.open(image.id)
}
</script>

<template>
  <div class="w-full">
    <div :class="card.type === 'carousel' ? 'flex snap-x snap-mandatory items-start gap-3 overflow-x-auto pb-2 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''">
      <AgentCardFrame
        v-for="(bubble, index) in bubbles"
        :key="index"
        :title="bubble.title"
        :tone="bubble.tone ?? 'brand'"
        :class="card.type === 'carousel' ? 'shrink-0 snap-start !w-[82%]' : ''"
      >
        <AgentFlexPart
          v-if="bubble.hero"
          class="mb-2"
          :part="bubble.hero"
          :message-disabled="messageDisabled"
          @photo="openPhoto"
        />
        <div class="flex flex-col gap-2">
          <AgentFlexPart
            v-for="(part, partIndex) in bubble.body"
            :key="partIndex"
            :part="part"
            :message-disabled="messageDisabled"
            @route="emit('route', $event)"
            @message="emit('message', $event)"
            @photo="openPhoto"
          />
        </div>
        <div v-if="bubble.footer?.length" class="mt-3 grid gap-2">
          <AgentFlexPart
            v-for="(button, buttonIndex) in bubble.footer"
            :key="buttonIndex"
            :part="button"
            :message-disabled="messageDisabled"
            @route="emit('route', $event)"
            @message="emit('message', $event)"
          />
        </div>
      </AgentCardFrame>
    </div>
    <PhotoViewer v-if="activePhoto" :images="viewerImages" :active-id="activePhoto" @change="viewer.open($event, true)" @close="viewer.close" />
  </div>
</template>
