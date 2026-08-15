import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import { generateCategoryPrefix } from '../../lib/sku'
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

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    const options = sizeOptions
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    if (options.length === 0) {
      alert('Agrega al menos una medida')
      return
    }

    const otherPrefixes = categories
      .filter(c => !editCategory || c.id !== editCategory.id)
      .map(c => c.prefix)
    const finalPrefix = prefix.trim().toUpperCase() || generateCategoryPrefix(name, otherPrefixes)

    if (!finalPrefix) {
      alert('El prefijo no puede estar vacío')
      return
    }
    if (otherPrefixes.includes(finalPrefix)) {
      alert(`El prefijo "${finalPrefix}" ya está en uso por otra categoría`)
      return
    }

    setSaving(true)
    const payload = {
      name: name.trim(),
      prefix: finalPrefix,
      size_label: sizeLabel.trim() || 'Talla',
      size_options: options,
    }

    if (editCategory) {
      await supabase.from('categories').update(payload).eq('id', editCategory.id)
    } else {
      await supabase.from('categories').insert([payload])
    }
    setSaving(false)
    setShowForm(false)
    setEditCategory(null)
    setName('')
    setPrefix('')
    setSizeLabel('Talla')
    setSizeOptions('')
    fetchCategories()
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
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label className="label">Nombre de Categoría</label>
                <input
                  className="input"
                  value={name}
                  onChange={e => {
                    const newName = e.target.value
                    setName(newName)
                    if (!editCategory) {
                      const otherPrefixes = categories.map(c => c.prefix)
                      setPrefix(generateCategoryPrefix(newName, otherPrefixes))
                    }
                  }}
                  placeholder="Ej: Blusas"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Prefijo de código</label>
                <input
                  className="input"
                  value={prefix}
                  onChange={e => setPrefix(e.target.value.toUpperCase())}
                  placeholder="Ej: BLU"
                  required
                />
                <small style={{ color: 'var(--color-dark-soft)', fontSize: '0.8rem' }}>Se usa para generar códigos como BLU-001</small>
              </div>
              <div>
                <label className="label">Etiqueta de medida</label>
                <input className="input" value={sizeLabel} onChange={e => setSizeLabel(e.target.value)} placeholder="Ej: Talla, Onzas, Talla calzado" required />
              </div>
              <div>
                <label className="label">Medidas disponibles (separadas por comas)</label>
                <input className="input" value={sizeOptions} onChange={e => setSizeOptions(e.target.value)} placeholder="XS, S, M, L, XL" required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
