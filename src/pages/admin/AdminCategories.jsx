import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import { generateCategoryPrefix } from '../../lib/sku'
import * as V from '../../lib/validation'
import styles from './AdminCategories.module.css'

const DEFAULT_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'UNI']

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCategory, setEditCategory] = useState(null)
  const [name, setName] = useState('')
  const [prefix, setPrefix] = useState('')
  const [sizeLabel, setSizeLabel] = useState('Talla')
  const [sizeOptions, setSizeOptions] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')

  const fetchCategories = async () => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  const handleNew = () => {
    setEditCategory(null)
    setName('')
    setPrefix('')
    setSizeLabel('Talla')
    setSizeOptions(DEFAULT_OPTIONS.join(', '))
    setShowForm(true)
  }

  const handleEdit = (cat) => {
    setEditCategory(cat)
    setName(cat.name)
    setPrefix(cat.prefix || '')
    setSizeLabel(cat.size_label || 'Talla')
    setSizeOptions((cat.size_options || DEFAULT_OPTIONS).join(', '))
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar esta categoría? Los productos perderán su categoría.')) {
      await supabase.from('categories').delete().eq('id', id)
      fetchCategories()
    }
  }

  const otherCategories = useMemo(() => categories.filter(c => !editCategory || c.id !== editCategory.id), [categories, editCategory])

  const options = useMemo(() =>
    sizeOptions.split(',').map(s => s.trim()).filter(Boolean)
  , [sizeOptions])

  const validationErrors = useMemo(() => {
    const errs = {}
    errs.name = V.required(name, 'El nombre')
    const finalPrefix = prefix.trim().toUpperCase() || generateCategoryPrefix(name, otherCategories.map(c => c.prefix))
    errs.prefix = V.run(finalPrefix, [
      (v) => V.required(v, 'El prefijo'),
      (v) => V.noSpaces(v, 'El prefijo'),
      (v) => V.unique(v, 'El prefijo', otherCategories.map(c => c.prefix)),
    ])
    errs.sizeLabel = V.required(sizeLabel, 'La etiqueta de medida')
    if (options.length === 0) errs.sizeOptions = 'Debe agregar al menos una medida'
    Object.keys(errs).forEach(k => { if (!errs[k]) delete errs[k] })
    return errs
  }, [name, prefix, sizeLabel, options, otherCategories])

  const hasErrors = useMemo(() => Object.keys(validationErrors).length > 0, [validationErrors])

  const handleFormSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (hasErrors) return
    setConfirmOpen(true)
  }

  const executeSave = async () => {
    const finalPrefix = prefix.trim().toUpperCase() || generateCategoryPrefix(name, otherCategories.map(c => c.prefix))
    const payload = {
      name: name.trim(),
      prefix: finalPrefix,
      size_label: sizeLabel.trim() || 'Talla',
      size_options: options,
    }

    setSaving(true)
    setError('')
    try {
      if (editCategory) {
        const { error: dbError } = await supabase.from('categories').update(payload).eq('id', editCategory.id)
        if (dbError) throw dbError
      } else {
        const { error: dbError } = await supabase.from('categories').insert([payload])
        if (dbError) throw dbError
      }
      setShowForm(false)
      setEditCategory(null)
      setName('')
      setPrefix('')
      setSizeLabel('Talla')
      setSizeOptions('')
      fetchCategories()
    } catch (e) {
      console.error('Error guardando categoría:', e)
      const message = e?.message || e?.error?.message || 'Error al guardar'
      const lower = message.toLowerCase()
      if (lower.includes('categories_prefix_key') || (lower.includes('duplicate key') && lower.includes('prefix'))) {
        setError('El prefijo ya está en uso por otra categoría.')
      } else if (lower.includes('row-level security')) {
        setError(`Error de permisos (RLS): ${message}.`)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  return (
    <AdminLayout>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>Categorías</h1>
          <p className={styles.pageSubtitle}>Administra las categorías y sus medidas</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          <Plus size={16} /> Nueva Categoría
        </button>
      </div>

      {loading ? (
        <div className={styles.skeletonList}>
          {[1, 2].map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Prefijo</th>
                <th>Etiqueta</th>
                <th>Medidas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <motion.tr key={c.id} className={styles.tableRow} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td><span className="badge badge-primary">{c.prefix || '—'}</span></td>
                  <td>{c.size_label || 'Talla'}</td>
                  <td style={{ color: 'var(--color-dark-soft)' }}>
                    {(c.size_options || []).slice(0, 6).join(', ')}
                    {(c.size_options || []).length > 6 && '...'}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.editBtn} onClick={() => handleEdit(c)}><Edit2 size={15} /></button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(c.id)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className={styles.overlay}>
          <div className={styles.formModal}>
            <div className={styles.modalHeader}>
              <h3>{editCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button className={styles.closeBtn} onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }} noValidate onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}>
              <div>
                <label className="label">Nombre de Categoría</label>
                <input
                  className={`input ${validationErrors.name ? styles.inputError : ''}`}
                  value={name}
                  onChange={e => {
                    const newName = e.target.value
                    setName(newName)
                    if (!editCategory) {
                      setPrefix(generateCategoryPrefix(newName, otherCategories.map(c => c.prefix)))
                    }
                  }}
                  placeholder="Ej: Blusas"
                  autoFocus
                />
                {validationErrors.name && <span className={styles.fieldError}>{validationErrors.name}</span>}
              </div>
              <div>
                <label className="label">Prefijo de código</label>
                <input
                  className={`input ${validationErrors.prefix ? styles.inputError : ''}`}
                  value={prefix}
                  onChange={e => setPrefix(e.target.value.toUpperCase())}
                  placeholder="Ej: BLU"
                />
                {validationErrors.prefix ? (
                  <span className={styles.fieldError}>{validationErrors.prefix}</span>
                ) : (
                  <small style={{ color: 'var(--color-dark-soft)', fontSize: '0.8rem' }}>Se usa para generar códigos como BLU-001</small>
                )}
              </div>
              <div>
                <label className="label">Etiqueta de medida</label>
                <input className={`input ${validationErrors.sizeLabel ? styles.inputError : ''}`} value={sizeLabel} onChange={e => setSizeLabel(e.target.value)} placeholder="Ej: Talla, Onzas, Talla calzado" />
                {validationErrors.sizeLabel && <span className={styles.fieldError}>{validationErrors.sizeLabel}</span>}
              </div>
              <div>
                <label className="label">Medidas disponibles (separadas por comas)</label>
                <input className={`input ${validationErrors.sizeOptions ? styles.inputError : ''}`} value={sizeOptions} onChange={e => setSizeOptions(e.target.value)} placeholder="XS, S, M, L, XL" />
                {validationErrors.sizeOptions && <span className={styles.fieldError}>{validationErrors.sizeOptions}</span>}
              </div>
              {error && <p className={styles.formError}>{error}</p>}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || hasErrors}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>

            <ConfirmModal
              isOpen={confirmOpen}
              title={editCategory ? '¿Guardar cambios?' : '¿Crear categoría?'}
              onCancel={() => setConfirmOpen(false)}
              onConfirm={executeSave}
              confirmText="Confirmar"
              disabled={saving}
            >
              <ul className={styles.summaryList}>
                <li><span className={styles.summaryLabel}>Nombre</span><span className={styles.summaryValue}>{name || '—'}</span></li>
                <li><span className={styles.summaryLabel}>Prefijo</span><span className={styles.summaryValue}>{prefix.trim().toUpperCase() || generateCategoryPrefix(name, otherCategories.map(c => c.prefix)) || '—'}</span></li>
                <li><span className={styles.summaryLabel}>Etiqueta</span><span className={styles.summaryValue}>{sizeLabel || '—'}</span></li>
                <li><span className={styles.summaryLabel}>Medidas</span><span className={styles.summaryValue}>{options.length}</span></li>
              </ul>
            </ConfirmModal>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
