import { createContentLoader } from 'vitepress'

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
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})
