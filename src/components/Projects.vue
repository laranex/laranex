<template>
  <div>
    <input
      type="text"
      class="search-box"
      placeholder="Search Projects..."
      v-model="search"
    />
    <div class="card-container">
      <div class="card" v-for="pkg in filteredPackages" :key="pkg.name">
        <div class="card-body">
          <h4>{{ pkg.name }}</h4>
          <p class="card-description">{{ pkg.description }}</p>
        </div>

        <div class="total-downloads">
          <img src="/svgs/download.svg" :alt="pkg.name" />
          <small>{{ pkg.downloads }}</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, computed } from "vue";
import { usePackagist } from "../composables/usePackagist";

const { fetchPackagesFromPackagist } = usePackagist();

export default defineComponent({
  name: "Projects",
  setup() {
    const packages = ref<Projects>([]);
    const search = ref("");

    onMounted(async () => {
      packages.value.push(...(await fetchPackagesFromPackagist()));
    });

    const filteredPackages = computed(() =>
      packages.value
        .filter(({ name }) =>
          name.toLowerCase().includes(search.value.toLowerCase())
        )
        .sort((a, b) => b.downloads - a.downloads)
    );

    return {
      filteredPackages,
      search,
    };
  },
});
</script>

<style scoped>
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  align-items: stretch;
}

.card {
  background-color: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 20px;
  flex-direction: column;
  display: flex;
}

.card-body {
  flex: 1;
}

.card-description {
  font-size: 14px;
}

.total-downloads {
  display: flex;
  gap: 10px;
  align-items: center;

  img {
    height: 20px;
    width: 20px;
  }
}

.search-box {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #7d7d7d;
  border-radius: 6px;
  transition: border-color 0.3s;
  margin-bottom: 20px;
}
</style>
