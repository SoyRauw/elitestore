import { useState, useRef } from 'react'
import { BILL_DENOMINATIONS, emptyBillCounts, sumBills, proposeChange, formatBillsList } from '../../lib/bills'
import { formatBs } from '../../lib/rate'
import styles from './POSCart.module.css'

/**
 * Selector de vuelto mixto: billetes del cajón + Bs efectivo + pago móvil + crédito en tienda.
 * Solo se muestra cuando hay vuelto (difference > 0) y existe un pago en efectivo.
 */
export default function VueltoMixto({
  difference,
  payments,
  onPaymentsChange,
  exchangeRate,
  sessionDrawer,
  customer,
}) {
  const differenceNum = parseFloat(difference) || 0
  const rate = parseFloat(exchangeRate) || 0

  const cashPaymentIdx = payments.findIndex((p) => p.method === 'efectivo')
  const cashPayment = cashPaymentIdx >= 0 ? payments[cashPaymentIdx] : null

  const changeSel = (() => {
    if (differenceNum <= 0 || !cashPayment || !sessionDrawer) return null
    const sel = cashPayment.changeBills || proposeChange(differenceNum, sessionDrawer).proposal
    const counts = { ...emptyBillCounts(), ...(sel || {}) }
    const list = BILL_DENOMINATIONS
      .map((denom) => ({ denom, maxDrawer: Math.max(0, sessionDrawer?.[denom] || 0) }))
      .filter(({ denom, maxDrawer }) => (counts[denom] || 0) > 0 || maxDrawer > 0)
      .map(({ denom, maxDrawer }) => ({ denom, qty: counts[denom] || 0, maxDrawer }))
    const sum = sumBills(counts)
    const exact = Math.abs(sum - differenceNum) < 0.005
    return { counts, list, sum, exact }
  })()

  const vueltoBs = parseFloat(cashPayment?.vueltoBs) || 0
  const vueltoPm = parseFloat(cashPayment?.vueltoPm) || 0
  const vueltoCredito = parseFloat(cashPayment?.vueltoCredito) || 0
  const vueltoBillsUsd = changeSel ? changeSel.sum : 0
  const coveredBs = Math.round((rate > 0 ? vueltoBs / rate : 0) * 100) / 100
  const vueltoCubierto = Math.round((vueltoBillsUsd + coveredBs + vueltoPm + vueltoCredito) * 100) / 100
  const vueltoRestante = Math.round((differenceNum - vueltoCubierto) * 100) / 100
  const vueltoCuadrado = Math.abs(vueltoCubierto - differenceNum) < 0.005

  const restBoxRef = useRef(null)
  const [pmOpen, setPmOpen] = useState(false)
  const [pmReference, setPmReference] = useState('')

  const updateChangeDenom = (denom, delta) => {
    if (cashPaymentIdx < 0) return
    const cur = { ...emptyBillCounts(), ...(cashPayment.changeBills || {}) }
    const maxDrawer = Math.max(0, parseInt(sessionDrawer?.[denom], 10) || 0)
    const next = { ...cur, [denom]: Math.max(0, Math.min((cur[denom] || 0) + delta, maxDrawer)) }
    const updated = payments.map((p, i) => (
      i === cashPaymentIdx ? { ...p, changeBills: next } : p
    ))
    onPaymentsChange(updated)
  }

  const updateVueltoBs = (value) => {
    if (cashPaymentIdx < 0) return
    const updated = payments.map((p, i) => (
      i === cashPaymentIdx ? { ...p, vueltoBs: value } : p
    ))
    onPaymentsChange(updated)
  }

  const confirmVueltoPm = () => {
    if (cashPaymentIdx < 0) return
    const updated = payments.map((p, i) => (
      i === cashPaymentIdx
        ? { ...p, vueltoPm: vueltoRestante > 0 ? vueltoRestante : p.vueltoPm, vueltoPmReference: pmReference.trim() || null }
        : p
    ))
    onPaymentsChange(updated)
    setPmOpen(false)
    setPmReference('')
  }

  const setVueltoPm = (pm) => {
    if (cashPaymentIdx < 0) return
    const updated = payments.map((p, i) => (
      i === cashPaymentIdx ? { ...p, vueltoPm: pm } : p
    ))
    onPaymentsChange(updated)
  }

  const updateVueltoCredito = (value) => {
    if (cashPaymentIdx < 0) return
    const updated = payments.map((p, i) => (
      i === cashPaymentIdx ? { ...p, vueltoCredito: value } : p
    ))
    onPaymentsChange(updated)
  }

  if (!(differenceNum > 0 && changeSel)) return null

  return (
    <div className={styles.changePickBlock}>
      <p className={styles.changePickTitle}>Billetes del vuelto</p>
      <div className={styles.changeChips}>
        {changeSel.list.map(({ denom }) => (
          <div key={denom} className={styles.changeChipRow}>
            <button
              type="button"
              className={styles.changeBill}
              onClick={() => updateChangeDenom(denom, +1)}
              title={`Añadir $${denom} al vuelto`}
            >
              ${denom}
              {changeSel.counts[denom] > 0 && <span className={styles.changeBadge}>{changeSel.counts[denom]}</span>}
            </button>
            {changeSel.counts[denom] > 0 && (
              <button
                type="button"
                className={styles.changeMinus}
                onClick={() => updateChangeDenom(denom, -1)}
                title={`Quitar $${denom}`}
              >
                −
              </button>
            )}
          </div>
        ))}
      </div>
      <p className={vueltoCuadrado ? styles.changeExact : styles.changeMismatch}>
        {formatBillsList(changeSel.counts) && `${formatBillsList(changeSel.counts)} + `}Bs {vueltoBs ? vueltoBs.toLocaleString('es-VE') : 0} {vueltoPm > 0 && `+ PM ${vueltoPm.toFixed(2)}`} {vueltoCredito > 0 && `+ Crédito ${vueltoCredito.toFixed(2)}`} = ${vueltoCubierto.toFixed(2)}
        {vueltoCuadrado ? ' ✅' : ` — falta $${vueltoRestante.toFixed(2)}`}
      </p>

      {/* Restante del vuelto: Bs efectivo, pago móvil y/o crédito en tienda */}
      {vueltoRestante > 0 && (
        <div className={styles.changeRestBox} ref={restBoxRef}>
          <div className={styles.changeRestRow}>
            <span>Restante del vuelto:</span>
            <strong>${vueltoRestante.toFixed(2)}{rate > 0 && ` ≈ ${formatBs(vueltoRestante * rate)}`}</strong>
          </div>
          <div className={styles.changeRestActions}>
            <button
              type="button"
              className={styles.changeRestBtn}
              onClick={() => updateVueltoBs(String(Math.ceil(vueltoRestante * rate * 100) / 100))}
            >
              Dar en Bs efectivo
            </button>
            <button
              type="button"
              className={styles.changeRestBtn}
              onClick={() => {
                setPmOpen(true)
                requestAnimationFrame(() => {
                  restBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                })
              }}
            >
              Dar por pago móvil
            </button>
            <button
              type="button"
              className={styles.changeRestBtn}
              onClick={() => updateVueltoCredito(String(vueltoRestante))}
              disabled={!customer?.id}
              title={!customer?.id ? 'Registra cédula y nombre del cliente' : 'Sumar al saldo del cliente'}
            >
              Dejar en crédito
            </button>
          </div>
          {!customer?.id && (
            <p className={styles.changeRef}>El crédito requiere cliente registrado (cédula + nombre)</p>
          )}
          {vueltoBs > 0 && (
            <div className={styles.changeRestRow}>
              <span>Vuelto en Bs:</span>
              <input
                type="number"
                className={styles.changeRestInput}
                value={cashPayment.vueltoBs}
                onChange={(e) => updateVueltoBs(e.target.value)}
              />
              <span>≈ ${coveredBs.toFixed(2)}</span>
            </div>
          )}
          {vueltoCredito > 0 && (
            <div className={styles.changeRestRow}>
              <span>Crédito en tienda:</span>
              <strong>${vueltoCredito.toFixed(2)}</strong>
              <button type="button" className={styles.changeRestRemove} onClick={() => updateVueltoCredito(null)}>×</button>
            </div>
          )}
          {vueltoPm > 0 && (
            <div className={styles.changeRestRow}>
              <span>Pago móvil vuelto:</span>
              <strong>${vueltoPm.toFixed(2)}</strong>
              <span className={styles.changeRef}>{cashPayment.vueltoPmReference || 'sin referencia'}</span>
              <button type="button" className={styles.changeRestRemove} onClick={() => setVueltoPm(null)}>×</button>
            </div>
          )}
          {pmOpen && (
            <div className={styles.changePmBox}>
              <div className={styles.changeRestRow}>
                <span>Pago móvil vuelto a dar:</span>
                <strong>${vueltoRestante.toFixed(2)} ≈ {formatBs(Math.ceil(vueltoRestante * rate * 100) / 100)}</strong>
              </div>
              <input
                type="text"
                className={styles.changeRestInput}
                placeholder="Referencia de la transacción"
                value={pmReference}
                onChange={(e) => setPmReference(e.target.value)}
                autoFocus
              />
              <div className={styles.changeRestActions}>
                <button type="button" className={styles.changeRestConfirm} onClick={confirmVueltoPm}>
                  Confirmar pago móvil
                </button>
                <button type="button" className={styles.changeRestRemove} onClick={() => setPmOpen(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
