import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Pencil, X, Settings2, Receipt } from 'lucide-react'
import styles from '../AdminFinance.module.css'
import MonthGrid from '../../../components/admin/MonthGrid'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import {
  fetchCategories, fetchExpenses, money, toISODate, monthStart, addMonths,
} from '../../../lib/finance'

const PAYMENT_METHODS = [
  ['', '—'],
  ['efectivo', 'Efectivo'],
  ['efectivo_bs', 'Efectivo Bs'],
  ['pago_movil', 'Pago Móvil'],
  ['zelle', 'Zelle'],
  ['zinli', 'Zinli'],
  ['binance', 'Binance'],
  ['transferencia', 'Transferencia'],
  ['punto', 'Punto de Venta'],
  ['otro', 'Otro'],
]

const emptyForm = (date) => ({
  id: null,
  expense_date: date || toISODate(new Date()),
  category_id: '',
  description: '',
  amount: '',
  payment_method: '',
  notes: '',
  is_recurring: false,
  recurring_start: date || toISODate(new Date()),
  recurring_end: '',
  active: true,
})

export default function ExpensesTab() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [month, setMonth] = useState(monthStart(new Date()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [catModal, setCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ id: null, name: '', color: '#C4788A', active: true })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [cats, exps] = await Promise.all([fetchCategories(), fetchExpenses()])
      setCategories(cats)
      setExpenses(exps)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error cargando gastos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const monthFrom = toISODate(month)
  const monthTo = toISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0))

  const expensesThisMonth = useMemo(() => expenses.filter((e) => {
    if (e.is_recurring || e.recurrence === 'monthly') {
      if (!e.active) return false
      const start = e.recurring_start || e.expense_date
      const end = e.recurring_end
      return start <= monthTo && (!end || end >= monthFrom)
    }
    return e.expense_date >= monthFrom && e.expense_date <= monthTo
  }), [expenses, monthFrom, monthTo])

  const byDate = useMemo(() => {
    const map = {}
    for (const e of expenses) {
      if (e.is_recurring || e.recurrence === 'monthly') {
        if (!e.active) continue
        const start = e.recurring_start || e.expense_date
        const end = e.recurring_end
        if (start > monthTo || (end && end < monthFrom)) continue
        const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`
        if (!map[key]) map[key] = []
        map[key].push({ ...e, _fixed: true })
      } else {
        if (!map[e.expense_date]) map[e.expense_date] = []
        map[e.expense_date].push(e)
      }
    }
    return map
  }, [expenses, month, monthFrom, monthTo])

  const totals = useMemo(() => {
    let variable = 0
    let fixed = 0
    for (const e of expensesThisMonth) {
      const amount = parseFloat(e.amount) || 0
      if (e.is_recurring || e.recurrence === 'monthly') fixed += amount
      else variable += amount
    }
    return { variable, fixed, total: variable + fixed }
  }, [expensesThisMonth])

  const catName = (id) => categories.find((c) => c.id === id)?.name || 'Otros'
  const catColor = (id) => categories.find((c) => c.id === id)?.color || '#C4788A'

  const openNew = (date) => {
    setForm(emptyForm(date))
    setError('')
    setModal(true)
  }

  const openEdit = (e) => {
    setForm({
      id: e.id,
      expense_date: e.expense_date,
      category_id: e.category_id || '',
      description: e.description || '',
      amount: e.amount ?? '',
      payment_method: e.payment_method || '',
      notes: e.notes || '',
      is_recurring: !!e.is_recurring,
      recurring_start: e.recurring_start || e.expense_date || toISODate(new Date()),
      recurring_end: e.recurring_end || '',
      active: e.active !== false,
    })
    setError('')
    setModal(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const amount = parseFloat(form.amount) || 0
      if (amount <= 0) throw new Error('Ingresa un monto mayor a 0')
      const payload = {
        expense_date: form.expense_date || toISODate(new Date()),
        category_id: form.category_id || null,
        description: form.description?.trim() || null,
        amount,
        payment_method: form.payment_method || null,
        notes: form.notes?.trim() || null,
        is_recurring: !!form.is_recurring,
        recurrence: form.is_recurring ? 'monthly' : 'once',
        recurring_start: form.is_recurring ? (form.recurring_start || form.expense_date) : null,
        recurring_end: form.is_recurring && form.recurring_end ? form.recurring_end : null,
        active: form.active !== false,
      }
      if (form.id) {
        const { error: upErr } = await supabase.from('expenses').update(payload).eq('id', form.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from('expenses').insert([{ ...payload, created_by: user?.id || null }])
        if (insErr) throw insErr
      }
      setModal(false)
      load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error guardando el gasto')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (e) => {
    if (!confirm(`¿Borrar el gasto "${e.description || catName(e.category_id)}" de ${money(e.amount)}?`)) return
    const { error: delErr } = await supabase.from('expenses').delete().eq('id', e.id)
    if (delErr) { alert(delErr.message); return }
    load()
  }

  const saveCategory = async () => {
    setSaving(true)
    setError('')
    try {
      if (!catForm.name.trim()) throw new Error('Escribe el nombre de la categoría')
      const payload = {
        name: catForm.name.trim(),
        color: catForm.color || '#C4788A',
        active: catForm.active !== false,
      }
      if (catForm.id) {
        const { error: upErr } = await supabase.from('expense_categories').update(payload).eq('id', catForm.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from('expense_categories').insert([payload])
        if (insErr) throw insErr
      }
      setCatForm({ id: null, name: '', color: '#C4788A', active: true })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className={styles.btnRow} style={{ marginBottom: '1rem' }}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openNew()}>
          <Plus size={16} /> Nuevo gasto
        </button>
        <button type="button" className={styles.btn} onClick={() => setCatModal(true)}>
          <Settings2 size={16} /> Categorías
        </button>
        <span className={styles.pill} style={{ marginLeft: 'auto' }}>
          Variables {money(totals.variable)} · Fijos {money(totals.fixed)} · Total {money(totals.total)}
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.grid2}>
        <MonthGrid
          month={month}
          onMonthChange={(delta) => setMonth(addMonths(month, delta))}
          onDayClick={(iso) => openNew(iso)}
          renderDay={(iso) => {
            const items = byDate[iso] || []
            const total = items.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
            return (
              <>
                <div className={styles.dayChips}>
                  {items.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className={styles.chip}
                      style={{
                        background: `${catColor(e.category_id)}22`,
                        color: catColor(e.category_id),
                      }}
                      title={`${catName(e.category_id)} ${money(e.amount)}`}
                    >
                      {money(e.amount)}
                    </span>
                  ))}
                  {items.length > 2 && <span className={styles.chip} style={{ background: '#f3f4f6', color: '#4b5563' }}>+{items.length - 2}</span>}
                </div>
                {total > 0 && <span className={`${styles.dayProfit} ${styles.profitNeg}`}>-{money(total)}</span>}
              </>
            )
          }}
        />

        <div className={styles.card}>
          <h3 className={styles.sectionTitle}><Receipt size={16} /> Gastos de {month.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}</h3>
          {loading ? (
            <p className={styles.empty}>Cargando...</p>
          ) : expensesThisMonth.length === 0 ? (
            <p className={styles.empty}>Sin gastos este mes. Haz clic en un día del calendario para agregar.</p>
          ) : (
            <div className={styles.list}>
              {expensesThisMonth.map((e) => (
                <div key={e.id} className={styles.row}>
                  <div>
                    <p className={styles.rowTitle}>
                      <span className={styles.colorDot} style={{ background: catColor(e.category_id) }} />
                      {e.description || catName(e.category_id)}
                      {(e.is_recurring || e.recurrence === 'monthly') && <span className={styles.pill} style={{ marginLeft: '0.4rem' }}>fijo</span>}
                    </p>
                    <p className={styles.rowMeta}>
                      {e.expense_date} · {catName(e.category_id)}
                      {e.payment_method ? ` · ${e.payment_method}` : ''}
                      {e.is_recurring ? ' · mensual' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span className={`${styles.rowValue} ${styles.profitNeg}`}>{money(e.amount)}</span>
                    <button type="button" className={styles.monthBtn} title="Editar" onClick={() => openEdit(e)}><Pencil size={13} /></button>
                    <button type="button" className={styles.monthBtn} title="Borrar" onClick={() => remove(e)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div className={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.modal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>{form.id ? 'Editar gasto' : 'Nuevo gasto'}</h2>
                <button className={styles.closeBtn} onClick={() => setModal(false)}><X size={18} /></button>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Fecha</label>
                  <input type="date" className={styles.input} value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Categoría</label>
                  <select className={styles.select} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Monto ($)</label>
                  <input type="number" min="0" step="0.01" className={styles.input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Método de pago</label>
                  <select className={styles.select} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                    {PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label>Descripción</label>
                  <input type="text" className={styles.input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label>Notas</label>
                  <textarea className={styles.textarea} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" className={styles.checkbox} checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
                    Gasto fijo mensual (se repite cada mes)
                  </label>
                </div>
                {form.is_recurring && (
                  <>
                    <div className={styles.field}>
                      <label>Desde</label>
                      <input type="date" className={styles.input} value={form.recurring_start} onChange={(e) => setForm({ ...form, recurring_start: e.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <label>Hasta (opcional)</label>
                      <input type="date" className={styles.input} value={form.recurring_end} onChange={(e) => setForm({ ...form, recurring_end: e.target.value })} />
                    </div>
                    <div className={`${styles.field} ${styles.fieldFull}`}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input type="checkbox" className={styles.checkbox} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                        Activo
                      </label>
                    </div>
                  </>
                )}
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.actions}>
                <button className={styles.btn} onClick={() => setModal(false)} disabled={saving}>Cancelar</button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {catModal && (
          <motion.div className={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.modal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>Categorías de gastos</h2>
                <button className={styles.closeBtn} onClick={() => setCatModal(false)}><X size={18} /></button>
              </div>

              <div className={styles.list} style={{ marginBottom: '0.75rem' }}>
                {categories.map((c) => (
                  <div key={c.id} className={styles.row}>
                    <p className={styles.rowTitle}>
                      <span className={styles.colorDot} style={{ background: c.color }} />
                      {c.name} {!c.active && <span className={styles.pill}>inactiva</span>}
                    </p>
                    <button type="button" className={styles.monthBtn} onClick={() => setCatForm({ id: c.id, name: c.name, color: c.color, active: c.active })}>
                      <Pencil size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Nombre</label>
                  <input type="text" className={styles.input} value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Color</label>
                  <input type="color" className={styles.input} value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} />
                </div>
              </div>

              <div className={styles.actions}>
                {catForm.id && <button className={styles.btn} onClick={() => setCatForm({ id: null, name: '', color: '#C4788A', active: true })}>Nueva</button>}
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveCategory} disabled={saving}>{catForm.id ? 'Guardar' : 'Agregar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
