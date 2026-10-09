import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { defineConfig, type HeadConfig, type PageData } from 'vitepress'
import { installCommand, programmingLanguage } from './package-meta'

/** The site's public origin. Change this one line when moving to a custom domain. */
const hostname = 'https://laranex.vercel.app'

const siteTitle = 'Laranex'
const siteDescription = 'Laranex is an open source organization, built by developers for developers.'
const homeTitle = 'Laranex — Open source, built by developers for developers'
const ogImage = { url: `${hostname}/og-image.png`, width: '1200', height: '630', alt: 'Laranex — Built by developers for developers.' }

interface PackageMeta {
  slug: string
  name: string
  description: string
  github: string
  language: string
  license: string
}

/** Each package's front matter from `src/<slug>/index.md`, read once at config time. */
const packages = new Map<string, PackageMeta>(
  (() => {
    const srcDir = fileURLToPath(new URL('../src', import.meta.url))

    return readdirSync(srcDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(`${srcDir}/${entry.name}/index.md`))
      .map((entry) => ({ slug: entry.name, data: matter(readFileSync(`${srcDir}/${entry.name}/index.md`, 'utf8')).data }))
      .filter(({ data }) => data.name)
      .map(({ slug, data }): [string, PackageMeta] => [
        slug,
        {
          slug,
          name: data.name,
          description: data.description || '',
          github: data.github || '',
          language: programmingLanguage(installCommand(slug, data.install)),
          license: data.license || 'MIT',
        },
      ])
  })(),
)

function packageOf(relativePath: string): PackageMeta | undefined {
  return packages.get(relativePath.split('/')[0])
}

/** The absolute, clean URL of a page: `foo/index.md` → `/foo/`, `foo/bar.md` → `/foo/bar`. */
function canonicalUrl(relativePath: string): string {
  return `${hostname}/${relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')}`
}

function jsonLd(data: Record<string, unknown>): HeadConfig {
  return ['script', { type: 'application/ld+json' }, JSON.stringify(data).replace(/</g, '\\u003c')]
}

const organization = {
  '@type': 'Organization',
  '@id': `${hostname}/#organization`,
  name: siteTitle,
  url: `${hostname}/`,
  logo: `${hostname}/logo.svg`,
  sameAs: ['https://github.com/laranex'],
}

function structuredData(pageData: PageData, url: string): HeadConfig[] {
  if (pageData.relativePath === 'index.md') {
    return [
      jsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': `${hostname}/#website`, name: siteTitle, url: `${hostname}/`, description: siteDescription, publisher: { '@id': organization['@id'] } },
          organization,
        ],
      }),
    ]
  }

  const pkg = packageOf(pageData.relativePath)

  if (!pkg) {
    return []
  }

  const introduction = `${hostname}/${pkg.slug}/introduction`
  const crumbs = [
    { name: siteTitle, item: `${hostname}/` },
    { name: pkg.name, item: introduction },
    ...(url === introduction ? [] : [{ name: pageData.title, item: url }]),
  ]

  return [
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: pkg.name,
      description: pkg.description,
      url: introduction,
      codeRepository: pkg.github,
      programmingLanguage: pkg.language,
      license: `https://spdx.org/licenses/${pkg.license}.html`,
      author: organization,
    }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })),
    }),
  ]
}

export default defineConfig({
  title: siteTitle,
  titleTemplate: `:title — ${siteTitle}`,
  description: siteDescription,
  base: '/',
  cleanUrls: true,
  lastUpdated: true,
  srcDir: 'src',

  sitemap: {
    hostname,
    // Package `index.md` pages only carry front matter; Vercel redirects them to the introduction.
    transformItems: (items) => items.filter(({ url }) => !packages.has(url.replace(/\/$/, ''))),
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#18b69b' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap' }],
    ['meta', { property: 'og:site_name', content: siteTitle }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: ogImage.url }],
    ['meta', { property: 'og:image:width', content: ogImage.width }],
    ['meta', { property: 'og:image:height', content: ogImage.height }],
    ['meta', { property: 'og:image:alt', content: ogImage.alt }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: ogImage.url }],
  ],

  /**
   * Package pages read "<Page> — <Package> — Laranex" and fall back to the package's own description.
   */
  transformPageData(pageData) {
    const pkg = packageOf(pageData.relativePath)

    if (!pkg) {
      return
    }

    pageData.titleTemplate = `:title — ${pkg.name} — ${siteTitle}`

    if (!pageData.frontmatter.description) {
      pageData.description = pkg.description
    }
  },

  transformHead({ pageData, title, description }) {
    const url = canonicalUrl(pageData.relativePath)
    const pageTitle = pageData.relativePath === 'index.md' ? homeTitle : title
    const pageDescription = description || siteDescription

    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: pageTitle }],
      ['meta', { property: 'og:description', content: pageDescription }],
      ['meta', { name: 'twitter:title', content: pageTitle }],
      ['meta', { name: 'twitter:description', content: pageDescription }],
      ...structuredData(pageData, url),
    ]
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
            { text: 'Testing',            link: '/laravel-myanmar-payments/testing' },
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
