<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed, ref } from 'vue'
import { data as categories } from '../../src/packages.data'

const { page } = useData()

const pkg = computed(() => {
  const slug = page.value.relativePath.split('/')[0]
  return categories.flatMap(({ packages }) => packages).find((p) => p.slug === slug) ?? null
})

const copied = ref(false)

async function copyInstall(): Promise<void> {
  if (!pkg.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(pkg.value.install)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    // Clipboard access can be denied; the command stays selectable.
  }
}
</script>

<template>
  <header v-if="pkg" class="pkg-hero">
    <h1 class="pkg-title">{{ pkg.name }}</h1>
    <p class="pkg-description">{{ pkg.description }}</p>
    <p class="pkg-badges">
      <a v-for="badge in pkg.badges" :key="badge.alt" :href="badge.href" target="_blank" rel="noopener noreferrer">
        <img :src="badge.src" :alt="badge.alt" height="20" />
      </a>
    </p>

    <div class="pkg-install">
      <span class="pkg-install-prompt" aria-hidden="true">$</span>
      <code class="pkg-install-command">{{ pkg.install }}</code>
      <button type="button" class="pkg-install-copy" :aria-label="copied ? 'Copied' : 'Copy install command'" @click="copyInstall">
        <svg v-if="!copied" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
          <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
        </svg>
        <svg v-else viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div class="pkg-actions">
      <a :href="withBase(`/${pkg.slug}/installation`)" class="lx-btn lx-btn-brand">
        Get started
        <svg class="lx-btn-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clip-rule="evenodd" />
        </svg>
      </a>
      <a :href="pkg.github" class="lx-btn lx-btn-alt" target="_blank" rel="noopener noreferrer">
        <svg class="lx-btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
        View on GitHub
      </a>
      <CopyOrDownloadAsMarkdownButtons class="pkg-copy-page" />
    </div>
  </header>

  <template v-if="pkg">
    <h2 id="requirements" tabindex="-1">Requirements <a class="header-anchor" href="#requirements" aria-label="Permalink to &quot;Requirements&quot;">&#8203;</a></h2>
    <ul class="pkg-reqs">
      <li v-for="req in pkg.requirements" :key="req">{{ req }}</li>
    </ul>
  </template>
</template>
