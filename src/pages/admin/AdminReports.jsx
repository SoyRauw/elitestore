import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Calendar, FileSpreadsheet, FileText, Filter, TrendingUp, DollarSign, ShoppingBag, CreditCard, Package } from 'lucide-react'
import { formatVariantLabel } from '../../lib/sku'
import { exportMovementsToExcel, exportMovementsToPDF } from '../../lib/reports'
import AdminLayout from '../../components/admin/AdminLayout'
import styles from './AdminReports.module.css'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  multiple: 'Múltiple',
}

function formatDateInput(date) {
  if (!date) return ''
  return new Date(date).toISOString().split('T')[0]
}

function toStartOfDay(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function toEndOfDay(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export default function AdminReports() {
  const today = formatDateInput(new Date())
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [userId, setUserId] = useState('')
  const [method, setMethod] = useState('')

  const [movements, setMovements] = useState([])
  const [movementItems, setMovementItems] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, name, email').order('name')
      setUsers(data || [])
    }
    fetchUsers()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      let query = supabase
        .from('movements')
        .select('*, movement_payments(method, amount)')
        .eq('movement_type', 'venta')
        .eq('status', 'pagado')
        .order('created_at', { ascending: false })

      if (startDate) query = query.gte('created_at', toStartOfDay(startDate))
      if (endDate) query = query.lte('created_at', toEndOfDay(endDate))
      if (userId) query = query.eq('user_id', userId)
      if (method) {
        if (method === 'multiple') {
          query = query.eq('payment_method', 'multiple')
        } else {
          query = query.or(`payment_method.eq.${method},movement_payments.method.eq.${method}`)
        }
      }

      const { data: movs, error } = await query
      if (error) console.error('Error cargando movimientos:', error)

      let items = []
      if (movs?.length) {
        const ids = movs.map(m => m.id)
        const { data: itemsData } = await supabase
          .from('movement_items')
          .select('*, products(name, category_id, categories(name)), product_variants(*)')
          .in('movement_id', ids)
        items = itemsData || []
      }

      setMovements(movs || [])
      setMovementItems(items)
      setLoading(false)
    }
    fetchData()
  }, [startDate, endDate, userId, method])

  const filteredMovements = useMemo(() => {
    return movements
  }, [movements])

  const summary = useMemo(() => {
    const totalSales = filteredMovements.reduce((sum, m) => sum + (parseFloat(m.total_amount) || 0), 0)
    const totalTransactions = filteredMovements.length
    const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0

    const byMethod = {}
    filteredMovements.forEach(m => {
      if (m.payment_method === 'multiple' && m.movement_payments?.length) {
        m.movement_payments.forEach(p => {
          byMethod[p.method] = (byMethod[p.method] || 0) + (parseFloat(p.amount) || 0)
        })
      } else {
        byMethod[m.payment_method] = (byMethod[m.payment_method] || 0) + (parseFloat(m.total_amount) || 0)
      }
    })

    const productSales = {}
    movementItems.forEach(item => {
      const name = item.products?.name || '—'
      const key = `${name}-${formatVariantLabel(item.product_variants || {})}`
      productSales[key] = {
        name,
        variant: formatVariantLabel(item.product_variants || {}),
        quantity: (productSales[key]?.quantity || 0) + (item.quantity || 0),
        total: (productSales[key]?.total || 0) + ((item.quantity || 0) * (item.unit_price || 0)),
      }
    })

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    const categorySales = {}
    movementItems.forEach(item => {
      const cat = item.products?.categories?.name || 'Sin categoría'
      categorySales[cat] = (categorySales[cat] || 0) + ((item.quantity || 0) * (item.unit_price || 0))
    })

    return {
      totalSales,
      totalTransactions,
      averageTicket,
      byMethod,
      topProducts,
      categorySales,
    }
  }, [filteredMovements, movementItems])

  const handleExportExcel = () => {
    const filename = `ventas_${startDate || 'todo'}_${endDate || 'todo'}`
    exportMovementsToExcel(filteredMovements, filename)
  }

  const handleExportPDF = () => {
    const filename = `ventas_${startDate || 'todo'}_${endDate || 'todo'}`
    exportMovementsToPDF(filteredMovements, summary, filename)
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Reportes de Ventas</h1>
            <p className={styles.pageSubtitle}>Analiza y exporta tus ventas</p>
          </div>
          <div className={styles.exportActions}>
            <button className="btn btn-outline" onClick={handleExportExcel}>
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button className="btn btn-outline" onClick={handleExportPDF}>
              <FileText size={16} /> PDF
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.filters}>
            <div className={styles.field}>
              <label><Calendar size={12} /> Desde</label>
              <input type="date" className={styles.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label><Calendar size={12} /> Hasta</label>
              <input type="date" className={styles.input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label><Filter size={12} /> Cajero</label>
              <select className={styles.input} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Todos</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label><CreditCard size={12} /> Método</label>
              <select className={styles.input} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <DollarSign size={20} />
            <div>
              <span className={styles.summaryLabel}>Total ventas</span>
              <strong className={styles.summaryValue}>${summary.totalSales.toFixed(2)}</strong>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <ShoppingBag size={20} />
            <div>
              <span className={styles.summaryLabel}>Transacciones</span>
              <strong className={styles.summaryValue}>{summary.totalTransactions}</strong>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <TrendingUp size={20} />
            <div>
              <span className={styles.summaryLabel}>Ticket promedio</span>
              <strong className={styles.summaryValue}>${summary.averageTicket.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}><CreditCard size={16} /> Ventas por método</h3>
            {Object.keys(summary.byMethod).length === 0 ? (
              <p className={styles.empty}>Sin datos</p>
            ) : (
              <div className={styles.methodList}>
                {Object.entries(summary.byMethod).map(([key, amount]) => (
                  <div key={key} className={styles.methodRow}>
                    <span>{PAYMENT_METHODS[key] || key}</span>
                    <strong>${amount.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}><Package size={16} /> Productos más vendidos</h3>
            {summary.topProducts.length === 0 ? (
              <p className={styles.empty}>Sin datos</p>
            ) : (
              <div className={styles.productList}>
                {summary.topProducts.map((p, i) => (
                  <div key={i} className={styles.productRow}>
                    <span>{p.name} <small>({p.variant})</small></span>
                    <strong>{p.quantity} und</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}><TrendingUp size={16} /> Ventas por categoría</h3>
            {Object.keys(summary.categorySales).length === 0 ? (
              <p className={styles.empty}>Sin datos</p>
            ) : (
              <div className={styles.methodList}>
                {Object.entries(summary.categorySales).map(([cat, amount]) => (
                  <div key={cat} className={styles.methodRow}>
                    <span>{cat}</span>
                    <strong>${amount.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Movimientos</h3>
          {loading ? (
            <p className={styles.empty}>Cargando...</p>
          ) : filteredMovements.length === 0 ? (
            <p className={styles.empty}>No hay movimientos para el filtro seleccionado</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Recibo</th>
                    <th>Cliente</th>
                    <th>Método</th>
                    <th>Descuento</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map(m => (
                    <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>{new Date(m.created_at).toLocaleString()}</td>
                      <td>#{m.id.slice(0, 8)}</td>
                      <td>{m.customer_name || 'Cliente general'}</td>
                      <td>{PAYMENT_METHODS[m.payment_method] || m.payment_method || '—'}</td>
                      <td>{(m.discount_amount || 0) > 0 ? `$${parseFloat(m.discount_amount).toFixed(2)}` : '—'}</td>
                      <td className={styles.totalCell}>${parseFloat(m.total_amount).toFixed(2)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
