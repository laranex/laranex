<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

const packages: Record<string, string> = {
  'laravel-myanmar-payments': 'Laravel Myanmar Payments',
  'go-myanmar-payments': 'Go Myanmar Payments',
  'php-myanmar-payments': 'PHP Myanmar Payments',
  'better-laravel': 'Better Laravel',
  'next-laravel': 'Next Laravel',
  'laravel-refresh-token': 'Laravel Refresh Token',
  'laravel-money': 'Laravel Money',
  'laravel-myanmar-nrc': 'Laravel Myanmar NRC',
  'laravel-biometric-auth': 'Laravel Biometric Auth',
  'laravel-newrelic': 'Laravel New Relic',
  'laralog-client': 'Laralog Client',
}

const packageName = computed(() => {
  const match = route.path.match(/^\/([^/]+)\//)
  return match ? (packages[match[1]] ?? null) : null
})
</script>

<template>
  <span v-if="packageName" class="lx-nav-package-name">{{ packageName }}</span>
</template>
