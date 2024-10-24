// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Projects from '../../src/components/Projects.vue'
import './style.css'


export default {
  extends: DefaultTheme,
  enhanceApp({ app, router, siteData }) {

    // Global Components
    app.component('Projects', Projects)
  }
} satisfies Theme
