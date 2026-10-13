<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// The Laravel Schema Viewer demo, embedded live. It is served from this site, so the page can follow the site's color
// scheme and, once the demo is on screen and ready, press one of its keyboard shortcuts or open its Download menu.
const props = defineProps<{ title: string; hash?: string; shortcut?: string; open?: 'download' }>()

const { isDark } = useData()
const frame = ref<HTMLIFrameElement | null>(null)
const page = withBase('/laravel-schema-viewer/demo/index.html')
const src = computed(() => page + (props.hash ? `#${props.hash}` : ''))
let poll: number | undefined
let observer: IntersectionObserver | undefined

function theme(): void {
  const root = frame.value?.contentDocument?.documentElement
  if (root) {
    root.dataset.theme = isDark.value ? 'dark' : 'light'
  }
}

function act(win: Window & typeof globalThis): void {
  if (props.shortcut) {
    win.dispatchEvent(new win.KeyboardEvent('keydown', { key: props.shortcut, bubbles: true }))
  }
  if (props.open === 'download') {
    // The menu opens on pointer down, like a click. On a phone it lives in the More actions menu.
    const doc = win.document
    const menu = doc.querySelector('[data-tour="actions"] button') ?? doc.querySelector('button[aria-label="More actions"]')
    menu?.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
  }
}

function loaded(): void {
  theme()
  if (!props.shortcut && !props.open) {
    return
  }
  let tries = 0
  window.clearInterval(poll)
  poll = window.setInterval(() => {
    const win = frame.value?.contentWindow as (Window & typeof globalThis) | null | undefined
    const ready = win?.document.querySelector('.table-node')
    if (!ready && ++tries <= 50) {
      return
    }
    window.clearInterval(poll)
    if (!ready || !win || !frame.value) {
      return
    }
    // Wait until the viewer has centered its first view and the demo is in sight, so nothing moves out of view.
    observer?.disconnect()
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer?.disconnect()
          window.setTimeout(() => act(win), 1200)
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(frame.value)
  }, 200)
}

watch(isDark, theme)
onBeforeUnmount(() => {
  window.clearInterval(poll)
  observer?.disconnect()
})
</script>

<template>
  <div class="lx-demo">
    <iframe ref="frame" :src="src" :title="title" loading="lazy" @load="loaded"></iframe>
  </div>
  <p class="lx-demo__open"><a :href="src" target="_blank" rel="noopener">Open the demo full screen →</a></p>
</template>
