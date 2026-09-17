import { motion } from 'framer-motion'
import { Calendar, Package, X } from 'lucide-react'
import styles from './ReturnInvoicePicker.module.css'

function formatMoney(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

export default function ReturnInvoicePicker({ options, onSelect, onClose }) {
  if (!options || options.length === 0) return null

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={styles.modal}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <div className={styles.header}>
          <h3>Elige la factura</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className={styles.subtitle}>Este producto aparece en varias facturas recientes.</p>
        <div className={styles.list}>
          {options.map((opt) => {
            const invoice = opt.invoice
            const item = opt.item
            const variant = item.product_variants
            const remaining = item.quantity - (item.returned_quantity || 0)
            return (
              <button
                key={`${invoice.id}-${item.id}`}
                className={styles.option}
                onClick={() => onSelect(opt)}
              >
                <div className={styles.optionMain}>
                  <span className={styles.invoiceId}>Factura #{invoice.id.slice(0, 8)}</span>
                  <span className={styles.date}>
                    <Calendar size={12} /> {new Date(invoice.created_at).toLocaleString()}
                  </span>
                </div>
                <div className={styles.optionDetail}>
                  <span><Package size={12} /> {variant?.products?.name}</span>
                  <span>{formatMoney(item.unit_price)} c/u</span>
                  <span>Devolver hasta {remaining} ud</span>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
