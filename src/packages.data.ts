import { createContentLoader } from 'vitepress'
import packageCategories from './packages.categories.json'

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
}

export interface PackageCategory {
  slug: string
  name: string
  packages: PackageData[]
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
        return {
          slug,
          name: frontmatter.name as string,
          description: (frontmatter.description as string) || '',
          requirements: (frontmatter.requirements as string[]) || [],
          github: (frontmatter.github as string) || '',
          docsUrl: `/${slug}/introduction.html`,
          install: (frontmatter.install as string) || `composer require laranex/${slug}`,
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
