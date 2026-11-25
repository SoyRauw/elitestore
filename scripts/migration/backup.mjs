import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getMigrationConfig } from './env.mjs'

const PAGE_SIZE = 1000

function stamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

async function fetchJson(url, key, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${path} -> ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

async function listTables(url, key) {
  const spec = await fetchJson(url, key, '')
  const definitions = spec?.definitions || spec?.components?.schemas || {}
  return Object.keys(definitions).sort()
}

async function fetchAll(url, key, table) {
  const rows = []
  let offset = 0
  while (true) {
    const query = new URLSearchParams({
      select: '*',
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    let data
    try {
      data = await fetchJson(url, key, `${table}?${query.toString()}&order=id.asc`)
    } catch (error) {
      if (String(error.message).includes('order=id')) {
        data = await fetchJson(url, key, `${table}?${query.toString()}`)
      } else {
        throw error
      }
    }
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

async function backupDatabase(name, url, key, baseDir) {
  const dir = resolve(baseDir, name)
  await mkdir(dir, { recursive: true })
  const tables = await listTables(url, key)
  const manifest = { name, url, generatedAt: new Date().toISOString(), tables: {} }

  console.log(`\n=== Backup ${name} (${tables.length} tablas) ===`)
  for (const table of tables) {
    process.stdout.write(`  ${table}... `)
    const rows = await fetchAll(url, key, table)
    await writeFile(resolve(dir, `${table}.json`), JSON.stringify(rows, null, 2), 'utf8')
    manifest.tables[table] = rows.length
    console.log(`${rows.length} filas`)
  }

  await writeFile(resolve(dir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return manifest
}

async function main() {
  const { prod, usa } = getMigrationConfig()
  const root = resolve(process.cwd(), 'migration-backups', stamp())
  await mkdir(root, { recursive: true })

  const eliteManifest = await backupDatabase('elite', prod.url, prod.key, root)
  const usaManifest = await backupDatabase('usa', usa.url, usa.key, root)

  await writeFile(
    resolve(root, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        root,
        elite: eliteManifest,
        usa: usaManifest,
      },
      null,
      2
    ),
    'utf8'
  )

  console.log(`\nBackup completo en: ${root}`)
  console.log('Elite:', eliteManifest.tables)
  console.log('USA:', usaManifest.tables)
}

main().catch((error) => {
  console.error('\nERROR:', error.message)
  process.exit(1)
})
