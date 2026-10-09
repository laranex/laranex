// Renders the site-wide Open Graph image (1200x630) to src/public/og-image.png.
// Run with `npm run og-image` after changing the wordmark or tagline.
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const output = fileURLToPath(new URL('../../src/public/og-image.png', import.meta.url))

const brand = '#18b69b'
const font = 'system-ui, -apple-system, Helvetica, Arial, sans-serif'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.85" cy="0.1" r="0.9">
      <stop offset="0" stop-color="${brand}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${brand}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0d1412"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="96" y="214" width="12" height="202" rx="6" fill="${brand}"/>
  <text x="140" y="318" font-family="${font}" font-size="132" font-weight="700" fill="${brand}" letter-spacing="-2">Laranex</text>
  <text x="144" y="398" font-family="${font}" font-size="46" font-weight="500" fill="#e6efec">Built by developers for developers.</text>
</svg>`

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(output)

console.log(`Wrote ${output}`)
