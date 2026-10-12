<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed } from 'vue'

// A screenshot taken in both color schemes (`<src>-light.webp` and `<src>-dark.webp` in public/): the page shows the
// one matching the site's theme, and a click opens it full size.
const props = defineProps<{ src: string; alt: string; caption?: string; phone?: boolean }>()

const light = computed(() => withBase(`${props.src}-light.webp`))
const dark = computed(() => withBase(`${props.src}-dark.webp`))
</script>

<template>
  <figure class="lx-screenshot" :class="{ 'lx-screenshot--phone': phone }">
    <a :href="light" class="lx-screenshot__light" target="_blank" rel="noopener">
      <img :src="light" :alt="alt" loading="lazy" decoding="async" />
    </a>
    <a :href="dark" class="lx-screenshot__dark" target="_blank" rel="noopener">
      <img :src="dark" :alt="alt" loading="lazy" decoding="async" />
    </a>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>
