import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Pencil, Percent, DollarSign, Plus, Save, Tags, Trash2, X } from 'lucide-react'
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
  discount_scope: 'store',
  categoryRows: [],
})

function formatDay(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

function formatPercent(value) {
  return `${Number(value).toLocaleString('es-VE', { maximumFractionDigits: 2 })}%`
}

function categoryStoreSuffix(category) {
  if (category?.store_id === 'usa') return ' (USA)'
  if (category?.store_id === 'elite') return ' (Elite)'
  return ' (Ambas)'
}

function scopeLabel(scope) {
  if (scope === 'elite') return 'Elite'
  if (scope === 'usa') return 'USA'
  return 'Elite + USA'
}

export default function DayDiscounts() {
  const { isAdmin, user } = useAuth()
  const [discounts, setDiscounts] = useState([])
  const [categories, setCategories] = useState([])
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

  const loadCategories = useCallback(async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, store_id, prefix')
      .order('name')
    setCategories(data || [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCategories() }, [loadCategories])

  const categoriesForScope = useCallback((scope) => {
    if (scope === 'elite') {
      return categories.filter((category) => category.store_id === 'elite' || category.store_id === 'both')
    }
    if (scope === 'usa') {
      return categories.filter((category) => category.store_id === 'usa' || category.store_id === 'both')
    }
    return categories
  }, [categories])

  const scopeCategories = useMemo(
    () => categoriesForScope(form.store_scope),
    [categoriesForScope, form.store_scope]
  )

  const validationErrors = useMemo(() => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Escribe el nombre del descuento'
    if (form.dates.length === 0) errs.dates = 'Selecciona al menos un día'

    if (form.discount_scope === 'categories') {
      if (form.categoryRows.length === 0) {
        errs.categoryRows = 'Agrega al menos una categoría con su porcentaje'
      } else {
        const seen = new Set()
        form.categoryRows.forEach((row, index) => {
          if (!row.category_id) {
            errs.categoryRows = 'Selecciona la categoría en todas las filas'
          } else if (seen.has(row.category_id)) {
            errs.categoryRows = 'No repitas la misma categoría'
          }
          seen.add(row.category_id)

          const value = parseFloat(row.percentage)
          if (!Number.isFinite(value) || value <= 0 || value > 100) {
            errs[`category_pct_${index}`] = 'Entre 1 y 100'
          }
        })
      }
    } else {
      const value = parseFloat(form.discount_value)
      if (!Number.isFinite(value) || value <= 0) {
        errs.discount_value = 'Ingresa un valor mayor a 0'
      } else if (form.discount_type === 'percentage' && value > 100) {
        errs.discount_value = 'El porcentaje no puede ser mayor a 100'
      }
    }

    return errs
  }, [form])

  const hasErrors = Object.keys(validationErrors).length > 0

  const openNew = () => {
    setForm(emptyForm())
    setMonth(monthStart(new Date()))
    setError('')
    setShowForm(true)
  }

  const openEdit = (discount) => {
    const dates = [...(discount.dates || [])].sort()
    const rows = (discount.day_discount_categories || []).map((row) => ({
      category_id: row.category_id,
      percentage: String(row.percentage ?? ''),
    }))
    setForm({
      id: discount.id,
      name: discount.name || '',
      discount_type: discount.discount_type || 'percentage',
      discount_value: discount.discount_value ?? '',
      dates,
      is_active: discount.is_active !== false,
      store_scope: discount.store_scope || 'ambos',
      discount_scope: discount.discount_scope || 'store',
      categoryRows: rows,
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

  const handleStoreScopeChange = (value) => {
    setForm((prev) => {
      const allowed = new Set(categoriesForScope(value).map((category) => category.id))
      return {
        ...prev,
        store_scope: value,
        categoryRows: prev.categoryRows.filter(
          (row) => !row.category_id || allowed.has(row.category_id)
        ),
      }
    })
  }

  const addCategoryRow = () => {
    setForm((prev) => ({
      ...prev,
      categoryRows: [...prev.categoryRows, { category_id: '', percentage: '' }],
    }))
  }

  const updateCategoryRow = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      categoryRows: prev.categoryRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      ),
    }))
  }

  const removeCategoryRow = (index) => {
    setForm((prev) => ({
      ...prev,
      categoryRows: prev.categoryRows.filter((_, rowIndex) => rowIndex !== index),
    }))
  }

  const categoryOptionsFor = (index) => {
    const used = new Set(
      form.categoryRows
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row) => row.category_id)
        .filter(Boolean)
    )
    return scopeCategories.filter((category) => !used.has(category.id))
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
      const isCategoryScope = form.discount_scope === 'categories'
      const cleanRows = isCategoryScope
        ? form.categoryRows.map((row) => ({
            category_id: row.category_id,
            percentage: parseFloat(row.percentage),
          }))
        : []
      const maxPercentage = cleanRows.length
        ? Math.max(...cleanRows.map((row) => row.percentage))
        : 0

      const payload = {
        name: form.name.trim(),
        discount_type: isCategoryScope ? 'percentage' : form.discount_type,
        discount_value: isCategoryScope ? maxPercentage : parseFloat(form.discount_value),
        dates: [...form.dates].sort(),
        is_active: form.is_active,
        store_scope: form.store_scope,
        discount_scope: form.discount_scope,
      }

      let discountId = form.id
      if (form.id) {
        const { error: updateError } = await supabase
          .from('day_discounts')
          .update(payload)
          .eq('id', form.id)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase
          .from('day_discounts')
          .insert([{ ...payload, created_by: user?.id || null }])
          .select('id')
          .single()
        if (insertError) throw insertError
        discountId = data.id
      }

      if (discountId) {
        const { error: deleteRowsError } = await supabase
          .from('day_discount_categories')
          .delete()
          .eq('discount_id', discountId)
        if (deleteRowsError) throw deleteRowsError

        if (isCategoryScope && cleanRows.length > 0) {
          const { error: rowsError } = await supabase
            .from('day_discount_categories')
            .insert(cleanRows.map((row) => ({
              discount_id: discountId,
              category_id: row.category_id,
              percentage: row.percentage,
            })))
          if (rowsError) throw rowsError
        }
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
          <h2 className={styles.daySectionTitle}><CalendarDays size={19} /> Descuentos por días y categorías</h2>
          <p className={styles.daySectionSub}>
            Se aplican solos a las ventas de detal de los días marcados. Puedes crear varias promociones el mismo día:
            cada producto toma la que más le convenga. No se acumulan con cupones.
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Nuevo descuento
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
            const isCategoryScope = discount.discount_scope === 'categories'
            const categoryRows = discount.day_discount_categories || []
            return (
              <div key={discount.id} className={`${styles.dayCard} ${!discount.is_active || past ? styles.dayCardInactive : ''}`}>
                <div className={styles.dayCardTop}>
                  <div>
                    <h3 className={styles.dayCardName}>{discount.name}</h3>
                    <p className={styles.dayCardValue}>
                      {isCategoryScope
                        ? <Tags size={14} />
                        : discount.discount_type === 'percentage'
                          ? <Percent size={14} />
                          : <DollarSign size={14} />}
                      {isCategoryScope
                        ? `${categoryRows.length} ${categoryRows.length === 1 ? 'categoría' : 'categorías'}`
                        : `${dayDiscountValueLabel(discount)} de descuento`}
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

                {isCategoryScope && categoryRows.length > 0 && (
                  <div className={styles.dayCategoryList}>
                    {categoryRows.map((row) => (
                      <span key={row.category_id} className={styles.dayCategoryChip}>
                        {row.categories?.name || 'Categoría'} {formatPercent(row.percentage)}
                      </span>
                    ))}
                  </div>
                )}

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
                <h2>{form.id ? 'Editar descuento' : 'Nuevo descuento'}</h2>
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
                    <label>Aplicar en</label>
                    <select
                      className={styles.input}
                      value={form.store_scope}
                      onChange={(e) => handleStoreScopeChange(e.target.value)}
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

                <div className={styles.field}>
                  <label>Alcance</label>
                  <div className={styles.scopeButtons}>
                    <button
                      type="button"
                      className={`${styles.scopeBtn} ${form.discount_scope === 'store' ? styles.scopeBtnActive : ''}`}
                      onClick={() => setForm({ ...form, discount_scope: 'store' })}
                    >
                      Toda la tienda
                    </button>
                    <button
                      type="button"
                      className={`${styles.scopeBtn} ${form.discount_scope === 'categories' ? styles.scopeBtnActive : ''}`}
                      onClick={() => setForm({ ...form, discount_scope: 'categories' })}
                    >
                      Por categorías
                    </button>
                  </div>
                </div>

                {form.discount_scope === 'store' ? (
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
                ) : (
                  <div className={styles.field}>
                    <label>Porcentaje por categoría</label>
                    <div className={styles.categoryEditor}>
                      {form.categoryRows.map((row, index) => (
                        <div key={index} className={styles.categoryRow}>
                          <select
                            className={styles.input}
                            value={row.category_id}
                            onChange={(e) => updateCategoryRow(index, 'category_id', e.target.value)}
                          >
                            <option value="">Selecciona categoría</option>
                            {categoryOptionsFor(index).map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}{categoryStoreSuffix(category)}
                              </option>
                            ))}
                          </select>
                          <div className={styles.categoryPercentWrap}>
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              max="100"
                              className={`${styles.input} ${validationErrors[`category_pct_${index}`] ? styles.inputError : ''}`}
                              value={row.percentage}
                              onChange={(e) => updateCategoryRow(index, 'percentage', e.target.value)}
                              placeholder="20"
                            />
                            <span>%</span>
                          </div>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => removeCategoryRow(index)}
                            aria-label="Quitar categoría"
                          >
                            <Trash2 size={14} />
                          </button>
                          {validationErrors[`category_pct_${index}`] && (
                            <span className={styles.fieldError}>{validationErrors[`category_pct_${index}`]}</span>
                          )}
                        </div>
                      ))}
                      <button type="button" className="btn btn-outline" onClick={addCategoryRow}>
                        <Plus size={14} /> Agregar categoría
                      </button>
                      {validationErrors.categoryRows && (
                        <span className={styles.fieldError}>{validationErrors.categoryRows}</span>
                      )}
                      <p className={styles.dayScopeHint}>
                        Puedes poner un porcentaje distinto por categoría. Solo se aplicará a los productos de esas categorías.
                      </p>
                    </div>
                  </div>
                )}

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
                title={form.id ? '¿Guardar cambios?' : '¿Crear descuento?'}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={executeSave}
                confirmText="Confirmar"
                disabled={saving}
              >
                <ul className={styles.summaryList}>
                  <li><span className={styles.summaryLabel}>Nombre</span><span className={styles.summaryValue}>{form.name || '—'}</span></li>
                  <li>
                    <span className={styles.summaryLabel}>Alcance</span>
                    <span className={styles.summaryValue}>
                      {form.discount_scope === 'categories' ? 'Por categorías' : 'Toda la tienda'}
                    </span>
                  </li>
                  {form.discount_scope === 'categories' ? (
                    <li>
                      <span className={styles.summaryLabel}>Categorías</span>
                      <span className={styles.summaryValue}>
                        {form.categoryRows
                          .map((row) => {
                            const category = categories.find((item) => item.id === row.category_id)
                            return `${category?.name || 'Categoría'} ${formatPercent(row.percentage)}`
                          })
                          .join(' · ') || '—'}
                      </span>
                    </li>
                  ) : (
                    <li>
                      <span className={styles.summaryLabel}>Descuento</span>
                      <span className={styles.summaryValue}>
                        {form.discount_type === 'percentage' ? formatPercent(form.discount_value) : `$${form.discount_value}`}
                      </span>
                    </li>
                  )}
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
        title="¿Eliminar descuento?"
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
