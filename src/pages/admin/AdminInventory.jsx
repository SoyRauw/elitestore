import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Package, LogOut, BarChart2, Tag, ShoppingBag, Save, FolderTree } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import styles from './AdminInventory.module.css'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL']

export default function AdminInventory() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [saved, setSaved] = useState({})
  
  // local state of sizes being edited: { productId: { XS: 5, S: 2 } }
  const [draftSizes, setDraftSizes] = useState({})

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('products').select('id, name, price, images, product_sizes(size, stock)').order('name')
      if (data) {
        setProducts(data)
        const drafts = {}
        data.forEach(p => {
          drafts[p.id] = {}
          SIZES.forEach(s => drafts[p.id][s] = 0)
          p.product_sizes?.forEach(ps => { drafts[p.id][ps.size] = ps.stock })
        })
        setDraftSizes(drafts)
      }
      setLoading(false)
    }
    fetch()
  }, [])

  const updateSizeDraft = (productId, size, value) => {
    setDraftSizes(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [size]: Math.max(0, parseInt(value) || 0) }
    }))
  }

  const saveProductInventory = async (productId) => {
    setSaving(s => ({ ...s, [productId]: true }))
    
    // We do an upsert for all 5 sizes for this product
    const sizesToUpsert = SIZES.map(size => ({
      product_id: productId,
      size,
      stock: draftSizes[productId][size]
    }))

    await supabase.from('product_sizes').upsert(sizesToUpsert, { onConflict: 'product_id,size' })
    
    setSaving(s => ({ ...s, [productId]: false }))
    setSaved(s => ({ ...s, [productId]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [productId]: false })), 2000)
  }

  const totalStockOf = (productId) => {
    if (!draftSizes[productId]) return 0
    return Object.values(draftSizes[productId]).reduce((sum, v) => sum + v, 0)
  }

  return (
    <AdminLayout>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Inventario</h1>
            <p className={styles.pageSubtitle}>Stock actual por producto y talla</p>
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
              const total = totalStockOf(product.id)
              const isLow = total > 0 && total < 5
              const isOut = total === 0
              return (
                <motion.div key={product.id} className={styles.productCard} initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:i*0.06}}>
                  <div className={styles.productHeader}>
                    <div className={styles.productInfo}>
                      <div className={styles.productThumb}>
                        {product.images?.[0] ? <img src={product.images[0]} alt={product.name}/> : <ShoppingBag size={16}/>}
                      </div>
                      <div>
                        <div className={styles.productName}>{product.name}</div>
                        <div className={styles.productId}>#{product.id}</div>
                      </div>
                    </div>
                    <div className={styles.productMeta}>
                      <span className={`${styles.stockTotal} ${isOut?styles.stockOut:isLow?styles.stockLow:styles.stockOk}`}>
                        {isOut ? '⚠ Sin stock' : isLow ? `⚡ ${total} und.` : `✓ ${total} und.`}
                      </span>
                      <span className={styles.productPrice}>${product.price}</span>
                    </div>
                  </div>

                  <div className={styles.sizesTable}>
                    {SIZES.map((size) => {
                      const qty = draftSizes[product.id]?.[size] ?? 0
                      const isLowSize = qty > 0 && qty < 3
                      return (
                        <div key={size} className={styles.sizeRow}>
                          <span className={styles.sizeLabel}>{size}</span>
                          <div className={styles.sizeBar}>
                            <div className={`${styles.sizeBarFill} ${qty===0?styles.barOut:isLowSize?styles.barLow:styles.barOk}`} style={{width: `${Math.min(100, qty * 10)}%`}} />
                          </div>
                          <input type="number" min={0} className={styles.sizeQtyInput} value={qty} onChange={(e) => updateSizeDraft(product.id, size, e.target.value)} />
                        </div>
  )
})}
                  </div>

                  <button className={`${styles.saveBtn} ${saved[product.id]?styles.saveBtnSaved:''}`} onClick={()=>saveProductInventory(product.id)} disabled={saving[product.id]}>
                    {saving[product.id] ? <div className={styles.spinner}/> : saved[product.id] ? '✓ Guardado' : <><Save size={14}/> Guardar cambios</>}
                  </button>
                </motion.div>
              )
            })}
          </div>
  )
}
      
    </AdminLayout>
  )
}
