<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// The Laravel Schema Viewer demo, embedded live. It is served from this site, so the page can follow the site's color
// scheme and open a tab (by its keyboard shortcut) once the viewer is ready.
const props = defineProps<{ title: string; hash?: string; shortcut?: string }>()

const { isDark } = useData()
const frame = ref<HTMLIFrameElement | null>(null)
const page = withBase('/laravel-schema-viewer/demo/index.html')
const src = computed(() => page + (props.hash ? `#${props.hash}` : ''))
let poll: number | undefined

function theme(): void {
  const root = frame.value?.contentDocument?.documentElement
  if (root) {
    root.dataset.theme = isDark.value ? 'dark' : 'light'
  }
}

function loaded(): void {
  theme()
  if (!props.shortcut) {
    return
  }
  let tries = 0
  window.clearInterval(poll)
  poll = window.setInterval(() => {
    const win = frame.value?.contentWindow as (Window & typeof globalThis) | null | undefined
    const ready = win?.document.querySelector('.table-node')
    if (ready || ++tries > 50) {
      window.clearInterval(poll)
      if (ready && win) {
        win.dispatchEvent(new win.KeyboardEvent('keydown', { key: props.shortcut, bubbles: true }))
      }
    }
  }, 200)
}

watch(isDark, theme)
onBeforeUnmount(() => window.clearInterval(poll))
</script>

<template>
  <div class="lx-demo">
    <iframe ref="frame" :src="src" :title="title" loading="lazy" @load="loaded"></iframe>
  </div>
  <p class="lx-demo__open"><a :href="src" target="_blank" rel="noopener">Open the demo full screen →</a></p>
</template>
