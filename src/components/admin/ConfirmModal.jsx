import { motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import styles from './ConfirmModal.module.css'

export default function ConfirmModal({
  isOpen,
  title = '¿Estás seguro?',
  message,
  children,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  disabled = false,
}) {
  if (!isOpen) return null

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className={styles.modal}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3><AlertTriangle size={20} /> {title}</h3>
          <button className={styles.closeBtn} onClick={onCancel} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {message && <p>{message}</p>}
          {children}
        </div>
        <div className={styles.modalActions}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={disabled}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn btn-${confirmVariant}`}
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
