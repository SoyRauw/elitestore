import { useMemo, useState, useEffect } from 'react'
import { DollarSign, Smartphone, CreditCard, Banknote, Wallet, Bitcoin, Zap, Coins, X, PackagePlus } from 'lucide-react'
import { bsToUsd } from '../../lib/rate'
import { BILL_DENOMINATIONS, emptyBillCounts, sumBills, proposeChange, formatBillsList } from '../../lib/bills'
import styles from './POSPaymentPanel.module.css'

// currency: 'usd' => se paga en dólares; 'bs' => se paga en bolívares.
// bills: true => el monto SIEMPRE sale de los billetes entregados (picker)
const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote, currency: 'usd', bills: true },
  { value: 'efectivo_bs', label: 'Efectivo Bs', icon: Coins, currency: 'bs' },
  { value: 'pago_movil', label: 'Pago Móvil', icon: Smartphone, currency: 'bs' },
  { value: 'zelle', label: 'Zelle', icon: DollarSign, currency: 'usd' },
  { value: 'zinli', label: 'Zinli', icon: Wallet, currency: 'usd' },
  { value: 'binance', label: 'Binance', icon: Bitcoin, currency: 'usd' },
  { value: 'rapikom', label: 'Rapikom', icon: Zap, currency: 'usd' },
  { value: 'transferencia', label: 'Transferencia', icon: Banknote, currency: 'usd' },
  { value: 'punto', label: 'Punto de Venta', icon: CreditCard, currency: 'bs' },
]

