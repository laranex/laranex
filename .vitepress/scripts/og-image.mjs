// Renders the Open Graph images (1200x630): the site card to src/public/og-image.png and one card per package
// to src/public/og/<slug>.png. Run with `npm run og-image` after changing the wordmark, the tagline or a
// package's name or description.
import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import sharp from 'sharp'

const srcDir = fileURLToPath(new URL('../../src', import.meta.url))
const publicDir = `${srcDir}/public`

const brand = '#18b69b'
const font = 'Geist, system-ui, -apple-system, Helvetica, Arial, sans-serif'

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Greedy word wrap by an estimated glyph width; good enough for a fixed card layout. */
function wrap(text, maxChars, maxLines) {
  const lines = []
  let line = ''

  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = (line + ' ' + word).trim()
    }
  }

  lines.push(line)

  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.:;]*\S*$/, '') + '…'
  }

  return lines
}

function frame(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0" r="0.9">
      <stop offset="0" stop-color="${brand}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="${brand}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#e6eff2" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="gridMask"><rect width="1200" height="630" fill="url(#fade)"/></mask>
  </defs>
  <rect width="1200" height="630" fill="#0a1014"/>
  <rect width="1200" height="630" fill="url(#grid)" mask="url(#gridMask)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  ${content}
</svg>`
}

async function render(svg, output) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(output)
  console.log(`Wrote ${output}`)
}

await render(
  frame(`
  <text x="600" y="250" text-anchor="middle" font-family="${font}" font-size="64" font-weight="700" fill="${brand}" letter-spacing="-1">Laranex</text>
  <text x="600" y="358" text-anchor="middle" font-family="${font}" font-size="76" font-weight="700" fill="#e6eff2" letter-spacing="-3">Built by developers,</text>
  <text x="600" y="444" text-anchor="middle" font-family="${font}" font-size="76" font-weight="700" fill="${brand}" letter-spacing="-3">for developers.</text>
  <text x="600" y="530" text-anchor="middle" font-family="${font}" font-size="26" font-weight="400" fill="#98abb4">Open source · Tested · Documented · Made for humans and AI agents</text>`),
  `${publicDir}/og-image.png`,
)

mkdirSync(`${publicDir}/og`, { recursive: true })

const packages = readdirSync(srcDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`${srcDir}/${entry.name}/index.md`))
  .map((entry) => ({ slug: entry.name, data: matter(readFileSync(`${srcDir}/${entry.name}/index.md`, 'utf8')).data }))
  .filter(({ data }) => data.name)

for (const { slug, data } of packages) {
  const title = wrap(data.name, 24, 2)
  const description = wrap(data.description || '', 52, 3)
  const titleY = 250
  const descriptionY = titleY + (title.length - 1) * 84 + 76

  await render(
    frame(`
  <text x="96" y="132" font-family="${font}" font-size="40" font-weight="700" fill="${brand}" letter-spacing="-0.5">Laranex</text>
  ${title.map((line, i) => `<text x="96" y="${titleY + i * 84}" font-family="${font}" font-size="76" font-weight="700" fill="#e6eff2" letter-spacing="-3">${escape(line)}</text>`).join('\n  ')}
  ${description.map((line, i) => `<text x="96" y="${descriptionY + i * 42}" font-family="${font}" font-size="30" font-weight="400" fill="#98abb4">${escape(line)}</text>`).join('\n  ')}
  <rect x="96" y="546" width="64" height="6" rx="3" fill="${brand}"/>
  <text x="1104" y="556" text-anchor="end" font-family="${font}" font-size="24" font-weight="500" fill="#98abb4">laranex.vercel.app/${escape(slug)}</text>`),
    `${publicDir}/og/${slug}.png`,
  )
}
