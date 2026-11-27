import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Trash2, ShoppingBag, MessageCircle, ArrowRight } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { useDayDiscounts } from '../../context/DayDiscountsContext'
import { sendWhatsAppOrder } from '../../lib/whatsapp'
import { formatVariantLabel } from '../../lib/sku'
import { STOREFRONTS } from '../../lib/storefronts'
import CategoryArtwork from './CategoryArtwork'
import styles from './CartDrawer.module.css'

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const drawerVariants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit:   { x: '100%', transition: { duration: 0.25, ease: 'easeIn' } },
}

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

export default function CartDrawer({
  isOpen,
  onClose,
  browseLabel = 'Ver catálogo',
  browsePath = null,
  onBrowse = null,
}) {
  const navigate = useNavigate()
  const { percentageFor } = useDayDiscounts()
  const { items, removeItem, updateQuantity, clearCart } = useCartStore()

  const pricedItems = useMemo(() => items.map((item) => {
    const storeId = item.store_id || 'elite'
    const categoryId = item.category_id || null
    const percentage = percentageFor(storeId, categoryId, item.product_id) || 0
    const originalPrice = Number(item.original_price ?? item.price) || 0
    const price = percentage > 0
      ? round2(originalPrice * (1 - percentage / 100))
      : originalPrice
    return {
      ...item,
      original_price: originalPrice,
      price,
      discount_percentage: percentage,
    }
  }), [items, percentageFor])

  const total = pricedItems.reduce((s, i) => s + i.price * i.quantity, 0)

  const groups = useMemo(() => {
    const map = new Map()
    pricedItems.forEach((item) => {
      const storeId = item.store_id || 'elite'
      if (!map.has(storeId)) map.set(storeId, [])
      map.get(storeId).push(item)
    })
    return [...map.entries()].map(([storeId, storeItems]) => ({
      store: STOREFRONTS[storeId] || STOREFRONTS.elite,
      items: storeItems,
    }))
  }, [pricedItems])

  const handleWhatsApp = () => {
    sendWhatsAppOrder(pricedItems)
  }

  const handleViewProduct = (item) => {
    const store = STOREFRONTS[item.store_id] || STOREFRONTS.elite
    onClose()
    navigate(store.productPath ? store.productPath(item.product_id) : `/product/${item.product_id}`)
  }

  const handleBrowse = () => {
    onClose()
    if (onBrowse) {
      onBrowse()
      return
    }
    if (browsePath) navigate(browsePath)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className={styles.overlay}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className={styles.drawer}
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label="Carrito de compras"
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                <ShoppingBag size={20} />
                <h2>Mi Carrito</h2>
              </div>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            {/* Items */}
            <div className={styles.body}>
              {items.length === 0 ? (
                <motion.div
                  className={styles.empty}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ShoppingBag size={48} className={styles.emptyIcon} />
                  <p>Tu carrito está vacío</p>
                  <span>Agrega productos para empezar</span>
                  <button className={styles.emptyCta} onClick={handleBrowse}>
                    {browseLabel} <ArrowRight size={16} />
                  </button>
                </motion.div>
              ) : (
                <div className={styles.groups}>
                  {groups.map((group) => (
                    <section key={group.store.id} className={styles.storeGroup}>
                      <div className={styles.storeGroupHeader}>
                        <span
                          className={styles.storeDot}
                          style={{ background: group.store.accent }}
                        />
                        <span className={styles.storeGroupName}>{group.store.fullName}</span>
                        <span className={styles.storeGroupCount}>
                          {group.items.reduce((sum, item) => sum + item.quantity, 0)} uds
                        </span>
                      </div>

                      <ul className={styles.itemList}>
                        {group.items.map((item) => (
                          <li key={item.id} className={styles.item}>
                            {/* Image */}
                            <div
                              className={styles.itemImage}
                              onClick={() => handleViewProduct(item)}
                              style={{ cursor: 'pointer' }}
                            >
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : item.store_id === 'usa' ? (
                                <CategoryArtwork
                                  category={item.category_name}
                                  size="mini"
                                />
                              ) : (
                                <div className={styles.imagePlaceholder}>
                                  <ShoppingBag size={24} />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className={styles.itemInfo}>
                              <h4
                                className={styles.itemName}
                                onClick={() => handleViewProduct(item)}
                                style={{ cursor: 'pointer' }}
                              >
                                {item.name}
                              </h4>
                              <span className={styles.itemVariant}>
                                {formatVariantLabel(item, item.size_label)}
                              </span>
                              {item.sku && <span className={styles.itemSku}>SKU: {item.sku}</span>}
                              <div className={styles.itemPriceRow}>
                                <span className={styles.itemUnitPrice}>${item.price.toFixed(2)} c/u</span>
                                {item.discount_percentage > 0 && (
                                  <span className={styles.discountTag}>
                                    -{Number(item.discount_percentage.toFixed(2))}%
                                  </span>
                                )}
                              </div>
                              {item.original_price > item.price && (
                                <span className={styles.itemOldPrice}>
                                  Antes ${item.original_price.toFixed(2)}
                                </span>
                              )}
                              <span className={styles.itemTotal}>
                                Total: ${(item.price * item.quantity).toFixed(2)}
                              </span>

                              {item.quantity >= item.stock && (
                                <span className={styles.stockWarning}>Máx. disponible</span>
                              )}

                              {/* Quantity controls */}
                              <div className={styles.qtyControls}>
                                <button
                                  className={styles.qtyBtn}
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  aria-label="Disminuir cantidad"
                                >
                                  −
                                </button>
                                <span className={styles.qty}>{item.quantity}</span>
                                <button
                                  className={styles.qtyBtn}
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= item.stock}
                                  aria-label="Aumentar cantidad"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Remove */}
                            <button
                              className={styles.removeBtn}
                              onClick={() => removeItem(item.id)}
                              aria-label="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className={styles.footer}>
                <div className={styles.totalRow}>
                  <span>Total ({items.reduce((acc, i) => acc + i.quantity, 0)} productos)</span>
                  <span className={styles.totalAmount}>${total.toFixed(2)}</span>
                </div>

                <motion.button
                  className={`${styles.whatsappBtn}`}
                  onClick={handleWhatsApp}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <MessageCircle size={20} />
                  Pedir por WhatsApp
                </motion.button>

                <button className={styles.clearBtn} onClick={clearCart}>
                  Vaciar carrito
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
