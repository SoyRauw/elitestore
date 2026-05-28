import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Plus, Edit2, Trash2, LogOut, BarChart2, Package, Tag, ShoppingBag, FolderTree } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import styles from './AdminCategories.module.css'

export default function AdminCategories() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCategory, setEditCategory] = useState(null)
  const [name, setName] = useState('')

  const fetchCategories = async () => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  const handleEdit = (cat) => {
    setEditCategory(cat)
    setName(cat.name)
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

    if (editCategory) {
      await supabase.from('categories').update({ name }).eq('id', editCategory.id)
    } else {
      await supabase.from('categories').insert([{ name }])
    }
    setShowForm(false)
    setEditCategory(null)
    setName('')
    fetchCategories()
  }

  return (
    <AdminLayout>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Categorías</h1>
            <p className={styles.pageSubtitle}>Administra las categorías de tu tienda</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditCategory(null); setName(''); setShowForm(true) }}>
            <Plus size={16} /> Nueva Categoría
          </button>
        </div>

        {loading ? (
          <div className={styles.skeletonList}>
            {[1,2].map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <motion.tr key={c.id} className={styles.tableRow} initial={{opacity:0}} animate={{opacity:1}}>
                    <td style={{fontWeight:600}}>{c.name}</td>
                    <td style={{color:'var(--color-dark-soft)'}}>{c.slug}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => handleEdit(c)}><Edit2 size={15}/></button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(c.id)}><Trash2 size={15}/></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
  )
}
      

      {showForm && (
        <div className={styles.overlay}>
          <div className={styles.formModal}>
            <h3>{editCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
            <form onSubmit={handleSave} style={{display:'flex', flexDirection:'column', gap:'1rem', marginTop:'1rem'}}>
              <div>
                <label className="label">Nombre de Categoría</label>
                <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Blusas" required autoFocus/>
              </div>
              <div style={{display:'flex', gap:'1rem', justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
  )
}
    </AdminLayout>
  )
}
