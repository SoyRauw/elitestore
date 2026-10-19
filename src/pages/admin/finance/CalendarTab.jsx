import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingBag, Receipt, Wallet, Gift, TrendingUp, CalendarDays } from 'lucide-react'
import styles from '../AdminFinance.module.css'
import MonthGrid from '../../../components/admin/MonthGrid'
import { fetchDailyActivity, money, toISODate, monthStart, addMonths } from '../../../lib/finance'

const METHOD_LABELS = {
  efectivo: 'Efectivo',
  efectivo_bs: 'Efectivo Bs',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  binance: 'Binance',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  rapikom: 'Rapikom',
  credito: 'Crédito',
  giftcard: 'Giftcard',
  multiple: 'Múltiple',
}

function dayProfit(day) {
  if (!day) return 0
  return (day.revenue || 0) - (day.cogs || 0) - (day.expensesTotal || 0)
}

export default function CalendarTab() {
  const [month, setMonth] = useState(monthStart(new Date()))
  const [days, setDays] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const from = toISODate(month)
      const to = toISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0))
      setDays(await fetchDailyActivity(from, to))
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error cargando el calendario')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  const day = selected ? days[selected] : null

  const monthTotals = Object.values(days).reduce((acc, d) => ({
    revenue: acc.revenue + (d.revenue || 0),
    cogs: acc.cogs + (d.cogs || 0),
    expenses: acc.expenses + (d.expensesTotal || 0),
    abonos: acc.abonos + (d.abonos || []).reduce((s, a) => s + (parseFloat(a.total_amount) || 0), 0),
  }), { revenue: 0, cogs: 0, expenses: 0, abonos: 0 })

  return (
    <div>
      <div className={styles.btnRow} style={{ marginBottom: '1rem' }}>
        <span className={styles.pill}>Ingresos {money(monthTotals.revenue)}</span>
        <span className={styles.pill}>Gastos {money(monthTotals.expenses)}</span>
        <span className={styles.pill}>Abonos {money(monthTotals.abonos)}</span>
        <span className={`${styles.pill} ${monthTotals.revenue - monthTotals.cogs - monthTotals.expenses >= 0 ? styles.profitPos : styles.profitNeg}`} style={{ marginLeft: 'auto' }}>
          Ganancia del mes {money(monthTotals.revenue - monthTotals.cogs - monthTotals.expenses)}
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading ? (
        <div className={styles.card}>Cargando calendario...</div>
      ) : (
        <MonthGrid
          month={month}
          onMonthChange={(delta) => setMonth(addMonths(month, delta))}
          onDayClick={(iso) => setSelected(iso)}
          renderDay={(iso) => {
            const d = days[iso]
            if (!d) return null
            const profit = dayProfit(d)
            return (
              <>
                <div className={styles.dayChips}>
                  {d.sales?.length > 0 && <span className={`${styles.chip} ${styles.chipSales}`}>V {money(d.revenue)}</span>}
                  {d.giftcards?.length > 0 && <span className={`${styles.chip} ${styles.chipGift}`}>G</span>}
                  {d.abonos?.length > 0 && <span className={`${styles.chip} ${styles.chipAbonos}`}>A</span>}
                  {d.expenses?.length > 0 && <span className={`${styles.chip} ${styles.chipExpenses}`}>-{money(d.expensesTotal)}</span>}
                </div>
                {(d.sales?.length > 0 || d.expenses?.length > 0) && (
                  <span className={`${styles.dayProfit} ${profit >= 0 ? styles.profitPos : styles.profitNeg}`}>
                    {profit >= 0 ? '+' : ''}{money(profit)}
                  </span>
                )}
              </>
            )
          }}
        />
      )}

      <AnimatePresence>
        {selected && (
          <motion.div className={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <motion.div
              className={`${styles.modal} ${styles.modalWide}`}
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>
                  <CalendarDays size={17} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  {new Date(`${selected}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <button className={styles.closeBtn} onClick={() => setSelected(null)}><X size={18} /></button>
              </div>

              {!day ? (
                <p className={styles.empty}>Sin movimientos este día.</p>
              ) : (
                <>
                  <div className={styles.cardsGrid} style={{ marginBottom: '1rem' }}>
                    <div className={styles.statCard}><p className={styles.statLabel}><ShoppingBag size={13} /> Ingresos</p><p className={styles.statValue}>{money(day.revenue)}</p></div>
                    <div className={styles.statCard}><p className={styles.statLabel}><Receipt size={13} /> Gastos</p><p className={`${styles.statValue} ${styles.profitNeg}`}>{money(day.expensesTotal)}</p></div>
                    <div className={styles.statCard}>
                      <p className={styles.statLabel}><TrendingUp size={13} /> Ganancia del día</p>
                      <p className={`${styles.statValue} ${dayProfit(day) >= 0 ? styles.profitPos : styles.profitNeg}`}>{money(dayProfit(day))}</p>
                    </div>
                  </div>

                  {day.sales?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 className={styles.sectionTitle}><ShoppingBag size={15} /> Ventas ({day.sales.length})</h3>
                      <div className={styles.list}>
                        {day.sales.map((s) => (
                          <div key={s.id} className={styles.row}>
                            <div>
                              <p className={styles.rowTitle}>{s.customer_name || 'Cliente'}</p>
                              <p className={styles.rowMeta}>
                                #{s.id.slice(0, 8)} · {(s.movement_payments || []).map((p) => METHOD_LABELS[p.method] || p.method).join(' + ') || '—'}
                              </p>
                            </div>
                            <span className={styles.rowValue}>{money(s.total_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {day.giftcards?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 className={styles.sectionTitle}><Gift size={15} /> Giftcards vendidas</h3>
                      <div className={styles.list}>
                        {day.giftcards.map((g) => (
                          <div key={g.id} className={styles.row}>
                            <p className={styles.rowTitle}>Venta de giftcard</p>
                            <span className={styles.rowValue}>{money(g.total_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {day.abonos?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 className={styles.sectionTitle}><Wallet size={15} /> Abonos recibidos</h3>
                      <div className={styles.list}>
                        {day.abonos.map((a) => (
                          <div key={a.id} className={styles.row}>
                            <div>
                              <p className={styles.rowTitle}>{a.customer_name || 'Cliente'}</p>
                              <p className={styles.rowMeta}>#{a.id.slice(0, 8)}</p>
                            </div>
                            <span className={styles.rowValue}>{money(a.total_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {day.expenses?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 className={styles.sectionTitle}><Receipt size={15} /> Gastos</h3>
                      <div className={styles.list}>
                        {day.expenses.map((e) => (
                          <div key={`${e.id}-${e.expense_date}`} className={styles.row}>
                            <div>
                              <p className={styles.rowTitle}>
                                <span className={styles.colorDot} style={{ background: e.expense_categories?.color || '#C4788A' }} />
                                {e.description || e.expense_categories?.name || 'Gasto'}
                                {e.is_fixed_day && <span className={styles.pill} style={{ marginLeft: '0.4rem' }}>fijo</span>}
                              </p>
                              <p className={styles.rowMeta}>{e.expense_categories?.name || 'Sin categoría'}</p>
                            </div>
                            <span className={`${styles.rowValue} ${styles.profitNeg}`}>{money(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
