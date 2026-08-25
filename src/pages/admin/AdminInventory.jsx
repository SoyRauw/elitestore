import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Package, Save, ShoppingBag, ChevronDown, ChevronUp, Trash2, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { useAuth } from '../../hooks/useAuth'
import { formatVariantLabel, getVariantImage } from '../../lib/sku'
import styles from './AdminInventory.module.css'

export default function AdminInventory() {
  const { isAdmin } = useAuth()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [saved, setSaved] = useState({})
  const [draftStocks, setDraftStocks] = useState({})
  const [expanded, setExpanded] = useState({})
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkError, setBulkError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [lightboxImage, setLightboxImage] = useState(null)

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const fetchData = async () => {
    setLoading(true)
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, price, wholesale_price, images, category_id, categories(id, name, size_label), product_variants(*)')
        .order('name'),
      supabase.from('categories').select('id, name').order('name')
    ])
    const data = prodRes.data || []
    setProducts(data)
    setCategories(catRes.data || [])
    const drafts = {}
    data.forEach(p => {
      p.product_variants?.forEach(v => {
        drafts[v.id] = v.stock || 0
      })
    })
    setDraftStocks(drafts)
    setLoading(false)
    setSelectedIds(new Set())
  }

  useEffect(() => { fetchData() }, [])

  const updateStockDraft = (variantId, value) => {
    setDraftStocks(prev => ({ ...prev, [variantId]: Math.max(0, parseInt(value) || 0) }))
  }

  const saveVariantStock = async (variantId) => {
    setSaving(s => ({ ...s, [variantId]: true }))
    await supabase
      .from('product_variants')
      .update({ stock: draftStocks[variantId] || 0 })
      .eq('id', variantId)
    setSaving(s => ({ ...s, [variantId]: false }))
    setSaved(s => ({ ...s, [variantId]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [variantId]: false })), 2000)
  }

  const totalStockOf = useCallback((product) => {
    return (product.product_variants || []).reduce((sum, v) => sum + (draftStocks[v.id] ?? v.stock ?? 0), 0)
  }, [draftStocks])

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

  const checkVariantHasSales = async (variantId) => {
    const { data } = await supabase
      .from('movement_items')
      .select('id')
      .eq('variant_id', variantId)
      .limit(1)
    return (data || []).length > 0
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
    fetchData()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.size} productos del inventario?`)) return
    await deleteProductsByIds(selectedIds)
  }

  const handleDeleteVariant = async (variantId, productId) => {
    if (!confirm('¿Eliminar esta variante?')) return
    if (await checkVariantHasSales(variantId)) {
      alert('No se puede eliminar porque tiene ventas previas')
      return
    }
    await supabase.from('product_variants').delete().eq('id', variantId)
    const remaining = products.find(p => p.id === productId)?.product_variants?.filter(v => v.id !== variantId) || []
    if (remaining.length === 0) {
      await supabase.from('products').delete().eq('id', productId)
    }
    fetchData()
  }

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      const variants = p.product_variants || []
      const total = totalStockOf(p)
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        variants.some(v => (v.sku || '').toLowerCase().includes(term) || (v.barcode || '').toLowerCase().includes(term))
      const matchesCategory = !categoryFilter || p.category_id === categoryFilter
      const matchesStock =
        !stockFilter ||
        (stockFilter === 'out' ? total === 0 : stockFilter === 'low' ? total > 0 && total < 5 : total >= 5)
      return matchesSearch && matchesCategory && matchesStock
    })
  }, [products, search, categoryFilter, stockFilter, totalStockOf])

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
  }

  const stockStatus = (total) => {
    if (total === 0) return { label: 'Sin stock', cls: styles.stockOut }
    if (total < 5) return { label: `⚡ ${total} und.`, cls: styles.stockLow }
    return { label: `✓ ${total} und.`, cls: styles.stockOk }
  }

  const colSpan = isAdmin ? 6 : 5

  return (
    <AdminLayout>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>Inventario</h1>
          <p className={styles.pageSubtitle}>{filteredProducts.length} de {products.length} productos</p>
        </div>
        {isAdmin && selectedIds.size > 0 && (
          <button className="btn btn-danger" onClick={handleBulkDelete}>
            <Trash2 size={16} /> Eliminar {selectedIds.size}
          </button>
        )}
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
          {(search || categoryFilter || stockFilter) && (
            <button className="btn btn-outline" onClick={clearFilters} style={{ padding: '0.55rem 0.9rem' }}>
              Limpiar
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonList}>
          {[1,2,3].map(i => <div key={i} className={`skeleton ${styles.skeletonCard}`}/>)}
        </div>
      ) : products.length === 0 ? (
        <div className={styles.empty}>
          <Package size={48} style={{color:'var(--color-secondary)'}}/>
          <p>No hay productos en el inventario</p>
          <Link to="/admin/products" className="btn btn-primary" style={{marginTop:'0.5rem'}}>Agregar productos</Link>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                  </th>
                )}
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock total</th>
                <th>Variantes</th>
                <th style={{ width: '60px' }}></th>
              </tr>
            </thead>
            {filteredProducts.map((product) => {
              const total = totalStockOf(product)
              const status = stockStatus(total)
              const variants = product.product_variants || []
              return (
                <tbody key={product.id}>
                  <motion.tr
                    className={`${styles.tableRow} ${isAdmin && selectedIds.has(product.id) ? styles.tableRowSelected : ''}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  >
                    {isAdmin && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelection(product.id)}
                        />
                      </td>
                    )}
                    <td>
                      <div className={styles.productCell}>
                        <button
                          type="button"
                          className={styles.productThumb}
                          onClick={() => setLightboxImage(product.images?.[0] || null)}
                          disabled={!product.images?.[0]}
                          title="Ver imagen"
                        >
                          {product.images?.[0] ? <img src={product.images[0]} alt={product.name}/> : <ShoppingBag size={16}/>}
                        </button>
                        <div>
                          <div className={styles.productName}>{product.name}</div>
                          <div className={styles.productId}>#{product.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-primary">{product.categories?.name || 'N/A'}</span>
                    </td>
                    <td className={styles.priceCell}>${product.price}</td>
                    <td>
                      <span className={`${styles.stockTotal} ${status.cls}`}>{status.label}</span>
                    </td>
                    <td>{variants.length} variantes</td>
                    <td>
                      <button className={styles.expandBtn} onClick={() => toggleExpand(product.id)}>
                        {expanded[product.id] ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                      </button>
                    </td>
                  </motion.tr>

                  {expanded[product.id] && (
                    <tr className={styles.detailRow}>
                      <td colSpan={colSpan} className={styles.detailCell}>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className={styles.variantPanelInner}
                        >
                          <h4 className={styles.variantPanelTitle}>
                            {isAdmin ? `Editar stock: ${product.name}` : `Variantes de ${product.name}`}
                          </h4>
                          <div className={styles.variantGrid}>
                            {variants.map((variant) => {
                              const qty = draftStocks[variant.id] ?? variant.stock ?? 0
                              const price = variant.price ?? product.price ?? 0
                              return (
                                <div key={variant.id} className={styles.variantCard}>
                                  <div className={styles.variantThumbInventory}>
                                    {getVariantImage(product, variant) ? (
                                      <img src={getVariantImage(product, variant)} alt={formatVariantLabel(variant, product.categories?.size_label)} />
                                    ) : (
                                      <ShoppingBag size={14} />
                                    )}
                                  </div>
                                  <div className={styles.variantInfo}>
                                    <div className={styles.variantName}>
                                      {formatVariantLabel(variant, product.categories?.size_label)}
                                    </div>
                                    <div className={styles.variantId}>{variant.id}</div>
                                    <div className={styles.variantMeta}>
                                      <span>Cantidad: <strong>{qty}</strong></span>
                                      <span>Precio: <strong>${price}</strong></span>
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <div className={styles.variantActions}>
                                      <input
                                        type="number"
                                        min={0}
                                        className={styles.variantQtyInput}
                                        value={qty}
                                        onChange={(e) => updateStockDraft(variant.id, e.target.value)}
                                      />
                                      <button
                                        className={`${styles.saveBtn} ${saved[variant.id]?styles.saveBtnSaved:''}`}
                                        onClick={() => saveVariantStock(variant.id)}
                                        disabled={saving[variant.id]}
                                        title="Guardar stock"
                                      >
                                        {saving[variant.id] ? <div className={styles.spinner}/> : saved[variant.id] ? '✓' : <Save size={14}/>}
                                      </button>
                                      <button
                                        className={styles.deleteBtn}
                                        onClick={() => handleDeleteVariant(variant.id, product.id)}
                                        title="Eliminar variante"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </tbody>
              )
            })}
          </table>

          {filteredProducts.length === 0 && (
            <div className={styles.emptyTable}>No hay productos que coincidan con los filtros.</div>
          )}
        </div>
      )}

      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            className={styles.lightbox}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
          >
            <button className={styles.lightboxClose} onClick={() => setLightboxImage(null)}>
              <X size={24} />
            </button>
            <img src={lightboxImage} alt="Vista ampliada" className={styles.lightboxImg} />
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
