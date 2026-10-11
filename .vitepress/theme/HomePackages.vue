<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { data as categories, type PackageBadge, type PackageData } from '../../src/packages.data'

/**
 * Selected category slugs, kept in the `?category=` query (comma separated) so a filtered view can be shared.
 */
const selected = ref<string[]>([])
const query = ref('')

const totalCount = categories.reduce((total, { packages }) => total + packages.length, 0)

function matches(text: string): boolean {
  const terms = query.value.toLowerCase().split(/\s+/).filter(Boolean)

  return terms.every((term) => text.toLowerCase().includes(term))
}

const visibleCategories = computed(() =>
  (selected.value.length === 0 ? categories : categories.filter(({ slug }) => selected.value.includes(slug)))
    .map((category) => ({
      ...category,
      packages: category.packages.filter((pkg) =>
        matches([pkg.name, pkg.description, category.name].join(' ')),
      ),
    }))
    .filter(({ packages }) => packages.length > 0),
)

/**
 * Languages first, each followed by its frameworks.
 */
const stacks = ['php', 'laravel', 'go', 'goravel', 'node', 'nestjs', 'python']

function stackRank({ slug }: PackageData): number {
  const stack = slug.includes('laravel') ? 'laravel' : slug.split('-')[0]
  const rank = stacks.indexOf(stack)

  return rank === -1 ? stacks.length : rank
}

/**
 * Sorted by language and framework; within one, the category order is kept.
 */
const visiblePackages = computed(() =>
  visibleCategories.value.flatMap(({ packages }) => packages).sort((a, b) => stackRank(a) - stackRank(b)),
)

/**
 * Cards show the tests badge first, then the version badge.
 */
function cardBadges(badges: PackageBadge[]): PackageBadge[] {
  const [version, tests] = badges

  return [tests, version].filter(Boolean)
}

const visibleCount = computed(() => visiblePackages.value.length)

function isSelected(slug: string): boolean {
  return selected.value.includes(slug)
}

function toggle(slug: string): void {
  selected.value = isSelected(slug) ? selected.value.filter((value) => value !== slug) : [...selected.value, slug]
  syncUrl()
}

function clear(): void {
  selected.value = []
  query.value = ''
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
 * Reveal cards as they scroll into view. Cards stay visible when JavaScript, IntersectionObserver
 * or motion is unavailable, because the hidden state only applies under `.lx-reveal-ready`.
 */
function observeCards(): void {
  if (observer === null || root.value === null) {
    return
  }

  root.value.querySelectorAll('.lx-card:not(.is-visible)').forEach((card) => observer?.observe(card))
}

watch(visiblePackages, () => nextTick(observeCards))

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
    observeCards()
  }

  const known = new Set(categories.map(({ slug }) => slug))
  const requested = new URLSearchParams(window.location.search).get('category') ?? ''

  selected.value = requested.split(',').map((slug) => slug.trim()).filter((slug) => known.has(slug))
})
</script>

<template>
  <section id="projects" ref="root" class="lx-packages" aria-labelledby="lx-projects-heading">
    <div class="lx-section-inner">
      <p class="lx-kicker">Projects</p>
      <h2 id="lx-projects-heading" class="lx-section-heading">Find the right project</h2>
      <p class="lx-section-lead">
        {{ totalCount }} projects across {{ categories.length }} categories, each with its own documentation and
        agent skill.
      </p>

      <div class="lx-toolbar">
        <label class="lx-search">
          <svg class="lx-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
          </svg>
          <span class="visually-hidden">Filter projects</span>
          <input v-model="query" type="search" class="lx-search-input" placeholder="Filter projects…" autocomplete="off" />
        </label>
        <div class="lx-packages-filters" role="group" aria-label="Filter projects by category">
          <button type="button" class="lx-filter" :aria-pressed="selected.length === 0" @click="clear">
            All <span class="lx-count">{{ totalCount }}</span>
          </button>
          <button
            v-for="category in categories"
            :key="category.slug"
            type="button"
            class="lx-filter"
            :aria-pressed="isSelected(category.slug)"
            @click="toggle(category.slug)"
          >
            {{ category.name }} <span class="lx-count">{{ category.packages.length }}</span>
          </button>
        </div>
      </div>

      <p v-if="visibleCount === 0" class="lx-empty">
        No project matches “{{ query }}”.
        <button type="button" class="lx-empty-reset" @click="clear">Show all projects</button>
      </p>

      <ul v-if="visibleCount > 0" class="lx-cards">
        <li
          v-for="(pkg, index) in visiblePackages"
          :key="pkg.slug"
          class="lx-card"
          :style="{ '--lx-delay': `${(index % 3) * 70}ms` }"
        >
          <h3 class="lx-card-name">
            <a :href="pkg.docsUrl" class="lx-card-link">{{ pkg.name }}</a>
          </h3>
          <p class="lx-card-desc" :title="pkg.description">{{ pkg.description }}</p>
          <div class="lx-card-foot">
            <p class="lx-card-badges">
              <a v-for="badge in cardBadges(pkg.badges)" :key="badge.alt" :href="badge.href" target="_blank" rel="noopener noreferrer">
                <img :src="badge.src" :alt="badge.alt" height="20" loading="lazy" decoding="async" />
              </a>
            </p>
          </div>
        </li>
      </ul>
    </div>
  </section>

  <section class="lx-cta" aria-labelledby="lx-cta-heading">
    <div class="lx-cta-inner">
      <h2 id="lx-cta-heading" class="lx-cta-heading">Build it with us</h2>
      <p class="lx-cta-text">
        Every project is developed in the open. Report an issue, suggest an idea or send a pull request.
      </p>
      <a class="lx-btn lx-btn-brand lx-btn-lg" href="https://github.com/laranex" target="_blank" rel="noopener noreferrer">
        Contribute on GitHub
      </a>
    </div>
  </section>
</template>
