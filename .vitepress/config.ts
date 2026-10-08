import { defineConfig, type HeadConfig } from 'vitepress'

export default defineConfig({
  title: 'Laranex',
  titleTemplate: ':title — Laranex',
  description: 'Laranex is an open source organization, built by developers for developers.',
  base: '/',
  cleanUrls: false,
  srcDir: 'src',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#18b69b' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap' }],
    ['meta', { property: 'og:site_name', content: 'Laranex' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],

  transformHead({ pageData }) {
    const heads: HeadConfig[] = []

    const isHome = pageData.relativePath === 'index.md'

    const title = isHome
      ? 'Laranex — Open source, built by developers for developers'
      : pageData.frontmatter.title
        ? `${pageData.frontmatter.title} — Laranex`
        : 'Laranex'

    const description =
      pageData.frontmatter.description ||
      'Laranex is an open source organization, built by developers for developers.'

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
            { text: 'AI Agent Skill', link: '/laravel-myanmar-payments/ai-agent-skill' },
            { text: 'Configuration',      link: '/laravel-myanmar-payments/configuration' },
            { text: 'Amounts',            link: '/laravel-myanmar-payments/amounts' },
            { text: 'Payment Flows',      link: '/laravel-myanmar-payments/payment-flows' },
            { text: 'Callbacks & Status', link: '/laravel-myanmar-payments/callbacks' },
            { text: 'Handling Webhooks', link: '/laravel-myanmar-payments/webhooks' },
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
      '/go-myanmar-payments/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction',         link: '/go-myanmar-payments/introduction' },
            { text: 'Installation',         link: '/go-myanmar-payments/installation' },
            { text: 'AI Agent Skill', link: '/go-myanmar-payments/ai-agent-skill' },
            { text: 'Configuration',        link: '/go-myanmar-payments/configuration' },
            { text: 'Amounts',              link: '/go-myanmar-payments/amounts' },
            { text: 'Payment Flows',        link: '/go-myanmar-payments/payment-flows' },
            { text: 'Callbacks & Status',   link: '/go-myanmar-payments/callbacks' },
            { text: 'Handling Webhooks', link: '/go-myanmar-payments/webhooks' },
            { text: 'net/http Integration', link: '/go-myanmar-payments/net-http' },
          ],
        },
        {
          text: 'Gateways',
          items: [
            { text: 'KBZ Pay',     link: '/go-myanmar-payments/drivers/kbz-pay' },
            { text: 'Wave Money',  link: '/go-myanmar-payments/drivers/wave-money' },
            { text: 'AYA Pay',     link: '/go-myanmar-payments/drivers/aya-pay' },
            { text: 'Yoma MMQR',   link: '/go-myanmar-payments/drivers/yoma-mmqr' },
            { text: 'CyberSource', link: '/go-myanmar-payments/drivers/cyber-source' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Results',                  link: '/go-myanmar-payments/references/results' },
            { text: 'PaymentCallback & Status', link: '/go-myanmar-payments/references/payment-callback' },
            { text: 'Errors',                   link: '/go-myanmar-payments/references/errors' },
          ],
        },
      ],
      '/node-myanmar-payments/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/node-myanmar-payments/introduction' },
            { text: 'Installation', link: '/node-myanmar-payments/installation' },
            { text: 'AI Agent Skill', link: '/node-myanmar-payments/ai-agent-skill' },
            { text: 'Configuration', link: '/node-myanmar-payments/configuration' },
            { text: 'Amounts', link: '/node-myanmar-payments/amounts' },
            { text: 'Payment Flows', link: '/node-myanmar-payments/payment-flows' },
            { text: 'Callbacks & Status', link: '/node-myanmar-payments/callbacks' },
            { text: 'Handling Webhooks', link: '/node-myanmar-payments/webhooks' },
            { text: 'Framework Integration', link: '/node-myanmar-payments/framework-integration' },
          ],
        },
        {
          text: 'Gateways',
          items: [
            { text: 'KBZ Pay', link: '/node-myanmar-payments/drivers/kbz-pay' },
            { text: 'Wave Money', link: '/node-myanmar-payments/drivers/wave-money' },
            { text: 'AYA Pay', link: '/node-myanmar-payments/drivers/aya-pay' },
            { text: 'Yoma MMQR', link: '/node-myanmar-payments/drivers/yoma-mmqr' },
            { text: 'CyberSource', link: '/node-myanmar-payments/drivers/cyber-source' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Results', link: '/node-myanmar-payments/references/results' },
            { text: 'PaymentCallback & Status', link: '/node-myanmar-payments/references/payment-callback' },
            { text: 'Errors', link: '/node-myanmar-payments/references/errors' },
          ],
        },
      ],
      '/php-myanmar-payments/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction',          link: '/php-myanmar-payments/introduction' },
            { text: 'Installation',          link: '/php-myanmar-payments/installation' },
            { text: 'AI Agent Skill', link: '/php-myanmar-payments/ai-agent-skill' },
            { text: 'Configuration',         link: '/php-myanmar-payments/configuration' },
            { text: 'Amounts',               link: '/php-myanmar-payments/amounts' },
            { text: 'Payment Flows',         link: '/php-myanmar-payments/payment-flows' },
            { text: 'Callbacks & Status',    link: '/php-myanmar-payments/callbacks' },
            { text: 'Handling Webhooks', link: '/php-myanmar-payments/webhooks' },
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
            { text: 'AI Agent Skill', link: '/better-laravel/ai-agent-skill' },
            { text: 'Configuration', link: '/better-laravel/configuration' },
            { text: 'Upgrading', link: '/better-laravel/upgrading' },
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
      '/next-laravel/': [
        {
          text: 'Next Laravel',
          items: [
            { text: 'Introduction',  link: '/next-laravel/introduction' },
            { text: 'Principles',    link: '/next-laravel/principles' },
            { text: 'Installation',  link: '/next-laravel/installation' },
            { text: 'AI Agent Skill', link: '/next-laravel/ai-agent-skill' },
            { text: 'Configuration', link: '/next-laravel/configuration' },
            { text: 'Upgrading', link: '/next-laravel/upgrading' },
          ],
        },
        {
          text: 'Usage',
          items: [
            { text: 'Route',      link: '/next-laravel/usage/route' },
            { text: 'Controller', link: '/next-laravel/usage/controller' },
            { text: 'Feature',    link: '/next-laravel/usage/feature' },
            { text: 'Request',    link: '/next-laravel/usage/request' },
            { text: 'Operation',  link: '/next-laravel/usage/operation' },
            { text: 'Job',        link: '/next-laravel/usage/job' },
          ],
        },
      ],
      '/laravel-refresh-token/': [
        {
          text: 'Laravel Refresh Token',
          items: [
            { text: 'Introduction', link: '/laravel-refresh-token/introduction' },
            { text: 'Installation', link: '/laravel-refresh-token/installation' },
            { text: 'AI Agent Skill', link: '/laravel-refresh-token/ai-agent-skill' },
            { text: 'Configuration', link: '/laravel-refresh-token/configuration' },
            { text: 'Upgrading', link: '/laravel-refresh-token/upgrading' },
            { text: 'Usage', link: '/laravel-refresh-token/usage' },
          ],
        },
      ],
      '/laravel-money/': [
        {
          text: 'Laravel Money',
          items: [
            { text: 'Introduction', link: '/laravel-money/introduction' },
            { text: 'Installation', link: '/laravel-money/installation' },
            { text: 'AI Agent Skill', link: '/laravel-money/ai-agent-skill' },
            { text: 'Usage', link: '/laravel-money/usage' },
            { text: 'Casts', link: '/laravel-money/casts' },
            { text: 'Arithmetic', link: '/laravel-money/arithmetic' },
          ],
        },
      ],
      '/laravel-myanmar-nrc/': [
        {
          text: 'Laravel Myanmar NRC',
          items: [
            { text: 'Introduction', link: '/laravel-myanmar-nrc/introduction' },
            { text: 'Installation', link: '/laravel-myanmar-nrc/installation' },
            { text: 'AI Agent Skill', link: '/laravel-myanmar-nrc/ai-agent-skill' },
            { text: 'Configuration', link: '/laravel-myanmar-nrc/configuration' },
            { text: 'Upgrading', link: '/laravel-myanmar-nrc/upgrading' },
            { text: 'Usage', link: '/laravel-myanmar-nrc/usage' },
          ],
        },
      ],
      '/laravel-biometric-auth/': [
        {
          text: 'Laravel Biometric Auth',
          items: [
            { text: 'Introduction', link: '/laravel-biometric-auth/introduction' },
            { text: 'Installation', link: '/laravel-biometric-auth/installation' },
            { text: 'AI Agent Skill', link: '/laravel-biometric-auth/ai-agent-skill' },
            { text: 'Configuration', link: '/laravel-biometric-auth/configuration' },
            { text: 'Upgrading', link: '/laravel-biometric-auth/upgrading' },
            { text: 'Usage', link: '/laravel-biometric-auth/usage' },
          ],
        },
      ],
      '/goravel-myanmar-payments/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/goravel-myanmar-payments/introduction' },
            { text: 'Installation', link: '/goravel-myanmar-payments/installation' },
            { text: 'AI Agent Skill', link: '/goravel-myanmar-payments/ai-agent-skill' },
            { text: 'Configuration', link: '/goravel-myanmar-payments/configuration' },
            { text: 'Usage', link: '/goravel-myanmar-payments/usage' },
            { text: 'Handling Webhooks', link: '/goravel-myanmar-payments/webhooks' },
            { text: 'Callbacks & Status', link: '/goravel-myanmar-payments/callbacks' },
            { text: 'Testing', link: '/goravel-myanmar-payments/testing' },
          ],
        },
      ],
      '/nestjs-myanmar-payments/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/nestjs-myanmar-payments/introduction' },
            { text: 'Installation', link: '/nestjs-myanmar-payments/installation' },
            { text: 'AI Agent Skill', link: '/nestjs-myanmar-payments/ai-agent-skill' },
            { text: 'Configuration', link: '/nestjs-myanmar-payments/configuration' },
            { text: 'Usage', link: '/nestjs-myanmar-payments/usage' },
            { text: 'Callbacks', link: '/nestjs-myanmar-payments/callbacks' },
            { text: 'Handling Webhooks', link: '/nestjs-myanmar-payments/webhooks' },
            { text: 'Testing', link: '/nestjs-myanmar-payments/testing' },
          ],
        },
      ],
      '/goravel-money/': [
        {
          text: 'Goravel Money',
          items: [
            { text: 'Introduction', link: '/goravel-money/introduction' },
            { text: 'Installation', link: '/goravel-money/installation' },
            { text: 'AI Agent Skill', link: '/goravel-money/ai-agent-skill' },
            { text: 'Usage', link: '/goravel-money/usage' },
            { text: 'Arithmetic', link: '/goravel-money/arithmetic' },
            { text: 'Columns', link: '/goravel-money/columns' },
          ],
        },
      ],
      '/laravel-newrelic/': [
        {
          text: 'Laravel New Relic',
          items: [
            { text: 'Introduction', link: '/laravel-newrelic/introduction' },
            { text: 'Installation', link: '/laravel-newrelic/installation' },
            { text: 'AI Agent Skill', link: '/laravel-newrelic/ai-agent-skill' },
            { text: 'Usage', link: '/laravel-newrelic/usage' },
            { text: 'Upgrading', link: '/laravel-newrelic/upgrading' },
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
      message: 'Released under the MIT License, except where a package says otherwise.',
      copyright: '© 2026 Laranex',
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
