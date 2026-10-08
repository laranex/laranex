import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import HomeHero from './HomeHero.vue'
import HomePackages from './HomePackages.vue'
import NavPackageName from './NavPackageName.vue'
import PackageIntroduction from './PackageIntroduction.vue'
import SequenceDiagram from './SequenceDiagram.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: any }) {
    app.component('PackageIntroduction', PackageIntroduction)
    app.component('SequenceDiagram', SequenceDiagram)
  },
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-before': () => h(HomeHero),
      'home-features-after': () => h(HomePackages),
      'nav-bar-title-after': () => h(NavPackageName),
    })
  },
}
