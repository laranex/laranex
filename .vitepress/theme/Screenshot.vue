<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

// A screenshot taken in both color schemes (`<src>-light.webp` and `<src>-dark.webp` in public/): the page shows the
// one matching the site's theme. The Preview button, or a click on the image, opens it full size on the page.
const props = defineProps<{ src: string; alt: string; caption?: string }>()

const light = computed(() => withBase(`${props.src}-light.webp`))
const dark = computed(() => withBase(`${props.src}-dark.webp`))

const open = ref(false)
const closeButton = ref<HTMLButtonElement | null>(null)
let opener: HTMLElement | null = null

function show(event: Event): void {
  opener = event.currentTarget as HTMLElement
  open.value = true
}

function close(): void {
  open.value = false
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
  }
}

watch(open, async (isOpen) => {
  document.documentElement.classList.toggle('lx-preview-open', isOpen)
  if (isOpen) {
    window.addEventListener('keydown', onKey)
    await nextTick()
    closeButton.value?.focus()
  } else {
    window.removeEventListener('keydown', onKey)
    opener?.focus()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.classList.remove('lx-preview-open')
})
</script>

<template>
  <figure class="lx-screenshot">
    <div class="lx-screenshot__frame">
      <button type="button" class="lx-screenshot__image" :aria-label="`Preview: ${alt}`" @click="show">
        <img class="lx-screenshot__light" :src="light" :alt="alt" loading="lazy" decoding="async" />
        <img class="lx-screenshot__dark" :src="dark" :alt="alt" loading="lazy" decoding="async" />
      </button>
      <button type="button" class="lx-screenshot__preview" @click="show">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M9.5 2.5 H13.5 V6.5 M13.5 2.5 L9 7 M6.5 13.5 H2.5 V9.5 M2.5 13.5 L7 9" />
        </svg>
        Preview
      </button>
    </div>
    <figcaption v-if="caption">{{ caption }}</figcaption>

    <Teleport to="body">
      <div v-if="open" class="lx-preview" role="dialog" aria-modal="true" :aria-label="alt" @click.self="close">
        <button ref="closeButton" type="button" class="lx-preview__close" aria-label="Close preview" @click="close">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M4 4 L12 12 M12 4 L4 12" />
          </svg>
        </button>
        <img class="lx-screenshot__light" :src="light" :alt="alt" @click="close" />
        <img class="lx-screenshot__dark" :src="dark" :alt="alt" @click="close" />
      </div>
    </Teleport>
  </figure>
</template>
