import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Save, RefreshCw, Tags, CheckSquare, LayoutGrid, List, X, ImageOff, Pencil,
} from 'lucide-react'
import styles from '../AdminFinance.module.css'
import { supabase } from '../../../lib/supabase'
import { fetchProductsWithCosts, backfillCosts, money } from '../../../lib/finance'

const totalCostOf = (p) => (parseFloat(p.cost_price) || 0) + (parseFloat(p.shipping_cost) || 0) + (parseFloat(p.freight_cost) || 0)
const imageOf = (p) => p.images?.[0] || (p.product_variants || []).find((v) => v.image)?.image || null

export default function CostsTab() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [costFilter, setCostFilter] = useState('todos')
  const [view, setView] = useState(() => localStorage.getItem('elite-cost-view') || 'tabla')
  const [edits, setEdits] = useState({})
  const [selected, setSelected] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [bulk, setBulk] = useState({ cost_price: '', shipping_cost: '', freight_cost: '' })
  const [cardEditing, setCardEditing] = useState(null)
  const [cardForm, setCardForm] = useState({ cost_price: '', shipping_cost: '', freight_cost: '' })

  useEffect(() => {
    localStorage.setItem('elite-cost-view', view)
  }, [view])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setProducts(await fetchProductsWithCosts())
      setEdits({})
      setSelected(new Set())
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error cargando productos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const map = new Map()
    products.forEach((p) => {
      if (p.category_id) map.set(p.category_id, p.categories?.name || 'Sin nombre')
    })
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  const sinCosto = useMemo(() => products.filter((p) => totalCostOf(p) === 0).length, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (categoryFilter && p.category_id !== categoryFilter) return false
      const total = totalCostOf(p)
      if (costFilter === 'sin' && total > 0) return false
      if (costFilter === 'con' && total === 0) return false
      if (!q) return true
      return (p.name || '').toLowerCase().includes(q)
        || (p.categories?.name || '').toLowerCase().includes(q)
        || (p.product_variants || []).some((v) => (v.sku || '').toLowerCase().includes(q))
    })
  }, [products, search, categoryFilter, costFilter])

  const valuesOf = (p) => {
    const edit = edits[p.id] || {}
    return {
      cost_price: edit.cost_price !== undefined ? edit.cost_price : (p.cost_price ?? ''),
      shipping_cost: edit.shipping_cost !== undefined ? edit.shipping_cost : (p.shipping_cost ?? ''),
      freight_cost: edit.freight_cost !== undefined ? edit.freight_cost : (p.freight_cost ?? ''),
    }
  }

  const setEdit = (id, field, value) => {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }))
  }

  const editedCount = Object.keys(edits).length

  const saveEdits = async () => {
    if (editedCount === 0) return
    setSaving(true)
    setError('')
    try {
      for (const [id, edit] of Object.entries(edits)) {
        const payload = {}
        for (const key of ['cost_price', 'shipping_cost', 'freight_cost']) {
          if (edit[key] !== undefined) {
            const n = parseFloat(edit[key]) || 0
            if (n < 0) throw new Error('Los costos no pueden ser negativos')
            payload[key] = n
          }
        }
        if (Object.keys(payload).length === 0) continue
        const { error: upErr } = await supabase.from('products').update(payload).eq('id', id)
        if (upErr) throw upErr
      }
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error guardando costos')
    } finally {
      setSaving(false)
    }
  }

  const applyBulk = async () => {
    if (selected.size === 0) { setError('Selecciona al menos un producto'); return }
    const payload = {}
    for (const key of ['cost_price', 'shipping_cost', 'freight_cost']) {
      if (bulk[key] !== '' && bulk[key] !== null) {
        const n = parseFloat(bulk[key]) || 0
        if (n < 0) { setError('Los costos no pueden ser negativos'); return }
        payload[key] = n
      }
    }
    if (Object.keys(payload).length === 0) { setError('Escribe al menos un valor para aplicar'); return }
    if (!confirm(`¿Aplicar ${Object.entries(payload).map(([k, v]) => `${k}: ${money(v)}`).join(' · ')} a ${selected.size} producto(s)?`)) return
    setSaving(true)
    setError('')
    try {
      const ids = [...selected]
      const { error: upErr } = await supabase.from('products').update(payload).in('id', ids)
      if (upErr) throw upErr
      setBulk({ cost_price: '', shipping_cost: '', freight_cost: '' })
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error aplicando costos')
    } finally {
      setSaving(false)
    }
  }

  const runBackfill = async (overwrite) => {
    const msg = overwrite
      ? 'Se RECALCULARÁN los costos de TODAS las ventas históricas con el costo actual de cada producto. ¿Continuar?'
      : 'Se completarán los costos de las ventas históricas que aún están en 0 con el costo actual de cada producto. ¿Continuar?'
    if (!confirm(msg)) return
    setBackfilling(true)
    setError('')
    try {
      const count = await backfillCosts(overwrite)
      alert(`Listo: ${count} línea(s) de venta actualizadas.`)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error actualizando ventas históricas')
    } finally {
      setBackfilling(false)
    }
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((p) => p.id)))
  }

  const openCardEditor = (p) => {
    setCardEditing(p)
    setCardForm({
      cost_price: p.cost_price ?? '',
      shipping_cost: p.shipping_cost ?? '',
      freight_cost: p.freight_cost ?? '',
    })
  }

  const saveCard = async () => {
    if (!cardEditing) return
    setSaving(true)
    setError('')
    try {
      const payload = {}
      for (const key of ['cost_price', 'shipping_cost', 'freight_cost']) {
        const n = parseFloat(cardForm[key]) || 0
        if (n < 0) throw new Error('Los costos no pueden ser negativos')
        payload[key] = n
      }
      const { error: upErr } = await supabase.from('products').update(payload).eq('id', cardEditing.id)
      if (upErr) throw upErr
      setCardEditing(null)
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error guardando costos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className={styles.btnRow} style={{ marginBottom: '0.9rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 210 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            className={styles.input}
            style={{ paddingLeft: '2rem' }}
            placeholder="Buscar producto, categoría o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={styles.select} style={{ width: 'auto' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={styles.select} style={{ width: 'auto' }} value={costFilter} onChange={(e) => setCostFilter(e.target.value)}>
          <option value="todos">Todos los costos</option>
          <option value="sin">Solo sin costo ({sinCosto})</option>
          <option value="con">Solo con costo</option>
        </select>
        <div className={styles.tabs} style={{ margin: 0, padding: '0.2rem' }}>
          <button type="button" className={`${styles.tab} ${view === 'tabla' ? styles.tabActive : ''}`} onClick={() => setView('tabla')} title="Vista tabla">
            <List size={15} />
          </button>
          <button type="button" className={`${styles.tab} ${view === 'tarjetas' ? styles.tabActive : ''}`} onClick={() => setView('tarjetas')} title="Vista tarjetas">
            <LayoutGrid size={15} />
          </button>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveEdits} disabled={saving || editedCount === 0}>
          <Save size={15} /> Guardar{editedCount > 0 ? ` (${editedCount})` : ''}
        </button>
      </div>

      {view === 'tabla' && (
        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          <h3 className={styles.sectionTitle}><Tags size={16} /> Edición masiva</h3>
          <p className={styles.statHint} style={{ marginBottom: '0.5rem' }}>
            Selecciona productos en la tabla y aplica el mismo valor. Deja vacío lo que no quieras cambiar.
          </p>
          <div className={styles.toolbar}>
            <div className={styles.field} style={{ width: 130 }}>
              <label>Costo</label>
              <input type="number" min="0" step="0.01" className={styles.input} value={bulk.cost_price} onChange={(e) => setBulk({ ...bulk, cost_price: e.target.value })} />
            </div>
            <div className={styles.field} style={{ width: 130 }}>
              <label>Envío</label>
              <input type="number" min="0" step="0.01" className={styles.input} value={bulk.shipping_cost} onChange={(e) => setBulk({ ...bulk, shipping_cost: e.target.value })} />
            </div>
            <div className={styles.field} style={{ width: 130 }}>
              <label>Flete</label>
              <input type="number" min="0" step="0.01" className={styles.input} value={bulk.freight_cost} onChange={(e) => setBulk({ ...bulk, freight_cost: e.target.value })} />
            </div>
            <button type="button" className={styles.btn} onClick={applyBulk} disabled={saving}>
              <CheckSquare size={15} /> Aplicar a seleccionados ({selected.size})
            </button>
          </div>
        </div>
      )}

      <div className={styles.card} style={{ marginBottom: '1rem' }}>
        <h3 className={styles.sectionTitle}><RefreshCw size={16} /> Costos de ventas históricas</h3>
        <p className={styles.statHint} style={{ marginBottom: '0.5rem' }}>
          Aplica los costos actuales a las ventas viejas (para que la ganancia histórica sea correcta).
        </p>
        <div className={styles.btnRow}>
          <button type="button" className={styles.btn} onClick={() => runBackfill(false)} disabled={backfilling}>
            {backfilling ? 'Procesando...' : 'Completar solo las que están en 0'}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => runBackfill(true)} disabled={backfilling}>
            Recalcular todas
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.card}><p className={styles.empty}>Cargando...</p></div>
      ) : view === 'tabla' ? (
        <div className={styles.card}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" className={styles.checkbox} checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} />
                  </th>
                  <th>Producto</th>
                  <th>Costo</th>
                  <th>Envío</th>
                  <th>Flete</th>
                  <th>Costo total</th>
                  <th>Precio</th>
                  <th>Margen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const v = valuesOf(p)
                  const totalCost = (parseFloat(v.cost_price) || 0) + (parseFloat(v.shipping_cost) || 0) + (parseFloat(v.freight_cost) || 0)
                  const margin = (parseFloat(p.price) || 0) - totalCost
                  const isSel = selected.has(p.id)
                  const img = imageOf(p)
                  return (
                    <tr key={p.id} style={isSel ? { background: 'rgba(196,120,138,0.06)' } : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={isSel}
                          onChange={() => {
                            const next = new Set(selected)
                            if (next.has(p.id)) next.delete(p.id)
                            else next.add(p.id)
                            setSelected(next)
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <div className={styles.costThumb}>
                            {img ? <img src={img} alt={p.name} loading="lazy" /> : <ImageOff size={15} />}
                          </div>
                          <div>
                            <strong>{p.name}</strong>
                            <div className={styles.rowMeta}>{p.categories?.name || 'Sin categoría'}</div>
                          </div>
                        </div>
                      </td>
                      <td><input type="number" min="0" step="0.01" value={v.cost_price} onChange={(e) => setEdit(p.id, 'cost_price', e.target.value)} /></td>
                      <td><input type="number" min="0" step="0.01" value={v.shipping_cost} onChange={(e) => setEdit(p.id, 'shipping_cost', e.target.value)} /></td>
                      <td><input type="number" min="0" step="0.01" value={v.freight_cost} onChange={(e) => setEdit(p.id, 'freight_cost', e.target.value)} /></td>
                      <td><strong>{money(totalCost)}</strong></td>
                      <td>{money(p.price)}</td>
                      <td className={margin >= 0 ? styles.profitPos : styles.profitNeg}><strong>{money(margin)}</strong></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <p className={styles.empty}>No hay productos que coincidan.</p>}
          </div>
        </div>
      ) : (
        <div className={styles.costCardsGrid}>
          {filtered.map((p) => {
            const totalCost = totalCostOf(p)
            const margin = (parseFloat(p.price) || 0) - totalCost
            const img = imageOf(p)
            return (
              <motion.div key={p.id} className={styles.costCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.costCardImg}>
                  {img ? <img src={img} alt={p.name} loading="lazy" /> : <ImageOff size={28} />}
                  {totalCost === 0 && <span className={`${styles.chip} ${styles.chipExpenses}`} style={{ position: 'absolute', top: 8, right: 8 }}>Sin costo</span>}
                </div>
                <div className={styles.costCardBody}>
                  <p className={styles.rowTitle}>{p.name}</p>
                  <p className={styles.rowMeta}>{p.categories?.name || 'Sin categoría'}</p>
                  <div className={styles.costCardPrices}>
                    <span>Costo <strong>{money(totalCost)}</strong></span>
                    <span>Precio <strong>{money(p.price)}</strong></span>
                  </div>
                  <p className={`${styles.rowValue} ${margin >= 0 ? styles.profitPos : styles.profitNeg}`}>Margen {money(margin)}</p>
                  <button type="button" className={styles.btn} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} onClick={() => openCardEditor(p)}>
                    <Pencil size={14} /> Editar costos
                  </button>
                </div>
              </motion.div>
            )
          })}
          {filtered.length === 0 && <p className={styles.empty}>No hay productos que coincidan.</p>}
        </div>
      )}

      <AnimatePresence>
        {cardEditing && (
          <motion.div className={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.modal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>Costos de {cardEditing.name}</h2>
                <button className={styles.closeBtn} onClick={() => setCardEditing(null)}><X size={18} /></button>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Costo ($)</label>
                  <input type="number" min="0" step="0.01" className={styles.input} value={cardForm.cost_price} onChange={(e) => setCardForm({ ...cardForm, cost_price: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Envío ($)</label>
                  <input type="number" min="0" step="0.01" className={styles.input} value={cardForm.shipping_cost} onChange={(e) => setCardForm({ ...cardForm, shipping_cost: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Flete ($)</label>
                  <input type="number" min="0" step="0.01" className={styles.input} value={cardForm.freight_cost} onChange={(e) => setCardForm({ ...cardForm, freight_cost: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Costo total</label>
                  <input
                    type="text"
                    className={styles.input}
                    readOnly
                    value={money((parseFloat(cardForm.cost_price) || 0) + (parseFloat(cardForm.shipping_cost) || 0) + (parseFloat(cardForm.freight_cost) || 0))}
                  />
                </div>
              </div>
              <div className={styles.actions}>
                <button className={styles.btn} onClick={() => setCardEditing(null)} disabled={saving}>Cancelar</button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveCard} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
