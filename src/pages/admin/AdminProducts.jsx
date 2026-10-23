import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Html5QrcodeScanner } from 'html5-qrcode'
import {
  Package, Plus, Edit2, Trash2,
  Camera, X, ShoppingBag, Save, AlertTriangle,
  ImagePlus, Star, RefreshCw, Copy, Download, Search,
  Images, Layers, Check
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import {
  generateProductId, generateProductCode, generateVariantCode,
  sortVariants, variantGroupKey
} from '../../lib/sku'
import * as V from '../../lib/validation'
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
    images: [],
    isNew: true,
    isDeleted: false,
  }
}

function groupLabelOf(variant) {
  const parts = [variant?.color, variant?.variant_name].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Sin color / modelo'
}

function collectGalleryImages(variants = []) {
  const list = []
  const push = (url) => {
    if (url && !list.includes(url)) list.push(url)
  }
  variants.forEach((variant) => {
    if (Array.isArray(variant.images)) variant.images.forEach(push)
    if (variant.image) push(variant.image)
  })
  return list
}

function sortVariantState(list, productId, sizeOptions) {
  const visible = list.filter((v) => !v.isDeleted)
  const deleted = list.filter((v) => v.isDeleted)
  return [...sortVariants(visible, productId, sizeOptions), ...deleted]
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [formTab, setFormTab] = useState('data')
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedId, setScannedId] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkError, setBulkError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

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

  const handleEdit = async (product, initialTab = 'data') => {
    setLoadingEdit(product.id)
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*), product_variants(*)')
      .eq('id', product.id)
      .single()
    setLoadingEdit(false)
    setEditProduct(error ? product : data)
    setFormTab(initialTab)
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

  const handleFormClose = () => {
    setShowForm(false)
    setEditProduct(null)
    setScannedId('')
  }

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      const variants = p.product_variants || []
      const totalStock = variants.reduce((s, v) => s + (v.stock || 0), 0)
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        variants.some(v => (v.sku || '').toLowerCase().includes(term) || (v.barcode || '').toLowerCase().includes(term))
      const matchesCategory = !categoryFilter || p.category_id === categoryFilter
      const matchesStatus = !statusFilter || (statusFilter === 'active' ? p.active : !p.active)
      const matchesStock =
        !stockFilter ||
        (stockFilter === 'out' ? totalStock === 0 : stockFilter === 'low' ? totalStock > 0 && totalStock < 5 : totalStock >= 5)
      return matchesSearch && matchesCategory && matchesStatus && matchesStock
    })
  }, [products, search, categoryFilter, stockFilter, statusFilter])

  const visibleIds = useMemo(() => new Set(filteredProducts.map(p => p.id)), [filteredProducts])
  const allVisibleSelected = visibleIds.size > 0 && [...visibleIds].every(id => selectedIds.has(id))

  const toggleAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id))
      } else {
        visibleIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setStockFilter('')
    setStatusFilter('')
  }

  return (
    <AdminLayout>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>Productos</h1>
          <p className={styles.pageSubtitle}>{filteredProducts.length} de {products.length} productos registrados</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedIds.size > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDelete}>
              <Trash2 size={16} /> Eliminar {selectedIds.size}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setFormTab('data'); setShowForm(true) }}>
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </div>

      {bulkError && <p className={styles.formError}>{bulkError}</p>}

      {!loading && (
        <div className={styles.filterBar}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Buscar por nombre, ID, SKU o barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={styles.filterSelect} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={styles.filterSelect} value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="">Todo stock</option>
            <option value="out">Sin stock</option>
            <option value="low">Stock bajo</option>
            <option value="ok">Stock OK</option>
          </select>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
          {(search || categoryFilter || stockFilter || statusFilter) && (
            <button className="btn btn-outline" onClick={clearFilters} style={{ padding: '0.55rem 0.9rem' }}>
              <X size={14} /> Limpiar
            </button>
          )}
        </div>
      )}

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
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
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
              {filteredProducts.map((p) => {
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
                          className={styles.photoBtn}
                          onClick={() => handleEdit(p, 'photos')}
                          aria-label="Fotos por color"
                          title="Fotos por color"
                          disabled={loadingEdit === p.id}
                        >
                          {loadingEdit === p.id
                            ? <div className={styles.spinnerSm} />
                            : <Images size={15} />
                          }
                        </button>
                        <button
                          className={styles.editBtn}
                          onClick={() => handleEdit(p)}
                          aria-label="Editar"
                          title="Editar producto"
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
          {products.length > 0 && filteredProducts.length === 0 && (
            <div className={styles.emptyTable}>
              <p>No hay productos que coincidan con los filtros.</p>
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
            tab={formTab}
            onTabChange={setFormTab}
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

function ProductFormModal({ product, categories, allProducts, scannedId, tab, onTabChange, onClose, onSaved, onOpenScanner, onScannedIdChange }) {
  const initialVariants = useMemo(() => {
    if (product?.product_variants?.length) {
      const sorted = sortVariants(
        product.product_variants,
        product.id,
        product.categories?.size_options || []
      )
      return sorted.map(v => ({
        ...v,
        images: Array.isArray(v.images) && v.images.length ? v.images : (v.image ? [v.image] : []),
        isNew: false,
        isDeleted: false,
      }))
    }
    return []
  }, [product])

  const [form, setForm] = useState({
    id: product?.id || scannedId || '',
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price ?? '',
    wholesale_price: product?.wholesale_price ?? '',
    min_wholesale_qty: product?.min_wholesale_qty ?? 0,
    category_id: product?.category_id || '',
    featured: product?.featured || false,
    active: product?.active !== false,
    images: Array.isArray(product?.images) ? product.images : [],
    cost_price: product?.cost_price ?? '',
    shipping_cost: product?.shipping_cost ?? '',
    freight_cost: product?.freight_cost ?? '',
    profit_margin: product?.profit_margin ?? 50,
  })
  const [priceTouched, setPriceTouched] = useState(false)
  const [idTouched, setIdTouched] = useState(!!product)

  const [variants, setVariants] = useState(initialVariants)
  const [groupImages, setGroupImages] = useState({})
  const [sizesModalOpen, setSizesModalOpen] = useState(false)
  const [quick, setQuick] = useState({ color: '', model: '', sizes: [], stock: '1', price: '', wholesale: '' })
  const [pendingFiles, setPendingFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saved, setSaved] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const category = useMemo(() => {
    return categories.find(c => c.id === form.category_id)
  }, [categories, form.category_id])

  const categoryName = category?.name || ''
  const categorySizeLabel = category?.size_label || 'Talla'
  const categorySizeOptions = useMemo(() => {
    return category?.size_options || []
  }, [category])

  useEffect(() => {
    setQuick((q) => ({ ...q, sizes: categorySizeOptions }))
  }, [categorySizeOptions])

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

  const finalPrice = parseFloat(form.price) || 0
  const realMargin = pricing.subtotal > 0 && finalPrice > 0
    ? ((finalPrice - pricing.subtotal) / pricing.subtotal) * 100
    : null

  const round2 = (n) => Math.round(n * 100) / 100

  // Precio final <-> % de ganancia, en ambos sentidos.
  const handleMarginChange = (value) => {
    setForm((f) => {
      const next = { ...f, profit_margin: value }
      const sub = (parseFloat(f.cost_price) || 0) + (parseFloat(f.shipping_cost) || 0) + (parseFloat(f.freight_cost) || 0)
      const m = parseFloat(value)
      if (sub > 0 && Number.isFinite(m)) {
        next.price = String(round2(sub * (1 + m / 100)))
      }
      return next
    })
    setPriceTouched(false)
  }

  const handlePriceChange = (value) => {
    setPriceTouched(true)
    setForm((f) => {
      const next = { ...f, price: value }
      const sub = (parseFloat(f.cost_price) || 0) + (parseFloat(f.shipping_cost) || 0) + (parseFloat(f.freight_cost) || 0)
      const p = parseFloat(value)
      if (sub > 0 && Number.isFinite(p)) {
        next.profit_margin = String(round2(((p - sub) / sub) * 100))
      }
      return next
    })
  }

  const handleCostChange = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value }
      const sub = (parseFloat(field === 'cost_price' ? value : f.cost_price) || 0)
        + (parseFloat(field === 'shipping_cost' ? value : f.shipping_cost) || 0)
        + (parseFloat(field === 'freight_cost' ? value : f.freight_cost) || 0)
      if (sub > 0) {
        if (!product && !priceTouched) {
          const m = parseFloat(f.profit_margin) || 0
          next.price = String(round2(sub * (1 + m / 100)))
        } else {
          const p = parseFloat(f.price)
          if (Number.isFinite(p) && p > 0) {
            next.profit_margin = String(round2(((p - sub) / sub) * 100))
          }
        }
      }
      return next
    })
  }

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
    if (product || saved || idTouched) return
    const name = form.name.trim()
    if (!form.category_id || !name) return
    const selectedCategory = categories.find(c => c.id === form.category_id)
    if (!selectedCategory) return
    const nextId = selectedCategory.prefix
      ? generateProductCode(selectedCategory.prefix, existingIds)
      : generateProductId(selectedCategory.name, name, existingIds)
    if (!nextId) return
    setForm(f => (f.id === nextId ? f : { ...f, id: nextId }))
  }, [product, saved, idTouched, form.name, form.category_id, categories, existingIds])

  const orderedVariants = useMemo(
    () => sortVariants(variants.filter(v => !v.isDeleted), form.id, categorySizeOptions),
    [variants, form.id, categorySizeOptions]
  )

  const groupList = useMemo(() => {
    const map = new Map()
    orderedVariants.forEach((v) => {
      const key = variantGroupKey(v)
      if (!map.has(key)) {
        map.set(key, {
          key,
          color: v.color || '',
          variantName: v.variant_name || '',
          variants: [],
        })
      }
      map.get(key).variants.push(v)
    })
    return [...map.values()]
  }, [orderedVariants])

  const lastGroup = groupList[groupList.length - 1] || null
  const lastGroupMissingSizes = useMemo(() => {
    if (!lastGroup) return []
    const existing = new Set(lastGroup.variants.map(v => v.size).filter(Boolean))
    return categorySizeOptions.filter(size => !existing.has(size))
  }, [lastGroup, categorySizeOptions])

  const getAllColors = useMemo(() => {
    const values = new Set()
    allProducts.forEach(p => (p.product_variants || []).forEach(v => {
      if (v.color) values.add(v.color)
    }))
    variants.forEach(v => { if (v.color) values.add(v.color) })
    return [...values].sort((a, b) => a.localeCompare(b, 'es'))
  }, [allProducts, variants])

  const getAllModels = useMemo(() => {
    const values = new Set()
    allProducts.forEach(p => (p.product_variants || []).forEach(v => {
      if (v.variant_name) values.add(v.variant_name)
    }))
    variants.forEach(v => { if (v.variant_name) values.add(v.variant_name) })
    return [...values].sort((a, b) => a.localeCompare(b, 'es'))
  }, [allProducts, variants])

  const sortState = (list) => sortVariantState(list, form.id, categorySizeOptions)

  const getGalleryFor = (group) => {
    if (!group) return { images: [], pending: [] }
    return groupImages[group.key] || { images: collectGalleryImages(group.variants), pending: [] }
  }

  const updateGallery = (group, updater) => {
    if (!group) return
    setGroupImages(prev => {
      const current = prev[group.key] || { images: collectGalleryImages(group.variants), pending: [] }
      return { ...prev, [group.key]: updater(current) }
    })
  }

  const validationErrors = useMemo(() => {
    const fieldLabels = {
      cost_price: 'El costo',
      shipping_cost: 'El envío',
      freight_cost: 'El flete',
      profit_margin: 'El % de ganancia',
    }
    const errs = {}
    errs.id = V.run(form.id.trim(), [
      (v) => V.required(v, 'El ID'),
      (v) => V.noSpaces(v, 'El ID'),
      (v) => V.unique(v, 'El ID', existingIds),
    ])
    errs.name = V.required(form.name, 'El nombre')
    errs.category_id = V.required(form.category_id, 'La categoría')
    errs.price = V.number(form.price, 'El precio base', { min: 0 })
    if (form.wholesale_price !== '' && form.wholesale_price != null) {
      errs.wholesale_price = V.number(form.wholesale_price, 'El precio al mayor', { min: 0, allowEmpty: true })
    }
    if (form.min_wholesale_qty !== '' && form.min_wholesale_qty != null) {
      errs.min_wholesale_qty = V.integer(form.min_wholesale_qty, 'La cantidad mínima al mayor', { min: 0, allowEmpty: true })
    }
    ;['cost_price', 'shipping_cost', 'freight_cost'].forEach((field) => {
      const empty = form[field] === '' || form[field] == null
      if (empty) {
        // En productos nuevos el costo, envío y flete son obligatorios.
        // En productos existentes se permite 0 (se completan luego en Finanzas → Costos).
        if (!product) errs[field] = `${fieldLabels[field]} es obligatorio`
      } else {
        const err = V.number(form[field], fieldLabels[field], { min: 0 })
        if (err) errs[field] = err
      }
    })

    if (form.profit_margin !== '' && form.profit_margin != null) {
      const err = V.number(form.profit_margin, fieldLabels.profit_margin, { allowEmpty: true })
      if (err) errs.profit_margin = err
    }
    const totalImages = form.images.length + pendingFiles.length
    if (totalImages === 0) errs.images = 'Debe subir al menos una imagen principal'
    const visibleVariants = orderedVariants
    if (visibleVariants.length === 0) errs.variants = 'Debe tener al menos una variante'
    const usedSKUs = new Set()
    const usedCombos = new Set()
    visibleVariants.forEach((v) => {
      const key = `variant_${v.id}`
      const skuValue = v.sku?.trim()
      if (skuValue) {
        const skuErr = V.run(skuValue, [
          (val) => V.noSpaces(val, 'El SKU'),
          (val) => V.unique(val, 'El SKU', existingSKUs),
        ])
        if (skuErr) {
          errs[key] = skuErr
        } else {
          const upper = skuValue.toUpperCase()
          if (usedSKUs.has(upper)) errs[key] = 'El SKU está repetido dentro de este producto'
          usedSKUs.add(upper)
        }
      }
      const combo = `${(v.color || '').trim().toLowerCase()}::${(v.variant_name || '').trim().toLowerCase()}::${(v.size || '').trim().toLowerCase()}`
      if (usedCombos.has(combo)) {
        errs[key] = errs[key] || 'Ya existe una variante con ese color, modelo y talla'
      }
      usedCombos.add(combo)
      if (v.price !== '' && v.price != null) {
        const perr = V.number(v.price, 'El precio de variante', { min: 0, allowEmpty: true })
        if (perr) errs[`${key}_price`] = perr
      }
      if (v.wholesale_price !== '' && v.wholesale_price != null) {
        const werr = V.number(v.wholesale_price, 'El precio al mayor de variante', { min: 0, allowEmpty: true })
        if (werr) errs[`${key}_wholesale`] = werr
      }
      const stockErr = V.integer(v.stock, 'El stock', { min: 0 })
      if (stockErr) errs[`${key}_stock`] = stockErr
    })
    Object.keys(errs).forEach((k) => { if (!errs[k]) delete errs[k] })
    return errs
  }, [form, orderedVariants, existingIds, existingSKUs, pendingFiles.length, product])

  const hasErrors = useMemo(() => Object.keys(validationErrors).length > 0, [validationErrors])
  const hasDataErrors = useMemo(() => {
    const keys = ['id', 'name', 'category_id', 'price', 'wholesale_price', 'min_wholesale_qty', 'cost_price', 'shipping_cost', 'freight_cost', 'profit_margin', 'images']
    return Object.keys(validationErrors).some((key) => keys.includes(key))
  }, [validationErrors])
  const hasVariantErrors = useMemo(
    () => Object.keys(validationErrors).some((key) => key === 'variants' || key.startsWith('variant_')),
    [validationErrors]
  )
  useEffect(() => {
    if (scannedId) {
      setIdTouched(true)
      setForm(f => ({ ...f, id: scannedId }))
    }
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

  // ===== Galería de fotos por color/modelo =====
  const addGroupPhotos = (group, fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    const entries = files.map(file => ({
      id: `pending-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }))
    updateGallery(group, (gallery) => ({ ...gallery, pending: [...gallery.pending, ...entries] }))
  }

  const removeGroupPhoto = (group, url) => {
    updateGallery(group, (gallery) => ({ ...gallery, images: gallery.images.filter(img => img !== url) }))
  }

  const removeGroupPending = (group, pendingId) => {
    updateGallery(group, (gallery) => {
      const target = gallery.pending.find(p => p.id === pendingId)
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return { ...gallery, pending: gallery.pending.filter(p => p.id !== pendingId) }
    })
  }

  const makeGroupPhotoPrincipal = (group, url) => {
    updateGallery(group, (gallery) => ({
      ...gallery,
      images: [url, ...gallery.images.filter(img => img !== url)],
    }))
  }

  // ===== Variantes =====
  const updateVariant = (id, field, value) => {
    setVariants(prev => prev.map(v => {
      if (v.id !== id) return v
      const updated = { ...v, [field]: value }
      if (field === 'sku') {
        updated.barcode = value
      }
      if (field === 'size') {
        const oldSize = String(v.size || '').trim()
        const newSize = String(value || '').trim()
        const sku = String(v.sku || '')
        if (oldSize && sku.toUpperCase().endsWith(`-${oldSize.toUpperCase()}`)) {
          const base = sku.slice(0, sku.length - oldSize.length - 1)
          const nextSku = newSize ? `${base}-${newSize}` : base
          updated.sku = nextSku
          if (!v.barcode || String(v.barcode).toUpperCase() === sku.toUpperCase()) {
            updated.barcode = nextSku
          }
        }
      }
      return updated
    }))
  }

  const addVariant = () => {
    setVariants(prev => sortState([...prev, emptyVariant()]))
  }

  const removeVariant = (id) => {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, isDeleted: true } : v))
  }

  const duplicateLastVariant = () => {
    const last = orderedVariants[orderedVariants.length - 1]
    if (!last) {
      addVariant()
      return
    }
    const images = collectGalleryImages([last])
    const copy = {
      ...emptyVariant(),
      color: last.color || '',
      variant_name: last.variant_name || '',
      price: last.price ?? '',
      wholesale_price: last.wholesale_price ?? '',
      stock: last.stock ?? 1,
      image: images[0] || null,
      images,
    }
    setVariants(prev => sortState([...prev, copy]))
  }

  const uploadVariantImage = async (file) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `variant_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)

    if (uploadError) throw new Error('Error al subir imagen de variante: ' + uploadError.message)

    const { data: publicUrlData } = await supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    return publicUrlData.publicUrl
  }

  const buildVariant = ({ color, variantName, size, template, defaults = {}, images = [] }) => {
    const gallery = images.filter(Boolean)
    return {
      ...emptyVariant(),
      color: color?.trim() || '',
      variant_name: variantName?.trim() || '',
      size: size || '',
      price: defaults.price !== '' && defaults.price != null
        ? defaults.price
        : (template?.price ?? form.price ?? ''),
      wholesale_price: defaults.wholesale !== '' && defaults.wholesale != null
        ? defaults.wholesale
        : (template?.wholesale_price ?? form.wholesale_price ?? ''),
      stock: defaults.stock !== '' && defaults.stock != null
        ? defaults.stock
        : (template?.stock ?? 1),
      image: gallery[0] || null,
      images: gallery,
    }
  }

  const addQuickVariants = () => {
    if (categorySizeOptions.length === 0) {
      setError('Selecciona una categoría con tallas configuradas')
      return
    }
    if (quick.sizes.length === 0) {
      setError('Selecciona al menos una talla')
      return
    }
    const color = quick.color.trim()
    const model = quick.model.trim()
    const targetKey = `${color.toLowerCase()}::${model.toLowerCase()}`
    const existingGroup = groupList.find(g => g.key === targetKey)
    const template = existingGroup?.variants[existingGroup.variants.length - 1] || null
    const existingSizes = new Set((existingGroup?.variants || []).map(v => v.size).filter(Boolean))
    const sizes = quick.sizes.filter(size => !existingSizes.has(size))
    if (sizes.length === 0) {
      setError('Esas tallas ya existen para ese color/modelo')
      return
    }
    const images = existingGroup ? collectGalleryImages(existingGroup.variants) : []
    const additions = sizes.map(size => buildVariant({
      color,
      variantName: model,
      size,
      template,
      defaults: { stock: quick.stock, price: quick.price, wholesale: quick.wholesale },
      images,
    }))
    setVariants(prev => sortState([...prev, ...additions]))
    setError('')
    setQuick(q => ({ ...q, color: '', model: '' }))
  }

  const duplicateLastColor = () => {
    const source = lastGroup
    if (!source) {
      setError('Primero agrega una variante')
      return
    }
    const newColor = quick.color.trim()
    if (!newColor) {
      setError('Escribe el nuevo color en el campo Color')
      return
    }
    const targetKey = `${newColor.toLowerCase()}::${String(source.variantName || '').toLowerCase()}`
    if (groupList.some(g => g.key === targetKey)) {
      setError('Ese color ya existe para este modelo')
      return
    }
    const images = collectGalleryImages(source.variants)
    const additions = source.variants.map(v => buildVariant({
      color: newColor,
      variantName: v.variant_name,
      size: v.size,
      template: v,
      defaults: { stock: v.stock, price: v.price, wholesale: v.wholesale_price },
      images,
    }))
    setVariants(prev => sortState([...prev, ...additions]))
    setError('')
    setQuick(q => ({ ...q, color: '' }))
  }

  const duplicateLastModel = () => {
    const source = lastGroup
    if (!source) {
      setError('Primero agrega una variante')
      return
    }
    const newModel = quick.model.trim()
    if (!newModel) {
      setError('Escribe el nuevo modelo/estampado en el campo Modelo')
      return
    }
    const targetKey = `${String(source.color || '').toLowerCase()}::${newModel.toLowerCase()}`
    if (groupList.some(g => g.key === targetKey)) {
      setError('Ese modelo ya existe para este color')
      return
    }
    const images = collectGalleryImages(source.variants)
    const additions = source.variants.map(v => buildVariant({
      color: v.color,
      variantName: newModel,
      size: v.size,
      template: v,
      defaults: { stock: v.stock, price: v.price, wholesale: v.wholesale_price },
      images,
    }))
    setVariants(prev => sortState([...prev, ...additions]))
    setError('')
    setQuick(q => ({ ...q, model: '' }))
  }

  const addSizeToGroup = (group, size) => {
    if (!group) return
    const template = group.variants[group.variants.length - 1]
    const images = collectGalleryImages(group.variants)
    const addition = buildVariant({
      color: group.color,
      variantName: group.variantName,
      size,
      template,
      defaults: {
        stock: template?.stock ?? quick.stock,
        price: template?.price ?? quick.price,
        wholesale: template?.wholesale_price ?? quick.wholesale,
      },
      images,
    })
    setVariants(prev => sortState([...prev, addition]))
  }

  const addVariantsFromMatrix = ({ selections, newGroup, defaults }) => {
    const additions = []
    for (const selection of selections) {
      const group = groupList.find(g => g.key === selection.key)
      if (!group) continue
      const template = group.variants[group.variants.length - 1] || null
      const images = collectGalleryImages(group.variants)
      for (const size of selection.sizes) {
        additions.push(buildVariant({
          color: group.color,
          variantName: group.variantName,
          size,
          template,
          defaults,
          images,
        }))
      }
    }
    if (newGroup && newGroup.sizes.length > 0) {
      for (const size of newGroup.sizes) {
        additions.push(buildVariant({
          color: newGroup.color,
          variantName: newGroup.model,
          size,
          template: null,
          defaults,
          images: [],
        }))
      }
    }
    if (additions.length === 0) return
    setVariants(prev => sortState([...prev, ...additions]))
    setSizesModalOpen(false)
    setError('')
  }

  const generateId = () => {
    if (!form.name || !categoryName) {
      setError('Ingresa nombre y categoría para generar el ID')
      return
    }
    setIdTouched(false)
    if (category?.prefix) {
      setForm(f => ({ ...f, id: generateProductCode(category.prefix, existingIds) }))
    } else {
      setForm(f => ({ ...f, id: generateProductId(categoryName, form.name, existingIds) }))
    }
  }

  const completeMissingSKUs = () => {
    if (!form.id) {
      setError('Primero define el ID del producto')
      return
    }
    const visible = sortVariants(variants.filter(v => !v.isDeleted), form.id, categorySizeOptions)
    const missing = visible.filter(v => !v.sku?.trim())
    if (missing.length === 0) {
      setError('Todas las variantes ya tienen SKU')
      return
    }
    const currentProductSKUs = (product?.product_variants || []).map(v => v.sku).filter(Boolean)
    const used = new Set([
      ...existingSKUs,
      ...currentProductSKUs,
      ...visible.map(v => v.sku).filter(Boolean),
    ])
    const generated = {}
    missing.forEach(v => {
      const sku = generateVariantCode(form.id, v.size, [...used]).toUpperCase()
      generated[v.id] = sku
      used.add(sku)
    })
    setVariants(prev => prev.map(v => generated[v.id] ? { ...v, sku: generated[v.id], barcode: generated[v.id] } : v))
    setError('')
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (hasErrors) return
    setConfirmOpen(true)
  }

  const executeSave = async () => {
    setSaving(true)
    setError('')
    try {
      // Evita crear el producto a medias si falta la migración de galería.
      const { error: galleryCheckError } = await supabase
        .from('product_variants')
        .select('id, images')
        .limit(1)
      if (galleryCheckError && /images/i.test(galleryCheckError.message || '')) {
        throw new Error('Falta aplicar la migración de galería de fotos (product_variants.images). Ejecuta el SQL en Supabase y vuelve a intentar.')
      }

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

      // Sube una sola vez la galería de cada color/modelo.
      const finalGalleries = {}
      for (const group of groupList) {
        const gallery = getGalleryFor(group)
        const images = []
        const push = (url) => {
          if (url && !images.includes(url)) images.push(url)
        }
        gallery.images.forEach(push)
        for (const pending of gallery.pending) {
          push(await uploadVariantImage(pending.file))
        }
        finalGalleries[group.key] = { images, image: images[0] || null }
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

      // Borra variantes existentes marcadas para eliminar.
      for (const v of variants) {
        if (!v.isDeleted || v.isNew) continue
        const { error: deleteError } = await supabase.from('product_variants').delete().eq('id', v.id)
        if (deleteError) throw deleteError
      }

      // Guarda variantes en el orden visual (color/modelo + talla).
      // Los SKU existentes no se renumeran nunca.
      const currentProductSKUs = (product?.product_variants || []).map(v => v.sku).filter(Boolean)
      const providedSKUs = orderedVariants.map(v => v.sku?.trim().toUpperCase()).filter(Boolean)
      const savedVariantSKUs = []
      const generatedSkus = {}
      for (const v of orderedVariants) {
        const usedCodes = [...new Set([...existingSKUs, ...currentProductSKUs, ...providedSKUs, ...savedVariantSKUs])]
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

        const gallery = finalGalleries[variantGroupKey(v)] || { images: [], image: null }

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
          image: gallery.image,
          images: gallery.images,
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
      setVariants(prev => sortState(prev.map(v => {
        const updates = {}
        if (generatedSkus[v.id]) {
          updates.sku = generatedSkus[v.id]
          updates.barcode = generatedSkus[v.id]
        }
        const gallery = finalGalleries[variantGroupKey(v)]
        if (gallery) {
          updates.images = gallery.images
          updates.image = gallery.image
        }
        return Object.keys(updates).length > 0 ? { ...v, ...updates } : v
      })))
      setGroupImages(Object.fromEntries(
        Object.entries(finalGalleries).map(([key, gallery]) => [key, { images: gallery.images, pending: [] }])
      ))
      setSaved(true)
    } catch (e) {
      console.error('Error guardando producto:', e)
      const message = e?.message || e?.error?.message || 'Error al guardar'
      const lower = message.toLowerCase()
      if (lower.includes('products_pkey')) {
        setError('Ya existe un producto con este ID. Usa otro ID o edita el existente.')
      } else if (lower.includes('product_variants_sku_key') || (lower.includes('duplicate key') && lower.includes('sku'))) {
        setError('El SKU de una variante ya existe. Revisa que no haya SKUs repetidos.')
      } else if (lower.includes('images') && (lower.includes('column') || lower.includes('schema cache'))) {
        setError('Falta aplicar la migración de galería de fotos (product_variants.images). Ejecuta el SQL de la migración en Supabase y vuelve a intentar.')
      } else if (lower.includes('row-level security')) {
        setError(`Error de permisos (RLS): ${message}. Ve a Supabase → Authentication → Policies y asegúrate de que las tablas permitan INSERT/UPDATE.`)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  return (
    <motion.div className={styles.overlay} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className={styles.formModal} initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} transition={{type:'spring',stiffness:300,damping:28}} style={{ maxWidth: '900px', width: '95%' }}>
        <div className={styles.modalHeader}>
          <h2>{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>

        <form onSubmit={handleFormSubmit} className={styles.form} noValidate onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}>
          <div className={styles.formTabs}>
            <button
              type="button"
              className={`${styles.formTab} ${tab === 'data' ? styles.formTabActive : ''}`}
              onClick={() => onTabChange('data')}
            >
              <Package size={15} /> Datos
              {hasDataErrors && <span className={styles.tabDot} />}
            </button>
            <button
              type="button"
              className={`${styles.formTab} ${tab === 'variants' ? styles.formTabActive : ''}`}
              onClick={() => onTabChange('variants')}
            >
              <Layers size={15} /> Variantes
              {hasVariantErrors && <span className={styles.tabDot} />}
            </button>
            <button
              type="button"
              className={`${styles.formTab} ${tab === 'photos' ? styles.formTabActive : ''}`}
              onClick={() => onTabChange('photos')}
            >
              <Images size={15} /> Fotos por color
            </button>
          </div>

          {tab === 'data' && (
            <>
          <div className={styles.field}>
            <label className="label">ID del producto</label>
            <div className={styles.idRow}>
              <input className={`input ${validationErrors.id ? styles.inputError : ''}`} value={form.id} onChange={(e) => { setIdTouched(true); setForm({ ...form, id: e.target.value }); onScannedIdChange(e.target.value) }} placeholder="ej: PIJ-SAT" disabled={!!product} />
              {!product && (
                <>
                  <button type="button" className={styles.scanBtn} onClick={onOpenScanner} title="Escanear código"><Camera size={20} /></button>
                  <button type="button" className="btn btn-outline" onClick={generateId} title="Generar ID automático"><RefreshCw size={16} /></button>
                </>
              )}
            </div>
            {validationErrors.id ? (
              <span className={styles.fieldError}>{validationErrors.id}</span>
            ) : (
              <span className={styles.fieldHint}>Se genera automáticamente al elegir categoría y nombre. Puedes editarlo.</span>
            )}
          </div>

          <div className={styles.field}>
            <label className="label">Nombre</label>
            <input className={`input ${validationErrors.name ? styles.inputError : ''}`} value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} placeholder="Pijama Satín Rosa" />
            {validationErrors.name && <span className={styles.fieldError}>{validationErrors.name}</span>}
          </div>

          <div className={styles.field}>
            <label className="label">Categoría</label>
            <select className={`input ${validationErrors.category_id ? styles.inputError : ''}`} value={form.category_id} onChange={(e) => setForm({...form,category_id:e.target.value})}>
              <option value="">Selecciona una categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {validationErrors.category_id && <span className={styles.fieldError}>{validationErrors.category_id}</span>}
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
            {validationErrors.images && <span className={styles.fieldError}>{validationErrors.images}</span>}
            {saving && uploadProgress > 0 && uploadProgress < 100 && (
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className="label">Precio base ($)</label>
              <input type="number" step="0.01" className={`input ${validationErrors.price ? styles.inputError : ''}`} value={form.price} onChange={(e) => { setPriceTouched(true); setForm({...form,price:e.target.value}) }} placeholder="35.00" />
              {validationErrors.price && <span className={styles.fieldError}>{validationErrors.price}</span>}
            </div>
            <div className={styles.field}>
              <label className="label">Precio al Mayor ($)</label>
              <input type="number" step="0.01" className={`input ${validationErrors.wholesale_price ? styles.inputError : ''}`} value={form.wholesale_price} onChange={(e) => setForm({...form,wholesale_price:e.target.value})} placeholder="25.00" />
              {validationErrors.wholesale_price && <span className={styles.fieldError}>{validationErrors.wholesale_price}</span>}
            </div>
            <div className={styles.field}>
              <label className="label">Cant. mínima mayor</label>
              <input type="number" className={`input ${validationErrors.min_wholesale_qty ? styles.inputError : ''}`} value={form.min_wholesale_qty} onChange={(e) => setForm({...form,min_wholesale_qty:e.target.value})} placeholder="3" />
              {validationErrors.min_wholesale_qty && <span className={styles.fieldError}>{validationErrors.min_wholesale_qty}</span>}
            </div>
          </div>

          {/* ===== PRICING CALCULATOR ===== */}
          <div className={styles.pricingCard}>
            <h3 className={styles.pricingTitle}>Calculadora de precios</h3>
            <div className={styles.pricingGrid}>
              <div className={styles.field}>
                <label className="label">Costo ($){!product ? ' *' : ''}</label>
                <input type="number" step="0.01" className={`input ${validationErrors.cost_price ? styles.inputError : ''}`} value={form.cost_price} onChange={(e) => handleCostChange('cost_price', e.target.value)} placeholder="0.00" />
                {validationErrors.cost_price && <span className={styles.fieldError}>{validationErrors.cost_price}</span>}
              </div>
              <div className={styles.field}>
                <label className="label">Envío + com. tarjeta ($){!product ? ' *' : ''}</label>
                <input type="number" step="0.01" className={`input ${validationErrors.shipping_cost ? styles.inputError : ''}`} value={form.shipping_cost} onChange={(e) => handleCostChange('shipping_cost', e.target.value)} placeholder="0.00" />
                {validationErrors.shipping_cost && <span className={styles.fieldError}>{validationErrors.shipping_cost}</span>}
              </div>
              <div className={styles.field}>
                <label className="label">Flete ($){!product ? ' *' : ''}</label>
                <input type="number" step="0.01" className={`input ${validationErrors.freight_cost ? styles.inputError : ''}`} value={form.freight_cost} onChange={(e) => handleCostChange('freight_cost', e.target.value)} placeholder="0.00" />
                {validationErrors.freight_cost && <span className={styles.fieldError}>{validationErrors.freight_cost}</span>}
              </div>
              <div className={styles.field}>
                <label className="label">% Ganancia</label>
                <input type="number" step="0.01" className={`input ${validationErrors.profit_margin ? styles.inputError : ''}`} value={form.profit_margin} onChange={(e) => handleMarginChange(e.target.value)} placeholder="50" />
                {validationErrors.profit_margin && <span className={styles.fieldError}>{validationErrors.profit_margin}</span>}
              </div>
            </div>
            {!product && (
              <p className={styles.pricingHint}>
                Costo, envío y flete son obligatorios. Los productos viejos sin costo quedan en 0 y puedes completarlos en Finanzas → Costos.
              </p>
            )}
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
                <input type="number" step="0.01" className={`input ${styles.pricingFinalInput} ${validationErrors.price ? styles.inputError : ''}`} value={form.price} onChange={(e) => handlePriceChange(e.target.value)} placeholder="0.00" />
              </div>
              <div className={styles.pricingResult}>
                <span>Margen real</span>
                <strong style={{ color: realMargin === null ? undefined : realMargin < 0 ? '#dc2626' : '#166534' }}>
                  {realMargin === null ? '—' : `${realMargin.toFixed(2)}%`}
                </strong>
              </div>
            </div>
            {pricing.subtotal > 0 && (
              <p className={styles.pricingHint}>El precio final y el % de ganancia se calculan entre sí automáticamente.</p>
            )}
          </div>
            </>
          )}

          {tab === 'variants' && (
            <>
          {/* ===== QUICK ADD ===== */}
          <div className={styles.quickAddCard}>
            <div className={styles.quickGrid}>
              <div className={styles.field}>
                <label className="label">Color</label>
                <input
                  className="input"
                  list="product-color-options"
                  value={quick.color}
                  onChange={(e) => setQuick(q => ({ ...q, color: e.target.value }))}
                  placeholder="Fucsia"
                />
                <datalist id="product-color-options">
                  {getAllColors.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className={styles.field}>
                <label className="label">Modelo / Estampado</label>
                <input
                  className="input"
                  list="product-model-options"
                  value={quick.model}
                  onChange={(e) => setQuick(q => ({ ...q, model: e.target.value }))}
                  placeholder="Corazones"
                />
                <datalist id="product-model-options">
                  {getAllModels.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
            </div>

            <div>
              <label className="label">{categorySizeLabel}s</label>
              <div className={styles.sizeChips}>
                {categorySizeOptions.length === 0 ? (
                  <span className={styles.quickHint}>Selecciona una categoría con tallas configuradas.</span>
                ) : (
                  <>
                    {categorySizeOptions.map(size => {
                      const active = quick.sizes.includes(size)
                      return (
                        <button
                          key={size}
                          type="button"
                          className={`${styles.sizeChip} ${active ? styles.sizeChipActive : ''}`}
                          onClick={() => setQuick(q => ({
                            ...q,
                            sizes: active ? q.sizes.filter(s => s !== size) : [...q.sizes, size],
                          }))}
                        >
                          {size}
                        </button>
                      )
                    })}
                    <button type="button" className={styles.sizeChip} onClick={() => setQuick(q => ({ ...q, sizes: categorySizeOptions }))}>
                      Todas
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className={`${styles.quickGrid} ${styles.quickGrid3}`}>
              <div className={styles.field}>
                <label className="label">Stock inicial</label>
                <input type="number" min="0" className="input" value={quick.stock} onChange={(e) => setQuick(q => ({ ...q, stock: e.target.value }))} placeholder="1" />
              </div>
              <div className={styles.field}>
                <label className="label">Precio (opcional)</label>
                <input type="number" step="0.01" className="input" value={quick.price} onChange={(e) => setQuick(q => ({ ...q, price: e.target.value }))} placeholder={form.price || 'Base'} />
              </div>
              <div className={styles.field}>
                <label className="label">Mayor (opcional)</label>
                <input type="number" step="0.01" className="input" value={quick.wholesale} onChange={(e) => setQuick(q => ({ ...q, wholesale: e.target.value }))} placeholder={form.wholesale_price || 'Base'} />
              </div>
            </div>

            <div className={styles.quickActions}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={addQuickVariants}
                disabled={categorySizeOptions.length === 0 || quick.sizes.length === 0}
              >
                <Plus size={14} /> Agregar variantes
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={duplicateLastColor}
                disabled={!lastGroup || !quick.color.trim()}
              >
                <Copy size={13} /> Duplicar color
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={duplicateLastModel}
                disabled={!lastGroup || !quick.model.trim()}
              >
                <Copy size={13} /> Duplicar modelo
              </button>
            </div>
            <p className={styles.quickHint}>
              “Duplicar color” usa el color escrito arriba y copia tallas, precios, stock y fotos del último color.
            </p>
          </div>

          {/* ===== VARIANTS EDITOR ===== */}
          <div className={styles.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label className="label" style={{ margin: 0 }}>Variantes</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" style={{ fontSize: '12px', padding: '0.4rem 0.6rem' }} onClick={duplicateLastVariant}>
                  <Copy size={12} /> Duplicar última
                </button>
                <button type="button" className="btn btn-outline" style={{ fontSize: '12px', padding: '0.4rem 0.6rem' }} onClick={() => setSizesModalOpen(true)}>
                  <Plus size={12} /> Agregar {categorySizeLabel.toLowerCase()}s
                </button>
                <button type="button" className="btn btn-outline" style={{ fontSize: '12px', padding: '0.4rem 0.6rem' }} onClick={completeMissingSKUs}>
                  <RefreshCw size={12} /> Completar SKUs
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
                  {variants.filter(v => !v.isDeleted).map((v) => {
                    const vKey = `variant_${v.id}`
                    const group = groupList.find(g => g.key === variantGroupKey(v))
                    const gallery = getGalleryFor(group)
                    const preview = gallery.images[0] || gallery.pending[0]?.preview || null
                    const photoCount = gallery.images.length + gallery.pending.length
                    return (
                    <tr key={v.id}>
                      <td>
                        <div className={styles.variantImageCell}>
                          {preview ? (
                            <button type="button" className={styles.variantThumbWrap} onClick={() => onTabChange('photos')} title="Editar fotos del color">
                              <img src={preview} alt="variant" className={styles.variantThumb} />
                              {photoCount > 1 && <span className={styles.photoCountBadge}>{photoCount}</span>}
                            </button>
                          ) : (
                            <button type="button" className={styles.variantUploadBtn} onClick={() => onTabChange('photos')} title="Agregar fotos del color">
                              <ImagePlus size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <input className={`input ${validationErrors[vKey] ? styles.inputError : ''}`} style={{ minWidth: '120px' }} value={v.sku} onChange={(e) => updateVariant(v.id, 'sku', e.target.value)} placeholder="SKU" />
                        {validationErrors[vKey] && <span className={styles.fieldError}>{validationErrors[vKey]}</span>}
                        {v.barcode && v.barcode !== v.sku && (
                          <div style={{ fontSize: '11px', color: 'var(--color-dark-soft)', marginTop: '2px' }}>Barcode: {v.barcode}</div>
                        )}
                      </td>
                      <td><input className="input" style={{ minWidth: '90px' }} value={v.color || ''} onChange={(e) => updateVariant(v.id, 'color', e.target.value)} placeholder="Color" /></td>
                      <td><input className="input" style={{ minWidth: '110px' }} value={v.variant_name || ''} onChange={(e) => updateVariant(v.id, 'variant_name', e.target.value)} placeholder="Corazones" /></td>
                      <td>
                        <select className="input" style={{ minWidth: '70px' }} title="Si cambias la talla, el sufijo del SKU se actualiza automáticamente" value={v.size || ''} onChange={(e) => updateVariant(v.id, 'size', e.target.value)}>
                          <option value="">—</option>
                          {categorySizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          {categorySizeOptions.length === 0 && <option value="" disabled>No hay medidas</option>}
                        </select>
                      </td>
                      <td>
                        <input type="number" step="0.01" className={`input ${validationErrors[`${vKey}_price`] ? styles.inputError : ''}`} style={{ minWidth: '80px' }} value={v.price ?? ''} onChange={(e) => updateVariant(v.id, 'price', e.target.value)} placeholder={form.price} />
                        {validationErrors[`${vKey}_price`] && <span className={styles.fieldError}>{validationErrors[`${vKey}_price`]}</span>}
                      </td>
                      <td>
                        <input type="number" step="0.01" className={`input ${validationErrors[`${vKey}_wholesale`] ? styles.inputError : ''}`} style={{ minWidth: '80px' }} value={v.wholesale_price ?? ''} onChange={(e) => updateVariant(v.id, 'wholesale_price', e.target.value)} placeholder={form.wholesale_price} />
                        {validationErrors[`${vKey}_wholesale`] && <span className={styles.fieldError}>{validationErrors[`${vKey}_wholesale`]}</span>}
                      </td>
                      <td>
                        <input type="number" className={`input ${validationErrors[`${vKey}_stock`] ? styles.inputError : ''}`} style={{ minWidth: '70px' }} value={v.stock} onChange={(e) => updateVariant(v.id, 'stock', e.target.value)} />
                        {validationErrors[`${vKey}_stock`] && <span className={styles.fieldError}>{validationErrors[`${vKey}_stock`]}</span>}
                      </td>
                      <td>
                        <button type="button" className={styles.deleteBtn} onClick={() => removeVariant(v.id)} aria-label="Eliminar variante">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-outline" style={{ marginTop: '0.75rem', width: '100%' }} onClick={addVariant}>
              <Plus size={14} /> Agregar variante manualmente
            </button>
            {validationErrors.variants && <span className={styles.fieldError}>{validationErrors.variants}</span>}

            {lastGroup && (
              <div className={styles.lastGroupBar}>
                <div className={styles.lastGroupInfo}>
                  <strong>Último: {groupLabelOf(lastGroup.variants[0])}</strong>
                  <span>{lastGroup.variants.map(v => v.size || 'Única').join(' · ')}</span>
                </div>
                <div className={styles.sizeChips}>
                  {lastGroupMissingSizes.length === 0 ? (
                    <span className={styles.quickHint}>Todas las tallas agregadas.</span>
                  ) : (
                    <>
                      <span className={styles.quickHint}>Agregar talla:</span>
                      {lastGroupMissingSizes.map(size => (
                        <button key={size} type="button" className={styles.sizeChip} onClick={() => addSizeToGroup(lastGroup, size)}>
                          + {size}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
            </>
          )}

          {tab === 'photos' && (
            <>
              {groupList.length === 0 ? (
                <div className={styles.emptyPhotos}>
                  <Images size={34} />
                  <p>Agrega variantes primero para asignar fotos por color.</p>
                  <button type="button" className="btn btn-outline" onClick={() => onTabChange('variants')}>Ir a Variantes</button>
                </div>
              ) : (
                <>
                  <p className={styles.quickHint}>
                    Cada color/modelo tiene su propia galería. Esas fotos se comparten entre todas las tallas; la primera es la principal.
                  </p>
                  <div className={styles.colorCards}>
                    {groupList.map(group => {
                      const gallery = getGalleryFor(group)
                      const photoCount = gallery.images.length + gallery.pending.length
                      return (
                        <div key={group.key} className={styles.colorCard}>
                          <div className={styles.colorCardHeader}>
                            <div>
                              <div className={styles.colorCardTitle}>{groupLabelOf(group.variants[0])}</div>
                              <div className={styles.colorCardMeta}>
                                {group.variants.map(v => v.size || 'Única').join(' · ')} · {group.variants.length} talla(s)
                              </div>
                            </div>
                            <span className={styles.countPill}>{photoCount} foto{photoCount === 1 ? '' : 's'}</span>
                          </div>

                          {(gallery.images.length > 0 || gallery.pending.length > 0) && (
                            <div className={styles.imgGrid}>
                              {gallery.images.map((url, index) => (
                                <div key={url} className={`${styles.imgThumbWrap} ${index === 0 ? styles.imgMain : ''}`}>
                                  <img src={url} alt="" className={styles.imgThumb} />
                                  {index === 0 && <span className={styles.mainBadge}><Star size={10}/> Principal</span>}
                                  <div className={styles.imgActions}>
                                    {index !== 0 && (
                                      <button type="button" className={styles.imgActionBtn} onClick={() => makeGroupPhotoPrincipal(group, url)} title="Hacer principal">
                                        <Star size={12}/>
                                      </button>
                                    )}
                                    <button type="button" className={`${styles.imgActionBtn} ${styles.imgDeleteBtn}`} onClick={() => removeGroupPhoto(group, url)} title="Quitar foto">
                                      <X size={12}/>
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {gallery.pending.map(entry => (
                                <div key={entry.id} className={styles.imgThumbWrap}>
                                  <img src={entry.preview} alt="" className={styles.imgThumb} />
                                  <span className={styles.newBadge}>Nueva</span>
                                  <div className={styles.imgActions}>
                                    <button type="button" className={`${styles.imgActionBtn} ${styles.imgDeleteBtn}`} onClick={() => removeGroupPending(group, entry.id)} title="Quitar foto">
                                      <X size={12}/>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <label className={styles.uploadArea}>
                            <ImagePlus size={18} />
                            <span>Agregar fotos</span>
                            <span style={{ fontSize: '11px', opacity: 0.6 }}>Puedes subir varias a la vez</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => { addGroupPhotos(group, e.target.files); e.target.value = '' }}
                            />
                          </label>
                          {photoCount === 0 && (
                            <p className={styles.quickHint}>Sin fotos: se usará la imagen principal del producto.</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}

          <div className={styles.toggles}>
            <label className={styles.toggle}><input type="checkbox" checked={form.featured} onChange={(e) => setForm({...form,featured:e.target.checked})} /><span>Producto destacado</span></label>
            <label className={styles.toggle}><input type="checkbox" checked={form.active} onChange={(e) => setForm({...form,active:e.target.checked})} /><span>Activo (visible en tienda)</span></label>
          </div>

          {error && <p className={styles.formError}>{error}</p>}

          {saved && (
            <div className={styles.successBox}>
              <p>Producto guardado correctamente.</p>
              <p className={styles.quickHint}>Para seguir editando (por ejemplo, agregar más fotos), cierra y vuelve a abrir el producto.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const { exportProductLabels } = await import('../../lib/labelExport')
                  exportProductLabels({ id: form.id, name: form.name, price: form.price }, orderedVariants)
                }}
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
                <button type="submit" className="btn btn-primary" disabled={saving || hasErrors}>
                  {saving ? <div className={styles.spinner}/> : <><Save size={16}/> Guardar</>}
                </button>
              </>
            )}
          </div>
        </form>

        <ConfirmModal
          isOpen={confirmOpen}
          title={product ? '¿Guardar cambios?' : '¿Crear producto?'}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={executeSave}
          confirmText="Confirmar"
          disabled={saving}
        >
          <ul className={styles.summaryList}>
            <li><span className={styles.summaryLabel}>ID</span><span className={styles.summaryValue}>{form.id || '—'}</span></li>
            <li><span className={styles.summaryLabel}>Nombre</span><span className={styles.summaryValue}>{form.name || '—'}</span></li>
            <li><span className={styles.summaryLabel}>Categoría</span><span className={styles.summaryValue}>{category?.name || '—'}</span></li>
            <li><span className={styles.summaryLabel}>Variantes</span><span className={styles.summaryValue}>{orderedVariants.length}</span></li>
            <li><span className={styles.summaryLabel}>Stock total</span><span className={styles.summaryValue}>{orderedVariants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)} uds</span></li>
            <li><span className={styles.summaryLabel}>Precio final</span><span className={styles.summaryValue}>${form.price || '0.00'}</span></li>
          </ul>
        </ConfirmModal>
      </motion.div>

      <AddSizesModal
        open={sizesModalOpen}
        groups={groupList}
        sizeOptions={categorySizeOptions}
        sizeLabel={categorySizeLabel}
        defaultStock={quick.stock}
        defaultPrice={quick.price !== '' ? quick.price : form.price}
        defaultWholesale={quick.wholesale !== '' ? quick.wholesale : form.wholesale_price}
        onClose={() => setSizesModalOpen(false)}
        onAdd={addVariantsFromMatrix}
      />
    </motion.div>
  )
}

function AddSizesModal({ open, groups, sizeOptions, sizeLabel, defaultStock, defaultPrice, defaultWholesale, onClose, onAdd }) {
  const [selected, setSelected] = useState({})
  const [newColor, setNewColor] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newSizes, setNewSizes] = useState([])
  const [stock, setStock] = useState(defaultStock ?? '1')
  const [price, setPrice] = useState(defaultPrice ?? '')
  const [wholesale, setWholesale] = useState(defaultWholesale ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSelected({})
    setNewColor('')
    setNewModel('')
    setNewSizes([])
    setStock(defaultStock ?? '1')
    setPrice(defaultPrice ?? '')
    setWholesale(defaultWholesale ?? '')
    setError('')
  }, [open, defaultStock, defaultPrice, defaultWholesale])

  if (!open) return null

  const missingSizesOf = (group) => {
    const existing = new Set(group.variants.map(v => v.size).filter(Boolean))
    return sizeOptions.filter(size => !existing.has(size))
  }

  const toggleSize = (key, size) => {
    setSelected(prev => {
      const current = prev[key] || []
      return {
        ...prev,
        [key]: current.includes(size) ? current.filter(s => s !== size) : [...current, size],
      }
    })
  }

  const selectAll = (group) => {
    setSelected(prev => ({ ...prev, [group.key]: missingSizesOf(group) }))
  }

  const total = Object.values(selected).reduce((sum, sizes) => sum + sizes.length, 0) + newSizes.length

  const confirm = () => {
    if (total === 0) {
      setError('Selecciona al menos una talla')
      return
    }
    if (newSizes.length > 0 && !newColor.trim() && !newModel.trim()) {
      setError('Para el color nuevo escribe un color o un modelo')
      return
    }
    if (newSizes.length > 0) {
      const newKey = `${newColor.trim().toLowerCase()}::${newModel.trim().toLowerCase()}`
      const existingGroup = groups.find(group => group.key === newKey)
      if (existingGroup) {
        const existingSizes = new Set(existingGroup.variants.map(v => v.size).filter(Boolean))
        if (newSizes.some(size => existingSizes.has(size))) {
          setError('Ese color/modelo ya existe. Marca sus tallas en la tarjeta de arriba.')
          return
        }
      }
    }
    onAdd({
      selections: groups
        .map(group => ({ key: group.key, sizes: selected[group.key] || [] }))
        .filter(selection => selection.sizes.length > 0),
      newGroup: { color: newColor.trim(), model: newModel.trim(), sizes: newSizes },
      defaults: { stock, price, wholesale },
    })
  }

  return (
    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className={styles.sizesModal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2><Layers size={20} /> Agregar {sizeLabel.toLowerCase()}s por color</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.sizesBody}>
          {groups.length === 0 ? (
            <p className={styles.quickHint}>Aún no hay colores. Crea el primero aquí abajo.</p>
          ) : (
            groups.map(group => {
              const missing = missingSizesOf(group)
              const chosen = selected[group.key] || []
              return (
                <div key={group.key} className={styles.sizeGroupCard}>
                  <div className={styles.sizeGroupHeader}>
                    <div>
                      <div className={styles.colorCardTitle}>{groupLabelOf(group.variants[0])}</div>
                      <div className={styles.colorCardMeta}>
                        Ya tiene: {group.variants.map(v => v.size || 'Única').join(' · ') || '—'}
                      </div>
                    </div>
                    {missing.length > 0 && (
                      <button type="button" className={styles.sizeChip} onClick={() => selectAll(group)}>Todas</button>
                    )}
                  </div>
                  <div className={styles.sizeChips}>
                    {sizeOptions.map(size => {
                      const exists = !missing.includes(size)
                      const active = chosen.includes(size)
                      return (
                        <button
                          key={size}
                          type="button"
                          className={`${styles.sizeChip} ${exists ? styles.sizeChipExisting : ''} ${active ? styles.sizeChipActive : ''}`}
                          disabled={exists}
                          onClick={() => toggleSize(group.key, size)}
                        >
                          {exists ? `${size} ✓` : size}
                        </button>
                      )
                    })}
                    {missing.length === 0 && <span className={styles.quickHint}>Este color ya tiene todas las tallas.</span>}
                  </div>
                </div>
              )
            })
          )}

          <div className={styles.sizeGroupCard}>
            <div className={styles.colorCardTitle}>Nuevo color / modelo</div>
            <div className={styles.quickGrid}>
              <div className={styles.field}>
                <label className="label">Color</label>
                <input className="input" value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="Ej: Negro" />
              </div>
              <div className={styles.field}>
                <label className="label">Modelo / Estampado</label>
                <input className="input" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Ej: Corazones" />
              </div>
            </div>
            <div className={styles.sizeChips}>
              {sizeOptions.map(size => {
                const active = newSizes.includes(size)
                return (
                  <button
                    key={size}
                    type="button"
                    className={`${styles.sizeChip} ${active ? styles.sizeChipActive : ''}`}
                    onClick={() => setNewSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className="label">Stock inicial</label>
              <input type="number" min="0" className="input" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="1" />
            </div>
            <div className={styles.field}>
              <label className="label">Precio (opcional)</label>
              <input type="number" step="0.01" className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Base" />
            </div>
            <div className={styles.field}>
              <label className="label">Mayor (opcional)</label>
              <input type="number" step="0.01" className="input" value={wholesale} onChange={(e) => setWholesale(e.target.value)} placeholder="Base" />
            </div>
          </div>

          {error && <p className={styles.formError}>{error}</p>}
        </div>
        <div className={styles.sizesFooter}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={total === 0}>
            <Check size={15} /> Agregar {total} variante{total === 1 ? '' : 's'}
          </button>
        </div>
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
