const RATE_API_URL = 'https://ve.dolarapi.com/v1/cotizaciones'

export function normalizeCotizaciones(data) {
  if (!Array.isArray(data)) return null
  const eur = data.find((c) => c.moneda === 'EUR' && (!c.fuente || c.fuente === 'oficial'))
    || data.find((c) => c.moneda === 'EUR')
  if (!eur?.promedio) return null
  return {
    rate: parseFloat(eur.promedio),
    source: eur.fuente || 'oficial',
    updatedAt: eur.fechaActualizacion || new Date().toISOString(),
  }
}

/**
 * Fetches the BCV euro rate (Bs per USD, "tasa euro") for bolívar conversions.
 * Returns { rate, source, updatedAt } or throws.
 */
export async function fetchEuroRate() {
  const res = await fetch(RATE_API_URL, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`DolarAPI respondió ${res.status}`)
  const data = await res.json()
  const normalized = normalizeCotizaciones(data)
  if (!normalized) throw new Error('No se encontró la tasa del euro')
  return normalized
}

export function formatRate(rate) {
  const value = parseFloat(rate) || 0
  return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function usdToBs(usd, rate) {
  const value = parseFloat(usd) || 0
  const r = parseFloat(rate) || 0
  if (r <= 0) return null
  return value * r
}

export function bsToUsd(bs, rate) {
  const value = parseFloat(bs) || 0
  const r = parseFloat(rate) || 0
  if (r <= 0) return null
  return value / r
}

export function formatBs(value) {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return '—'
  return `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Rounds UP a USD amount to its Bs equivalent with 2 decimals, so the
 * suggested figure is always collectable exactly ("cobrable hacia arriba")
 */
export function bsCeilFromUsd(usd, rate) {
  const bs = usdToBs(usd, rate)
  if (bs === null) return null
  return Math.ceil(bs * 100) / 100
}
