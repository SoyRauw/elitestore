import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  useCashSession,
  fetchSessionDrawer,
  insertBillMovements,
} from '../../hooks/useCashSession'
import { fetchEuroRate, formatRate, bsCeilFromUsd, formatBs } from '../../lib/rate'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import POSPaymentPanel from '../../components/admin/POSPaymentPanel'
import VueltoMixto from '../../components/admin/VueltoMixto'
import GiftCardView, { printGiftCard, downloadGiftCardPdf } from '../../components/admin/GiftCardView'
import {
  generateGiftCode,
  normalizeGiftCode,
  effectiveStatus,
  statusLabel,
  statusBadge,
  formatMoney,
  formatExpiry,
} from '../../lib/giftcards'
import {
  Gift, Plus, Search, Printer, FileDown, X, Ban, List, Lock, ArrowDownUp,
} from 'lucide-react'
import styles from './AdminGiftCards.module.css'

const EMPTY_BUYER = { id: '', id_number: '', name: '', phone: '' }

export default function AdminGiftCards() {
  const { user } = useAuth()
  const { session, loading: sessionLoading, updateSessionRate } = useCashSession(user?.id)
  const sessionId = session?.id

  const [view, setView] = useState('nueva') // 'nueva' | 'lista'
  const [error, setError] = useState('')

  // Drawer
  const [sessionDrawer, setSessionDrawer] = useState(null)
  const refreshDrawer = useCallback(async () => {
    if (!sessionId) { setSessionDrawer(null); return }
    try { setSessionDrawer(await fetchSessionDrawer(sessionId)) } catch (e) { console.error(e) }
  }, [sessionId])

  useEffect(() => { refreshDrawer() }, [refreshDrawer])

  const handleAbastecer = useCallback(async (counts, note) => {
    if (!sessionId) return
    await insertBillMovements(sessionId, 'ajuste', counts, { note })
    setSessionDrawer(await fetchSessionDrawer(sessionId))
  }, [sessionId])

  // Tasa euro
  const [rateLoading, setRateLoading] = useState(false)
  const handleRefreshRate = useCallback(async () => {
    setRateLoading(true)
    try {
      const { rate } = await fetchEuroRate()
      await updateSessionRate(rate)
    } catch (e) { console.error('No se pudo actualizar la tasa:', e) }
    finally { setRateLoading(false) }
  }, [updateSessionRate])

  useEffect(() => {
    if (!session) return
    const interval = setInterval(handleRefreshRate, 5 * 60 * 1000)
    window.addEventListener('focus', handleRefreshRate)
    return () => { clearInterval(interval); window.removeEventListener('focus', handleRefreshRate) }
  }, [session?.exchange_rate, session?.id, handleRefreshRate])

  useEffect(() => {
    if (!session || session.exchange_rate) return
    handleRefreshRate()
  }, [session?.exchange_rate, session?.id, handleRefreshRate])

  // ===== Nueva giftcard =====
  const [amount, setAmount] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [notes, setNotes] = useState('')
  const [buyer, setBuyer] = useState(EMPTY_BUYER)
  const [payments, setPayments] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createdCard, setCreatedCard] = useState(null)

  const amountNum = parseFloat(amount) || 0
  const rate = parseFloat(session?.exchange_rate) || 0
  const totalPaid = useMemo(
    () => payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
    [payments]
  )

  // Buscar comprador por cédula
  useEffect(() => {
    const idNum = buyer.id_number?.trim()
    if (!idNum || idNum.length < 3) return
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, id_number')
        .ilike('id_number', idNum)
        .limit(2)
      if (data && data.length === 1) {
        setBuyer((prev) => ({ ...prev, id: data[0].id, name: data[0].name || prev.name, phone: data[0].phone || prev.phone }))
      }
    }, 300)
    return () => clearTimeout(t)
  }, [buyer.id_number])

  const clearForm = () => {
    setAmount('')
    setExpiresAt('')
    setRecipientName('')
    setNotes('')
    setBuyer(EMPTY_BUYER)
    setPayments([])
    setError('')
  }

  const handleFinish = () => {
    if (!session) { setError('No hay caja abierta. Abre una caja primero.'); return }
    if (amountNum <= 0) { setError('Ingresa el monto de la giftcard'); return }
    if (!buyer.id_number?.trim() || !buyer.name?.trim()) { setError('Datos del comprador obligatorios: cédula y nombre'); return }
    if (totalPaid + 0.005 < amountNum) { setError(`Faltan $${(amountNum - totalPaid).toFixed(2)} para cubrir el monto`); return }
    setError('')
    setConfirmOpen(true)
  }

  const resolveBuyerId = async () => {
    let customerId = buyer.id || null
    const idNumber = buyer.id_number?.trim() || null
    const name = buyer.name?.trim() || null
    const phone = buyer.phone?.trim() || null
    if (idNumber && !customerId) {
      const { data: existing } = await supabase.from('customers').select('id').ilike('id_number', idNumber).limit(2)
      if (existing && existing.length === 1) customerId = existing[0].id
    }
    if (!customerId) {
      const { data: newCustomer, error: cErr } = await supabase
        .from('customers')
        .insert([{ name: name || 'Cliente', id_number: idNumber, phone }])
        .select()
        .single()
      if (cErr) throw cErr
      customerId = newCustomer.id
    }
    return { customerId, idNumber, name, phone }
  }

  const executeCreate = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { customerId, idNumber, name, phone } = await resolveBuyerId()
      const expiresISO = expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null
      const external = payments.filter((p) => parseFloat(p.amount) > 0)
      const paymentMethod = external.length === 0 ? 'efectivo' : external.length === 1 ? external[0].method : 'multiple'

      const { data: movement, error: movError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'giftcard',
          status: 'pagado',
          user_id: user.id,
          cash_session_id: sessionId,
          customer_id: customerId,
          customer_name: name,
          customer_phone: phone,
          payment_method: paymentMethod,
          total_amount: amountNum,
          discount_amount: 0,
          credit_amount: 0,
          notes: notes?.trim() || 'Venta de giftcard',
        }])
        .select()
        .single()
      if (movError) throw movError

      const movementPayments = external.map((p) => ({
        movement_id: movement.id,
        cash_session_id: sessionId,
        method: p.method,
        amount: parseFloat(p.amount),
        reference: p.reference?.trim() || null,
        bs_amount: p.bs ? Math.round(parseFloat(p.bs) * 100) / 100 : null,
        bs_rate: p.bs ? (session.exchange_rate || null) : null,
      }))
      if (movementPayments.length > 0) {
        const { error: payError } = await supabase.from('movement_payments').insert(movementPayments)
        if (payError) throw payError
      }

      // Vuelto mixto
      const cashPayments = payments.filter((p) => p.method === 'efectivo' && (
        (parseFloat(p.vueltoBs) || 0) > 0 || (parseFloat(p.vueltoPm) || 0) > 0 || (parseFloat(p.vueltoCredito) || 0) > 0
      ))
      for (const p of cashPayments) {
        await supabase.from('movement_payments').update({
          vuelto_bs: p.vueltoBs ? Math.round(parseFloat(p.vueltoBs) * 100) / 100 : null,
          vuelto_pm_amount: p.vueltoPm ? parseFloat(p.vueltoPm) : null,
          vuelto_pm_reference: p.vueltoPmReference?.trim() || null,
          vuelto_credito: p.vueltoCredito ? Math.round(parseFloat(p.vueltoCredito) * 100) / 100 : null,
        }).eq('movement_id', movement.id).eq('method', 'efectivo')
      }

      // Billetes (venta + vuelto)
      const billRows = []
      for (const p of payments) {
        if (p.method === 'efectivo' && p.bills) {
          for (const [denom, qty] of Object.entries(p.bills)) {
            if (parseInt(qty, 10) > 0) billRows.push({ session_id: sessionId, movement_id: movement.id, type: 'venta', denomination: parseFloat(denom), quantity: parseInt(qty, 10) })
          }
        }
        if (p.method === 'efectivo' && p.changeBills) {
          for (const [denom, qty] of Object.entries(p.changeBills)) {
            if (parseInt(qty, 10) > 0) billRows.push({ session_id: sessionId, movement_id: movement.id, type: 'vuelto', denomination: parseFloat(denom), quantity: parseInt(qty, 10) })
          }
        }
      }
      if (billRows.length > 0) {
        const { error: bErr } = await supabase.from('cash_bill_movements').insert(billRows)
        if (bErr) throw bErr
      }

      // Vuelto dejado en crédito → saldo del comprador
      const vueltoCreditoTotal = payments.filter((p) => p.method === 'efectivo').reduce((s, p) => s + (parseFloat(p.vueltoCredito) || 0), 0)
      if (customerId && vueltoCreditoTotal > 0) {
        const { data: cur } = await supabase.from('customers').select('balance').eq('id', customerId).single()
        await supabase.from('customers').update({ balance: (cur?.balance || 0) + vueltoCreditoTotal }).eq('id', customerId)
        await supabase.from('customer_credit_history').insert([{
          customer_id: customerId, movement_id: movement.id, amount: vueltoCreditoTotal, reason: 'Vuelto dejado en crédito (giftcard)',
        }])
      }

      // Crear giftcard (reintentar si el código choca)
      let card = null
      for (let i = 0; i < 4 && !card; i++) {
        const code = generateGiftCode()
        const { data, error: gErr } = await supabase
          .from('gift_cards')
          .insert([{
            code,
            amount: amountNum,
            status: 'activa',
            store: 'elite',
            buyer_customer_id: customerId,
            buyer_name: name,
            buyer_id_number: idNumber,
            recipient_name: recipientName?.trim() || null,
            notes: notes?.trim() || null,
            expires_at: expiresISO,
            purchase_movement_id: movement.id,
            created_by: user.id,
          }])
          .select()
          .single()
        if (!gErr) card = data
        else if (gErr.code !== '23505') throw gErr
      }
      if (!card) throw new Error('No se pudo generar un código único, intenta de nuevo')

      refreshDrawer()
      setCreatedCard(card)
      clearForm()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error creando la giftcard')
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  // ===== Lista =====
  const [cards, setCards] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [statusFilter, setStatusFilter] = useState('todas')
  const [search, setSearch] = useState('')
  const [detailCard, setDetailCard] = useState(null)
  const [annulCard, setAnnulCard] = useState(null)
  const [annulMethod, setAnnulMethod] = useState('credito')
  const [annulling, setAnnulling] = useState(false)
  const [annulError, setAnnulError] = useState('')

  const fetchCards = useCallback(async () => {
    setLoadingList(true)
    const { data, error: fErr } = await supabase
      .from('gift_cards')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (fErr) console.error('Error cargando giftcards:', fErr)
    setCards(data || [])
    setLoadingList(false)
  }, [])

  useEffect(() => {
    if (view === 'lista') fetchCards()
  }, [view, fetchCards])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cards.filter((c) => {
      if (statusFilter !== 'todas' && effectiveStatus(c) !== statusFilter) return false
      if (!q) return true
      return (
        (c.code || '').toLowerCase().includes(q) ||
        (c.buyer_name || '').toLowerCase().includes(q) ||
        (c.recipient_name || '').toLowerCase().includes(q)
      )
    })
  }, [cards, statusFilter, search])

  const counts = useMemo(() => {
    const acc = { activa: 0, usada: 0, anulada: 0, vencida: 0 }
    cards.forEach((c) => { const s = effectiveStatus(c); if (acc[s] !== undefined) acc[s] += 1 })
    return acc
  }, [cards])

  const executeAnnul = async () => {
    if (!annulCard) return
    setAnnulling(true)
    setAnnulError('')
    try {
      const { data: gc, error: gErr } = await supabase.from('gift_cards').select('*').eq('id', annulCard.id).single()
      if (gErr) throw gErr
      if (gc.status !== 'activa') throw new Error('Solo se pueden anular giftcards activas')

      const buyerId = gc.buyer_customer_id || null
      const { data: movement, error: movError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'devolucion',
          status: 'completada',
          user_id: user.id,
          cash_session_id: sessionId,
          customer_id: buyerId,
          customer_name: gc.buyer_name,
          payment_method: annulMethod === 'efectivo' ? 'efectivo' : 'credito',
          total_amount: gc.amount,
          discount_amount: 0,
          credit_amount: 0,
          reference_movement_id: gc.purchase_movement_id,
          notes: `Anulación giftcard ${gc.code}`,
        }])
        .select()
        .single()
      if (movError) throw movError

      if (annulMethod === 'efectivo') {
        // salida de caja (monto negativo) para que el cierre cuadre
        await supabase.from('movement_payments').insert([{
          movement_id: movement.id,
          cash_session_id: sessionId,
          method: 'efectivo',
          amount: -Math.round(gc.amount * 100) / 100,
          reference: `Reembolso giftcard ${gc.code}`,
        }])
      } else if (buyerId) {
        const { data: cur } = await supabase.from('customers').select('balance').eq('id', buyerId).single()
        await supabase.from('customers').update({ balance: (cur?.balance || 0) + (parseFloat(gc.amount) || 0) }).eq('id', buyerId)
        await supabase.from('customer_credit_history').insert([{
          customer_id: buyerId, movement_id: movement.id, amount: gc.amount, reason: `Anulación giftcard ${gc.code}`,
        }])
      }

      const { error: upErr } = await supabase.from('gift_cards').update({
        status: 'anulada',
        annulled_at: new Date().toISOString(),
        annul_refund_method: annulMethod,
        annul_movement_id: movement.id,
      }).eq('id', gc.id)
      if (upErr) throw upErr

      setAnnulCard(null)
      setDetailCard(null)
      fetchCards()
      refreshDrawer()
    } catch (e) {
      console.error(e)
      setAnnulError(e.message || 'Error anulando la giftcard')
    } finally {
      setAnnulling(false)
    }
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}><Gift size={22} /> Giftcards</h1>
            <p className={styles.pageSubtitle}>Vende tarjetas de regalo y consulta las activas</p>
          </div>
          <div className={styles.topRight}>
            {session && (
              <button
                type="button"
                className={`${styles.ratePill} ${session.exchange_rate ? '' : styles.ratePillMissing}`}
                onClick={handleRefreshRate}
                disabled={rateLoading}
                title="Tasa euro (BCV) — clic para actualizar"
              >
                <ArrowDownUp size={13} />
                {session.exchange_rate
                  ? `Tasa Euro: ${formatRate(session.exchange_rate)} Bs/$`
                  : (rateLoading ? 'Buscando tasa...' : 'Sin tasa — actualizar')}
              </button>
            )}
            <button className={`btn ${view === 'nueva' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('nueva')}>
              <Plus size={16} /> Nueva giftcard
            </button>
            <button className={`btn ${view === 'lista' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('lista')}>
              <List size={16} /> Giftcards
            </button>
          </div>
        </div>

        {sessionLoading ? (
          <div className={styles.card}><p>Cargando caja...</p></div>
        ) : !session ? (
          <div className={styles.card}>
            <div className={styles.noSession}>
              <p><Lock size={18} /> No hay caja abierta</p>
              <p className={styles.muted}>Abre una caja en Caja para vender giftcards.</p>
            </div>
          </div>
        ) : view === 'nueva' ? (
          <div className={styles.layout}>
            <div className={styles.leftPanel}>
              <div className={styles.card}>
                <p className={styles.blockLabel}>Datos del comprador *</p>
                <div className={styles.customerRow}>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label>Cédula / RIF</label>
                    <input
                      className={styles.input}
                      value={buyer.id_number}
                      onChange={(e) => setBuyer({ ...buyer, id_number: e.target.value })}
                      placeholder="V-12345678"
                      disabled={submitting}
                    />
                  </div>
                  <button
                    className="btn btn-outline"
                    onClick={async () => {
                      const idNum = buyer.id_number?.trim()
                      if (!idNum) return
                      const { data } = await supabase.from('customers').select('*').ilike('id_number', idNum).limit(2)
                      if (data && data.length === 1) {
                        setBuyer((prev) => ({ ...prev, id: data[0].id, name: data[0].name || '', phone: data[0].phone || '' }))
                      } else {
                        alert(data && data.length > 1 ? 'Hay varios clientes con esa cédula' : 'Cliente no registrado — completa el nombre')
                      }
                    }}
                  >
                    <Search size={16} />
                  </button>
                </div>
                <div className={styles.field}>
                  <label>Nombre del comprador *</label>
                  <input className={styles.input} value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} disabled={submitting} />
                </div>
                <div className={styles.field}>
                  <label>Teléfono</label>
                  <input className={styles.input} value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} />
                </div>
              </div>

              <div className={styles.card}>
                <p className={styles.blockLabel}>Datos de la giftcard</p>
                <div className={styles.field}>
                  <label>Monto ($) *</label>
                  <input
                    type="number" min={0} step="0.01"
                    className={styles.input}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={submitting}
                    placeholder="Ej: 20"
                  />
                </div>
                <div className={styles.field}>
                  <label>Vence el (opcional)</label>
                  <input type="date" className={styles.input} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={submitting} />
                </div>
                <div className={styles.field}>
                  <label>Para (dedicatoria, opcional)</label>
                  <input className={styles.input} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Ej: Mamá" disabled={submitting} />
                </div>
                <div className={styles.field}>
                  <label>Nota interna (opcional)</label>
                  <input className={styles.input} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submitting} />
                </div>
              </div>
            </div>

            <div className={styles.rightPanel}>
              <div className={styles.card}>
                <p className={styles.blockLabel}>Cobro de la giftcard</p>
                <div className={styles.detailRow}>
                  <span>Monto a pagar</span>
                  <strong className={styles.amount}>{formatMoney(amountNum)}</strong>
                </div>
                {rate > 0 && (
                  <p className={styles.totalBs}>≈ {formatBs(bsCeilFromUsd(amountNum, rate))} (tasa euro)</p>
                )}
                <div className={styles.detailRow}>
                  <span>Pagado</span>
                  <strong>{formatMoney(totalPaid)}</strong>
                </div>
                {totalPaid + 0.005 < amountNum && (
                  <div className={styles.detailRow}>
                    <span>Falta</span>
                    <strong className={styles.red}>
                      {formatMoney(amountNum - totalPaid)}
                      {rate > 0 ? ` · ≈ ${formatBs(bsCeilFromUsd(amountNum - totalPaid, rate))}` : ''}
                    </strong>
                  </div>
                )}
                {error && <p className={styles.error}>{error}</p>}
                <POSPaymentPanel
                  totalAmount={amountNum}
                  payments={payments}
                  onChange={setPayments}
                  exchangeRate={session.exchange_rate}
                  sessionDrawer={sessionDrawer}
                  onAbastecer={handleAbastecer}
                  disableGiftcard
                />
                <VueltoMixto
                  difference={totalPaid - amountNum}
                  payments={payments}
                  onPaymentsChange={setPayments}
                  exchangeRate={session.exchange_rate}
                  sessionDrawer={sessionDrawer}
                  customer={{ ...buyer, id: buyer.id }}
                />
                <div className={styles.actionsRow} style={{ marginTop: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={handleFinish} disabled={submitting}>
                    <Gift size={16} /> Cobrar y generar giftcard
                  </button>
                  <button className="btn btn-outline" onClick={clearForm} disabled={submitting}>Limpiar</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.filtersBar}>
              <div className={styles.searchWrap}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  placeholder="Buscar por código, comprador o destinatario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="todas">Todas ({cards.length})</option>
                <option value="activa">Activas ({counts.activa})</option>
                <option value="vencida">Vencidas ({counts.vencida})</option>
                <option value="usada">Usadas ({counts.usada})</option>
                <option value="anulada">Anuladas ({counts.anulada})</option>
              </select>
              <button className="btn btn-outline" onClick={fetchCards} disabled={loadingList}>Actualizar</button>
            </div>

            {loadingList ? (
              <p>Cargando...</p>
            ) : filtered.length === 0 ? (
              <div className={styles.card}>No hay giftcards que coincidan.</div>
            ) : (
              <div className={styles.card}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Monto</th>
                        <th>Comprador</th>
                        <th>Para</th>
                        <th>Estado</th>
                        <th>Creada</th>
                        <th>Vence</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id}>
                          <td className={styles.code}>{normalizeGiftCode(c.code)}</td>
                          <td className={styles.amount}>{formatMoney(c.amount)}</td>
                          <td>{c.buyer_name || '—'}</td>
                          <td>{c.recipient_name || '—'}</td>
                          <td><span className={`badge ${statusBadge(c)}`}>{statusLabel(c)}</span></td>
                          <td>{new Date(c.created_at).toLocaleDateString()}</td>
                          <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <button className={styles.iconBtn} title="Ver / imprimir" onClick={() => setDetailCard(c)}><Printer size={15} /></button>
                              <button className={styles.iconBtn} title="Descargar PDF" onClick={() => downloadGiftCardPdf(c)}><FileDown size={15} /></button>
                              {c.status === 'activa' && (
                                <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Anular" onClick={() => { setAnnulCard(c); setAnnulMethod('credito'); setAnnulError('') }}><Ban size={15} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal giftcard creada */}
      <AnimatePresence>
        {createdCard && (
          <motion.div className={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.modalWide} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>Giftcard generada ✅</h2>
                <button className={styles.closeBtn} onClick={() => setCreatedCard(null)}><X size={20} /></button>
              </div>
              <GiftCardView card={createdCard} />
              <div className={styles.actionsCol}>
                <button className="btn btn-primary" onClick={() => printGiftCard(createdCard)}>
                  <Printer size={16} /> Imprimir tarjeta (2 caras)
                </button>
                <button className="btn btn-outline" onClick={() => downloadGiftCardPdf(createdCard)}>
                  <FileDown size={16} /> Descargar PDF (2 caras)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal detalle */}
      <AnimatePresence>
        {detailCard && (
          <motion.div className={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setDetailCard(null) }}>
            <motion.div className={styles.modalWide} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>Giftcard {normalizeGiftCode(detailCard.code)}</h2>
                <button className={styles.closeBtn} onClick={() => setDetailCard(null)}><X size={20} /></button>
              </div>
              <GiftCardView card={detailCard} />
              <div style={{ marginTop: '1rem' }}>
                <div className={styles.detailRow}><span>Estado</span><strong>{statusLabel(detailCard)}</strong></div>
                <div className={styles.detailRow}><span>Comprador</span><strong>{detailCard.buyer_name || '—'}</strong></div>
                <div className={styles.detailRow}><span>Para</span><strong>{detailCard.recipient_name || '—'}</strong></div>
                <div className={styles.detailRow}><span>Creada</span><strong>{new Date(detailCard.created_at).toLocaleString()}</strong></div>
                <div className={styles.detailRow}><span>Vence</span><strong>{formatExpiry(detailCard.expires_at)}</strong></div>
                {detailCard.status === 'usada' && (
                  <>
                    <div className={styles.detailRow}><span>Usada</span><strong>{detailCard.used_at ? new Date(detailCard.used_at).toLocaleString() : '—'}</strong></div>
                    <div className={styles.detailRow}><span>Aplicada a venta</span><strong>{formatMoney(detailCard.used_amount)}</strong></div>
                    {parseFloat(detailCard.balance_to_credit) > 0 && (
                      <div className={styles.detailRow}><span>A saldo del cliente</span><strong>{formatMoney(detailCard.balance_to_credit)}</strong></div>
                    )}
                  </>
                )}
                {detailCard.status === 'anulada' && (
                  <div className={styles.detailRow}><span>Reembolso</span><strong>{detailCard.annul_refund_method === 'efectivo' ? 'Efectivo' : 'Crédito'}</strong></div>
                )}
              </div>
              <div className={styles.actionsCol}>
                <div className={styles.actionsRow}>
                  <button className="btn btn-primary" onClick={() => printGiftCard(detailCard)}><Printer size={16} /> Imprimir</button>
                  <button className="btn btn-outline" onClick={() => downloadGiftCardPdf(detailCard)}><FileDown size={16} /> PDF</button>
                </div>
                {detailCard.status === 'activa' && (
                  <button
                    className="btn btn-outline"
                    style={{ color: '#dc2626', borderColor: '#dc2626' }}
                    onClick={() => { setAnnulCard(detailCard); setAnnulMethod('credito'); setAnnulError(''); setDetailCard(null) }}
                  >
                    <Ban size={16} /> Anular giftcard
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmOpen}
        title="¿Cobrar y crear giftcard?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeCreate}
        confirmText="Sí, cobrar"
        disabled={submitting}
      >
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
          <li>Monto: <strong>{formatMoney(amountNum)}</strong></li>
          <li>Comprador: <strong>{buyer.name || '—'}</strong> ({buyer.id_number || '—'})</li>
          {recipientName && <li>Para: <strong>{recipientName}</strong></li>}
          <li>Pago: {payments.filter((p) => parseFloat(p.amount) > 0).map((p) => `${p.method} ${formatMoney(p.amount)}`).join(' + ') || '—'}</li>
        </ul>
      </ConfirmModal>

      <ConfirmModal
        isOpen={!!annulCard}
        title="¿Anular giftcard?"
        onCancel={() => { setAnnulCard(null); setAnnulError('') }}
        onConfirm={executeAnnul}
        confirmText="Sí, anular"
        disabled={annulling}
      >
        <p>Se anulará la giftcard <strong>{normalizeGiftCode(annulCard?.code)}</strong> por <strong>{formatMoney(annulCard?.amount)}</strong>.</p>
        <div className={styles.radioRow}>
          <label><input type="radio" name="annulMethod" checked={annulMethod === 'credito'} onChange={() => setAnnulMethod('credito')} /> Dejar en crédito</label>
          <label><input type="radio" name="annulMethod" checked={annulMethod === 'efectivo'} onChange={() => setAnnulMethod('efectivo')} /> Efectivo</label>
        </div>
        <p className={styles.muted} style={{ fontSize: '0.8rem' }}>
          {annulMethod === 'credito'
            ? 'El monto se sumará al saldo del comprador.'
            : 'Se registrará una salida de efectivo en caja.'}
        </p>
        {annulError && <p className={styles.error}>{annulError}</p>}
      </ConfirmModal>
    </AdminLayout>
  )
}
