/**
 * Cash drawer bill tracking (USD bills).
 * Denominations: 100, 50, 20, 10, 5, 2, 1
 */

export const BILL_DENOMINATIONS = [100, 50, 20, 10, 5, 2, 1]

export function emptyBillCounts() {
  const counts = {}
  for (const denom of BILL_DENOMINATIONS) counts[denom] = 0
  return counts
}

/**
 * Aggregates a cash_bill_movements ledger into a per-denomination drawer count.
 * apertura + venta + ajuste add up; vuelto subtracts.
 * cierre rows are only included when requested (final count).
 */
export function drawerFromLedger(rows, { includeCierre = false } = {}) {
  const drawer = emptyBillCounts()
  for (const row of rows || []) {
    const denom = parseFloat(row.denomination)
    const qty = parseInt(row.quantity, 10) || 0
    switch (row.type) {
      case 'apertura':
      case 'venta':
      case 'ajuste':
        drawer[denom] = (drawer[denom] || 0) + qty
        break
      case 'vuelto':
        drawer[denom] = (drawer[denom] || 0) - qty
        break
      case 'cierre':
        if (includeCierre) drawer[denom] = (drawer[denom] || 0) + qty
        break
      default:
        break
    }
  }
  return drawer
}

export function sumBills(counts) {
  return BILL_DENOMINATIONS.reduce(
    (sum, denom) => sum + (parseInt(counts[denom], 10) || 0) * denom,
    0
  )
}

/**
 * Greedy change proposal against the current drawer.
 * Returns { ok, missing, proposal } where proposal = { denom: qty, ... }
 */
export function proposeChange(changeAmount, drawer) {
  let remaining = Math.round((parseFloat(changeAmount) || 0) * 100) / 100
  const proposal = emptyBillCounts()
  const missing = emptyBillCounts()

  for (const denom of BILL_DENOMINATIONS) {
    const available = parseInt(drawer[denom], 10) || 0
    const needed = Math.min(Math.floor(remaining / denom + 1e-9), available)
    if (needed > 0) {
      proposal[denom] = needed
      remaining = Math.round((remaining - needed * denom) * 100) / 100
    }
  }

  const ok = remaining <= 0.009
  if (!ok) {
    for (const denom of BILL_DENOMINATIONS) {
      const needed = Math.min(Math.floor(remaining / denom + 1e-9), 999)
      if (needed > 0) {
        missing[denom] = (missing[denom] || 0) + needed
        remaining = Math.round((remaining - needed * denom) * 100) / 100
      }
    }
  }

  return { ok, missing, proposal }
}

/** Same as proposeChange but unlimited bills (only to suggest a mix for a given amount) */
export function proposeChangeUnlimited(changeAmount) {
  let remaining = Math.round((parseFloat(changeAmount) || 0) * 100) / 100
  const proposal = emptyBillCounts()
  for (const denom of BILL_DENOMINATIONS) {
    const needed = Math.floor(remaining / denom + 1e-9)
    if (needed > 0) {
      proposal[denom] = needed
      remaining = Math.round((remaining - needed * denom) * 100) / 100
    }
  }
  return { ok: remaining <= 0.009, proposal }
}

export function formatBillsList(counts) {
  return BILL_DENOMINATIONS
    .filter((denom) => parseInt(counts[denom], 10) > 0)
    .map((denom) => `${counts[denom]}×$${denom}`)
    .join(', ')
}
