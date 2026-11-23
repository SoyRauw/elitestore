import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  Eye,
  Gift,
  HeartHandshake,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import Pagination from '../../components/admin/Pagination'
import POSProductSearch from '../../components/admin/POSProductSearch'
import { localISODate } from '../../lib/dayDiscounts'
import { money, unitCostOf } from '../../lib/finance'
import { formatVariantLabel, getVariantImage } from '../../lib/sku'
import styles from './AdminGifts.module.css'

const PAGE_SIZE = 20
const REASONS = ['Cortesía', 'Influencer', 'Empleado', 'Promoción', 'Cliente frecuente', 'Otro']

function missingSchema(error) {
  const message = (error?.message || '').toLowerCase()
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    message.includes('could not find the function')
  )
}

function dateLabel(value) {
  if (!value) return '—'
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function dateTimeLabel(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function unitsOf(gift) {
  return (gift?.gift_items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
}

function itemsText(items, max = 2) {
  const names = [...new Set((items || []).map((item) => item.product_name).filter(Boolean))]
  if (names.length === 0) return 'Sin detalle'
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} +${names.length - max}`
}

export default function AdminGifts() {
  const { isAdmin } = useAuth()

  const [gifts, setGifts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [missingSql, setMissingSql] = useState(false)
  const [page, setPage] = useState(1)

  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [stats, setStats] = useState({ count: 0, units: 0, cost: 0 })

  const [formOpen, setFormOpen] = useState(false)
  const [cart, setCart] = useState([])
  const [recipient, setRecipient] = useState('')
  const [reason, setReason] = useState('Cortesía')
  const [notes, setNotes] = useState('')
  const [giftDate, setGiftDate] = useState(localISODate())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [detailGift, setDetailGift] = useState(null)
  const [voidTarget, setVoidTarget] = useState(null)
  const [voiding, setVoiding] = useState(false)
  const [toast, setToast] = useState('')

  const loadStats = useCallback(async () => {
    if (!isAdmin) return

    const now = new Date()
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const to = localISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    const { data, error: statsError } = await supabase
      .from('gift_movements')
      .select('total_cost, gift_items(quantity)')
      .eq('status', 'entregado')
      .gte('gift_date', from)
      .lte('gift_date', to)

    if (statsError) {
      if (missingSchema(statsError)) setMissingSql(true)
      return
    }

    const rows = data || []
    setStats({
      count: rows.length,
      units: rows.reduce((sum, gift) => sum + unitsOf(gift), 0),
      cost: rows.reduce((sum, gift) => sum + (parseFloat(gift.total_cost) || 0), 0),
    })
  }, [isAdmin])

  const fetchGifts = useCallback(async () => {
    if (!isAdmin) return

    setLoading(true)
    setError('')

    let query = supabase
      .from('gift_movements')
      .select(`
        id, created_at, gift_date, user_name, recipient_name, recipient_phone,
        reason, notes, total_cost, status, voided_at, voided_by_name,
        gift_items(id, product_name, variant_label, sku, size, quantity, unit_cost, line_cost)
      `, { count: 'exact' })
      .order('gift_date', { ascending: false })
      .order('created_at', { ascending: false })

    const term = search.trim().replace(/[,%()]/g, ' ')
    if (term) {
      query = query.or(`recipient_name.ilike.%${term}%,notes.ilike.%${term}%,user_name.ilike.%${term}%`)
    }
    if (reasonFilter) query = query.eq('reason', reasonFilter)
    if (statusFilter) query = query.eq('status', statusFilter)
    if (fromDate) query = query.gte('gift_date', fromDate)
    if (toDate) query = query.lte('gift_date', toDate)

    const offset = (page - 1) * PAGE_SIZE
    query = query.range(offset, offset + PAGE_SIZE - 1)

    const { data, error: fetchError, count } = await query

    if (fetchError) {
      if (missingSchema(fetchError)) setMissingSql(true)
      else setError(fetchError.message || 'No se pudieron cargar los regalos')
      setGifts([])
      setTotal(0)
    } else {
      setMissingSql(false)
      setGifts(data || [])
      setTotal(count || 0)
    }

    setLoading(false)
  }, [isAdmin, page, search, reasonFilter, statusFilter, fromDate, toDate])

  useEffect(() => { fetchGifts() }, [fetchGifts])
  useEffect(() => { loadStats() }, [loadStats])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + unitCostOf(item.product) * item.quantity, 0),
    [cart]
  )
  const cartUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )
  const hasMissingCost = useMemo(
    () => cart.some((item) => unitCostOf(item.product) <= 0),
    [cart]
  )

  const openForm = () => {
    setCart([])
    setRecipient('')
    setReason('Cortesía')
    setNotes('')
    setGiftDate(localISODate())
    setFormError('')
    setFormOpen(true)
  }

  const addItem = useCallback((product, variant) => {
    setFormError('')
    setCart((prev) => {
      const index = prev.findIndex((item) => item.variant.id === variant.id)
      if (index >= 0) {
        const current = prev[index]
        if (current.quantity >= (Number(variant.stock) || 0)) return prev
        return prev.map((item, i) => (
          i === index ? { ...item, quantity: item.quantity + 1 } : item
        ))
      }
      if ((Number(variant.stock) || 0) <= 0) return prev
      return [...prev, { product, variant, quantity: 1 }]
    })
  }, [])

  const changeQty = (variantId, delta) => {
    setCart((prev) => prev.map((item) => {
      if (item.variant.id !== variantId) return item
      const max = Math.max(1, Number(item.variant.stock) || 0)
      return { ...item, quantity: Math.max(1, Math.min(max, item.quantity + delta)) }
    }))
  }

  const removeItem = (variantId) => {
    setCart((prev) => prev.filter((item) => item.variant.id !== variantId))
  }

  const requestSubmit = () => {
    setFormError('')
    if (cart.length === 0) {
      setFormError('Agrega al menos una prenda al regalo')
      return
    }
    if (cart.some((item) => item.quantity > (Number(item.variant.stock) || 0))) {
      setFormError('Hay una cantidad mayor al stock disponible')
      return
    }
    setConfirmOpen(true)
  }

  const submitGift = async () => {
    setSubmitting(true)
    setFormError('')

    try {
      const { error: rpcError } = await supabase.rpc('admin_register_gift', {
        p_items: cart.map((item) => ({
          variant_id: item.variant.id,
          quantity: item.quantity,
        })),
        p_recipient_name: recipient.trim() || null,
        p_recipient_phone: null,
        p_reason: reason,
        p_notes: notes.trim() || null,
        p_gift_date: giftDate || localISODate(),
      })

      if (rpcError) throw rpcError

      setConfirmOpen(false)
      setFormOpen(false)
      setToast(`Regalo registrado: ${cartUnits} prenda(s) y un gasto de ${money(cartTotal)}.`)
      await Promise.all([fetchGifts(), loadStats()])
    } catch (e) {
      console.error('Error registrando regalo:', e)
      setConfirmOpen(false)
      if (missingSchema(e)) {
        setMissingSql(true)
        setFormError('Falta ejecutar el SQL de Regalos en Supabase.')
      } else {
        setFormError(e.message || 'No se pudo registrar el regalo')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const voidGift = async () => {
    if (!voidTarget) return

    setVoiding(true)
    setError('')

    try {
      const { error: rpcError } = await supabase.rpc('admin_void_gift', {
        p_gift_id: voidTarget.id,
      })
      if (rpcError) throw rpcError

      setVoidTarget(null)
      setDetailGift(null)
      setToast('Regalo anulado: se devolvió el stock y se eliminó el gasto.')
      await Promise.all([fetchGifts(), loadStats()])
    } catch (e) {
      console.error('Error anulando regalo:', e)
      if (missingSchema(e)) setMissingSql(true)
      else setError(e.message || 'No se pudo anular el regalo')
      setVoidTarget(null)
    } finally {
      setVoiding(false)
    }
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className={styles.page}>
          <div className={styles.empty}>
            <HeartHandshake size={40} />
            <p>Solo un administrador puede ver y registrar regalos.</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}><HeartHandshake size={22} /> Regalos</h1>
            <p className={styles.pageSubtitle}>
              Prendas entregadas sin cobro. No generan ingreso; su costo se registra como gasto.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openForm}
            disabled={missingSql}
            title={missingSql ? 'Ejecuta el SQL de Regalos primero' : undefined}
          >
            <Plus size={16} /> Registrar regalo
          </button>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Regalos este mes</span>
            <strong className={styles.statValue}>{stats.count}</strong>
            <span className={styles.statHint}>Registros entregados</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Prendas regaladas</span>
            <strong className={styles.statValue}>{stats.units}</strong>
            <span className={styles.statHint}>Unidades del mes</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Costo regalado</span>
            <strong className={`${styles.statValue} ${styles.statCost}`}>{money(stats.cost)}</strong>
            <span className={styles.statHint}>Se suma a Gastos → Regalos</span>
          </div>
        </div>

        {missingSql && (
          <div className={styles.setupNotice}>
            <AlertTriangle size={18} />
            <div>
              <strong>Falta ejecutar el SQL de Regalos.</strong>
              <p>
                Ejecuta <code>supabase/migrations/20261123_gifts.sql</code> en Supabase
                para activar esta pestaña.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
              onClick={() => {
                setMissingSql(false)
                fetchGifts()
                loadStats()
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.card}>
          <div className={styles.filtersBar}>
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Buscar destinatario, nota o admin..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <select
              className={styles.select}
              value={reasonFilter}
              onChange={(e) => { setReasonFilter(e.target.value); setPage(1) }}
            >
              <option value="">Todos los motivos</option>
              {REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            >
              <option value="">Todos los estados</option>
              <option value="entregado">Entregados</option>
              <option value="anulada">Anulados</option>
            </select>
            <input
              type="date"
              className={styles.dateInput}
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
              title="Desde"
            />
            <input
              type="date"
              className={styles.dateInput}
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1) }}
              title="Hasta"
            />
            {(search || reasonFilter || statusFilter || fromDate || toDate) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setSearch('')
                  setReasonFilter('')
                  setStatusFilter('')
                  setFromDate('')
                  setToDate('')
                  setPage(1)
                }}
              >
                Limpiar
              </button>
            )}
          </div>

          {loading ? (
            <div className={styles.loading}>
              <Loader2 size={22} className={styles.spinner} /> Cargando regalos...
            </div>
          ) : gifts.length === 0 ? (
            <div className={styles.empty}>
              <Gift size={36} />
              <p>No hay regalos registrados con esos filtros.</p>
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Destinatario</th>
                      <th>Motivo</th>
                      <th>Prendas</th>
                      <th>Und.</th>
                      <th>Costo</th>
                      <th>Registró</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gifts.map((gift) => (
                      <tr key={gift.id}>
                        <td>{dateLabel(gift.gift_date)}</td>
                        <td>
                          {gift.recipient_name || <span className={styles.muted}>Sin destinatario</span>}
                        </td>
                        <td>{gift.reason}</td>
                        <td>{itemsText(gift.gift_items)}</td>
                        <td>{unitsOf(gift)}</td>
                        <td className={styles.cost}>{money(gift.total_cost)}</td>
                        <td>{gift.user_name || '—'}</td>
                        <td>
                          <span className={`${styles.badge} ${gift.status === 'entregado' ? styles.badgeDelivered : styles.badgeVoid}`}>
                            {gift.status === 'entregado' ? 'Entregado' : 'Anulado'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Ver detalle"
                              onClick={() => setDetailGift(gift)}
                            >
                              <Eye size={15} />
                            </button>
                            {gift.status === 'entregado' && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                title="Anular regalo"
                                onClick={() => setVoidTarget(gift)}
                              >
                                <Ban size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </div>

        <AnimatePresence>
          {formOpen && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) setFormOpen(false)
              }}
            >
              <motion.div
                className={`${styles.modal} ${styles.modalWide}`}
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
              >
                <div className={styles.modalHeader}>
                  <div>
                    <h2><Gift size={18} /> Registrar regalo</h2>
                    <p className={styles.modalSubtitle}>
                      Se descontará del stock y se registrará un gasto en Finanzas.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={() => setFormOpen(false)}
                    disabled={submitting}
                    aria-label="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.searchColumn}>
                    <p className={styles.sectionLabel}>Buscar prenda</p>
                    <div className={styles.searchBox}>
                      <POSProductSearch onAdd={addItem} exchangeRate={0} />
                    </div>
                    <p className={styles.hint}>
                      El precio de venta no se usa. El gasto se calcula con costo + envío + flete.
                    </p>
                  </div>

                  <div className={styles.cartColumn}>
                    <p className={styles.sectionLabel}>Prendas del regalo</p>
                    {cart.length === 0 ? (
                      <div className={styles.cartEmpty}>
                        <Gift size={28} />
                        <p>Busca y agrega las prendas que se regalarán.</p>
                      </div>
                    ) : (
                      <div className={styles.cartList}>
                        {cart.map((item) => {
                          const image = getVariantImage(item.product, item.variant)
                          const cost = unitCostOf(item.product)
                          return (
                            <div key={item.variant.id} className={styles.cartItem}>
                              <div className={styles.thumb}>
                                {image ? <img src={image} alt={item.product.name} /> : <Gift size={18} />}
                              </div>
                              <div className={styles.itemInfo}>
                                <strong>{item.product.name}</strong>
                                <span>{formatVariantLabel(item.variant, item.product.categories?.size_label)}</span>
                                <span className={styles.itemCost}>
                                  {money(cost)} c/u · {money(cost * item.quantity)}
                                </span>
                              </div>
                              <div className={styles.qtyRow}>
                                <button
                                  type="button"
                                  className={styles.qtyBtn}
                                  onClick={() => changeQty(item.variant.id, -1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus size={12} />
                                </button>
                                <span>{item.quantity}</span>
                                <button
                                  type="button"
                                  className={styles.qtyBtn}
                                  onClick={() => changeQty(item.variant.id, 1)}
                                  disabled={item.quantity >= item.variant.stock}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                              <button
                                type="button"
                                className={styles.removeBtn}
                                onClick={() => removeItem(item.variant.id)}
                                aria-label="Quitar prenda"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className={styles.formFields}>
                      <div className={styles.field}>
                        <label>Destinatario (opcional)</label>
                        <input
                          className={styles.input}
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          placeholder="Nombre de quien recibe"
                        />
                      </div>
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label>Motivo</label>
                          <select
                            className={styles.select}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          >
                            {REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label>Fecha</label>
                          <input
                            type="date"
                            className={styles.input}
                            value={giftDate}
                            max={localISODate()}
                            onChange={(e) => setGiftDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label>Nota (opcional)</label>
                        <textarea
                          className={styles.textarea}
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ej: regalo para influencer, cumpleaños, etc."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {formError && <p className={styles.error}>{formError}</p>}

                <div className={styles.formFooter}>
                  <div>
                    <span className={styles.totalLabel}>{cartUnits} prenda(s) · Costo total</span>
                    <strong className={styles.totalValue}>{money(cartTotal)}</strong>
                    {hasMissingCost && (
                      <p className={styles.warning}>
                        <AlertTriangle size={13} /> Hay prendas sin costo registrado; su gasto quedará en $0.
                      </p>
                    )}
                  </div>
                  <div className={styles.footerActions}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setFormOpen(false)}
                      disabled={submitting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={requestSubmit}
                      disabled={submitting || cart.length === 0}
                    >
                      {submitting ? 'Registrando...' : 'Registrar regalo'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmModal
          isOpen={confirmOpen}
          title="¿Registrar este regalo?"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitGift}
          confirmText="Sí, registrar"
          disabled={submitting}
        >
          <p>Se descontarán <strong>{cartUnits} prenda(s)</strong> del inventario.</p>
          <p>Se registrará un gasto de <strong>{money(cartTotal)}</strong> en Finanzas, categoría “Regalos”.</p>
          <p className={styles.muted}>No se registrará como venta ni como ingreso.</p>
        </ConfirmModal>

        <AnimatePresence>
          {detailGift && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { if (e.target === e.currentTarget) setDetailGift(null) }}
            >
              <motion.div
                className={`${styles.modal} ${styles.modalWide}`}
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
              >
                <div className={styles.modalHeader}>
                  <div>
                    <h2><Gift size={18} /> Detalle del regalo</h2>
                    <p className={styles.modalSubtitle}>
                      {dateLabel(detailGift.gift_date)} · {detailGift.user_name || '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={() => setDetailGift(null)}
                    aria-label="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className={styles.detailGrid}>
                  <div>
                    <span className={styles.detailLabel}>Destinatario</span>
                    <strong>{detailGift.recipient_name || 'Sin destinatario'}</strong>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Motivo</span>
                    <strong>{detailGift.reason}</strong>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Estado</span>
                    <span className={`${styles.badge} ${detailGift.status === 'entregado' ? styles.badgeDelivered : styles.badgeVoid}`}>
                      {detailGift.status === 'entregado' ? 'Entregado' : 'Anulado'}
                    </span>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Costo total</span>
                    <strong className={styles.cost}>{money(detailGift.total_cost)}</strong>
                  </div>
                  {detailGift.notes && (
                    <div className={styles.detailFull}>
                      <span className={styles.detailLabel}>Nota</span>
                      <p>{detailGift.notes}</p>
                    </div>
                  )}
                  {detailGift.status === 'anulada' && (
                    <div className={styles.detailFull}>
                      <span className={styles.detailLabel}>Anulado</span>
                      <p>{dateTimeLabel(detailGift.voided_at)} · {detailGift.voided_by_name || '—'}</p>
                    </div>
                  )}
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Prenda</th>
                        <th>Variante</th>
                        <th>SKU</th>
                        <th>Cant.</th>
                        <th>Costo u.</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailGift.gift_items || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.product_name}</td>
                          <td>{item.variant_label || item.size || '—'}</td>
                          <td className={styles.mono}>{item.sku || '—'}</td>
                          <td>{item.quantity}</td>
                          <td>{money(item.unit_cost)}</td>
                          <td><strong>{money(item.line_cost)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.formFooter}>
                  <span className={styles.muted}>
                    El gasto asociado está en Finanzas → Gastos → Regalos.
                  </span>
                  {detailGift.status === 'entregado' && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => { setVoidTarget(detailGift); setDetailGift(null) }}
                    >
                      <Ban size={15} /> Anular regalo
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmModal
          isOpen={!!voidTarget}
          title="¿Anular este regalo?"
          onCancel={() => setVoidTarget(null)}
          onConfirm={voidGift}
          confirmText="Sí, anular"
          confirmVariant="danger"
          disabled={voiding}
        >
          {voidTarget && (
            <>
              <p>Se devolverán <strong>{unitsOf(voidTarget)} prenda(s)</strong> al inventario.</p>
              <p>Se eliminará el gasto de <strong>{money(voidTarget.total_cost)}</strong> en Finanzas.</p>
              <p className={styles.muted}>El registro quedará como anulado en el historial.</p>
            </>
          )}
        </ConfirmModal>

        {toast && <div className={styles.toast} role="status">{toast}</div>}
      </div>
    </AdminLayout>
  )
}
