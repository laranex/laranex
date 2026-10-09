// Package helpers shared by the site config and the home page data loader.

/**
 * The install command shown for a package; PHP packages default to Composer.
 */
export function installCommand(slug: string, install?: unknown): string {
  return (install as string) || `composer require laranex/${slug}`
}

/**
 * The language a package is written in, picked by its registry like the badges in src/packages.data.ts.
 */
export function programmingLanguage(install: string): 'Go' | 'TypeScript' | 'Python' | 'PHP' {
  const tool = install.split(' ')[0]

  return tool === 'go' ? 'Go' : tool === 'npm' ? 'TypeScript' : tool === 'pip' ? 'Python' : 'PHP'
}
