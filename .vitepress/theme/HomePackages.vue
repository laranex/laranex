<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { data as categories } from '../../src/packages.data'

/**
 * Selected category slugs, kept in the `?category=` query (comma separated) so a filtered view can be shared.
 */
const selected = ref<string[]>([])

const visibleCategories = computed(() =>
  selected.value.length === 0 ? categories : categories.filter(({ slug }) => selected.value.includes(slug)),
)

function isSelected(slug: string): boolean {
  return selected.value.includes(slug)
}

function toggle(slug: string): void {
  selected.value = isSelected(slug) ? selected.value.filter((value) => value !== slug) : [...selected.value, slug]
  syncUrl()
}

function clear(): void {
  selected.value = []
  syncUrl()
}

function syncUrl(): void {
  const url = new URL(window.location.href)
  const ordered = categories.map(({ slug }) => slug).filter((slug) => selected.value.includes(slug))

  if (ordered.length === 0) {
    url.searchParams.delete('category')
  } else {
    url.searchParams.set('category', ordered.join(','))
  }

  window.history.replaceState(window.history.state, '', url.toString().replace(/%2C/g, ','))
}

const root = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/**
 * Reveal rows as they scroll into view. Rows stay visible when JavaScript, IntersectionObserver
 * or motion is unavailable, because the hidden state only applies under `.lx-reveal-ready`.
 */
function observeRows(): void {
  if (observer === null || root.value === null) {
    return
  }

  root.value.querySelectorAll('.lx-registry-row:not(.is-visible)').forEach((row) => observer?.observe(row))
}

watch(visibleCategories, () => nextTick(observeRows))

onBeforeUnmount(() => observer?.disconnect())

onMounted(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!reduceMotion && 'IntersectionObserver' in window && root.value !== null) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer?.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    root.value.classList.add('lx-reveal-ready')
    observeRows()
  }

  const known = new Set(categories.map(({ slug }) => slug))
  const requested = new URLSearchParams(window.location.search).get('category') ?? ''

  selected.value = requested.split(',').map((slug) => slug.trim()).filter((slug) => known.has(slug))
})
</script>

<template>
  <section id="projects" ref="root" class="lx-packages">
    <div class="lx-packages-inner">
      <div class="lx-packages-head">
        <h2 class="lx-packages-heading">Projects</h2>
        <div class="lx-packages-filters" role="group" aria-label="Filter projects by category">
          <button type="button" class="lx-filter" :aria-pressed="selected.length === 0" @click="clear">All</button>
          <button
            v-for="category in categories"
            :key="category.slug"
            type="button"
            class="lx-filter"
            :aria-pressed="isSelected(category.slug)"
            @click="toggle(category.slug)"
          >
            {{ category.name }}
          </button>
        </div>
      </div>

      <TransitionGroup name="lx-category" tag="div" class="lx-packages-list">
      <section v-for="category in visibleCategories" :key="category.slug" class="lx-packages-category">
        <h3 class="lx-packages-category-heading">{{ category.name }}</h3>
        <ul class="lx-registry">
          <li
            v-for="(pkg, index) in category.packages"
            :key="pkg.slug"
            class="lx-registry-row"
            :style="{ '--lx-delay': `${index * 60}ms` }"
          >
            <div class="lx-registry-main">
              <a :href="pkg.docsUrl" class="lx-registry-name">{{ pkg.name }}</a>
              <p class="lx-registry-desc">{{ pkg.description }}</p>
              <p class="lx-registry-reqs">{{ pkg.requirements.join(', ') }}</p>
            </div>
            <div class="lx-registry-side">
              <a :href="pkg.docsUrl" class="lx-link-btn">
                Documentation
              </a>
              <a :href="pkg.github" class="lx-link-btn" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </div>
          </li>
        </ul>
      </section>
      </TransitionGroup>
    </div>
  </section>
</template>
