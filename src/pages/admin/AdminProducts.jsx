import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Html5QrcodeScanner } from 'html5-qrcode'
import {
  Package, Plus, Edit2, Trash2, LogOut, BarChart2, Tag,
  Camera, X, ShoppingBag, Save, AlertTriangle, FolderTree
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import styles from './AdminProducts.module.css'

const SIZES = ['XS', 'S', 'M', 'L', 'XL']

export default function AdminProducts() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedId, setScannedId] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, categories(name), product_sizes(size, stock)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name')
    ])
    setProducts(prodRes.data || [])
    setCategories(catRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleEdit = (product) => {
    setEditProduct(product)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    await supabase.from('products').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchData()
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditProduct(null)
    setScannedId('')
  }

  return (
    <AdminLayout>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Productos</h1>
            <p className={styles.pageSubtitle}>{products.length} productos registrados</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowForm(true) }}>
            <Plus size={16} /> Nuevo
          </button>
        </div>

        {loading ? (
          <div className={styles.skeletonList}>
            {[1,2,3].map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID / Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const totalStock = p.product_sizes?.reduce((s, sizeObj) => s + (sizeObj.stock || 0), 0) || 0
                  const isLow = totalStock > 0 && totalStock < 5
                  return (
                    <motion.tr key={p.id} className={styles.tableRow} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>
                        <div className={styles.productCell}>
                          <div className={styles.productThumb}>
                            {p.images?.[0] ? <img src={p.images[0]} alt={p.name} /> : <ShoppingBag size={14} />}
                          </div>
                          <div>
                            <div className={styles.productName}>{p.name}</div>
                            <div className={styles.productId}>#{p.id}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{p.categories?.name || 'N/A'}</span></td>
                      <td className={styles.priceCell}>${p.price}</td>
                      <td>
                        <span className={`${styles.stockBadge} ${totalStock === 0 ? styles.stockOut : isLow ? styles.stockLow : styles.stockOk}`}>
                          {totalStock === 0 ? '⚠ Sin stock' : isLow ? `⚡ ${totalStock} uds` : `✓ ${totalStock} uds`}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.active ? 'badge-success' : 'badge-danger'}`}>
                          {p.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.editBtn} onClick={() => handleEdit(p)} aria-label="Editar">
                            <Edit2 size={15} />
                          </button>
                          <button className={styles.deleteBtn} onClick={() => setDeleteConfirm(p.id)} aria-label="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
            {products.length === 0 && (
              <div className={styles.emptyTable}>
                <Package size={40} style={{color:'var(--color-secondary)'}} />
                <p>No hay productos. <button onClick={() => setShowForm(true)} style={{color:'var(--color-primary)',textDecoration:'underline'}}>Agrega el primero</button></p>
              </div>
  )
}
          </div>
  )
}
      

      <AnimatePresence>
        {showForm && (
          <ProductFormModal
            product={editProduct}
            categories={categories}
            scannedId={scannedId}
            onClose={handleFormClose}
            onSaved={fetchData}
            onOpenScanner={() => setScannerOpen(true)}
            onScannedIdChange={setScannedId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scannerOpen && (
          <ScannerModal
            onResult={(id) => { setScannedId(id); setScannerOpen(false) }}
            onClose={() => setScannerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div className={styles.overlay} initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <motion.div className={styles.confirmModal} initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.9, opacity:0 }}>
              <AlertTriangle size={40} style={{color:'#d97706', margin:'0 auto'}} />
              <h3>¿Eliminar producto?</h3>
              <p>Esta acción no se puede deshacer.</p>
              <div style={{display:'flex',gap:'0.75rem',justifyContent:'center'}}>
                <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                <button className="btn" style={{background:'#dc2626',color:'white'}} onClick={() => handleDelete(deleteConfirm)}>Eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}

function ProductFormModal({ product, categories, scannedId, onClose, onSaved, onOpenScanner, onScannedIdChange }) {
  // Convert product_sizes array to an object map for the form
  const initialSizes = { XS:0, S:0, M:0, L:0, XL:0 }
  if (product && product.product_sizes) {
    product.product_sizes.forEach(ps => { initialSizes[ps.size] = ps.stock })
  }

  const [form, setForm] = useState({
    id: product?.id || scannedId || '',
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    category_id: product?.category_id || (categories[0]?.id || ''),
    sizes: initialSizes,
    featured: product?.featured || false,
    active: product?.active !== false,
    images: product?.images || [],
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(product?.images?.[0] || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  useEffect(() => {
    if (scannedId) setForm(f => ({ ...f, id: scannedId }))
  }, [scannedId])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.id.trim()) { setError('El ID del producto es obligatorio'); return }
    if (!form.category_id) { setError('Debe seleccionar una categoría'); return }
    setSaving(true)
    setError('')
    try {
      let imageUrls = form.images

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile)

        if (uploadError) {
          throw new Error('Error al subir la imagen: ' + uploadError.message)
        }

        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName)
          
        imageUrls = [publicUrlData.publicUrl]
      }

      const payload = {
        id: form.id.trim(),
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        category_id: form.category_id,
        featured: form.featured,
        active: form.active,
        images: imageUrls,
        updated_at: new Date().toISOString(),
      }
      
      // 1. Save Product
      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert([payload])
        if (error) throw error
      }

      // 2. Save Sizes (Upsert logic - deleting old ones and inserting new is easier if size rows didn't exist)
      // Since it's an update, let's delete existing for this product and re-insert to ensure clean state
      await supabase.from('product_sizes').delete().eq('product_id', payload.id)
      
      const sizesToInsert = Object.entries(form.sizes).map(([size, stock]) => ({
        product_id: payload.id,
        size,
        stock: parseInt(stock) || 0
      }))
      
      const { error: sizesError } = await supabase.from('product_sizes').insert(sizesToInsert)
      if (sizesError) throw sizesError

      onSaved()
      onClose()
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div className={styles.overlay} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className={styles.formModal} initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} transition={{type:'spring',stiffness:300,damping:28}}>
        <div className={styles.modalHeader}>
          <h2>{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>

        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.field}>
            <label className="label">ID del producto (serial físico)</label>
            <div className={styles.idRow}>
              <input className="input" value={form.id} onChange={(e) => { setForm({...form,id:e.target.value}); onScannedIdChange(e.target.value) }} placeholder="ej: PJ-001" required disabled={!!product} />
              {!product && (
                <button type="button" className={styles.scanBtn} onClick={onOpenScanner} title="Escanear código"><Camera size={20} /></button>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className="label">Nombre</label>
            <input className="input" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} placeholder="Pijama Satín Rosa" required />
          </div>

          <div className={styles.field}>
            <label className="label">Descripción</label>
            <textarea className={`input ${styles.textarea}`} value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} placeholder="Descripción..." rows={3} />
          </div>

          <div className={styles.field}>
            <label className="label">Imagen Principal</label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: 8, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Camera size={24} />
                </div>
  )
}
              <input type="file" accept="image/*" onChange={handleImageChange} className="input" style={{ flex: 1, padding: '0.4rem' }} />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className="label">Precio ($)</label>
              <input type="number" step="0.01" className="input" value={form.price} onChange={(e) => setForm({...form,price:e.target.value})} placeholder="350.00" required />
            </div>
            <div className={styles.field}>
              <label className="label">Categoría</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm({...form,category_id:e.target.value})} required>
                {categories.length === 0 && <option value="">Sin categorías</option>}
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className="label">Stock inicial por talla</label>
            <div className={styles.sizesGrid}>
              {SIZES.map((s) => (
                <div key={s} className={styles.sizeInput}>
                  <label className={styles.sizeLabel}>{s}</label>
                  <input type="number" min={0} className={`input ${styles.sizeQtyInput}`} value={form.sizes[s] ?? 0} onChange={(e) => setForm({...form, sizes:{...form.sizes,[s]:parseInt(e.target.value)||0}})} />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.toggles}>
            <label className={styles.toggle}><input type="checkbox" checked={form.featured} onChange={(e) => setForm({...form,featured:e.target.checked})} /><span>Producto destacado</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={form.active} onChange={(e) => setForm({...form,active:e.target.checked})} /><span>Activo (visible en tienda)</span></label>
          </div>

          {error && <p className={styles.formError}>{error}</p>}

          <div className={styles.formActions}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className={styles.spinner}/> : <><Save size={16}/> Guardar</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function ScannerModal({ onResult, onClose }) {
  const scannerInstance = useRef(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 250, height: 150 }, formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, false)
    scannerInstance.current = scanner
    scanner.render((res) => { scanner.clear(); onResult(res) }, () => {})
    return () => { scanner.clear().catch(() => {}) }
  }, [])

  return (
    <motion.div className={styles.overlay} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
      <motion.div className={styles.scannerModal} initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}><h2><Camera size={20}/> Escanear código</h2><button className={styles.closeBtn} onClick={onClose}><X size={20}/></button></div>
        <p className={styles.scanInstructions}>Apunta la cámara al código de barras o QR del producto</p>
        <div id="qr-reader" className={styles.scannerContainer} />
      </motion.div>
    </motion.div>
  )
}
