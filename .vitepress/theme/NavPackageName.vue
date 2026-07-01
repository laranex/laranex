<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

const packages: Record<string, string> = {
  'laravel-myanmar-payments': 'Laravel Myanmar Payments',
  'better-laravel': 'Better Laravel',
}

const packageName = computed(() => {
  const match = route.path.match(/^\/([^/]+)\//)
  return match ? (packages[match[1]] ?? null) : null
})
</script>

<template>
  <span v-if="packageName" class="lx-nav-package-name">{{ packageName }}</span>
</template>
