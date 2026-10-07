import { createContentLoader } from 'vitepress'
import packageOrder from './packages.order.json'

const rank = new Map<string, number>(packageOrder.order.map(({ slug }, index) => [slug, index]))

export interface PackageData {
  slug: string
  name: string
  description: string
  requirements: string[]
  github: string
  docsUrl: string
}

declare const data: PackageData[]
export { data }

export default createContentLoader('*/index.md', {
  transform(raw) {
    return raw
      .filter(({ frontmatter }) => frontmatter.name)
      .map(({ url, frontmatter }) => {
        const slug = url.replace(/^\//, '').replace(/\/$/, '')
        return {
          slug,
          name: frontmatter.name as string,
          description: (frontmatter.description as string) || '',
          requirements: (frontmatter.requirements as string[]) || [],
          github: (frontmatter.github as string) || '',
          docsUrl: `/${slug}/introduction.html`,
        }
      })
      .sort((a, b) => {
        const rankA = rank.get(a.slug) ?? Number.MAX_SAFE_INTEGER
        const rankB = rank.get(b.slug) ?? Number.MAX_SAFE_INTEGER

        return rankA - rankB || a.name.localeCompare(b.name)
      })
  },
})
