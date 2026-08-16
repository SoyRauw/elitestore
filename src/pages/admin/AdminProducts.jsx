import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Html5QrcodeScanner } from 'html5-qrcode'
import {
  Package, Plus, Edit2, Trash2,
  Camera, X, ShoppingBag, Save, AlertTriangle,
  ImagePlus, Star, RefreshCw, Copy, Download
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import { generateProductId, generateProductCode, generateVariantCode } from '../../lib/sku'
import { exportProductLabels } from '../../lib/labelExport'
import styles from './AdminProducts.module.css'



function emptyVariant() {
  return {
    id: `temp-${Math.random().toString(36).slice(2)}`,
    sku: '',
    color: '',
    variant_name: '',
    size: '',
    barcode: '',
    price: null,
    wholesale_price: null,
    stock: 0,
    image: null,
    pendingImageFile: null,
    pendingImagePreview: null,
    isNew: true,
    isDeleted: false,
  }
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedId, setScannedId] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkError, setBulkError] = useState('')

  const handleScanResult = useCallback((id) => {
    setScannedId(id)
    setScannerOpen(false)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, categories(*), product_variants(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name')
    ])
    setProducts(prodRes.data || [])
    setCategories(catRes.data || [])
    setLoading(false)
    setSelectedIds(new Set())
  }

  useEffect(() => { fetchData() }, [])

  const handleEdit = async (product) => {
    setLoadingEdit(product.id)
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*), product_variants(*)')
      .eq('id', product.id)
      .single()
    setLoadingEdit(false)
    setEditProduct(error ? product : data)
    setShowForm(true)
  }

  const checkProductsHaveSales = async (ids) => {
    const { data } = await supabase
      .from('movement_items')
      .select('product_id, products(name)')
      .in('product_id', ids)
    const unique = new Map()
    ;(data || []).forEach(row => {
      if (!unique.has(row.product_id)) unique.set(row.product_id, row.products?.name || row.product_id)
    })
    return Array.from(unique.entries())
  }

  const deleteProductsByIds = async (ids) => {
    const idsArray = Array.from(ids)
    if (idsArray.length === 0) return

    setBulkError('')
    const sales = await checkProductsHaveSales(idsArray)
    if (sales.length > 0) {
      setBulkError(`No se pueden eliminar porque tienen ventas previas: ${sales.map(([, name]) => name).join(', ')}`)
      return
    }

    await supabase.from('product_variants').delete().in('product_id', idsArray)
    await supabase.from('products').delete().in('id', idsArray)
    setDeleteConfirm(null)
    fetchData()
  }

  const handleDelete = async (id) => {
    await deleteProductsByIds(new Set([id]))
  }

  const handleBulkDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.size} productos?`)) return
    await deleteProductsByIds(selectedIds)
  }

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map(p => p.id)))
    }
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedIds.size > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDelete}>
              <Trash2 size={16} /> Eliminar {selectedIds.size}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowForm(true) }}>
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </div>

      {bulkError && <p className={styles.formError}>{bulkError}</p>}

      {loading ? (
        <div className={styles.skeletonList}>
          {[1,2,3].map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" checked={products.length > 0 && selectedIds.size === products.length} onChange={toggleAll} />
                </th>
                <th>ID / Producto</th>
                <th>Categoría</th>
                <th>Precio Base</th>
                <th>Variantes / Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const variants = p.product_variants || []
                const totalStock = variants.reduce((s, v) => s + (v.stock || 0), 0)
                const isLow = totalStock > 0 && totalStock < 5
                const isSelected = selectedIds.has(p.id)
                return (
                  <motion.tr key={p.id} className={`${styles.tableRow} ${isSelected ? styles.tableRowSelected : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td data-label="Seleccionar">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(p.id)} />
                    </td>
                    <td data-label="Producto">
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
                    <td data-label="Categoría"><span className="badge badge-primary">{p.categories?.name || 'N/A'}</span></td>
                    <td data-label="Precio" className={styles.priceCell}>
                      ${p.price}
                      {p.wholesale_price > 0 && <div style={{fontSize:'12px', color:'var(--color-dark-soft)', fontWeight:'normal'}}>Mayor: ${p.wholesale_price}</div>}
                    </td>
                    <td data-label="Stock Total">
                      <span className={`${styles.stockBadge} ${totalStock === 0 ? styles.stockOut : isLow ? styles.stockLow : styles.stockOk}`}>
                        {totalStock === 0 ? '⚠ Sin stock' : isLow ? `⚡ ${totalStock} uds` : `✓ ${totalStock} uds`}
                      </span>
                      <div style={{fontSize:'12px', color:'var(--color-dark-soft)', marginTop:'2px'}}>{variants.length} variantes</div>
                    </td>
                    <td data-label="Estado">
                      <span className={`badge ${p.active ? 'badge-success' : 'badge-danger'}`}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="Acciones">
                      <div className={styles.actions}>
                        <button
                          className={styles.editBtn}
                          onClick={() => handleEdit(p)}
                          aria-label="Editar"
                          disabled={loadingEdit === p.id}
                        >
                          {loadingEdit === p.id
                            ? <div className={styles.spinnerSm} />
                            : <Edit2 size={15} />
                          }
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
          )}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <ProductFormModal
            product={editProduct}
            categories={categories}
            allProducts={products}
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
            onResult={handleScanResult}
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