export default function POSPaymentPanel({
  totalAmount,
  payments,
  onChange,
  exchangeRate,
  sessionDrawer,
  onAbastecer,
}) {
  const rate = parseFloat(exchangeRate) || 0

  // Drafts while typing: { [method]: { amount, bs, reference, receivedBills } }
  const [drafts, setDrafts] = useState({})
  const [abastecerOpen, setAbastecerOpen] = useState(false)
  const [abastecerCounts, setAbastecerCounts] = useState(emptyBillCounts())
  const [abastecerNote, setAbastecerNote] = useState('')
  const [savingAbastecer, setSavingAbastecer] = useState(false)

  useEffect(() => {
    if (payments.length === 0) setDrafts({})
  }, [payments.length])

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  }, [payments])

  const difference = totalPaid - totalAmount

  const keepPayment = (p) =>
    parseFloat(p.amount) > 0 ||
    parseFloat(p.bs) > 0 ||
    Object.values(p.bills || {}).some((q) => q > 0) ||
    (p.reference || '').trim()

  const buildEntryFromDraft = (method, currency) => {
    const draft = drafts[method] || {}
    const entry = payments.find((p) => p.method === method) ||
      { method, amount: '', reference: '', bs: '', bills: null, changeBills: null }
    const merged = {
      ...entry,
      method,
      amount: draft.amount !== undefined ? draft.amount : entry.amount,
      bs: draft.bs !== undefined ? draft.bs : entry.bs,
      reference: draft.reference !== undefined ? draft.reference : entry.reference,
      // Don't stomp committed values with undefined when re-committing with no draft
      receivedBills: draft.receivedBills !== undefined ? draft.receivedBills : entry.receivedBills,
      changeBills: draft.changeBills !== undefined ? draft.changeBills : entry.changeBills,
    }

    // Keep other vuelto-mix fields from the committed entry
    merged.vueltoBs = draft.vueltoBs !== undefined ? draft.vueltoBs : entry.vueltoBs
    merged.vueltoPm = draft.vueltoPm !== undefined ? draft.vueltoPm : entry.vueltoPm
    merged.vueltoPmReference = draft.vueltoPmReference !== undefined ? draft.vueltoPmReference : entry.vueltoPmReference
    merged.vueltoCredito = draft.vueltoCredito !== undefined ? draft.vueltoCredito : entry.vueltoCredito

    if (currency === 'bs' && merged.bs !== '' && merged.bs !== null && parseFloat(merged.bs) > 0 && rate > 0) {
      merged.amount = bsToUsd(merged.bs, rate).toFixed(4)
    }

    if (method === 'efectivo' && merged.receivedBills) {
      const receivedSum = sumBills(merged.receivedBills)
      merged.amount = receivedSum.toFixed(2)
      merged.bills = merged.receivedBills

      // Change for this cash portion vs the rest already committed
      const committedOther = payments
        .filter((p) => p.method !== 'efectivo')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
      const cashDue = totalAmount - committedOther
      const changeNeeded = Math.round((receivedSum - cashDue) * 100) / 100

      if (changeNeeded > 0) {
        // Seller's hand-picked selection if edited; otherwise greedy suggestion
        const userSelection = draft.changeBills
        if (userSelection) {
          merged.changeBills = userSelection
        } else if (entry.changeBills) {
          merged.changeBills = entry.changeBills
        } else if (sessionDrawer) {
          const { proposal } = proposeChange(changeNeeded, sessionDrawer)
          merged.changeBills = proposal
        } else {
          merged.changeBills = null
        }
      } else {
        merged.changeBills = null
      }
    } else {
      merged.bills = null
    }
    return merged
  }

  // Updates received bills and resets the change selection to the greedy
  // suggestion for the new change needed
  const updateReceivedBill = (method, denom, delta) => {
    const cur = { ...emptyBillCounts(), ...(getValue(method, 'receivedBills') || {}) }
    const nextReceived = { ...cur, [denom]: Math.max(0, (cur[denom] || 0) + delta) }
    const nextSum = sumBills(nextReceived)
    const committedOther = payments
      .filter((p) => p.method !== 'efectivo')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const needed = Math.round((nextSum - (totalAmount - committedOther)) * 100) / 100
    let autoBills = null
    if (needed > 0 && sessionDrawer) {
      autoBills = proposeChange(needed, sessionDrawer).proposal
    }
    setDrafts((prev) => {
      const base = { amount: '', bs: '', reference: '', receivedBills: null, ...(prev[method] || {}) }
      base.receivedBills = nextReceived
      base.changeBills = autoBills
      return { ...prev, [method]: base }
    })
  }

  const commitDraft = (method, currency) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[method]
      return next
    })
    const merged = buildEntryFromDraft(method, currency)
    const updated = payments.map((p) => (p.method === method ? merged : p))
    if (!payments.some((p) => p.method === method)) {
      updated.push(merged)
    }
    onChange(updated.filter(keepPayment))
  }

  const updateDraft = (method, field, value) => {
    setDrafts((prev) => {
      const base = { amount: '', bs: '', reference: '', receivedBills: null, ...(prev[method] || {}) }
      base[field] = value
      return { ...prev, [method]: base }
    })
  }

  const commitOnKey = (method, currency) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft(method, currency)
    }
  }

  // Effective values: draft while typing, committed payments otherwise
  const getValue = (method, field) => {
    const draft = drafts[method]
    if (draft && draft[field] !== undefined) return draft[field]
    const payment = payments.find((p) => p.method === method)
    return payment ? (payment[field] ?? '') : ''
  }

  const hasDraft = (method) => drafts[method] !== undefined

  const handleAbastecerSave = async () => {
    if (!onAbastecer) { setAbastecerOpen(false); return }
    setSavingAbastecer(true)
    try {
      await onAbastecer(abastecerCounts, abastecerNote.trim() || 'Billetes agregados al cajón')
      setAbastecerCounts(emptyBillCounts())
      setAbastecerNote('')
      setAbastecerOpen(false)
    } finally {
      setSavingAbastecer(false)
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.title}>Métodos de pago</p>

      {PAYMENT_METHODS.map((method) => {
        const Icon = method.icon
        const amount = getValue(method.value, 'amount')
        const bs = getValue(method.value, 'bs')
        const reference = getValue(method.value, 'reference')
        const receivedBills = getValue(method.value, 'receivedBills')
        const isDraft = hasDraft(method.value)
        const bsNum = parseFloat(bs) || 0
        const usdEquiv = method.currency === 'bs' && rate > 0 && bsNum > 0 ? bsToUsd(bs, rate) : null

        // Efectivo: bill picker (solo entrega del cliente)
        if (method.bills) {
          const receiving = receivedBills || {}
          const receivedSum = sumBills(receiving)
          const committedOther = payments
            .filter((p) => p.method !== 'efectivo')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
          const cashDue = totalAmount - committedOther
          const changeNeeded = Math.round((receivedSum - cashDue) * 100) / 100

          // What the seller already committed to give as change (bills + Bs + PM + crédito)
          const cashCommitted = payments.find((p) => p.method === 'efectivo')
          const selBillsUsd = sumBills(cashCommitted?.changeBills || {})
          const selBsCovered = (parseFloat(cashCommitted?.vueltoBs) || 0) / (rate || 1)
          const selPm = parseFloat(cashCommitted?.vueltoPm) || 0
          const selCredito = parseFloat(cashCommitted?.vueltoCredito) || 0
          const vueltoRemainingUncovered = Math.round(
            (changeNeeded - selBillsUsd - selBsCovered - selPm - selCredito) * 100
          ) / 100

          // Warn only when the uncovered remainder can't be made with the drawer
          const avail = vueltoRemainingUncovered > 0 && sessionDrawer
            ? proposeChange(vueltoRemainingUncovered, sessionDrawer)
            : null

          return (
            <div
              key={method.value}
              className={styles.billsBlock}
              onKeyDown={commitOnKey(method.value, method.currency)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) commitDraft(method.value, method.currency) }}
            >
              <p className={`${styles.methodLabel} ${isDraft ? styles.methodLabelDraft : ''}`}>
                <Icon size={14} /> {method.label} — billetes que entregan
              </p>
              <div className={styles.billPicker}>
                {BILL_DENOMINATIONS.map((denom) => (
                  <div key={denom} className={styles.billPick}>
                    <button
                      type="button"
                      className={styles.billBtn}
                      onClick={() => updateReceivedBill(method.value, denom, +1)}
                      title={`Añadir billete de $${denom}`}
                    >
                      <PackagePlus size={12} /> ${denom}
                      {receiving[denom] > 0 && <span className={styles.billQty}>{receiving[denom]}</span>}
                    </button>
                    {receiving[denom] > 0 && (
                      <button
                        type="button"
                        className={styles.billMinus}
                        onClick={() => updateReceivedBill(method.value, denom, -1)}
                        title={`Quitar un $${denom}`}
                      >
                        −
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {receivedSum > 0 && (
                <div className={styles.cashDraftInfo}>
                  <span>Entrega: {formatBillsList(receiving)}</span>
                  <span>$ {receivedSum.toFixed(2)}</span>
                </div>
              )}

              {vueltoRemainingUncovered > 0 && !avail?.ok && (
                <>
                  <p className={styles.changeWarn}>
                    ⚠️ No hay billetes para dar vuelto de ${vueltoRemainingUncovered.toFixed(2)} — usa otro método o abastece el cajón
                  </p>
                  <button type="button" className={styles.abastecerBtn} onClick={() => setAbastecerOpen(true)}>
                    <PackagePlus size={14} /> Abastecer cajón (cambiar afuera)
                  </button>
                </>
              )}

              {parseFloat(amount) > 0 && !isDraft && (
                <input
                  type="text"
                  className={`input ${styles.referenceInput}`}
                  style={{ width: '100%', marginTop: '0.35rem', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                  placeholder={`Referencia (opcional)`}
                  value={reference}
                  onChange={(e) => updateDraft(method.value, 'reference', e.target.value)}
                  onKeyDown={commitOnKey(method.value, method.currency)}
                  onBlur={() => commitDraft(method.value, method.currency)}
                />
              )}
            </div>
          )
        }

        return (
          <div key={method.value}>
            <div className={styles.paymentRow}>
              <span className={`${styles.methodLabel} ${isDraft ? styles.methodLabelDraft : ''}`}>
                <Icon size={14} /> {method.label}
              </span>
              {method.currency === 'usd' ? (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={styles.input}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => updateDraft(method.value, 'amount', e.target.value)}
                  onKeyDown={commitOnKey(method.value, method.currency)}
                  onBlur={() => commitDraft(method.value, method.currency)}
                />
              ) : rate > 0 ? (
                <input
                  type="number"
                  min={0}
                  className={`${styles.input} ${styles.bsInput}`}
                  placeholder="Bs 0"
                  value={bs}
                  onChange={(e) => updateDraft(method.value, 'bs', e.target.value)}
                  onKeyDown={commitOnKey(method.value, method.currency)}
                  onBlur={() => commitDraft(method.value, method.currency)}
                />
              ) : (
                <span className={styles.noRateHint}>Sin tasa</span>
              )}
            </div>
            {method.currency === 'bs' && rate > 0 && bsNum > 0 && (
              <div className={styles.bsEquiv}>
                ≈ ${usdEquiv?.toFixed(2)} @ {rate.toLocaleString('es-VE')}
              </div>
            )}
            {parseFloat(amount) > 0 && method.currency !== 'bs' && (
              <input
                type="text"
                className={`input ${styles.referenceInput}`}
                style={{ width: '100%', marginTop: '0.35rem', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                placeholder={`Referencia ${method.label.toLowerCase()} (opcional)`}
                value={reference}
                onChange={(e) => updateDraft(method.value, 'reference', e.target.value)}
                onKeyDown={commitOnKey(method.value, method.currency)}
                onBlur={() => commitDraft(method.value, method.currency)}
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

      {abastecerOpen && (
        <div className={styles.abastecerOverlay} onClick={(e) => { if (e.target === e.currentTarget) setAbastecerOpen(false) }}>
          <div className={styles.abastecerModal}>
            <div className={styles.abastecerHeader}>
              <h4>Abastecer cajón</h4>
              <button className={styles.abastecerClose} onClick={() => setAbastecerOpen(false)}><X size={16} /></button>
            </div>
            <p className={styles.abastecerSub}>Billetes que traen afuera para poder dar el vuelto</p>
            <div className={styles.billsGrid}>
              {BILL_DENOMINATIONS.map((denom) => (
                <div key={denom} className={styles.billTile}>
                  <button
                    type="button"
                    className={`${styles.billBtn} ${abastecerCounts[denom] > 0 ? styles.billBtnActive : ''}`}
                    onClick={() => setAbastecerCounts({ ...abastecerCounts, [denom]: (abastecerCounts[denom] || 0) + 1 })}
                  >
                    ${denom}{abastecerCounts[denom] > 0 && <span className={styles.billQty}>{abastecerCounts[denom]}</span>}
                  </button>
                  {abastecerCounts[denom] > 0 && (
                    <button type="button" className={styles.billMinus} onClick={() => setAbastecerCounts({ ...abastecerCounts, [denom]: Math.max(0, abastecerCounts[denom] - 1) })}>−</button>
                  )}
                </div>
              ))}
            </div>
            <input
              type="text"
              className="input"
              placeholder="Nota (opcional)"
              value={abastecerNote}
              onChange={(e) => setAbastecerNote(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingAbastecer || Object.values(abastecerCounts).every((q) => !q)}
              onClick={handleAbastecerSave}
            >
              {savingAbastecer ? 'Guardando...' : 'Guardar en caja'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
