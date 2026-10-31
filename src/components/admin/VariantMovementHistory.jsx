import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Eye, History, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatVariantLabel, getVariantImage } from '../../lib/sku'
import styles from './VariantMovementHistory.module.css'

const TYPE_LABELS = {
  venta: 'Venta',
  devolucion: 'Devolución',
  apartado: 'Apartado',
}

const STATUS_LABELS = {
  pagado: 'Pagado',
  activo: 'Activo',
  completada: 'Completada',
  anulada: 'Anulada',
  anulado: 'Anulado',
  cancelada: 'Cancelada',
  cancelado: 'Cancelado',
  pendiente: 'Pendiente',
}

const CANCELLED_STATUSES = ['anulada', 'anulado', 'cancelada', 'cancelado']

function formatMoney(value) {
  return `$${(Number(value) || 0).toFixed(2)}`
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusClass(status) {
  if (['pagado', 'activo', 'completada'].includes(status)) return styles.statusPaid
  if (CANCELLED_STATUSES.includes(status)) return styles.statusCancelled
  return styles.statusNeutral
}

export default function VariantMovementHistory({ product, variant, onClose }) {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('todos')

  const loadMovements = useCallback(async () => {
    if (!variant?.id) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('movements')
      .select(`
        id,
        created_at,
        movement_type,
        status,
        customer_name,
        total_amount,
        movement_items!inner(id, quantity, unit_price, discount_amount, returned_quantity, variant_id)
      `)
      .eq('movement_items.variant_id', variant.id)
      .in('movement_type', ['venta', 'devolucion', 'apartado'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (queryError) {
      console.error('Error cargando historial de la variante:', queryError)
      setMovements([])
      setError(queryError.message || 'No se pudo cargar el historial')
    } else {
      setMovements(data || [])
    }
    setLoading(false)
  }, [variant])

  useEffect(() => { loadMovements() }, [loadMovements])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const rows = useMemo(() => {
    return (movements || []).map((movement) => {
      const lines = (movement.movement_items || []).filter(
        (item) => item.variant_id === variant?.id
      )
      const quantity = lines.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      const returned = lines.reduce(
        (sum, item) => sum + (Number(item.returned_quantity) || 0),
        0
      )
      const gross = lines.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        0
      )
      const discount = lines.reduce(
        (sum, item) => sum + (Number(item.discount_amount) || 0),
        0
      )
      return {
        ...movement,
        quantity,
        returned,
        lineTotal: Math.max(0, gross - discount),
        isReturn: movement.movement_type === 'devolucion',
      }
    })
  }, [movements, variant?.id])

  const summary = useMemo(() => {
    let sold = 0
    let returned = 0
    let layaway = 0
    let soldAmount = 0

    for (const row of rows) {
      const cancelled = CANCELLED_STATUSES.includes(row.status)
      const isCompletedLayaway = row.movement_type === 'apartado' && row.status === 'pagado'
      if ((row.movement_type === 'venta' || isCompletedLayaway) && !cancelled) {
        const netQuantity = Math.max(0, row.quantity - row.returned)
        const ratio = row.quantity > 0 ? netQuantity / row.quantity : 0
        sold += netQuantity
        soldAmount += row.lineTotal * ratio
      } else if (row.movement_type === 'devolucion' && row.status === 'completada') {
        returned += row.quantity
      } else if (row.movement_type === 'apartado' && !cancelled) {
        layaway += row.quantity
      }
    }

    return { sold, returned, layaway, soldAmount }
  }, [rows])

  const visibleRows = useMemo(() => {
    if (typeFilter === 'todos') return rows
    return rows.filter((row) => row.movement_type === typeFilter)
  }, [rows, typeFilter])

  const image = getVariantImage(product, variant)
  const variantLabel = formatVariantLabel(variant, product?.categories?.size_label || 'Talla')

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Historial de ${variantLabel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.thumb}>
            {image ? <img src={image} alt={variantLabel} /> : <History size={22} />}
          </div>
          <div className={styles.headerInfo}>
            <p className={styles.eyebrow}>Historial de la variante</p>
            <h2 className={styles.title}>{product?.name || 'Producto'}</h2>
            <p className={styles.variantLabel}>{variantLabel}</p>
            <p className={styles.sku}>
              SKU: <strong>{variant?.sku || '—'}</strong>
              {variant?.barcode && variant.barcode !== variant.sku && (
                <> · Barcode: <strong>{variant.barcode}</strong></>
              )}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span>Stock actual</span>
            <strong>{Number(variant?.stock) || 0}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Vendidas</span>
            <strong>{summary.sold}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Devueltas</span>
            <strong>{summary.returned}</strong>
          </div>
          {summary.layaway > 0 && (
            <div className={styles.statCard}>
              <span>En apartado</span>
              <strong>{summary.layaway}</strong>
            </div>
          )}
          <div className={styles.statCard}>
            <span>Total vendido</span>
            <strong>{formatMoney(summary.soldAmount)}</strong>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            <label htmlFor="variant-history-type">Tipo</label>
            <select
              id="variant-history-type"
              className={styles.select}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="venta">Ventas</option>
              <option value="devolucion">Devoluciones</option>
              <option value="apartado">Apartados</option>
            </select>
          </div>
          <span className={styles.count}>
            {visibleRows.length} {visibleRows.length === 1 ? 'movimiento' : 'movimientos'}
          </span>
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.state}>
              <Loader2 size={26} className={styles.spinner} />
              <p>Cargando movimientos...</p>
            </div>
          ) : error ? (
            <div className={styles.state}>
              <p className={styles.errorText}>{error}</p>
              <button type="button" className="btn btn-outline" onClick={loadMovements}>
                Reintentar
              </button>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className={styles.state}>
              <CalendarDays size={34} />
              <p>
                {rows.length === 0
                  ? 'Esta variante todavía no tiene movimientos registrados.'
                  : 'No hay movimientos de ese tipo.'}
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const unitPrice = row.quantity > 0 ? row.lineTotal / row.quantity : 0
                  return (
                    <tr key={row.id}>
                      <td className={styles.dateCell}>{formatDate(row.created_at)}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${styles[`type_${row.movement_type}`]}`}>
                          {TYPE_LABELS[row.movement_type] || row.movement_type}
                        </span>
                      </td>
                      <td>{row.customer_name || 'Sin cliente'}</td>
                      <td>
                        <span className={row.isReturn ? styles.qtyReturn : styles.qtySale}>
                          {row.isReturn ? '-' : ''}{row.quantity}
                        </span>
                        {!row.isReturn && row.returned > 0 && (
                          <span className={styles.qtyNote}> ({row.returned} dev.)</span>
                        )}
                      </td>
                      <td>{formatMoney(unitPrice)}</td>
                      <td>
                        <strong className={row.isReturn ? styles.totalReturn : styles.totalSale}>
                          {row.isReturn ? '-' : ''}{formatMoney(row.lineTotal)}
                        </strong>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${statusClass(row.status)}`}>
                          {STATUS_LABELS[row.status] || row.status || '—'}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/admin/movements/${row.id}`}
                          className={styles.detailLink}
                          title="Ver movimiento"
                        >
                          <Eye size={15} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && rows.length > 0 && (
          <p className={styles.footerNote}>
            Mostrando los últimos {rows.length} movimientos. Los totales se calculan sobre esta lista.
          </p>
        )}
      </div>
    </div>
  )
}