function ProductFormModal({ product, categories, allProducts, scannedId, onClose, onSaved, onOpenScanner, onScannedIdChange }) {
  const initialVariants = useMemo(() => {
    if (product?.product_variants?.length) {
      return product.product_variants.map(v => ({ ...v, isNew: false, isDeleted: false }))
    }
    return [emptyVariant()]
  }, [product])

  const [form, setForm] = useState({
    id: product?.id || scannedId || '',
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price ?? '',
    wholesale_price: product?.wholesale_price ?? '',
    min_wholesale_qty: product?.min_wholesale_qty ?? 0,
    category_id: product?.category_id || (categories[0]?.id || ''),
    featured: product?.featured || false,
    active: product?.active !== false,
    images: Array.isArray(product?.images) ? product.images : [],
    cost_price: product?.cost_price ?? '',
    shipping_cost: product?.shipping_cost ?? '',
    freight_cost: product?.freight_cost ?? '',
    profit_margin: product?.profit_margin ?? 50,
  })
  const [priceTouched, setPriceTouched] = useState(false)

  const [variants, setVariants] = useState(initialVariants)
  const [pendingFiles, setPendingFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saved, setSaved] = useState(false)

  const category = useMemo(() => {
    return categories.find(c => c.id === form.category_id)
  }, [categories, form.category_id])

  const categoryName = category?.name || ''
  const categorySizeLabel = category?.size_label || 'Talla'
  const categorySizeOptions = useMemo(() => {
    return category?.size_options || []
  }, [category])

  const costPrice = parseFloat(form.cost_price) || 0
  const shippingCost = parseFloat(form.shipping_cost) || 0
  const freightCost = parseFloat(form.freight_cost) || 0
  const margin = parseFloat(form.profit_margin) || 0

  const pricing = useMemo(() => {
    const subtotal = costPrice + shippingCost + freightCost
    const profit = subtotal * (margin / 100)
    const recommended = subtotal + profit
    return {
      subtotal,
      profit,
      recommended,
    }
  }, [costPrice, shippingCost, freightCost, margin])

  useEffect(() => {
    if (product) return
    if (priceTouched) return
    const recommended = Number(pricing.recommended.toFixed(2))
    if (recommended > 0 && form.price !== recommended) {
      setForm(f => ({ ...f, price: recommended }))
    }
  }, [pricing.recommended, product, priceTouched, form.price])

  const existingIds = useMemo(() => allProducts.map(p => p.id).filter(id => id !== product?.id), [allProducts, product])
  const existingSKUs = useMemo(() => {
    const skus = []
    allProducts.forEach(p => {
      p.product_variants?.forEach(v => {
        if (v.sku && (!product || v.product_id !== product.id)) skus.push(v.sku)
      })
    })
    return skus
  }, [allProducts, product])

  useEffect(() => {
    if (scannedId) setForm(f => ({ ...f, id: scannedId }))
  }, [scannedId])

  const handleImageFiles = (e) => {
    const files = Array.from(e.target.files)
    const newEntries = files.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      isNew: true,
    }))
    setPendingFiles(prev => [...prev, ...newEntries])
    e.target.value = ''
  }

  const removeExistingImage = (url) => {
    setForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))
  }

  const removePendingFile = (id) => {
    setPendingFiles(prev => prev.filter(p => p.id !== id))
  }

  const moveImageToFirst = (url) => {
    setForm(f => ({ ...f, images: [url, ...f.images.filter(u => u !== url)] }))
  }

  const updateVariant = (id, field, value) => {
    setVariants(prev => prev.map(v => {
      if (v.id !== id) return v
      const updated = { ...v, [field]: value }
      if (field === 'sku') {
        updated.barcode = value
      }
      return updated
    }))
  }

  const addVariant = () => {
    setVariants(prev => [...prev, emptyVariant()])
  }

  const duplicateLastVariant = () => {
    const visible = variants.filter(v => !v.isDeleted)
    const last = visible[visible.length - 1]
    if (!last) {
      setVariants(prev => [...prev, emptyVariant()])
      return
    }
    const copy = {
      ...emptyVariant(),
      color: last.color || '',
      variant_name: last.variant_name || '',
      price: last.price ?? '',
      wholesale_price: last.wholesale_price ?? '',
      image: last.image || null,
      pendingImageFile: null,
      pendingImagePreview: null,
    }
    setVariants(prev => [...prev, copy])
  }

  const removeVariant = (id) => {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, isDeleted: true } : v))
  }

  const handleVariantImageFile = (id, file) => {
    if (!file) return
    setVariants(prev => prev.map(v => {
      if (v.id !== id) return v
      return {
        ...v,
        pendingImageFile: file,
        pendingImagePreview: URL.createObjectURL(file),
      }
    }))
  }

  const removeVariantImage = (id) => {
    setVariants(prev => prev.map(v => {
      if (v.id !== id) return v
      return { ...v, image: null, pendingImageFile: null, pendingImagePreview: null }
    }))
  }

  const uploadVariantImage = async (file) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `variant_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)

    if (uploadError) throw new Error('Error al subir imagen de variante: ' + uploadError.message)

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    return publicUrlData.publicUrl
  }

  const generateId = () => {
    if (!form.name || !categoryName) {
      setError('Ingresa nombre y categoría para generar el ID')
      return
    }
    if (category?.prefix) {
      setForm(f => ({ ...f, id: generateProductCode(category.prefix, existingIds) }))
    } else {
      setForm(f => ({ ...f, id: generateProductId(categoryName, f.name, existingIds) }))
    }
  }

  const generateAllSKUs = () => {
    setVariants(prev => {
      const result = []
      prev.forEach(v => {
        if (v.isDeleted) {
          result.push(v)
          return
        }
        const usedCodes = [...existingSKUs, ...result.filter(r => !r.isDeleted).map(r => r.sku)]
        const sku = generateVariantCode(form.id, v.size, usedCodes)
        result.push({ ...v, sku, barcode: sku })
      })
      return result
    })
  }

  const generateSizeVariants = () => {
    if (!form.id) {
      setError('Genera o ingresa el ID del producto primero')
      return
    }
    if (categorySizeOptions.length === 0) {
      setError('La categoría no tiene medidas configuradas')
      return
    }
    const visible = variants.filter(v => !v.isDeleted)
    const usedSizes = visible.map(v => v.size)
    const referenceColor = visible.find(v => v.color?.trim())?.color || ''
    const referencePrice = visible[visible.length - 1]?.price ?? ''
    const referenceWholesale = visible[visible.length - 1]?.wholesale_price ?? ''
    const newVariants = categorySizeOptions
      .filter(s => !usedSizes.includes(s))
      .reduce((acc, size) => {
        const usedCodes = [...existingSKUs, ...acc.map(a => a.sku)]
        const v = emptyVariant()
        v.size = size
        v.color = referenceColor
        v.price = referencePrice
        v.wholesale_price = referenceWholesale
        v.sku = generateVariantCode(form.id, size, usedCodes)
        v.barcode = v.sku
        acc.push(v)
        return acc
      }, [])
    if (newVariants.length === 0) return
    setVariants(prev => [...prev, ...newVariants])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.id.trim()) { setError('El ID del producto es obligatorio'); return }
    if (!form.category_id) { setError('Debe seleccionar una categoría'); return }
    if (variants.filter(v => !v.isDeleted).length === 0) { setError('Debe tener al menos una variante'); return }
    if (form.images.length === 0 && pendingFiles.length === 0) { setError('Debe subir al menos una imagen principal del producto'); return }

    setSaving(true)
    setError('')
    try {
      let imageUrls = [...form.images]

      if (pendingFiles.length > 0) {
        setUploadProgress(0)
        for (let i = 0; i < pendingFiles.length; i++) {
          const entry = pendingFiles[i]
          const fileExt = entry.file.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, entry.file)

          if (uploadError) throw new Error('Error al subir imagen: ' + uploadError.message)

          const { data: publicUrlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName)

          imageUrls.push(publicUrlData.publicUrl)
          setUploadProgress(Math.round(((i + 1) / pendingFiles.length) * 100))
        }
      }

      const payload = {
        id: form.id.trim(),
        name: form.name,
        description: form.description,
        price: parseFloat(form.price) || 0,
        wholesale_price: parseFloat(form.wholesale_price) || 0,
        min_wholesale_qty: parseInt(form.min_wholesale_qty) || 0,
        category_id: form.category_id,
        featured: form.featured,
        active: form.active,
        images: imageUrls,
        cost_price: parseFloat(form.cost_price) || 0,
        shipping_cost: parseFloat(form.shipping_cost) || 0,
        freight_cost: parseFloat(form.freight_cost) || 0,
        profit_margin: parseFloat(form.profit_margin) || 0,
        updated_at: new Date().toISOString(),
      }

      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert([payload])
        if (error) throw error
      }

      // Save variants
      const savedVariantSKUs = []
      const generatedSkus = {}
      for (const v of variants) {
        if (v.isDeleted && !v.isNew) {
          const { error: deleteError } = await supabase.from('product_variants').delete().eq('id', v.id)
          if (deleteError) throw deleteError
          continue
        }
        if (v.isDeleted) continue

        const usedCodes = [...existingSKUs, ...savedVariantSKUs]
        let sku = v.sku?.trim().toUpperCase()
        if (!sku) {
          sku = generateVariantCode(payload.id, v.size, usedCodes).toUpperCase()
          generatedSkus[v.id] = sku
        }
        if (sku) savedVariantSKUs.push(sku)

        const variantPrice = v.price !== '' && v.price != null ? parseFloat(v.price) : parseFloat(form.price) || 0
        const variantWholesale = v.wholesale_price !== '' && v.wholesale_price != null ? parseFloat(v.wholesale_price) : parseFloat(form.wholesale_price) || 0
        const variantStock = v.stock !== '' && v.stock != null ? parseInt(v.stock) : 0

        if (!sku) {
          throw new Error(`La variante ${v.color || v.variant_name || v.size || 'sin nombre'} no tiene SKU`)
        }

        let variantImageUrl = v.image || null
        if (v.pendingImageFile) {
          variantImageUrl = await uploadVariantImage(v.pendingImageFile)
        }

        const variantPayload = {
          product_id: payload.id,
          sku,
          color: v.color?.trim() || null,
          variant_name: v.variant_name?.trim() || null,
          size: v.size?.trim() || null,
          barcode: sku,
          price: variantPrice,
          wholesale_price: variantWholesale,
          stock: variantStock,
          image: variantImageUrl,
        }

        if (v.isNew) {
          const { error: insertError } = await supabase.from('product_variants').insert([variantPayload])
          if (insertError) throw insertError
        } else {
          const { error: updateError } = await supabase.from('product_variants').update(variantPayload).eq('id', v.id)
          if (updateError) throw updateError
        }
      }

      onSaved()
      if (Object.keys(generatedSkus).length > 0) {
        setVariants(prev => prev.map(v => generatedSkus[v.id] ? { ...v, sku: generatedSkus[v.id] } : v))
      }
      setSaved(true)
    } catch (e) {
      console.error('Error guardando producto:', e)
      const message = e?.message || e?.error?.message || 'Error al guardar'
      if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('violates')) {
        setError(`Error de permisos (RLS): ${message}. Ve a Supabase → Authentication → Policies y asegúrate de que la tabla product_variants permita INSERT/UPDATE.`)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div className={styles.overlay} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className={styles.formModal} initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} transition={{type:'spring',stiffness:300,damping:28}} style={{ maxWidth: '900px', width: '95%' }}>
        <div className={styles.modalHeader}>
          <h2>{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>

        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.field}>
            <label className="label">ID del producto</label>
            <div className={styles.idRow}>
              <input className="input" value={form.id} onChange={(e) => { setForm({...form,id:e.target.value}); onScannedIdChange(e.target.value) }} placeholder="ej: PIJ-SAT" required disabled={!!product} />
              {!product && (
                <>
                  <button type="button" className={styles.scanBtn} onClick={onOpenScanner} title="Escanear código"><Camera size={20} /></button>
                  <button type="button" className="btn btn-outline" onClick={generateId} title="Generar ID automático"><RefreshCw size={16} /></button>
                </>
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

          {/* ===== MULTI-IMAGE MANAGER ===== */}
          <div className={styles.field}>
            <label className="label">Imágenes del producto</label>
            {form.images.length > 0 && (
              <div className={styles.imgGrid}>
                {form.images.map((url, i) => (
                  <div key={url} className={`${styles.imgThumbWrap} ${i === 0 ? styles.imgMain : ''}`}>
                    <img src={url} alt={`img ${i+1}`} className={styles.imgThumb} />
                    {i === 0 && <span className={styles.mainBadge}><Star size={10}/> Principal</span>}
                    <div className={styles.imgActions}>
                      {i !== 0 && (
                        <button type="button" className={styles.imgActionBtn} onClick={() => moveImageToFirst(url)} title="Hacer principal">
                          <Star size={12}/>
                        </button>
                      )}
                      <button type="button" className={`${styles.imgActionBtn} ${styles.imgDeleteBtn}`} onClick={() => removeExistingImage(url)} title="Eliminar">
                        <X size={12}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pendingFiles.length > 0 && (
              <div className={styles.imgGrid} style={{ marginTop: '0.5rem' }}>
                {pendingFiles.map((entry) => (
                  <div key={entry.id} className={styles.imgThumbWrap}>
                    <img src={entry.preview} alt="nueva" className={styles.imgThumb} />
                    <span className={styles.newBadge}>Nueva</span>
                    <div className={styles.imgActions}>
                      <button type="button" className={`${styles.imgActionBtn} ${styles.imgDeleteBtn}`} onClick={() => removePendingFile(entry.id)} title="Quitar">
                        <X size={12}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label className={styles.uploadArea}>
              <ImagePlus size={20} />
              <span>Agregar fotos</span>
              <span style={{ fontSize: '11px', opacity: 0.6 }}>PNG, JPG — múltiples a la vez</span>
              <input type="file" accept="image/*" multiple onChange={handleImageFiles} style={{ display: 'none' }} />
            </label>
            {saving && uploadProgress > 0 && uploadProgress < 100 && (
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className="label">Precio base ($)</label>
              <input type="number" step="0.01" className="input" value={form.price} onChange={(e) => { setPriceTouched(true); setForm({...form,price:e.target.value}) }} placeholder="35.00" required />
            </div>
            <div className={styles.field}>
              <label className="label">Precio al Mayor ($)</label>
              <input type="number" step="0.01" className="input" value={form.wholesale_price} onChange={(e) => setForm({...form,wholesale_price:e.target.value})} placeholder="25.00" />
            </div>
            <div className={styles.field}>
              <label className="label">Cant. mínima mayor</label>
              <input type="number" min={0} className="input" value={form.min_wholesale_qty} onChange={(e) => setForm({...form,min_wholesale_qty:e.target.value})} placeholder="3" />
            </div>
            <div className={styles.field}>
              <label className="label">Categoría</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm({...form,category_id:e.target.value})} required>
                {categories.length === 0 && <option value="">Sin categorías</option>}
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* ===== PRICING CALCULATOR ===== */}
          <div className={styles.pricingCard}>
            <h3 className={styles.pricingTitle}>Calculadora de precios</h3>
            <div className={styles.pricingGrid}>
              <div className={styles.field}>
                <label className="label">Costo ($)</label>
                <input type="number" step="0.01" min={0} className="input" value={form.cost_price} onChange={(e) => setForm({...form,cost_price:e.target.value})} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className="label">Envío + com. tarjeta ($)</label>
                <input type="number" step="0.01" min={0} className="input" value={form.shipping_cost} onChange={(e) => setForm({...form,shipping_cost:e.target.value})} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className="label">Flete ($)</label>
                <input type="number" step="0.01" min={0} className="input" value={form.freight_cost} onChange={(e) => setForm({...form,freight_cost:e.target.value})} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className="label">% Ganancia</label>
                <input type="number" step="0.01" min={0} className="input" value={form.profit_margin} onChange={(e) => setForm({...form,profit_margin:e.target.value})} placeholder="50" />
              </div>
            </div>
            <div className={styles.pricingResults}>
              <div className={styles.pricingResult}>
                <span>Sub-total</span>
                <strong>${pricing.subtotal.toFixed(2)}</strong>
              </div>
              <div className={styles.pricingResult}>
                <span>Ganancia</span>
                <strong>${pricing.profit.toFixed(2)}</strong>
              </div>
              <div className={styles.pricingResult}>
                <span>Precio venta recomendado</span>
                <strong>${pricing.recommended.toFixed(2)}</strong>
              </div>
              <div className={`${styles.pricingResult} ${styles.pricingFinal}`}>
                <span>Precio final</span>
                <input type="number" step="0.01" min={0} className={`input ${styles.pricingFinalInput}`} value={form.price} onChange={(e) => { setPriceTouched(true); setForm({...form,price:e.target.value}) }} placeholder="0.00" required />
              </div>
            </div>
            {!product && !priceTouched && pricing.recommended > 0 && (
              <p className={styles.pricingHint}>El precio final se ajusta automáticamente al recomendado. Si lo editas, dejará de actualizarse.</p>
            )}
          </div>

          {/* ===== VARIANTS EDITOR ===== */}
          <div className={styles.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="label" style={{ margin: 0 }}>Variantes</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" style={{ fontSize: '12px', padding: '0.4rem 0.6rem' }} onClick={duplicateLastVariant}>
                  <Copy size={12} /> Duplicar última
                </button>
                <button type="button" className="btn btn-outline" style={{ fontSize: '12px', padding: '0.4rem 0.6rem' }} onClick={generateSizeVariants}>
                  <Plus size={12} /> Agregar {categorySizeLabel.toLowerCase()}
                </button>
                <button type="button" className="btn btn-outline" style={{ fontSize: '12px', padding: '0.4rem 0.6rem' }} onClick={generateAllSKUs}>
                  <RefreshCw size={12} /> Generar SKUs
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table} style={{ minWidth: '820px' }}>
                <thead>
                  <tr>
                    <th>Imagen</th>
                    <th>SKU / Barcode</th>
                    <th>Color</th>
                    <th>Modelo/Estampado</th>
                    <th>{categorySizeLabel}</th>
                    <th>Precio</th>
                    <th>Mayor</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.filter(v => !v.isDeleted).map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className={styles.variantImageCell}>
                          {(v.image || v.pendingImagePreview) ? (
                            <div className={styles.variantThumbWrap}>
                              <img src={v.pendingImagePreview || v.image} alt="variant" className={styles.variantThumb} />
                              <button type="button" className={styles.variantImageRemove} onClick={() => removeVariantImage(v.id)} title="Quitar imagen">
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <label className={styles.variantUploadBtn} title="Agregar imagen">
                              <ImagePlus size={14} />
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleVariantImageFile(v.id, e.target.files[0])} />
                            </label>
                          )}
                        </div>
                      </td>
                      <td>
                        <input className="input" style={{ minWidth: '120px' }} value={v.sku} onChange={(e) => updateVariant(v.id, 'sku', e.target.value)} placeholder="SKU" required />
                        {v.barcode && v.barcode !== v.sku && (
                          <div style={{ fontSize: '11px', color: 'var(--color-dark-soft)', marginTop: '2px' }}>Barcode: {v.barcode}</div>
                        )}
                      </td>
                      <td><input className="input" style={{ minWidth: '90px' }} value={v.color || ''} onChange={(e) => updateVariant(v.id, 'color', e.target.value)} placeholder="Color" /></td>
                      <td><input className="input" style={{ minWidth: '110px' }} value={v.variant_name || ''} onChange={(e) => updateVariant(v.id, 'variant_name', e.target.value)} placeholder="Corazones" /></td>
                      <td>
                        <select className="input" style={{ minWidth: '70px' }} value={v.size || ''} onChange={(e) => updateVariant(v.id, 'size', e.target.value)}>
                          <option value="">—</option>
                          {categorySizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          {categorySizeOptions.length === 0 && <option value="" disabled>No hay medidas</option>}
                        </select>
                      </td>
                      <td><input type="number" step="0.01" className="input" style={{ minWidth: '80px' }} value={v.price ?? ''} onChange={(e) => updateVariant(v.id, 'price', e.target.value)} placeholder={form.price} /></td>
                      <td><input type="number" step="0.01" className="input" style={{ minWidth: '80px' }} value={v.wholesale_price ?? ''} onChange={(e) => updateVariant(v.id, 'wholesale_price', e.target.value)} placeholder={form.wholesale_price} /></td>
                      <td><input type="number" min={0} className="input" style={{ minWidth: '70px' }} value={v.stock} onChange={(e) => updateVariant(v.id, 'stock', e.target.value)} required /></td>
                      <td>
                        <button type="button" className={styles.deleteBtn} onClick={() => removeVariant(v.id)} aria-label="Eliminar variante">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-outline" style={{ marginTop: '0.75rem', width: '100%' }} onClick={addVariant}>
              <Plus size={14} /> Agregar variante manualmente
            </button>
          </div>

          <div className={styles.toggles}>
            <label className={styles.toggle}><input type="checkbox" checked={form.featured} onChange={(e) => setForm({...form,featured:e.target.checked})} /><span>Producto destacado</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={form.active} onChange={(e) => setForm({...form,active:e.target.checked})} /><span>Activo (visible en tienda)</span></label>
          </div>

          {error && <p className={styles.formError}>{error}</p>}

          {saved && (
            <div className={styles.successBox}>
              <p>Producto guardado correctamente.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => exportProductLabels({ id: form.id, name: form.name, price: form.price }, variants.filter(v => !v.isDeleted))}
              >
                <Download size={16} /> Descargar Excel de etiquetas
              </button>
            </div>
          )}

          <div className={styles.formActions}>
            {saved ? (
              <button type="button" className="btn btn-primary" onClick={onClose}>Cerrar</button>
            ) : (
              <>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <div className={styles.spinner}/> : <><Save size={16}/> Guardar</>}
                </button>
              </>
            )}
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
  }, [onResult])

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
