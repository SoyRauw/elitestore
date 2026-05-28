import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, ShoppingBag, MessageCircle } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { sendWhatsAppOrder } from '../../lib/whatsapp'
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
  const { items, removeItem, updateQuantity, clearCart } = useCartStore()
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  const handleWhatsApp = () => {
    sendWhatsAppOrder(items)
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
                </motion.div>
              ) : (
                <ul className={styles.itemList}>
                  <AnimatePresence>
                    {items.map((item) => (
                      <motion.li
                        key={`${item.id}-${item.size}`}
                        className={styles.item}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {/* Image */}
                        <div className={styles.itemImage}>
                          {item.image ? (
                            <img src={item.image} alt={item.name} />
                          ) : (
                            <div className={styles.imagePlaceholder}>
                              <ShoppingBag size={24} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className={styles.itemInfo}>
                          <h4 className={styles.itemName}>{item.name}</h4>
                          <span className={styles.itemSize}>Talla: {item.size}</span>
                          <span className={styles.itemPrice}>
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>

                          {/* Quantity controls */}
                          <div className={styles.qtyControls}>
                            <button
                              className={styles.qtyBtn}
                              onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                            >
                              −
                            </button>
                            <span className={styles.qty}>{item.quantity}</span>
                            <button
                              className={styles.qtyBtn}
                              onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Remove */}
                        <button
                          className={styles.removeBtn}
                          onClick={() => removeItem(item.id, item.size)}
                          aria-label="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className={styles.footer}>
                <div className={styles.totalRow}>
                  <span>Total</span>
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
