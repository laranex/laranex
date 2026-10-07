import { defineConfig, type HeadConfig } from 'vitepress'

export default defineConfig({
  title: 'Laranex',
  titleTemplate: ':title — Laranex',
  description: 'Open source packages for developers by Laranex',
  base: '/',
  cleanUrls: false,
  srcDir: 'src',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#18b69b' }],
    ['meta', { property: 'og:site_name', content: 'Laranex' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],

  transformHead({ pageData }) {
    const heads: HeadConfig[] = []

    const isHome = pageData.relativePath === 'index.md'

    const title = isHome
      ? 'Laranex — Open Source Packages for Developers'
      : pageData.frontmatter.title
        ? `${pageData.frontmatter.title} — Laranex`
        : 'Laranex'

    const description =
      pageData.frontmatter.description ||
      'Open source packages for developers by Laranex'

    heads.push(['meta', { property: 'og:title', content: title }])
    heads.push(['meta', { property: 'og:description', content: description }])
    heads.push(['meta', { name: 'twitter:title', content: title }])
    heads.push(['meta', { name: 'twitter:description', content: description }])
    heads.push(['meta', { name: 'description', content: description }])

    return heads
  },

  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo.svg' },
    siteTitle: false,

    sidebar: {
      '/laravel-myanmar-payments/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction',       link: '/laravel-myanmar-payments/introduction' },
            { text: 'Installation',       link: '/laravel-myanmar-payments/installation' },
            { text: 'Configuration',      link: '/laravel-myanmar-payments/configuration' },
            { text: 'Payment Flows',      link: '/laravel-myanmar-payments/payment-flows' },
            { text: 'Callbacks & Status', link: '/laravel-myanmar-payments/callbacks' },
            { text: 'Upgrading',          link: '/laravel-myanmar-payments/upgrading' },
          ],
        },
        {
          text: 'Gateways',
          items: [
            { text: 'KBZ Pay',     link: '/laravel-myanmar-payments/drivers/kbz-pay' },
            { text: 'Wave Money',  link: '/laravel-myanmar-payments/drivers/wave-money' },
            { text: 'AYA Pay',     link: '/laravel-myanmar-payments/drivers/aya-pay' },
            { text: 'Yoma MMQR',   link: '/laravel-myanmar-payments/drivers/yoma-mmqr' },
            { text: 'CyberSource', link: '/laravel-myanmar-payments/drivers/cyber-source' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Results',                 link: '/laravel-myanmar-payments/references/results' },
            { text: 'PaymentCallback & Status', link: '/laravel-myanmar-payments/references/payment-callback' },
            { text: 'Errors',                  link: '/laravel-myanmar-payments/references/errors' },
          ],
        },
      ],
      '/php-myanmar-payments/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction',          link: '/php-myanmar-payments/introduction' },
            { text: 'Installation',          link: '/php-myanmar-payments/installation' },
            { text: 'Configuration',         link: '/php-myanmar-payments/configuration' },
            { text: 'Payment Flows',         link: '/php-myanmar-payments/payment-flows' },
            { text: 'Callbacks & Status',    link: '/php-myanmar-payments/callbacks' },
            { text: 'Framework Integration', link: '/php-myanmar-payments/framework-integration' },
          ],
        },
        {
          text: 'Gateways',
          items: [
            { text: 'KBZ Pay',     link: '/php-myanmar-payments/drivers/kbz-pay' },
            { text: 'Wave Money',  link: '/php-myanmar-payments/drivers/wave-money' },
            { text: 'AYA Pay',     link: '/php-myanmar-payments/drivers/aya-pay' },
            { text: 'Yoma MMQR',   link: '/php-myanmar-payments/drivers/yoma-mmqr' },
            { text: 'CyberSource', link: '/php-myanmar-payments/drivers/cyber-source' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Results',                  link: '/php-myanmar-payments/references/results' },
            { text: 'PaymentCallback & Status', link: '/php-myanmar-payments/references/payment-callback' },
            { text: 'Errors',                   link: '/php-myanmar-payments/references/errors' },
          ],
        },
      ],
      '/better-laravel/': [
        {
          text: 'Better Laravel',
          items: [
            { text: 'Introduction',  link: '/better-laravel/introduction' },
            { text: 'Principles',    link: '/better-laravel/principles' },
            { text: 'Installation',  link: '/better-laravel/installation' },
            { text: 'Configuration', link: '/better-laravel/configuration' },
          ],
        },
        {
          text: 'Usage',
          items: [
            { text: 'Route',      link: '/better-laravel/usage/route' },
            { text: 'Controller', link: '/better-laravel/usage/controller' },
            { text: 'Feature',    link: '/better-laravel/usage/feature' },
            { text: 'Request',    link: '/better-laravel/usage/request' },
            { text: 'Operation',  link: '/better-laravel/usage/operation' },
            { text: 'Job',        link: '/better-laravel/usage/job' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/laranex' },
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: 'Search docs...',
            buttonAriaLabel: 'Search docs',
          },
        },
        miniSearch: {
          searchOptions: {
            // Scope results to the package currently being browsed.
            // On the home page (no package prefix) all results are shown.
            filter(result) {
              if (typeof window === 'undefined') return true
              const match = window.location.pathname.match(/^\/([^/]+)\//)
              if (!match) return true
              const pkg = match[1]
              return result.id.includes(pkg)
            },
          },
        },
      },
    },

    footer: {
      copyright: 'Copyright © 2024 Laranex',
    },
  },

  markdown: {
    languageAlias: {
      env: 'dotenv',
    },
  },

  vite: {
    server: {
      host: true,
    },
  },
})
