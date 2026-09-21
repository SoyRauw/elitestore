import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { drawerFromLedger } from '../lib/bills'

export function useCashSession(userId) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: supaError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (supaError) throw supaError
      setSession(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const openSession = async (openingAmount, exchangeRate, openingBills) => {
    if (!userId) throw new Error('No hay usuario autenticado')
    const { data, error: supaError } = await supabase
      .from('cash_sessions')
      .insert([{
        user_id: userId,
        status: 'open',
        opening_amount: parseFloat(openingAmount) || 0,
        exchange_rate: exchangeRate ? parseFloat(exchangeRate) : null,
      }])
      .select()
      .single()

    if (supaError) throw supaError

    // Register opening bills in the ledger
    if (openingBills) {
      await insertBillMovements(data.id, 'apertura', openingBills)
    }

    setSession(data)
    return data
  }

  // Refreshes the euro rate (Bs/$) of the open cash session
  const updateSessionRate = async (rate) => {
    if (!session) throw new Error('No hay caja abierta')
    const { data, error: supaError } = await supabase
      .from('cash_sessions')
      .update({ exchange_rate: parseFloat(rate) })
      .eq('id', session.id)
      .select()
      .single()
    if (supaError) throw supaError
    setSession(data)
    return data
  }

  const closeSession = async (closingAmount, closingBs, countedBills) => {
    if (!session) throw new Error('No hay caja abierta')
    const expectedCashAmount = await getExpectedCashUsdAmount(session.id)
    const expectedBs = await getExpectedCashBs(session.id)
    const { data, error: supaError } = await supabase
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_amount: parseFloat(closingAmount) || 0,
        closing_bs: closingBs ? parseFloat(closingBs) : null,
        expected_amount: (session.opening_amount || 0) + expectedCashAmount,
        expected_bs: expectedBs > 0 ? expectedBs : null,
      })
      .eq('id', session.id)
      .select()
      .single()

    if (supaError) throw supaError

    if (countedBills) {
      await insertBillMovements(session.id, 'cierre', countedBills)
    }

    setSession(null)
    return data
  }

  return {
    session,
    loading,
    error,
    refresh: fetchSession,
    openSession,
    closeSession,
    updateSessionRate,
  }
}

/** Same-session sales + apartado payments (movement_type 'abono'), not returns */
async function getSessionMovementIds(sessionId) {
  const { data, error } = await supabase
    .from('movements')
    .select('id')
    .eq('cash_session_id', sessionId)
    .eq('status', 'pagado')
    .in('movement_type', ['venta', 'abono'])

  if (error) throw error
  return (data || []).map(m => m.id)
}

/**
 * All payment inflows of a session:
 *  a) payments of movements tied to this session (legacy sales)
 *  b) payments carrying cash_session_id (new sales + apartado abonos)
 * Deduplicated by id.
 */
async function getSessionPayments(sessionId) {
  const movementIds = await getSessionMovementIds(sessionId)
  let byMovement = []
  if (movementIds.length) {
    const { data, error } = await supabase
      .from('movement_payments')
      .select('id, method, amount, bs_amount, vuelto_bs')
      .in('movement_id', movementIds)
    if (error) throw error
    byMovement = data || []
  }

  const { data: bySessionData, error: bySessionError } = await supabase
    .from('movement_payments')
    .select('id, method, amount, bs_amount, vuelto_bs')
    .eq('cash_session_id', sessionId)
  if (bySessionError) throw bySessionError
  const bySession = bySessionData || []

  const mergedMap = new Map()
  for (const p of [...byMovement, ...bySession]) {
    mergedMap.set(p.id, p)
  }
  return [...mergedMap.values()]
}

/** Cash (USD drawer, Bs converted) received during the session */
export async function getExpectedCashAmount(sessionId) {
  const payments = await getSessionPayments(sessionId)
  return payments
    .filter((p) => p.method === 'efectivo' || p.method === 'efectivo_bs')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
}

/** USD (dollar drawer) cash received during the session, NET of bills given as change */
export async function getExpectedCashUsdAmount(sessionId) {
  const payments = await getSessionPayments(sessionId)
  const gross = payments
    .filter((p) => p.method === 'efectivo')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

  // Subtract the bills handed out as change (from the bill ledger)
  const { data: changeRows, error: changeError } = await supabase
    .from('cash_bill_movements')
    .select('denomination, quantity')
    .eq('session_id', sessionId)
    .eq('type', 'vuelto')
  if (changeError) throw changeError
  const changeBillsUsd = (changeRows || []).reduce(
    (sum, r) => sum + (parseFloat(r.denomination) || 0) * (parseInt(r.quantity, 10) || 0),
    0
  )

  return gross - changeBillsUsd
}

/** Native bolívares (Bs drawer) received during the session,
 *  NET of bolívars handed out as change (vuelto_bs) */
export async function getExpectedCashBs(sessionId) {
  const movementIds = await getSessionMovementIds(sessionId)

  let received = 0
  let vueltoBs = 0

  if (movementIds.length) {
    const { data: payments, error } = await supabase
      .from('movement_payments')
      .select('method, amount, bs_amount, vuelto_bs')
      .in('movement_id', movementIds)
    if (error) throw error
    for (const p of payments || []) {
      if (p.method === 'efectivo_bs') received += parseFloat(p.amount) || 0
      vueltoBs += parseFloat(p.vuelto_bs) || 0
    }
  }

  return received - vueltoBs
}

export async function getSessionTotalsByMethod(sessionId) {
  const { data, error } = await supabase
    .from('movements')
    .select('payment_method, total_amount')
    .eq('cash_session_id', sessionId)
    .eq('status', 'pagado')
    .in('movement_type', ['venta', 'abono'])

  if (error) throw error

  const totals = {}
  ;(data || []).forEach(m => {
    totals[m.payment_method] = (totals[m.payment_method] || 0) + (m.total_amount || 0)
  })
  return totals
}

/** Inserts one ledger row per denomination with quantity > 0 */
export async function insertBillMovements(sessionId, type, counts, { movementId = null, note = null } = {}) {
  const rows = Object.entries(counts || {})
    .filter(([, qty]) => parseInt(qty, 10) > 0)
    .map(([denom, qty]) => ({
      session_id: sessionId,
      movement_id: movementId,
      type,
      denomination: parseFloat(denom),
      quantity: parseInt(qty, 10),
      note,
    }))
  if (rows.length === 0) return
  const { error } = await supabase.from('cash_bill_movements').insert(rows)
  if (error) throw error
}

/** Full ledger of a session (apertura, venta, vuelto, ajuste, cierre) */
export async function fetchSessionBillLedger(sessionId) {
  const { data, error } = await supabase
    .from('cash_bill_movements')
    .select('*')
    .eq('session_id', sessionId)
  if (error) throw error
  return data || []
}

/** Current drawer (excluding cierre) for an open session */
export async function fetchSessionDrawer(sessionId) {
  const ledger = await fetchSessionBillLedger(sessionId)
  return drawerFromLedger(ledger)
}

/** Closing counts from the last closed session (to carry over the drawer) */
export async function fetchLastCloseBills() {
  const { data: last, error: lastError } = await supabase
    .from('cash_sessions')
    .select('id')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError) throw lastError
  if (!last) return null

  const { data, error } = await supabase
    .from('cash_bill_movements')
    .select('*')
    .eq('session_id', last.id)
    .eq('type', 'cierre')
  if (error) throw error
  const drawer = drawerFromLedger(data || [], { includeCierre: true })
  return { sessionId: last.id, drawer }
}
