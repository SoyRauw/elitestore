import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Trash2, ShoppingBag, MessageCircle, ArrowRight } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { sendWhatsAppOrder } from '../../lib/whatsapp'
import { formatVariantLabel } from '../../lib/sku'
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

export default function CartDrawer({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { items, removeItem, updateQuantity, clearCart } = useCartStore()
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  const handleWhatsApp = () => {
    sendWhatsAppOrder(items)
  }

  const handleViewProduct = (productId) => {
    onClose()
    navigate(`/product/${productId}`)
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
                  <button
                    className={styles.emptyCta}
                    onClick={() => { onClose(); navigate('/catalog') }}
                  >
                    Ver catálogo <ArrowRight size={16} />
                  </button>
                </motion.div>
              ) : (
                <ul className={styles.itemList}>
                  {items.map((item) => (
                    <li key={item.id} className={styles.item}>
                      {/* Image */}
                      <div
                        className={styles.itemImage}
                        onClick={() => handleViewProduct(item.product_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
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
                          onClick={() => handleViewProduct(item.product_id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {item.name}
                        </h4>
                        <span className={styles.itemVariant}>
                          {formatVariantLabel(item, item.size_label)}
                        </span>
                        {item.sku && <span className={styles.itemSku}>SKU: {item.sku}</span>}
                        <span className={styles.itemUnitPrice}>${item.price.toFixed(2)} c/u</span>
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
