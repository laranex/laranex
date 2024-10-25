<template>
  <div>
    <input
      type="text"
      class="mb-5 w-full rounded-md border border-solid border-gray-400 px-4 py-3 transition duration-300"
      placeholder="Search Projects..."
      v-model="search"
    />
    <div></div>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] items-stretch gap-5">
      <div
        class="flex flex-col rounded-lg bg-[var(--vp-c-bg-soft)] p-4"
        v-for="pkg in filteredPackages"
        :key="pkg.name"
      >
        <div class="flex-1">
          <h4 class="!mt-0">
            <a :href="pkg.homepage">{{ pkg.name }}</a>
          </h4>
          <p class="!mb-6 text-sm">{{ pkg.description }}</p>
        </div>

        <div class="mb-2 flex items-center justify-between gap-2.5">
          <!-- <img src="/svgs/download.svg" :alt="pkg.name" class="h-5 w-5" /> -->
          <small>Downloads:</small>
          <small>{{ pkg.downloads.toLocaleString("en-US") }}</small>
        </div>
        <div class="flex items-center justify-between gap-2.5">
          <small>Registry:</small>
          <div class="flex items-center gap-1">
            <img class="h-4 w-4" :src="`/svgs/${pkg.type}.svg`" :alt="pkg.type" />
            <small>{{ pkg.type.charAt(0).toUpperCase() + pkg.type.slice(1) }}</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, onMounted, ref, computed } from "vue"
import { usePackagist, useNpm } from "../composables"

const { fetchPackagesFromPackagist } = usePackagist()
const { fetchPackagesFromNpm } = useNpm()

const packages = ref<Project>([])
const search = ref("")

onMounted(async () => {
  packages.value.push(...(await fetchPackagesFromPackagist()))
  packages.value.push(...(await fetchPackagesFromNpm()))
})

const filteredPackages = computed(() =>
  packages.value
    .filter(({ name }) => name.toLowerCase().includes(search.value.toLowerCase()))
    .sort((a, b) => b.downloads - a.downloads),
)
</script>

<style scoped>
a {
  text-decoration: none;
  color: inherit;
}
</style>
