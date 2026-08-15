import { useMemo } from 'react'
import { DollarSign, Smartphone, CreditCard, Banknote } from 'lucide-react'
import styles from './POSPaymentPanel.module.css'

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'pago_movil', label: 'Pago Móvil', icon: Smartphone },
  { value: 'zelle', label: 'Zelle', icon: DollarSign },
  { value: 'transferencia', label: 'Transferencia', icon: Banknote },
  { value: 'punto', label: 'Punto de Venta', icon: CreditCard },
]

export default function POSPaymentPanel({ totalAmount, payments, onChange }) {
  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  }, [payments])

  const difference = totalPaid - totalAmount

  const updatePayment = (method, field, value) => {
    const existingIndex = payments.findIndex((p) => p.method === method)
    let updated = [...payments]

    if (existingIndex >= 0) {
      updated[existingIndex] = { ...updated[existingIndex], [field]: value }
    } else {
      updated.push({ method, amount: '', reference: '', [field]: value })
    }

    // Remove empty payments
    updated = updated.filter((p) => parseFloat(p.amount) > 0 || p.reference.trim())
    onChange(updated)
  }

  const getPayment = (method) => payments.find((p) => p.method === method) || { method, amount: '', reference: '' }

  return (
    <div className={styles.panel}>
      <p className={styles.title}>Métodos de pago</p>

      {PAYMENT_METHODS.map((method) => {
        const payment = getPayment(method.value)
        const Icon = method.icon
        return (
          <div key={method.value}>
            <div className={styles.paymentRow}>
              <span className={styles.methodLabel}>
                <Icon size={14} /> {method.label}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={styles.input}
                placeholder="0.00"
                value={payment.amount}
                onChange={(e) => updatePayment(method.value, 'amount', e.target.value)}
              />
            </div>
            {parseFloat(payment.amount) > 0 && (
              <input
                type="text"
                className={`input ${styles.referenceInput}`}
                style={{ width: '100%', marginTop: '0.35rem', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                placeholder={`Referencia ${method.label.toLowerCase()} (opcional)`}
                value={payment.reference}
                onChange={(e) => updatePayment(method.value, 'reference', e.target.value)}
              />
            )}
          </div>
        )
      })}

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Total a pagar</span>
          <span className={styles.summaryValue}>${totalAmount.toFixed(2)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Total pagado</span>
          <span className={styles.summaryValue}>${totalPaid.toFixed(2)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{difference >= 0 ? 'Vuelto' : 'Faltante'}</span>
          <span className={`${styles.summaryValue} ${difference === 0 ? styles.summaryValueSuccess : difference > 0 ? styles.summaryValueWarning : styles.summaryValueDanger}`}>
            ${Math.abs(difference).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}
