import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

  const openSession = async (openingAmount) => {
    if (!userId) throw new Error('No hay usuario autenticado')
    const { data, error: supaError } = await supabase
      .from('cash_sessions')
      .insert([{
        user_id: userId,
        status: 'open',
        opening_amount: parseFloat(openingAmount) || 0,
      }])
      .select()
      .single()

    if (supaError) throw supaError
    setSession(data)
    return data
  }

  const closeSession = async (closingAmount) => {
    if (!session) throw new Error('No hay caja abierta')
    const expectedCashAmount = await getExpectedCashAmount(session.id)
    const { data, error: supaError } = await supabase
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_amount: parseFloat(closingAmount) || 0,
        expected_amount: expectedCashAmount,
      })
      .eq('id', session.id)
      .select()
      .single()

    if (supaError) throw supaError
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
  }
}

export async function getExpectedAmount(sessionId) {
  const { data, error } = await supabase
    .from('movements')
    .select('total_amount')
    .eq('cash_session_id', sessionId)
    .eq('status', 'pagado')
    .neq('movement_type', 'devolucion')

  if (error) throw error
  return (data || []).reduce((sum, m) => sum + (m.total_amount || 0), 0)
}

export async function getExpectedCashAmount(sessionId) {
  const { data: movements, error: movError } = await supabase
    .from('movements')
    .select('id')
    .eq('cash_session_id', sessionId)
    .eq('status', 'pagado')
    .neq('movement_type', 'devolucion')

  if (movError) throw movError
  if (!movements?.length) return 0

  const movementIds = movements.map(m => m.id)
  const { data: payments, error: payError } = await supabase
    .from('movement_payments')
    .select('amount')
    .in('movement_id', movementIds)
    .eq('method', 'efectivo')

  if (payError) throw payError
  return (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
}

export async function getSessionTotalsByMethod(sessionId) {
  const { data, error } = await supabase
    .from('movements')
    .select('payment_method, total_amount')
    .eq('cash_session_id', sessionId)
    .eq('status', 'pagado')

  if (error) throw error

  const totals = {}
  ;(data || []).forEach(m => {
    totals[m.payment_method] = (totals[m.payment_method] || 0) + (m.total_amount || 0)
  })
  return totals
}
