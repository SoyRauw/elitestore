import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useCashSession, getExpectedCashUsdAmount, getExpectedCashBs, getSessionTotalsByMethod, fetchSessionBillLedger, fetchLastCloseBills } from '../../hooks/useCashSession'
import { fetchEuroRate, formatRate } from '../../lib/rate'
import { BILL_DENOMINATIONS, emptyBillCounts, drawerFromLedger, sumBills, formatBillsList } from '../../lib/bills'
import { DollarSign, Lock, Unlock, AlertCircle, Loader2, Coins, ArrowDownUp } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import * as V from '../../lib/validation'
import styles from './AdminCash.module.css'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo $',
  efectivo_bs: 'Efectivo Bs',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  binance: 'Binance',
  rapikom: 'Rapikom',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  pendiente: 'Pendiente',
  multiple: 'Múltiple',
}

export default function AdminCash() {
  const { user } = useAuth()
  const { session, loading, error, refresh, openSession, closeSession } = useCashSession(user?.id)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [exchangeRate, setExchangeRate] = useState('')
  const [openingBills, setOpeningBills] = useState(emptyBillCounts())
  const [closeBs, setCloseBs] = useState('')
  const [closeBills, setCloseBills] = useState(null)
  const [byMethod, setByMethod] = useState({})
  const [expectedCashUsd, setExpectedCashUsd] = useState(0)
  const [expectedCashBs, setExpectedCashBs] = useState(0)
  const [sessionDrawer, setSessionDrawer] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmType, setConfirmType] = useState(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [lastCloseLoading, setLastCloseLoading] = useState(false)

  // Pre-fill the euro rate + suggest carrying over the last close's drawer
  useEffect(() => {
    if (session) return
    let cancelled = false
    const init = async () => {
      setLastCloseLoading(true)
      try {
        const last = await fetchLastCloseBills()
        if (!cancelled && last && Object.values(last.drawer).some((q) => q > 0)) {
          setOpeningBills(last.drawer)
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLastCloseLoading(false)
      }
    }
    const fetchInitialRate = async () => {
      try {
        const { rate } = await fetchEuroRate()
        if (!cancelled) setExchangeRate((prev) => prev || String(Math.round(rate * 100) / 100))
      } catch {
        /* manual entry fallback */
      }
    }
    init()
    fetchInitialRate()
    return () => { cancelled = true }
  }, [session])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory, session])

  const loadTotals = useCallback(async () => {
    const [usd, bs, methods, ledger] = await Promise.all([
      getExpectedCashUsdAmount(session.id),
      getExpectedCashBs(session.id),
      getSessionTotalsByMethod(session.id),
      fetchSessionBillLedger(session.id),
    ])
    setExpectedCashUsd(usd)
    setExpectedCashBs(bs)
    setByMethod(methods)
    setSessionDrawer(drawerFromLedger(ledger, { includeCierre: false }))
  }, [session])

  useEffect(() => {
    if (!session) return
    loadTotals()
  }, [loadTotals, session])

  const handleRefreshRate = async () => {
    setRateLoading(true)
    try {
      const { rate } = await fetchEuroRate()
      setExchangeRate(String(Math.round(rate * 100) / 100))
    } catch {
      /* keep editable value */
    } finally {
      setRateLoading(false)
    }
  }

  const handleCarryOver = () => {
    setLastCloseLoading(true)
    fetchLastCloseBills()
      .then((last) => { if (last) setOpeningBills(last.drawer) })
      .finally(() => setLastCloseLoading(false))
  }

  const openingTotal = sumBills(openingBills)
  const closeBillTotal = closeBills ? sumBills(closeBills) : 0

  const openErrors = useMemo(() => {
    const errs = {}
    errs.openAmount = V.number(openingTotal, 'El monto inicial', { min: 0 })
    errs.exchangeRate = V.number(exchangeRate, 'La tasa', { min: 0 })
    Object.keys(errs).forEach(k => { if (!errs[k]) delete errs[k] })
    return errs
  }, [openingTotal, exchangeRate])

  const closeErrors = useMemo(() => {
    const errs = {}
    errs.closeAmount = V.number(closeBillTotal, 'El efectivo contado', { min: 0 })
    errs.closeBs = V.number(closeBs, 'Los bolívares contados', { min: 0, allowEmpty: true })
    Object.keys(errs).forEach(k => { if (!errs[k]) delete errs[k] })
    return errs
  }, [closeBillTotal, closeBs])

  const hasOpenErrors = useMemo(() => Object.keys(openErrors).length > 0, [openErrors])
  const hasCloseErrors = useMemo(() => Object.keys(closeErrors).length > 0, [closeErrors])

  const bsToUsdAtSessionRate = expectedCashBs > 0 && session?.exchange_rate
    ? expectedCashBs / parseFloat(session.exchange_rate)
    : 0

  const expectedUsdDrawer = (session?.opening_amount || 0) + expectedCashUsd
  const expectedTotalUsd = expectedUsdDrawer + bsToUsdAtSessionRate
  const dollarDifference = closeBillTotal - expectedUsdDrawer
  const bsDifference = (parseFloat(closeBs) || 0) - expectedCashBs

  const handleOpen = (e) => {
    e.preventDefault()
    setFormError('')
    if (hasOpenErrors) return
    setConfirmType('open')
    setConfirmOpen(true)
  }

  const executeOpen = async () => {
    setSubmitting(true)
    setFormError('')
    try {
      await openSession(openingTotal, exchangeRate, openingBills)
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
      setConfirmType(null)
    }
  }

  const handleClose = (e) => {
    e.preventDefault()
    setFormError('')
    if (hasCloseErrors) return
    setConfirmType('close')
    setConfirmOpen(true)
  }

  const formatDiff = (value, symbol = '$') => {
    if (value === 0) return 'Cuadrado'
    if (value > 0) return `sobrante de ${symbol}${value.toFixed(2)}`
    return `faltante de ${symbol}${Math.abs(value).toFixed(2)}`
  }

  const executeClose = async () => {
    setSubmitting(true)
    setFormError('')
    try {
      await closeSession(closeBillTotal, closeBs, closeBills || emptyBillCounts())
      setCloseBs('')
      setCloseBills(null)
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
      setConfirmType(null)
    }
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Control de Caja</h1>
            <p className={styles.pageSubtitle}>Gestiona apertura y cierre de turno</p>
          </div>
        </div>

        {loading ? (
          <div className={styles.card}><Loader2 className="spin" /> Cargando...</div>
        ) : error ? (
          <div className={styles.card} style={{ color: '#dc2626' }}>
            <AlertCircle size={18} /> Error: {error}
            <button className="btn btn-outline" style={{ marginLeft: '1rem' }} onClick={refresh}>Reintentar</button>
          </div>
        ) : !session ? (
          <motion.div className={styles.card} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={styles.statusClosed}>
              <Lock size={20} /> Caja cerrada
            </div>
            <h2 className={styles.cardTitle} style={{ marginTop: '1rem' }}>Abrir caja</h2>

            <form className={styles.form} onSubmit={handleOpen} noValidate onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}>
              <div className={styles.billsOpenRow}>
                <div style={{ flex: 1, minWidth: 320 }}>
                  <label className={styles.billsLabel}>Billetes con los que abres la caja</label>
                  <div className={styles.billsGrid}>
                    {BILL_DENOMINATIONS.map((denom) => (
                      <div key={denom} className={styles.billTile}>
                        <div className={styles.billTileMini}>${denom}</div>
                        <div className={styles.billStepper}>
                          <button type="button" onClick={() => setOpeningBills({ ...openingBills, [denom]: Math.max(0, (openingBills[denom] || 0) - 1) })}>−</button>
                          <span>{openingBills[denom] || 0}</span>
                          <button type="button" onClick={() => setOpeningBills({ ...openingBills, [denom]: (openingBills[denom] || 0) + 1 })}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.billsActions}>
                    <span className={styles.billsTotal}>Total: ${openingTotal.toFixed(2)}</span>
                    <button type="button" className="btn btn-ghost" onClick={() => setOpeningBills(emptyBillCounts())}>Empezar en cero</button>
                    <button type="button" className="btn btn-outline" onClick={handleCarryOver} disabled={lastCloseLoading}>
                      {lastCloseLoading ? <Loader2 size={14} className="spin" /> : 'Traer cierre anterior'}
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className={styles.field}>
                    <label>Tasa Euro (Bs/$) del turno</label>
                    <div className={styles.rateField}>
                      <ArrowDownUp size={16} />
                      <input
                        className={`${styles.input} ${openErrors.exchangeRate ? styles.inputError : ''}`}
                        type="number"
                        step="0.01"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        placeholder="Ej: 977.68"
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleRefreshRate}
                        disabled={rateLoading}
                        title="Buscar la tasa euro actual"
                      >
                        {rateLoading ? <Loader2 size={14} className="spin" /> : 'Actualizar'}
                      </button>
                    </div>
                    {openErrors.exchangeRate ? (
                      <span className={styles.fieldError}>{openErrors.exchangeRate}</span>
                    ) : (
                      exchangeRate && <p className={styles.hint}>Tasa usada en el turno. Si el BCV cambia, actualízala con el botón.</p>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label>Monto inicial en caja (auto por billetes)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <DollarSign size={16} />
                      <input
                        className={styles.input}
                        type="number"
                        step="0.01"
                        value={openingTotal.toFixed(2)}
                        readOnly
                        style={{ background: '#f9fafb' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <button type="submit" className="btn btn-primary" disabled={submitting || hasOpenErrors}>
                  {submitting ? 'Abriendo...' : 'Abrir caja'}
                </button>
              </div>
              {formError && <p className={styles.error}>{formError}</p>}
            </form>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={styles.card}>
              <div className={styles.statusOpen}>
                <Unlock size={20} /> Caja abierta desde {new Date(session.opened_at).toLocaleString()}
                {session.exchange_rate && (
                  <button className={styles.rateBadge} title="Tasa euro del turno" type="button">
                    <ArrowDownUp size={12} /> {formatRate(session.exchange_rate)} Bs/$
                  </button>
                )}
              </div>

              <div className={styles.summaryGrid} style={{ marginTop: '1rem' }}>
                <div className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Monto inicial</p>
                  <p className={styles.summaryValue}>${session.opening_amount?.toFixed(2)}</p>
                </div>
                <div className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Efectivo $ recibido</p>
                  <p className={styles.summaryValue}>${expectedCashUsd.toFixed(2)}</p>
                </div>
                <div className={styles.summaryCard}>
                  <p className={styles.summaryLabel}><Coins size={14} /> Bs efectivo esperado</p>
                  <p className={styles.summaryValue}>Bs {expectedCashBs.toLocaleString('es-VE')}</p>
                  {bsToUsdAtSessionRate > 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#d4a017', margin: '0.15rem 0 0' }}>
                      ≈ ${bsToUsdAtSessionRate.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Esperado en caja ($)</p>
                  <p className={styles.summaryValue}>${expectedTotalUsd.toFixed(2)}</p>
                  {expectedCashBs > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-dark-soft)', margin: 0 }}>
                      $ drawer ${expectedUsdDrawer.toFixed(2)} + Bs drawer aparte
                    </p>
                  )}
                </div>
              </div>

              {sessionDrawer && (
                <>
                  <h3 className={styles.cardTitle}>Cajón de efectivo $ (en vivo)</h3>
                  <div className={styles.billsGrid}>
                    {BILL_DENOMINATIONS.map((denom) => {
                      const qty = sessionDrawer[denom] || 0
                      return (
                        <div key={denom} className={`${styles.billTile} ${qty < 0 ? styles.billTileDanger : ''}`}>
                          <div className={styles.billTileMini}>${denom}</div>
                          <div className={styles.billCount}>×{qty}</div>
                        </div>
                      )
                    })}
                    <div className={styles.drawerTotal}>
                      Total cajón: ${(BILL_DENOMINATIONS.reduce((s, d) => s + (sessionDrawer[d] || 0) * d, 0)).toFixed(2)}
                    </div>
                  </div>
                </>
              )}

              {Object.keys(byMethod).length > 0 && (
                <>
                  <h3 className={styles.cardTitle}>Ventas por método de pago</h3>
                  <div className={styles.summaryGrid}>
                    {Object.entries(byMethod).map(([method, amount]) => (
                      <div key={method} className={styles.summaryCard}>
                        <p className={styles.summaryLabel}>{PAYMENT_METHODS[method] || method}</p>
                        <p className={styles.summaryValue}>${amount.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <h3 className={styles.cardTitle}>Cerrar caja</h3>
              <form className={styles.form} onSubmit={handleClose} noValidate onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}>
                <div className={styles.field}>
                  <label>Conteo final de billetes $ (esperado según cajón)</label>
                  <div className={styles.billsGrid}>
                    {BILL_DENOMINATIONS.map((denom) => {
                      const expectedQty = sessionDrawer?.[denom] || 0
                      const counted = closeBills?.[denom] || 0
                      const mismatch = counted !== expectedQty
                      return (
                        <div key={denom} className={`${styles.billTile} ${mismatch ? styles.billTileMismatch : ''}`}>
                          <div className={styles.billTileMini}>${denom}</div>
                          <div className={styles.billStepper}>
                            <button type="button" onClick={() => setCloseBills({ ...(closeBills || emptyBillCounts()), [denom]: Math.max(0, counted - 1) })}>−</button>
                            <span>{counted}</span>
                            <button type="button" onClick={() => setCloseBills({ ...(closeBills || emptyBillCounts()), [denom]: counted + 1 })}>+</button>
                          </div>
                          <span className={styles.billExpected}>{mismatch ? ` esperaba ${expectedQty}` : ''}</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className={styles.hint}>Contado: ${closeBillTotal.toFixed(2)}</p>
                </div>

                {(closeBillTotal > 0 || (closeBills && Object.values(closeBills).some((q) => q > 0))) && (
                  <div className={styles.summaryCard} style={{ background: dollarDifference === 0 ? '#dcfce7' : dollarDifference > 0 ? '#fef3c7' : '#fee2e2' }}>
                    <p className={styles.summaryLabel}>Diferencia $</p>
                    <p className={`${styles.summaryValue} ${dollarDifference === 0 ? '' : dollarDifference > 0 ? styles.summaryValueWarning : styles.summaryValueDanger}`}>
                      {formatDiff(dollarDifference, '$')}
                    </p>
                  </div>
                )}
                {closeBs !== '' && (
                  <div className={styles.summaryCard} style={{ background: bsDifference === 0 ? '#dcfce7' : bsDifference > 0 ? '#fef3c7' : '#fee2e2' }}>
                    <p className={styles.summaryLabel}>Diferencia Bs</p>
                    <p className={`${styles.summaryValue} ${bsDifference === 0 ? '' : bsDifference > 0 ? styles.summaryValueWarning : styles.summaryValueDanger}`}>
                      {formatDiff(bsDifference, 'Bs ')}
                    </p>
                  </div>
                )}

                <div className={styles.field}>
                  <label>Bolívares contados en caja</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Coins size={16} />
                    <input
                      className={`${styles.input} ${closeErrors.closeBs ? styles.inputError : ''}`}
                      type="number"
                      step="0.01"
                      value={closeBs}
                      onChange={(e) => setCloseBs(e.target.value)}
                      placeholder={expectedCashBs > 0 ? `Esperado: Bs ${Math.round(expectedCashBs).toLocaleString('es-VE')}` : '0'}
                    />
                  </div>
                  {closeErrors.closeBs && <span className={styles.fieldError}>{closeErrors.closeBs}</span>}
                </div>

                <div className={styles.actions}>
                  <button type="submit" className="btn btn-primary" disabled={submitting || hasCloseErrors}>
                    {submitting ? 'Cerrando...' : 'Cerrar caja'}
                  </button>
                </div>
                {formError && <p className={styles.error}>{formError}</p>}
              </form>
            </div>
          </motion.div>
        )}

        <ConfirmModal
          isOpen={confirmOpen}
          title={confirmType === 'open' ? '¿Abrir caja?' : '¿Cerrar caja?'}
          message={
            confirmType === 'open'
              ? `Se abrirá la caja con $${openingTotal.toFixed(2)} (${formatBillsList(openingBills) || 'sin billetes'}) y tasa ${formatRate(exchangeRate)} Bs/$.`
              : `Cierre: $${closeBillTotal.toFixed(2)} contados (${formatDiff(dollarDifference, '$')})` + (closeBs !== '' ? `, Bs ${Math.round(parseFloat(closeBs) || 0).toLocaleString('es-VE')} contados (${formatDiff(bsDifference, 'Bs ')})` : '')
          }
          onCancel={() => { setConfirmOpen(false); setConfirmType(null) }}
          onConfirm={confirmType === 'open' ? executeOpen : executeClose}
          confirmText="Confirmar"
          disabled={submitting}
        />

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Historial de cierres</h3>
          {historyLoading ? (
            <Loader2 className="spin" />
          ) : history.length === 0 ? (
            <p style={{ color: 'var(--color-dark-soft)' }}>No hay cierres registrados.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Fecha cierre</th>
                    <th>Apertura</th>
                    <th>Efectivo $ esperado</th>
                    <th>Efectivo $ contado</th>
                    <th>Dif. $</th>
                    <th>Bs esperados</th>
                    <th>Bs contados</th>
                    <th>Dif. Bs</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    // expected_amount = opening + net cash $ (drawer-level), so the diff is direct
                    const diff = (h.closing_amount || 0) - (h.expected_amount || 0)
                    const bsExp = h.expected_bs || 0
                    const bsDiff = (h.closing_bs || 0) - bsExp
                    const fmtBs = (v) => v ? Math.round(v).toLocaleString('es-VE') : '—'
                    return (
                      <tr key={h.id}>
                        <td>{h.closed_at ? new Date(h.closed_at).toLocaleString() : '—'}</td>
                        <td>${h.opening_amount?.toFixed(2)}</td>
                        <td>${(h.expected_amount || 0).toFixed(2)}</td>
                        <td>${h.closing_amount?.toFixed(2)}</td>
                        <td style={{ color: diff === 0 ? '#16a34a' : diff > 0 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                          {diff === 0 ? 'Cuadrado' : diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                        </td>
                        <td>{fmtBs(bsExp)}</td>
                        <td>{fmtBs(h.closing_bs)}</td>
                        <td style={{ color: bsDiff === 0 ? '#16a34a' : bsDiff > 0 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                          {bsDiff === 0 ? 'Cuadrado' : bsDiff > 0 ? `+${Math.round(bsDiff).toLocaleString()}` : Math.round(bsDiff).toLocaleString('es-VE')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
