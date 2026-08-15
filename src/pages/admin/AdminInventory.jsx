import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Package, Save, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react'
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

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  useEffect(() => {
    const fetch = async () => {
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
    }
    fetch()
  }, [])

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

  return (
    <AdminLayout>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>Inventario</h1>
          <p className={styles.pageSubtitle}>Stock actual por producto y variante</p>
        </div>
      </div>

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
                <div className={styles.productHeader} onClick={() => toggleExpand(product.id)} style={{ cursor: 'pointer' }}>
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
