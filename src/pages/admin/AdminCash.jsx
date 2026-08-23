import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useCashSession, getExpectedCashAmount, getSessionTotalsByMethod } from '../../hooks/useCashSession'
import { DollarSign, Lock, Unlock, AlertCircle, Loader2 } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import * as V from '../../lib/validation'
import styles from './AdminCash.module.css'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
}

export default function AdminCash() {
  const { user } = useAuth()
  const { session, loading, error, refresh, openSession, closeSession } = useCashSession(user?.id)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [openAmount, setOpenAmount] = useState('')
  const [closeAmount, setCloseAmount] = useState('')
  const [byMethod, setByMethod] = useState({})
  const [expectedCashAmount, setExpectedCashAmount] = useState(0)
  const [lastClosingAmount, setLastClosingAmount] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmType, setConfirmType] = useState(null)

  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true)
      const { data } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(20)
      setHistory(data || [])
      if (data && data.length > 0) {
        setLastClosingAmount(data[0].closing_amount)
      }
      setHistoryLoading(false)
    }
    fetchHistory()
  }, [session])

  useEffect(() => {
    if (!session) return
    const loadTotals = async () => {
      const [expected, methods] = await Promise.all([
        getExpectedCashAmount(session.id),
        getSessionTotalsByMethod(session.id),
      ])
      setExpectedCashAmount(expected)
      setByMethod(methods)
    }
    loadTotals()
  }, [session])

  const openErrors = useMemo(() => {
    const errs = {}
    errs.openAmount = V.number(openAmount, 'El monto inicial', { min: 0 })
    Object.keys(errs).forEach(k => { if (!errs[k]) delete errs[k] })
    return errs
  }, [openAmount])

  const closeErrors = useMemo(() => {
    const errs = {}
    errs.closeAmount = V.number(closeAmount, 'El efectivo contado', { min: 0 })
    Object.keys(errs).forEach(k => { if (!errs[k]) delete errs[k] })
    return errs
  }, [closeAmount])

  const hasOpenErrors = useMemo(() => Object.keys(openErrors).length > 0, [openErrors])
  const hasCloseErrors = useMemo(() => Object.keys(closeErrors).length > 0, [closeErrors])

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
      await openSession(openAmount)
      setOpenAmount('')
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

  const executeClose = async () => {
    setSubmitting(true)
    setFormError('')
    try {
      await closeSession(closeAmount)
      setCloseAmount('')
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
      setConfirmType(null)
    }
  }

  const expectedCashInBox = (session?.opening_amount || 0) + expectedCashAmount
  const cashDifference = (parseFloat(closeAmount) || 0) - expectedCashInBox

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
              <div className={styles.field}>
                <label>Monto inicial en caja</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={16} />
                  <input
                    className={`${styles.input} ${openErrors.openAmount ? styles.inputError : ''}`}
                    type="number"
                    step="0.01"
                    value={openAmount}
                    onChange={(e) => setOpenAmount(e.target.value)}
                    placeholder={lastClosingAmount !== null ? `Último cierre: $${lastClosingAmount.toFixed(2)}` : '0.00'}
                    autoFocus
                  />
                </div>
                {openErrors.openAmount ? (
                  <span className={styles.fieldError}>{openErrors.openAmount}</span>
                ) : (
                  lastClosingAmount !== null && openAmount === '' && (
                    <p className={styles.hint}>Sugerencia: $${lastClosingAmount.toFixed(2)} del último cierre</p>
                  )
                )}
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
              </div>

              <div className={styles.summaryGrid} style={{ marginTop: '1rem' }}>
                <div className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Monto inicial</p>
                  <p className={styles.summaryValue}>${session.opening_amount?.toFixed(2)}</p>
                </div>
                <div className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Efectivo recibido</p>
                  <p className={styles.summaryValue}>${expectedCashAmount.toFixed(2)}</p>
                </div>
                <div className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Efectivo esperado en caja</p>
                  <p className={styles.summaryValue}>${expectedCashInBox.toFixed(2)}</p>
                </div>
              </div>

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
                    <label>Efectivo real contado en caja</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <DollarSign size={16} />
                      <input
                        className={`${styles.input} ${closeErrors.closeAmount ? styles.inputError : ''}`}
                        type="number"
                        step="0.01"
                        value={closeAmount}
                        onChange={(e) => setCloseAmount(e.target.value)}
                        placeholder={`Esperado: $${expectedCashInBox.toFixed(2)}`}
                      />
                    </div>
                    {closeErrors.closeAmount && <span className={styles.fieldError}>{closeErrors.closeAmount}</span>}
                  </div>

                {closeAmount !== '' && (
                  <div className={styles.summaryCard} style={{ background: cashDifference === 0 ? '#dcfce7' : cashDifference > 0 ? '#fef3c7' : '#fee2e2' }}>
                    <p className={styles.summaryLabel}>Diferencia de efectivo</p>
                    <p className={`${styles.summaryValue} ${cashDifference === 0 ? '' : cashDifference > 0 ? styles.summaryValueWarning : styles.summaryValueDanger}`}>
                      {cashDifference === 0 ? 'Cuadrado' : cashDifference > 0 ? `Sobrante $${cashDifference.toFixed(2)}` : `Faltante $${Math.abs(cashDifference).toFixed(2)}`}
                    </p>
                  </div>
                )}

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
              ? `Se abrirá la caja con un monto inicial de $${parseFloat(openAmount || 0).toFixed(2)}.`
              : `Se cerrará la caja con un efectivo contado de $${parseFloat(closeAmount || 0).toFixed(2)}. La diferencia es ${cashDifference === 0 ? 'cuadrada' : cashDifference > 0 ? `sobrante de $${cashDifference.toFixed(2)}` : `faltante de $${Math.abs(cashDifference).toFixed(2)}`}.`
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
                    <th>Efectivo esperado</th>
                    <th>Efectivo contado</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    const sales = (h.expected_amount || 0)
                    const diff = (h.closing_amount || 0) - (h.opening_amount || 0) - sales
                    return (
                      <tr key={h.id}>
                        <td>{h.closed_at ? new Date(h.closed_at).toLocaleString() : '—'}</td>
                        <td>${h.opening_amount?.toFixed(2)}</td>
                        <td>${sales.toFixed(2)}</td>
                        <td>${h.closing_amount?.toFixed(2)}</td>
                        <td style={{ color: diff === 0 ? '#16a34a' : diff > 0 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                          {diff === 0 ? 'Cuadrado' : diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
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
