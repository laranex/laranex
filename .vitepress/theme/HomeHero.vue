<script setup lang="ts">
const words = ['Built', 'by', 'developers,', 'for', 'developers']
</script>

<template>
  <section class="lx-hero">
    <div class="lx-hero-inner">
      <h1 class="lx-hero-title" aria-label="Built by developers, for developers">
        <span
          v-for="(word, index) in words"
          :key="word + index"
          class="lx-hero-word"
          :style="{ '--lx-delay': `${index * 70}ms` }"
          aria-hidden="true"
        >{{ word }}</span><span class="lx-cursor" aria-hidden="true" />
      </h1>
      <p class="lx-hero-lead lx-hero-fade" style="--lx-delay: 420ms">
        Laranex is an open source organization. Everything here is free to use, tested before it ships and
        documented before we call it done. Every project is built for humans and AI agents alike: clear docs
        for you, and an agent skill so your coding agent uses it the right way.
      </p>
      <div class="lx-hero-actions lx-hero-fade" style="--lx-delay: 520ms">
        <a class="lx-btn lx-btn-brand lx-btn-lg" href="#projects">Explore the projects</a>
        <a class="lx-btn lx-btn-alt lx-btn-lg" href="https://github.com/laranex" target="_blank" rel="noopener noreferrer">Laranex on GitHub</a>
      </div>
    </div>
  </section>
</template>
