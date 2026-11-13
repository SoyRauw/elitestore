import fs from 'node:fs'
import path from 'node:path'
import { preview } from 'vite'
import { chromium } from 'playwright-core'

const ROOT = process.cwd()
const DIST = path.join(ROOT, 'dist')
const SITE_URL = 'https://elitestoremcbo.web.app'
const PREVIEW_PORT = 4173
const CONCURRENCY = 4

function readEnv(file) {
  const values = {}
  if (!fs.existsSync(file)) return values
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return values
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function writeDist(relativePath, content) {
  const fullPath = path.join(DIST, relativePath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf8')
}

async function fetchProducts() {
  const env = readEnv(path.join(ROOT, '.env'))
  const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn('  Sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: se omiten las páginas de producto.')
    return []
  }

  const response = await fetch(
    `${url}/rest/v1/products?select=id,name&active=eq.true&order=created_at.desc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`No se pudieron leer los productos (${response.status}): ${body.slice(0, 200)}`)
  }
  const products = await response.json()
  return Array.isArray(products) ? products : []
}

function buildSitemap(products) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${SITE_URL}/catalog`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${SITE_URL}/nosotros`, priority: '0.5', changefreq: 'monthly' },
    ...products.map((product) => ({
      loc: `${SITE_URL}/product/${product.id}`,
      priority: '0.8',
      changefreq: 'weekly',
    })),
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>
`
}

async function preparePage(page) {
  await page.route('**/*', (route) => {
    const request = route.request()
    const type = request.resourceType()
    if (['image', 'font', 'media'].includes(type)) return route.abort()
    const url = request.url()
    if (/google-analytics|googletagmanager|firebaseinstallations|firebase-analytics|doubleclick/i.test(url)) {
      return route.abort()
    }
    return route.continue()
  })
}

async function waitForPage(page, route) {
  await page.goto(`http://127.0.0.1:${PREVIEW_PORT}${route.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForFunction(
    () => document.querySelector('#root')?.children.length > 0,
    { timeout: 20000 }
  )

  if (route.kind === 'product') {
    await page.waitForSelector('h1', { timeout: 20000 })
    await page.waitForFunction(
      (name) => document.title.includes(name),
      route.productName,
      { timeout: 20000 }
    ).catch(() => {})
  } else if (route.kind === 'catalog') {
    await page.waitForSelector('h1', { timeout: 20000 })
    await page.waitForSelector('a[href^="/product/"]', { timeout: 10000 }).catch(() => {})
  } else {
    await page.waitForSelector('h1', { timeout: 20000 })
  }

  await page.waitForTimeout(700)
  await page.addStyleTag({
    content: '#root [style*="opacity: 0"], #root [style*="opacity:0"] { opacity: 1 !important; }',
  })
  await page.waitForTimeout(120)
}

async function main() {
  const shellPath = path.join(DIST, 'index.html')
  const spaPath = path.join(DIST, 'spa.html')
  if (!fs.existsSync(shellPath)) {
    throw new Error('No existe dist/index.html. Ejecuta primero npm run build.')
  }
  // Si se vuelve a ejecutar el prerender sin rebuild, index.html ya es el home:
  // el shell original queda guardado en spa.html.
  const shellHtml = fs.existsSync(spaPath)
    ? fs.readFileSync(spaPath, 'utf8')
    : fs.readFileSync(shellPath, 'utf8')

  console.log('Leyendo productos activos...')
  const products = await fetchProducts()
  console.log(`  ${products.length} productos activos`)

  const routes = [
    { path: '/', file: 'index.html', kind: 'home' },
    { path: '/catalog', file: 'catalog.html', kind: 'catalog' },
    { path: '/nosotros', file: 'nosotros.html', kind: 'static' },
    ...products.map((product) => ({
      path: `/product/${product.id}`,
      file: `product/${product.id}.html`,
      kind: 'product',
      productName: product.name,
    })),
  ]

  console.log('Levantando preview local...')
  const server = await preview({
    root: ROOT,
    logLevel: 'warn',
    preview: { port: PREVIEW_PORT, strictPort: true, host: '127.0.0.1' },
  })

  let browser
  try {
    try {
      browser = await chromium.launch({ channel: process.env.PRERENDER_CHANNEL || 'msedge', headless: true })
    } catch {
      browser = await chromium.launch({ channel: 'chrome', headless: true })
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    })

    const failures = []
    const staticFailures = []
    let nextIndex = 0
    let completed = 0

    async function worker() {
      const page = await context.newPage()
      await preparePage(page)
      while (true) {
        const index = nextIndex++
        if (index >= routes.length) break
        const route = routes[index]
        try {
          await waitForPage(page, route)
          const html = await page.content()
          writeDist(route.file, html.startsWith('<!DOCTYPE') ? html : `<!DOCTYPE html>\n${html}`)
          completed += 1
          if (completed % 25 === 0 || completed === routes.length) {
            console.log(`  ${completed}/${routes.length} páginas prerenderizadas`)
          }
        } catch (error) {
          failures.push({ route: route.path, error: error.message })
          if (!['product'].includes(route.kind)) staticFailures.push(route.path)
          console.warn(`  Falló ${route.path}: ${error.message}`)
        }
      }
      await page.close()
    }

    console.log(`Prerenderizando ${routes.length} páginas con ${CONCURRENCY} pestañas...`)
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    writeDist('sitemap.xml', buildSitemap(products))
    writeDist('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
    writeDist(
      'spa.html',
      shellHtml.includes('name="robots"')
        ? shellHtml
        : shellHtml.replace(
            '</head>',
            '  <meta name="robots" content="noindex, nofollow" />\n  </head>'
          )
    )

    if (staticFailures.length > 0) {
      throw new Error(`Fallaron páginas principales: ${staticFailures.join(', ')}`)
    }

    console.log(`\nListo: ${completed - failures.length} páginas OK, ${failures.length} con error.`)
    console.log(`Sitemap: ${products.length + 3} URLs`)
    if (failures.length > 0) {
      console.log('Productos que quedaron sin prerender (se servirán como SPA):')
      failures.slice(0, 10).forEach((failure) => console.log(`  - ${failure.route}: ${failure.error}`))
    }
  } finally {
    await browser?.close().catch(() => {})
    await server.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error(`\nPrerender abortado: ${error.message}`)
  process.exitCode = 1
})
