import { createContentLoader } from 'vitepress'
import packageCategories from './packages.categories.json'
import { installCommand } from '../.vitepress/package-meta'

const placement = new Map<string, { category: number; rank: number }>(
  packageCategories.categories.flatMap(({ packages }, category) =>
    packages.map(({ slug }, rank) => [slug, { category, rank }] as const),
  ),
)

export interface PackageData {
  slug: string
  name: string
  description: string
  requirements: string[]
  github: string
  docsUrl: string
  install: string
  badges: PackageBadge[]
}

export interface PackageBadge {
  alt: string
  src: string
  href: string
}

export interface PackageCategory {
  slug: string
  name: string
  packages: PackageData[]
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * The same badges as each package's README, picked by its registry.
 */
function badges(install: string, github: string): PackageBadge[] {
  const repo = github.replace(/^https:\/\/github\.com\//, '')
  const tests: PackageBadge = {
    alt: 'Tests',
    src: `${github}/actions/workflows/tests.yml/badge.svg`,
    href: `${github}/actions/workflows/tests.yml`,
  }
  const license = `${github}/blob/HEAD/LICENSE.md`
  const [tool, , target = ''] = install.split(' ')

  if (tool === 'go') {
    const module = target.replace(/@.*$/, '')

    return [
      { alt: 'Go Reference', src: `https://pkg.go.dev/badge/${module}.svg`, href: `https://pkg.go.dev/${module}` },
      tests,
      { alt: 'License', src: `https://img.shields.io/github/license/${repo}.svg?style=flat-square`, href: license },
    ]
  }

  if (tool === 'npm') {
    const name = target.replace(/(.)@.*$/, '$1')

    return [
      { alt: 'npm', src: `https://img.shields.io/npm/v/${name}.svg?style=flat-square`, href: `https://www.npmjs.com/package/${name}` },
      tests,
      { alt: 'License', src: `https://img.shields.io/npm/l/${name}.svg?style=flat-square`, href: license },
    ]
  }

  return [
    { alt: 'Latest Version on Packagist', src: `https://img.shields.io/packagist/v/${target}.svg?style=flat-square`, href: `https://packagist.org/packages/${target}` },
    tests,
    { alt: 'Total Downloads', src: `https://img.shields.io/packagist/dt/${target}.svg?style=flat-square`, href: `https://packagist.org/packages/${target}` },
    { alt: 'License', src: `https://img.shields.io/packagist/l/${target}.svg?style=flat-square`, href: license },
  ]
}

declare const data: PackageCategory[]
export { data }

export default createContentLoader('*/index.md', {
  transform(raw): PackageCategory[] {
    const categories: PackageCategory[] = packageCategories.categories.map(({ name }) => ({ slug: slugify(name), name, packages: [] }))
    const other: PackageCategory = { slug: 'other', name: 'Other', packages: [] }

    raw
      .filter(({ frontmatter }) => frontmatter.name)
      .map(({ url, frontmatter }): PackageData => {
        const slug = url.replace(/^\//, '').replace(/\/$/, '')
        const github = (frontmatter.github as string) || ''
        const install = installCommand(slug, frontmatter.install)

        return {
          slug,
          name: frontmatter.name as string,
          description: (frontmatter.description as string) || '',
          requirements: (frontmatter.requirements as string[]) || [],
          github,
          docsUrl: `/${slug}/introduction`,
          install,
          badges: badges(install, github),
        }
      })
      .sort((a, b) => {
        const rankA = placement.get(a.slug)?.rank ?? Number.MAX_SAFE_INTEGER
        const rankB = placement.get(b.slug)?.rank ?? Number.MAX_SAFE_INTEGER

        return rankA - rankB || a.name.localeCompare(b.name)
      })
      .forEach((pkg) => {
        const category = placement.get(pkg.slug)?.category

        ;(category === undefined ? other : categories[category]).packages.push(pkg)
      })

    return [...categories, other].filter(({ packages }) => packages.length > 0)
  },
})
