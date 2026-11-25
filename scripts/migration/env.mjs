import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnv(file = '.env') {
  const path = resolve(process.cwd(), file)
  const env = {}
  let text = ''
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return env
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }

  return env
}

export function getMigrationConfig() {
  const prodEnv = loadEnv('.env')
  const devEnv = loadEnv('.env.development.local')

  const prodUrl = prodEnv.VITE_SUPABASE_URL
  const prodKey = devEnv.SUPABASE_SERVICE_ROLE_KEY
  const usaUrl = devEnv.USA_SUPABASE_URL
  const usaKey = devEnv.USA_SUPABASE_SERVICE_ROLE_KEY
  const stagingUrl = devEnv.VITE_SUPABASE_URL
  const stagingKey = devEnv.STAGING_SUPABASE_SERVICE_ROLE_KEY

  if (!prodUrl || !prodKey) {
    throw new Error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para Elite producción')
  }
  if (!usaUrl || !usaKey) {
    throw new Error('Faltan USA_SUPABASE_URL / USA_SUPABASE_SERVICE_ROLE_KEY')
  }

  return {
    prod: { url: prodUrl, key: prodKey },
    usa: { url: usaUrl, key: usaKey },
    staging: { url: stagingUrl, key: stagingKey },
  }
}
