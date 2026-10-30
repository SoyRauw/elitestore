import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Pencil, Percent, DollarSign, Plus, Save, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { addMonths, monthStart } from '../../lib/finance'
import { dayDiscountValueLabel, fetchAllDayDiscounts, localISODate } from '../../lib/dayDiscounts'
import MonthGrid from './MonthGrid'
import ConfirmModal from './ConfirmModal'
import styles from '../../pages/admin/AdminCoupons.module.css'

const emptyForm = () => ({
  id: null,
  name: '',
  discount_type: 'percentage',
  discount_value: '',
  dates: [],
  is_active: true,
  store_scope: 'ambos',
})

function formatDay(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

function scopeLabel(scope) {
  if (scope === 'elite') return 'Elite'
  if (scope === 'usa') return 'USA'
  return 'Elite + USA'
}

export default function DayDiscounts() {
  const { isAdmin, user } = useAuth()
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [month, setMonth] = useState(monthStart(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const todayISO = localISODate()

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setDiscounts(await fetchAllDayDiscounts())
    } catch (e) {
      console.error('Error cargando descuentos por días:', e)
      setDiscounts([])
      setLoadError(e.message || 'No se pudieron cargar los descuentos por días')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const validationErrors = useMemo(() => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Escribe el nombre del descuento'
    const value = parseFloat(form.discount_value)
    if (!Number.isFinite(value) || value <= 0) {
      errs.discount_value = 'Ingresa un valor mayor a 0'
    } else if (form.discount_type === 'percentage' && value > 100) {
      errs.discount_value = 'El porcentaje no puede ser mayor a 100'
    }
    if (form.dates.length === 0) errs.dates = 'Selecciona al menos un día'
    if (form.is_active) {
      const overlap = discounts.find((discount) => (
        discount.id !== form.id
        && discount.is_active
        && (discount.dates || []).some((date) => form.dates.includes(date))
      ))
      if (overlap) errs.dates = `Se solapa con "${overlap.name}". Elige otros días.`
    }
    return errs
  }, [form, discounts])

  const hasErrors = Object.keys(validationErrors).length > 0

  const openNew = () => {
    setForm(emptyForm())
    setMonth(monthStart(new Date()))
    setError('')
    setShowForm(true)
  }

  const openEdit = (discount) => {
    const dates = [...(discount.dates || [])].sort()
    setForm({
      id: discount.id,
      name: discount.name || '',
      discount_type: discount.discount_type || 'percentage',
      discount_value: discount.discount_value ?? '',
      dates,
      is_active: discount.is_active !== false,
      store_scope: discount.store_scope || 'ambos',
    })
    setMonth(dates.length ? monthStart(new Date(`${dates[0]}T12:00:00`)) : monthStart(new Date()))
    setError('')
    setShowForm(true)
  }

  const toggleDate = (iso) => {
    setForm((prev) => {
      const exists = prev.dates.includes(iso)
      const dates = exists
        ? prev.dates.filter((date) => date !== iso)
        : [...prev.dates, iso]
      return { ...prev, dates: dates.sort() }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (hasErrors) return
    setConfirmOpen(true)
  }

  const executeSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        dates: [...form.dates].sort(),
        is_active: form.is_active,
        store_scope: form.store_scope,
      }
      if (form.id) {
        const { error: updateError } = await supabase
          .from('day_discounts')
          .update(payload)
          .eq('id', form.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('day_discounts')
          .insert([{ ...payload, created_by: user?.id || null }])
        if (insertError) throw insertError
      }
      setShowForm(false)
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error guardando el descuento')
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  const executeDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error: deleteError } = await supabase
        .from('day_discounts')
        .delete()
        .eq('id', deleteTarget.id)
      if (deleteError) throw deleteError
      setDeleteTarget(null)
      await load()
    } catch (e) {
      console.error(e)
      setLoadError(e.message || 'Error eliminando el descuento')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={styles.daySection}>
      <div className={styles.daySectionHead}>
        <div>
          <h2 className={styles.daySectionTitle}><CalendarDays size={19} /> Descuentos por días</h2>
          <p className={styles.daySectionSub}>
            Se aplican solos a las ventas de detal de los días marcados. No se acumulan con cupones.
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Descuento por días
          </button>
        )}
      </div>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {loading ? (
        <p className={styles.empty}>Cargando descuentos...</p>
      ) : discounts.length === 0 ? (
        <div className={styles.dayEmpty}>
          <CalendarDays size={34} />
          <p>No hay descuentos por días creados.</p>
          {isAdmin && (
            <button type="button" className="btn btn-outline" onClick={openNew}>
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className={styles.dayGrid}>
          {discounts.map((discount) => {
            const dates = [...(discount.dates || [])].sort()
            const past = dates.length > 0 && dates.every((date) => date < todayISO)
            const today = dates.includes(todayISO)
            return (
              <div key={discount.id} className={`${styles.dayCard} ${!discount.is_active || past ? styles.dayCardInactive : ''}`}>
                <div className={styles.dayCardTop}>
                  <div>
                    <h3 className={styles.dayCardName}>{discount.name}</h3>
                    <p className={styles.dayCardValue}>
                      {discount.discount_type === 'percentage' ? <Percent size={14} /> : <DollarSign size={14} />}
                      {dayDiscountValueLabel(discount)} de descuento
                    </p>
                  </div>
                  {isAdmin && (
                    <div className={styles.dayCardActions}>
                      <button type="button" className={styles.iconBtn} onClick={() => openEdit(discount)} aria-label="Editar">
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                        onClick={() => setDeleteTarget(discount)}
                        aria-label="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.dayDateList}>
                  {dates.slice(0, 4).map((date) => (
                    <span key={date} className={`${styles.dayDateChip} ${date === todayISO ? styles.dayDateToday : ''}`}>
                      {formatDay(date)}
                    </span>
                  ))}
                  {dates.length > 4 && <span className={styles.dayDateMore}>+{dates.length - 4}</span>}
                </div>

                <div className={styles.dayCardFooter}>
                  {!discount.is_active ? (
                    <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactivo</span>
                  ) : past ? (
                    <span className={`${styles.badge} ${styles.badgeExpired}`}>Vencido</span>
                  ) : today ? (
                    <span className={`${styles.badge} ${styles.badgeActive}`}>Hoy</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeActive}`}>Activo</span>
                  )}
                  <span className={`${styles.badge} ${discount.store_scope === 'usa' ? 'badge-info' : discount.store_scope === 'elite' ? 'badge-primary' : 'badge-warning'}`}>
                    {scopeLabel(discount.store_scope)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={`${styles.modal} ${styles.dayModal}`} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>{form.id ? 'Editar descuento por días' : 'Nuevo descuento por días'}</h2>
                <button type="button" className={styles.closeBtn} onClick={() => setShowForm(false)}>
                  <X size={20} />
                </button>
              </div>

              <form className={styles.form} onSubmit={handleSubmit} noValidate onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}>
                <div className={styles.field}>
                  <label>Nombre</label>
                  <input
                    className={`${styles.input} ${validationErrors.name ? styles.inputError : ''}`}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Fin de semana 10%"
                  />
                  {validationErrors.name && <span className={styles.fieldError}>{validationErrors.name}</span>}
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Tipo de descuento</label>
                    <select
                      className={styles.input}
                      value={form.discount_type}
                      onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                    >
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Monto fijo ($)</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`${styles.input} ${validationErrors.discount_value ? styles.inputError : ''}`}
                      value={form.discount_value}
                      onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                      placeholder={form.discount_type === 'percentage' ? '10' : '5'}
                    />
                    {validationErrors.discount_value && <span className={styles.fieldError}>{validationErrors.discount_value}</span>}
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Días que aplica</label>
                  <div className={styles.calendarBox}>
                    <MonthGrid
                      month={month}
                      onMonthChange={(delta) => setMonth((prev) => addMonths(prev, delta))}
                      onDayClick={toggleDate}
                      dayClassName={(iso) => form.dates.includes(iso) ? styles.selectedDay : ''}
                    />
                  </div>
                  <div className={styles.dayDates}>
                    {form.dates.length === 0 ? (
                      <span className={styles.dayDatesEmpty}>Ningún día seleccionado</span>
                    ) : (
                      form.dates.map((date) => (
                        <span key={date} className={styles.dayDateChip}>
                          {formatDay(date)}
                          <button type="button" onClick={() => toggleDate(date)} aria-label={`Quitar ${date}`}>
                            <X size={11} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  {validationErrors.dates && <span className={styles.fieldError}>{validationErrors.dates}</span>}
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Aplicar en</label>
                    <select
                      className={styles.input}
                      value={form.store_scope}
                      onChange={(e) => setForm({ ...form, store_scope: e.target.value })}
                    >
                      <option value="ambos">Elite + USA</option>
                      <option value="elite">Solo Elite Store</option>
                      <option value="usa">Solo USA Super Store</option>
                    </select>
                  </div>
                  <label className={styles.toggle} style={{ alignSelf: 'end', paddingBottom: '0.65rem' }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    <span>Activo</span>
                  </label>
                </div>

                {error && <p className={styles.formError}>{error}</p>}

                <div className={styles.formActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || hasErrors}>
                    {saving ? 'Guardando...' : <><Save size={16} /> Guardar</>}
                  </button>
                </div>
              </form>

              <ConfirmModal
                isOpen={confirmOpen}
                title={form.id ? '¿Guardar cambios?' : '¿Crear descuento por días?'}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={executeSave}
                confirmText="Confirmar"
                disabled={saving}
              >
                <ul className={styles.summaryList}>
                  <li><span className={styles.summaryLabel}>Nombre</span><span className={styles.summaryValue}>{form.name || '—'}</span></li>
                  <li><span className={styles.summaryLabel}>Descuento</span><span className={styles.summaryValue}>{form.discount_type === 'percentage' ? `${form.discount_value}%` : `$${form.discount_value}`}</span></li>
                  <li><span className={styles.summaryLabel}>Días</span><span className={styles.summaryValue}>{form.dates.length}</span></li>
                  <li><span className={styles.summaryLabel}>Aplica en</span><span className={styles.summaryValue}>{scopeLabel(form.store_scope)}</span></li>
                </ul>
              </ConfirmModal>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="¿Eliminar descuento por días?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        confirmText="Eliminar"
        disabled={deleting}
      >
        <p>Se eliminará <strong>{deleteTarget?.name}</strong>. Las ventas ya registradas conservan el descuento aplicado.</p>
      </ConfirmModal>
    </div>
  )
}
