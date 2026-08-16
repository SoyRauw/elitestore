import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Package, Save, ShoppingBag, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { formatVariantLabel, getVariantImage } from '../../lib/sku'
import styles from './AdminInventory.module.css'

export default function AdminInventory() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [saved, setSaved] = useState({})
  const [draftStocks, setDraftStocks] = useState({})
  const [expanded, setExpanded] = useState({})
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkError, setBulkError] = useState('')

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, price, wholesale_price, images, category_id, categories(size_label), product_variants(*)')
      .order('name')
    if (data) {
      setProducts(data)
      const drafts = {}
      data.forEach(p => {
        p.product_variants?.forEach(v => {
          drafts[v.id] = v.stock || 0
        })
      })
      setDraftStocks(drafts)
    }
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

  const totalStockOf = (product) => {
    return (product.product_variants || []).reduce((sum, v) => sum + (draftStocks[v.id] ?? v.stock ?? 0), 0)
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

  return (
    <AdminLayout>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>Inventario</h1>
          <p className={styles.pageSubtitle}>Stock actual por producto y variante</p>
        </div>
        {selectedIds.size > 0 && (
          <button className="btn btn-danger" onClick={handleBulkDelete}>
            <Trash2 size={16} /> Eliminar {selectedIds.size}
          </button>
        )}
      </div>

      {bulkError && <p className={styles.formError}>{bulkError}</p>}

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
        <div className={styles.productList}>
          {products.map((product, i) => {
            const total = totalStockOf(product)
            const isLow = total > 0 && total < 5
            const isOut = total === 0
            const variants = product.product_variants || []
            return (
              <motion.div key={product.id} className={styles.productCard} initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:i*0.06}}>
                <div className={`${styles.productHeader} ${selectedIds.has(product.id) ? styles.productHeaderSelected : ''}`} onClick={() => toggleExpand(product.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelection(product.id) }}
                    />
                    <div className={styles.productMain}>
                    <div className={styles.productThumb}>
                      {product.images?.[0] ? <img src={product.images[0]} alt={product.name}/> : <ShoppingBag size={16}/>}
                    </div>
                    <div className={styles.productDetailsInfo}>
                      <div className={styles.productName}>{product.name}</div>
                      <div className={styles.productId}>#{product.id}</div>
                      <div className={styles.productPrices}>
                        <span className={styles.priceRetail}>Detal: ${product.price}</span>
                        {product.wholesale_price > 0 && <span className={styles.priceWholesale}>Mayor: ${product.wholesale_price}</span>}
                      </div>
                    </div>
                  </div>
                  </div>
                  <div className={styles.productActionsRow}>
                    <span className={`${styles.stockTotal} ${isOut?styles.stockOut:isLow?styles.stockLow:styles.stockOk}`}>
                      {isOut ? '⚠ Sin stock' : isLow ? `⚡ ${total} und.` : `✓ ${total} und.`}
                    </span>
                    {expanded[product.id] ? <ChevronUp size={20} className={styles.expandIcon}/> : <ChevronDown size={20} className={styles.expandIcon}/>}
                  </div>
                </div>

                {expanded[product.id] && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={styles.productDetails}>
                    <div className={styles.sizesTable}>
                      {variants.map((variant) => {
                        const qty = draftStocks[variant.id] ?? variant.stock ?? 0
                        const isLowSize = qty > 0 && qty < 3
                        return (
                          <div key={variant.id} className={styles.sizeRow}>
                            <div className={styles.variantThumbInventory}>
                              {getVariantImage(product, variant) ? (
                                <img src={getVariantImage(product, variant)} alt={formatVariantLabel(variant, product.categories?.size_label)} />
                              ) : (
                                <ShoppingBag size={14} />
                              )}
                            </div>
                            <span className={styles.sizeLabel} style={{ flex: 1, textAlign: 'left' }}>
                              {formatVariantLabel(variant, product.categories?.size_label)}
                              <div style={{ fontSize: '11px', color: 'var(--color-dark-soft)', fontWeight: 'normal' }}>{variant.sku}</div>
                            </span>
                            <div className={styles.sizeBar}>
                              <div className={`${styles.sizeBarFill} ${qty===0?styles.barOut:isLowSize?styles.barLow:styles.barOk}`} style={{width: `${Math.min(100, qty * 10)}%`}} />
                            </div>
                            <input
                              type="number"
                              min={0}
                              className={styles.sizeQtyInput}
                              value={qty}
                              onChange={(e) => updateStockDraft(variant.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              className={`${styles.saveBtn} ${saved[variant.id]?styles.saveBtnSaved:''}`}
                              onClick={(e) => { e.stopPropagation(); saveVariantStock(variant.id) }}
                              disabled={saving[variant.id]}
                              style={{ marginLeft: '0.5rem', padding: '0.4rem 0.6rem', minWidth: 'auto' }}
                            >
                              {saving[variant.id] ? <div className={styles.spinner}/> : saved[variant.id] ? '✓' : <Save size={14}/>}
                            </button>
                            <button
                              className={styles.deleteBtn}
                              onClick={(e) => { e.stopPropagation(); handleDeleteVariant(variant.id, product.id) }}
                              title="Eliminar variante"
                              style={{ marginLeft: '0.35rem', padding: '0.4rem', minWidth: 'auto' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
