import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import HomePackages from './HomePackages.vue'
import NavPackageName from './NavPackageName.vue'
import PackageIntroduction from './PackageIntroduction.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: any }) {
    app.component('PackageIntroduction', PackageIntroduction)
  },
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-after': () => h(HomePackages),
      'nav-bar-title-after': () => h(NavPackageName),
    })
  },
}
