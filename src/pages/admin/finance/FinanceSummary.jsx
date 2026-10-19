import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import {
  TrendingUp, PiggyBank, Percent, Boxes, Gift, ShoppingBag,
  Receipt, Package, CircleDollarSign, ArrowDownRight,
} from 'lucide-react'
import styles from '../AdminFinance.module.css'
import { fetchFinanceSummary, money, presetRange } from '../../../lib/finance'

const PRESETS = [
  { id: 'this-month', label: 'Este mes' },
  { id: 'last-month', label: 'Mes pasado' },
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '6m', label: 'Últimos 6 meses' },
  { id: 'year', label: 'Este año' },
]

const COLORS = ['#C4788A', '#D4A017', '#7C9A92', '#8A6D3B', '#B5697C', '#9C7FA8', '#6B7280', '#4B8B9E']

function StatCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <motion.div
      className={styles.statCard}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={tone === 'danger' ? { borderColor: 'rgba(220,38,38,0.25)' } : undefined}
    >
      <p className={styles.statLabel}><Icon size={13} /> {label}</p>
      <p className={styles.statValue} style={tone === 'danger' ? { color: '#dc2626' } : tone === 'success' ? { color: '#166534' } : undefined}>
        {value}
      </p>
      {hint && <p className={styles.statHint}>{hint}</p>}
    </motion.div>
  )
}

export default function FinanceSummary() {
  const [preset, setPreset] = useState('this-month')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = presetRange(preset)
      setData(await fetchFinanceSummary(r.from, r.to))
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error cargando finanzas')
    } finally {
      setLoading(false)
    }
  }, [preset])

  useEffect(() => { load() }, [load])

  const range = presetRange(preset)

  const pieData = data ? Object.entries(data.byCategory || {}).map(([name, value]) => ({ name, value })) : []
  const chartData = data?.series || []

  return (
    <div>
      <div className={styles.btnRow} style={{ marginBottom: '1rem' }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.btn} ${preset === p.id ? styles.btnPrimary : ''}`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        <span className={styles.pill} style={{ marginLeft: 'auto' }}>{range.from} → {range.to}</span>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading || !data ? (
        <div className={styles.card}>Cargando finanzas...</div>
      ) : (
        <>
          <div className={styles.cardsGrid} style={{ marginBottom: '1rem' }}>
            <StatCard icon={ShoppingBag} label="Ingresos" value={money(data.revenue)} hint="Ventas + apartados pagados" />
            <StatCard icon={Package} label="Costo de ventas" value={money(data.cogs)} hint="Costo de lo vendido (COGS)" />
            <StatCard icon={TrendingUp} label="Ganancia bruta" value={money(data.grossProfit)} tone={data.grossProfit >= 0 ? 'success' : 'danger'} hint="Ingresos − COGS" />
            <StatCard icon={Receipt} label="Gastos" value={money(data.expensesTotal)} tone="danger" hint={`Variables ${money(data.variableTotal)} · Fijos ${money(data.fixedTotal)}`} />
            <StatCard icon={CircleDollarSign} label="Ganancia neta" value={money(data.netProfit)} tone={data.netProfit >= 0 ? 'success' : 'danger'} hint="Bruta − Gastos" />
            <StatCard icon={Percent} label="Margen" value={`${(data.margin || 0).toFixed(1)}%`} hint="Ganancia neta / Ingresos" />
            <StatCard icon={ArrowDownRight} label="Inversión" value={money(data.investment)} hint="Inventario actual + Gastos" />
            <StatCard icon={TrendingUp} label="ROI" value={data.roi === null ? '—' : `${data.roi.toFixed(1)}%`} tone={data.roi === null ? undefined : data.roi >= 0 ? 'success' : 'danger'} hint="Ganancia neta / Inversión" />
          </div>

          <div className={styles.cardsGrid} style={{ marginBottom: '1rem' }}>
            <StatCard icon={Boxes} label="Inventario actual" value={money(data.inventoryValue)} hint="Stock × costo unitario" />
            <StatCard icon={PiggyBank} label="COGS del período" value={money(data.cogs)} hint="Costo de lo vendido" />
            <StatCard icon={Gift} label="Giftcards vendidas" value={money(data.giftcardsSold)} hint="Pasivo hasta que se usen" />
          </div>

          <div className={styles.grid2}>
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}><TrendingUp size={16} /> Ingresos, gastos y ganancia</h3>
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => money(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Ingresos" fill="#C4788A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cogs" name="Costo ventas" fill="#D4A017" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Gastos" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={styles.card}>
              <h3 className={styles.sectionTitle}><Receipt size={16} /> Gastos por categoría</h3>
              {pieData.length === 0 ? (
                <p className={styles.empty}>Sin gastos en el período</p>
              ) : (
                <div className={styles.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={(d) => d.name}>
                        {pieData.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className={styles.grid2} style={{ marginTop: '1rem' }}>
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}><TrendingUp size={16} /> Ganancia neta por mes</h3>
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.map((s) => ({ ...s, net: s.revenue - s.cogs - s.expenses }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => money(v)} />
                    <Line type="monotone" dataKey="net" name="Ganancia neta" stroke="#166534" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={styles.card}>
              <h3 className={styles.sectionTitle}><TrendingUp size={16} /> Top productos por ganancia</h3>
              {data.topProducts.length === 0 ? (
                <p className={styles.empty}>Sin ventas en el período</p>
              ) : (
                <div className={styles.list}>
                  {data.topProducts.map((p) => (
                    <div key={p.name} className={styles.row}>
                      <div>
                        <p className={styles.rowTitle}>{p.name}</p>
                        <p className={styles.rowMeta}>Ingresos {money(p.revenue)} · Costo {money(p.cogs)}</p>
                      </div>
                      <span className={`${styles.rowValue} ${p.profit >= 0 ? styles.profitPos : styles.profitNeg}`}>
                        {money(p.profit)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className={styles.statHint} style={{ marginTop: '0.75rem' }}>
            * La venta de una giftcard no cuenta como ingreso (es un pasivo); el uso de la giftcard sí es una venta normal.
          </p>
        </>
      )}
    </div>
  )
}
