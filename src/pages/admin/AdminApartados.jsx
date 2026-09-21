import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  useCashSession,
  fetchSessionDrawer,
  insertBillMovements,
} from '../../hooks/useCashSession'
import {
  minInitialFor,
  pendingFromPaid,
  daysUntilDue,
  dueDateExtended,
} from '../../lib/apartados'
import { fetchEuroRate } from '../../lib/rate'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import POSProductSearch from '../../components/admin/POSProductSearch'
import POSPaymentPanel from '../../components/admin/POSPaymentPanel'
import POSCart from '../../components/admin/POSCart'
import VueltoMixto from '../../components/admin/VueltoMixto'
import ApartadoReceiptView, { printApartadoReceipt } from '../../components/admin/ApartadoReceiptView'
import AbonoReceiptView, { printAbonoReceipt } from '../../components/admin/AbonoReceiptView'
import ReceiptView, { printReceipt } from '../../components/admin/ReceiptView'
import { formatVariantLabel } from '../../lib/sku'
import {
  Bookmark as BookmarkIcon, Lock, Plus, X, Search, Printer, Undo2, CalendarClock, Package,
} from 'lucide-react'
import styles from './AdminApartados.module.css'

const METHOD_LABELS = {
  efectivo: 'Efectivo',
  efectivo_bs: 'Efectivo Bs',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  rapikom: 'Rapikom',
  binance: 'Binance',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  pendiente: 'Pendiente',
  credito: 'Crédito en cuenta',
  multiple: 'Múltiple',
}

export default function AdminApartados() {
  const { user } = useAuth()
  const { session, loading: sessionLoading, updateSessionRate } = useCashSession(user?.id)
  const sessionId = session?.id || null

  const [view, setView] = useState('nuevo') // 'nuevo' | 'lista'
  const [error, setError] = useState('')

  // Cart / nuevo apartado
  const [items, setItems] = useState([])
  const [customer, setCustomer] = useState({ id: '', id_number: '', name: '', phone: '', balance: 0 })
  const [payments, setPayments] = useState([])
  const [inicial, setInicial] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [createdApartado, setCreatedApartado] = useState(null)

  const handleRefreshRate = useCallback(async () => {
    try {
      const { rate } = await fetchEuroRate()
      await updateSessionRate(rate)
    } catch (e) {
      console.error('No se pudo actualizar la tasa:', e)
    }
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

  // Drawer
  const [sessionDrawer, setSessionDrawer] = useState(null)
  const refreshDrawer = useCallback(async () => {
    if (!sessionId) { setSessionDrawer(null); return }
    try {
      setSessionDrawer(await fetchSessionDrawer(sessionId))
    } catch (e) {
      console.error('Error cargando cajón:', e)
    }
  }, [sessionId])

  useEffect(() => {
    refreshDrawer()
  }, [refreshDrawer])

  const handleAbastecer = useCallback(async (counts, note) => {
    if (!sessionId) return
    await insertBillMovements(sessionId, 'ajuste', counts, { note })
    setSessionDrawer(await fetchSessionDrawer(sessionId))
  }, [sessionId])

  // Lista de apartados
  const [apartados, setApartados] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [search, setSearch] = useState('')

  const fetchApartados = useCallback(async () => {
    setLoadingList(true)
    const { data, error } = await supabase
      .from('movements')
      .select(`
        *,
        movement_items(*, products(name, categories(size_label)), product_variants(*)),
        movement_payments(*),
        customers(id_number)
      `)
      .eq('movement_type', 'apartado')
      .in('status', ['activo'])
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) console.error('Error cargando apartados:', error)
    setApartados(data || [])
    setLoadingList(false)
  }, [])

  useEffect(() => {
    if (view === 'lista') fetchApartados()
  }, [view, fetchApartados])

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  )
  const minInicial = minInitialFor(subtotal)
  const totalPaidInicial = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const inicialAmount = parseFloat(inicial) || 0
  // Crédito del cliente aplicado automáticamente a la inicial
  const creditAppliedInicial = Math.min(customer?.balance || 0, inicialAmount)
  const totalDueInicial = Math.max(0, inicialAmount - creditAppliedInicial)
  const inicialCubierta = totalPaidInicial + creditAppliedInicial

  // Cliente fetch por cédula (igual que POS)
  useEffect(() => {
    const id = customer.id_number?.trim()
    if (!id || id.length < 3) return
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .ilike('id_number', id)
        .limit(2)
      if (data && data.length === 1) {
        setCustomer((prev) => ({
          ...prev,
          id: data[0].id,
          name: data[0].name || '',
          phone: data[0].phone || '',
          balance: data[0].balance || 0,
          points: data[0].points || 0,
        }))
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [customer.id_number])

  const addItem = useCallback((product, variant) => {
    setError('')
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.product.id === product.id && i.variant.id === variant.id
      )
      if (existingIndex >= 0) {
        const item = prev[existingIndex]
        if (item.quantity >= variant.stock) return prev
        return prev.map((i, idx) =>
          idx === existingIndex
            ? { ...i, quantity: i.quantity + 1, price: variant.price || product.price || 0 }
            : i
        )
      }
      const price = variant.price || product.price || 0
      return [...prev, { product, variant, quantity: 1, price }]
    })
  }, [])

  const updateQuantity = useCallback((index, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((_, i) => i !== index)
      const item = prev[index]
      if (quantity > item.variant.stock) return prev
      return prev.map((i, idx) => (idx === index ? { ...i, quantity } : i))
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setCustomer({ id: '', id_number: '', name: '', phone: '', balance: 0 })
    setPayments([])
    setInicial('')
    setError('')
  }, [])

  const handleFinish = () => {
    const idNumber = customer?.id_number?.trim()
    const customerName = customer?.name?.trim()
    if (!session) { setError('No hay caja abierta. Abre una caja primero.'); return }
    if (items.length === 0) { setError('Agrega al menos una prenda al apartado'); return }
    if (!idNumber || !customerName) { setError('Datos del cliente obligatorios: cédula y nombre'); return }
    if (inicial <= 0) { setError('Ingresa el monto de la inicial del apartado'); return }
    if (inicialCubierta + 0.004 < minInicial) {
      setError(`La inicial debe ser mínimo 20% del total: $${minInicial.toFixed(2)}`)
      return
    }
    if (inicialCubierta + 0.004 < inicialAmount) {
      setError(`Faltan $${(inicialAmount - inicialCubierta).toFixed(2)} para cubrir la inicial`)
      return
    }
    setError('')
    setConfirmOpen(true)
  }

  const executeCreate = async () => {
    setSubmitting(true)
    setError('')
    try {
      let customerId = customer?.id || null
      const idNumber = customer?.id_number?.trim() || null
      const customerName = customer?.name?.trim() || null
      const customerPhone = customer?.phone?.trim() || null

      if (idNumber && !customerId) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .ilike('id_number', idNumber)
          .single()
        if (existing?.id) customerId = existing.id
      }
      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([{ name: customerName || 'Cliente', id_number: idNumber, phone: customerPhone }])
          .select()
          .single()
        if (customerError) throw customerError
        customerId = newCustomer.id
      }

      const total = subtotal
      const due = dueDateExtended(new Date().toISOString(), 0)
      const externalInicial = payments.filter((p) => parseFloat(p.amount) > 0)
      const inicialPaymentMethod =
        externalInicial.length === 0
          ? (creditAppliedInicial > 0 ? 'credito' : 'pendiente')
          : externalInicial.length === 1 && creditAppliedInicial <= 0
            ? externalInicial[0].method
            : 'multiple'
      const inicialPagada = Math.round(inicialAmount * 100) / 100
      const yaPagado = inicialAmount + 0.004 >= total

      // 1) Padre: el apartado (contrato, sin pagos colgados)
      const { data: movement, error: movError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'apartado',
          status: yaPagado ? 'pagado' : 'activo',
          user_id: user.id,
          cash_session_id: sessionId,
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_method: inicialPaymentMethod,
          total_amount: total,
          discount_amount: 0,
          credit_amount: 0,
          paid_amount: inicialPagada,
          due_date: due,
        }])
        .select()
        .single()
      if (movError) throw movError

      const movementItems = items.map((item) => ({
        movement_id: movement.id,
        product_id: item.product.id,
        variant_id: item.variant.id,
        size: item.variant.size || '',
        quantity: item.quantity,
        unit_price: item.price,
        discount_amount: 0,
      }))
      const { error: itemsError } = await supabase.from('movement_items').insert(movementItems)
      if (itemsError) throw itemsError

      // 2) Hijo: la inicial como movimiento propio (abono)
      const { data: abonoMov, error: abonoError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'abono',
          status: 'pagado',
          user_id: user.id,
          cash_session_id: sessionId,
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          reference_movement_id: movement.id,
          payment_method: inicialPaymentMethod,
          total_amount: inicialPagada,
          discount_amount: 0,
          credit_amount: Math.round(creditAppliedInicial * 100) / 100,
          notes: 'Inicial de apartado',
        }])
        .select()
        .single()
      if (abonoError) throw abonoError

      const movementPayments = payments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          movement_id: abonoMov.id,
          cash_session_id: sessionId,
          method: p.method,
          amount: parseFloat(p.amount),
          reference: p.reference?.trim() || null,
          bs_amount: p.bs ? Math.round(p.bs * 100) / 100 : null,
          bs_rate: p.bs ? (session.exchange_rate || null) : null,
        }))
      if (creditAppliedInicial > 0) {
        movementPayments.unshift({
          movement_id: abonoMov.id,
          cash_session_id: sessionId,
          method: 'credito',
          amount: Math.round(creditAppliedInicial * 100) / 100,
          reference: null,
          bs_amount: null,
          bs_rate: null,
        })
      }
      if (movementPayments.length > 0) {
        const { error: paymentsError } = await supabase.from('movement_payments').insert(movementPayments)
        if (paymentsError) throw paymentsError
      }

      // Kardex de billetes para la inicial (efectivo + vuelto)
      const billRows = []
      for (const p of payments) {
        if (p.method === 'efectivo' && p.bills) {
          for (const [denom, qty] of Object.entries(p.bills)) {
            if (parseInt(qty, 10) > 0) {
              billRows.push({
                session_id: sessionId,
                movement_id: abonoMov.id,
                type: 'venta',
                denomination: parseFloat(denom),
                quantity: parseInt(qty, 10),
              })
            }
          }
        }
        if (p.method === 'efectivo' && p.changeBills) {
          for (const [denom, qty] of Object.entries(p.changeBills)) {
            if (parseInt(qty, 10) > 0) {
              billRows.push({
                session_id: sessionId,
                movement_id: abonoMov.id,
                type: 'vuelto',
                denomination: parseFloat(denom),
                quantity: parseInt(qty, 10),
              })
            }
          }
        }
      }
      if (billRows.length > 0) {
        const { error: billsError } = await supabase.from('cash_bill_movements').insert(billRows)
        if (billsError) throw billsError
      }
      refreshDrawer()

      // Vuelto mixto on payments (Bs / PM / crédito)
      const cashPayments = payments.filter((p) => p.method === 'efectivo' && (
        (parseFloat(p.vueltoBs) || 0) > 0 ||
        (parseFloat(p.vueltoPm) || 0) > 0 ||
        (parseFloat(p.vueltoCredito) || 0) > 0
      ))
      for (const p of cashPayments) {
        await supabase
          .from('movement_payments')
          .update({
            vuelto_bs: p.vueltoBs ? Math.round(parseFloat(p.vueltoBs) * 100) / 100 : null,
            vuelto_pm_amount: p.vueltoPm ? parseFloat(p.vueltoPm) : null,
            vuelto_pm_reference: p.vueltoPmReference?.trim() || null,
            vuelto_credito: p.vueltoCredito ? Math.round(parseFloat(p.vueltoCredito) * 100) / 100 : null,
          })
          .eq('movement_id', abonoMov.id)
          .eq('method', 'efectivo')
      }

      // Stock reservado
      for (const item of items) {
        const newStock = Math.max(0, item.variant.stock - item.quantity)
        const { error: stockError } = await supabase
          .from('product_variants')
          .update({ stock: newStock })
          .eq('id', item.variant.id)
        if (stockError) throw stockError
      }

      // Crédito: aplicar saldo a la inicial y/o dejar vuelto en crédito
      const vueltoCreditoTotal = payments
        .filter((p) => p.method === 'efectivo')
        .reduce((sum, p) => sum + (parseFloat(p.vueltoCredito) || 0), 0)

      if (customerId && (creditAppliedInicial > 0 || vueltoCreditoTotal > 0)) {
        const { data: currentCustomer, error: balReadError } = await supabase
          .from('customers')
          .select('balance')
          .eq('id', customerId)
          .single()
        if (balReadError) throw balReadError

        const newBalance = (currentCustomer?.balance || 0) - creditAppliedInicial + vueltoCreditoTotal
        const { error: balError } = await supabase
          .from('customers')
          .update({ balance: newBalance })
          .eq('id', customerId)
        if (balError) throw balError

        const historyRows = []
        if (creditAppliedInicial > 0) {
          historyRows.push({
            customer_id: customerId,
            movement_id: abonoMov.id,
            amount: -creditAppliedInicial,
            reason: `Usado en apartado #${movement.id.slice(0, 8)}`,
          })
        }
        if (vueltoCreditoTotal > 0) {
          historyRows.push({
            customer_id: customerId,
            movement_id: abonoMov.id,
            amount: vueltoCreditoTotal,
            reason: `Vuelto dejado en crédito (apartado #${movement.id.slice(0, 8)})`,
          })
        }
        if (historyRows.length > 0) {
          const { error: histError } = await supabase.from('customer_credit_history').insert(historyRows)
          if (histError) throw histError
        }
      }

      setCreatedApartado({
        movement,
        items: items.map((i) => ({
          product: i.product,
          variant: i.variant,
          quantity: i.quantity,
          unit_price: i.price,
        })),
        paidAmount: inicialPagada,
        payments: movementPayments.map((p) => ({ method: p.method, amount: p.amount, bs: p.bs_amount })),
        customer: { name: customerName, id_number: idNumber, phone: customerPhone },
        total,
        inicial: inicialPagada,
        dueDate: due,
        createdAt: new Date().toISOString(),
      })
      clearCart()
      refreshDrawer()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Error creando el apartado')
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  // ===== Detalle / abonos =====
  const [detail, setDetail] = useState(null)
  const [detailAbonos, setDetailAbonos] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [abonoAmount, setAbonoAmount] = useState('')
  const [abonoPayments, setAbonoPayments] = useState([])
  const [abonoCredit, setAbonoCredit] = useState('')
  const [detailBalance, setDetailBalance] = useState(0)
  const [detailPoints, setDetailPoints] = useState(0)
  const [detailCustomer, setDetailCustomer] = useState(null)
  const [confirmAbonoOpen, setConfirmAbonoOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [confirmExtendOpen, setConfirmExtendOpen] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [createdAbono, setCreatedAbono] = useState(null)

  const loadDetailAbonos = useCallback(async (apartadoId) => {
    const { data } = await supabase
      .from('movements')
      .select('*, movement_payments(*), cash_sessions(opened_at)')
      .eq('reference_movement_id', apartadoId)
      .eq('movement_type', 'abono')
      .order('created_at', { ascending: true })
    return data || []
  }, [])

  const openDetail = useCallback(async (apartado) => {
    setDetailLoading(true)
    setDetail(apartado)
    setDetailAbonos([])
    setAbonoAmount('')
    setAbonoPayments([])
    setAbonoCredit('')
    setDetailBalance(0)
    setDetailPoints(0)
    const { data, error } = await supabase
      .from('movements')
      .select(`
        *,
        movement_items(*, products(name, categories(size_label)), product_variants(*)),
        movement_payments(*)
      `)
      .eq('id', apartado.id)
      .single()
    if (error) console.error(error)
    else setDetail(data)
    setDetailAbonos(await loadDetailAbonos(apartado.id))
    if (apartado.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('balance, points, name, id_number, phone')
        .eq('id', apartado.customer_id)
        .single()
      setDetailBalance(cust?.balance || 0)
      setDetailPoints(cust?.points || 0)
      setDetailCustomer(cust || null)
    } else {
      setDetailCustomer(null)
    }
    setDetailLoading(false)
  }, [loadDetailAbonos])

  const closeDetailSafe = () => {
    setDetail(null)
    if (view === 'lista') fetchApartados()
  }

  const removeCartItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const [errorAB, setErrorAB] = useState('')
  const totalPaidAbono = abonoPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const abonoMax = Math.min(detailBalance || 0, parseFloat(abonoAmount) || 0)
  const abonoCreditApplied = abonoCredit === ''
    ? abonoMax
    : Math.min(Math.max(parseFloat(abonoCredit) || 0, 0), abonoMax)
  const totalDueAbono = Math.max(0, (parseFloat(abonoAmount) || 0) - abonoCreditApplied)

  const abonosConAcumulado = useMemo(() => {
    let acc = 0
    const total = parseFloat(detail?.total_amount) || 0
    return detailAbonos.map((ab) => {
      acc = Math.round((acc + (parseFloat(ab.total_amount) || 0)) * 100) / 100
      return {
        ab,
        paidTotal: acc,
        pending: Math.max(0, Math.round((total - acc) * 100) / 100),
      }
    })
  }, [detailAbonos, detail?.total_amount])

  const handleAbono = () => {
    const amount = parseFloat(abonoAmount) || 0
    if (!session) { setErrorAB('No hay caja abierta. Abre una caja primero.'); return }
    if (amount <= 0) { setErrorAB('Ingresa el monto del abono'); return }
    if (amount > stillPending(detail) + 0.004) { setErrorAB(`El abono no puede exceder el pendiente ($${stillPending(detail).toFixed(2)})`); return }
    if (totalPaidAbono + abonoCreditApplied + 0.005 < amount) {
      setErrorAB(`Faltan $${(amount - totalPaidAbono - abonoCreditApplied).toFixed(2)} para completar el abono`)
      return
    }
    setErrorAB('')
    setConfirmAbonoOpen(true)
  }

  const executeAbono = async () => {
    if (!detail) return
    setSubmitting(true)
    setErrorAB('')
    try {
      const abonoTotal = Math.round((parseFloat(abonoAmount) || 0) * 100) / 100
      const externalAbono = abonoPayments.filter((p) => parseFloat(p.amount) > 0)
      const abonoMethod =
        externalAbono.length === 0
          ? (abonoCreditApplied > 0 ? 'credito' : 'pendiente')
          : externalAbono.length === 1 && abonoCreditApplied <= 0
            ? externalAbono[0].method
            : 'multiple'

      // 1) Hijo: el abono como movimiento propio
      const { data: abonoMov, error: abonoError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'abono',
          status: 'pagado',
          user_id: user.id,
          cash_session_id: sessionId,
          customer_id: detail.customer_id || null,
          customer_name: detail.customer_name || null,
          customer_phone: detail.customer_phone || null,
          reference_movement_id: detail.id,
          payment_method: abonoMethod,
          total_amount: abonoTotal,
          discount_amount: 0,
          credit_amount: Math.round(abonoCreditApplied * 100) / 100,
          notes: 'Abono de apartado',
        }])
        .select()
        .single()
      if (abonoError) throw abonoError

      const movementPayments = abonoPayments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          movement_id: abonoMov.id,
          cash_session_id: sessionId,
          method: p.method,
          amount: parseFloat(p.amount),
          reference: p.reference?.trim() || (p.bs ? `Bs ${Math.round(p.bs).toLocaleString('es-VE')} @ ${(session.exchange_rate || 0).toLocaleString('es-VE')}` : null),
          bs_amount: p.bs ? Math.round(p.bs * 100) / 100 : null,
          bs_rate: p.bs ? (session.exchange_rate || null) : null,
        }))
      if (abonoCreditApplied > 0) {
        movementPayments.unshift({
          movement_id: abonoMov.id,
          cash_session_id: sessionId,
          method: 'credito',
          amount: Math.round(abonoCreditApplied * 100) / 100,
          reference: null,
          bs_amount: null,
          bs_rate: null,
        })
      }
      if (movementPayments.length > 0) {
        const { error: paymentsError } = await supabase.from('movement_payments').insert(movementPayments)
        if (paymentsError) throw paymentsError
      }

      const cashPayments = abonoPayments.filter((p) => p.method === 'efectivo' && (
        (parseFloat(p.vueltoBs) || 0) > 0 ||
        (parseFloat(p.vueltoPm) || 0) > 0 ||
        (parseFloat(p.vueltoCredito) || 0) > 0
      ))
      for (const p of cashPayments) {
        await supabase
          .from('movement_payments')
          .update({
            vuelto_bs: p.vueltoBs ? Math.round(parseFloat(p.vueltoBs) * 100) / 100 : null,
            vuelto_pm_amount: p.vueltoPm ? parseFloat(p.vueltoPm) : null,
            vuelto_pm_reference: p.vueltoPmReference?.trim() || null,
            vuelto_credito: p.vueltoCredito ? Math.round(parseFloat(p.vueltoCredito) * 100) / 100 : null,
          })
          .eq('movement_id', abonoMov.id)
          .eq('method', 'efectivo')
      }

      const billRows = []
      for (const p of abonoPayments) {
        if (p.method === 'efectivo' && p.bills) {
          for (const [denom, qty] of Object.entries(p.bills)) {
            if (parseInt(qty, 10) > 0) {
              billRows.push({
                session_id: sessionId,
                movement_id: abonoMov.id,
                type: 'venta',
                denomination: parseFloat(denom),
                quantity: parseInt(qty, 10),
              })
            }
          }
        }
        if (p.method === 'efectivo' && p.changeBills) {
          for (const [denom, qty] of Object.entries(p.changeBills)) {
            if (parseInt(qty, 10) > 0) {
              billRows.push({
                session_id: sessionId,
                movement_id: abonoMov.id,
                type: 'vuelto',
                denomination: parseFloat(denom),
                quantity: parseInt(qty, 10),
              })
            }
          }
        }
      }
      if (billRows.length > 0) {
        const { error: billsError } = await supabase.from('cash_bill_movements').insert(billRows)
        if (billsError) throw billsError
      }

      // Crédito: saldo usado en el abono y/o vuelto dejado en crédito
      const vueltoCreditoAbono = abonoPayments
        .filter((p) => p.method === 'efectivo')
        .reduce((sum, p) => sum + (parseFloat(p.vueltoCredito) || 0), 0)

      if (detail.customer_id && (abonoCreditApplied > 0 || vueltoCreditoAbono > 0)) {
        const { data: cur, error: curError } = await supabase
          .from('customers')
          .select('balance')
          .eq('id', detail.customer_id)
          .single()
        if (curError) throw curError
        const newBalance = (cur?.balance || 0) - abonoCreditApplied + vueltoCreditoAbono
        const { error: balError } = await supabase
          .from('customers')
          .update({ balance: newBalance })
          .eq('id', detail.customer_id)
        if (balError) throw balError

        const rows = []
        if (abonoCreditApplied > 0) {
          rows.push({
            customer_id: detail.customer_id,
            movement_id: abonoMov.id,
            amount: -Math.round(abonoCreditApplied * 100) / 100,
            reason: `Usado en abono #${abonoMov.id.slice(0, 8)}`,
          })
        }
        if (vueltoCreditoAbono > 0) {
          rows.push({
            customer_id: detail.customer_id,
            movement_id: abonoMov.id,
            amount: Math.round(vueltoCreditoAbono * 100) / 100,
            reason: `Vuelto dejado en crédito (abono #${abonoMov.id.slice(0, 8)})`,
          })
        }
        if (rows.length > 0) {
          const { error: histError } = await supabase.from('customer_credit_history').insert(rows)
          if (histError) throw histError
        }
      }
      refreshDrawer()

      // 2) Actualizar el padre: paid_amount + estado
      const newPaid = Math.round(((parseFloat(detail.paid_amount) || 0) + abonoTotal) * 100) / 100
      const pendingNow = Math.max(0, Math.round(((parseFloat(detail.total_amount) || 0) - newPaid) * 100) / 100)
      const completado = pendingNow <= 0.004
      const { error: parentError } = await supabase
        .from('movements')
        .update({
          paid_amount: newPaid,
          status: completado ? 'pagado' : 'activo',
          updated_at: new Date().toISOString(),
        })
        .eq('id', detail.id)
      if (parentError) throw parentError

      // Recibo del abono
      setCreatedAbono({
        abonoId: abonoMov.id,
        apartadoId: detail.id,
        createdAt: abonoMov.created_at || new Date().toISOString(),
        sessionOpenedAt: session?.opened_at || null,
        customer: {
          name: detailCustomer?.name || detail.customer_name,
          id_number: detailCustomer?.id_number,
          phone: detailCustomer?.phone || detail.customer_phone,
        },
        payments: movementPayments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference })),
        amount: abonoTotal,
        paidTotal: newPaid,
        pending: pendingNow,
      })

      if (completado) {
        const hijos = await loadDetailAbonos(detail.id)
        const allPayments = hijos.flatMap((h) => h.movement_payments || [])
        const { data: parentFresh } = await supabase
          .from('movements')
          .select(`*, movement_items(*, products(name, categories(size_label)), product_variants(*))`)
          .eq('id', detail.id)
          .single()
        setCompletedSale({
          movement: { ...parentFresh, status: 'pagado' },
          items: parentFresh?.movement_items || [],
          payments: allPayments,
          createdAt: new Date().toISOString(),
        })
      }

      setAbonoAmount('')
      setAbonoPayments([])
      setAbonoCredit('')
      const { data: refreshed } = await supabase
        .from('movements')
        .select(`
          *,
          movement_items(*, products(name, categories(size_label)), product_variants(*)),
          movement_payments(*)
        `)
        .eq('id', detail.id)
        .single()
      setDetail(refreshed)
      setDetailAbonos(await loadDetailAbonos(detail.id))
      if (detail.customer_id) {
        const { data: custAfter } = await supabase
          .from('customers')
          .select('balance, points, name, id_number, phone')
          .eq('id', detail.customer_id)
          .single()
        setDetailBalance(custAfter?.balance || 0)
        setDetailPoints(custAfter?.points || 0)
        setDetailCustomer(custAfter || null)
      }
    } catch (e) {
      console.error(e)
      setErrorAB(e.message || 'Error registrando el abono')
    } finally {
      setSubmitting(false)
      setConfirmAbonoOpen(false)
    }
  }

  function stillPending(mov) {
    return pendingFromPaid(mov?.total_amount, mov?.paid_amount)
  }

  const handleExtend = async () => {
    if (!detail) return
    setSubmitting(true)
    try {
      const base = detail.due_date || detail.created_at
      const d = new Date(base)
      d.setDate(d.getDate() + 15)
      const { error } = await supabase
        .from('movements')
        .update({ due_date: d.toISOString(), extended_count: (detail.extended_count || 0) + 1 })
        .eq('id', detail.id)
      if (error) throw error
      setDetail({ ...detail, due_date: d.toISOString(), extended_count: (detail.extended_count || 0) + 1 })
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
      setConfirmExtendOpen(false)
    }
  }

  const handleCancel = async () => {
    if (!detail) return
    setSubmitting(true)
    try {
      // Restore stock
      for (const item of detail.movement_items || []) {
        const { data: variantData } = await supabase
          .from('product_variants')
          .select('stock')
          .eq('id', item.variant_id)
          .single()
        if (variantData) {
          await supabase
            .from('product_variants')
            .update({ stock: variantData.stock + item.quantity })
            .eq('id', item.variant_id)
        }
      }

      // Abonos pasan a crédito en tienda
      const paid = parseFloat(detail.paid_amount) || 0
      if (paid > 0 && detail.customer_id) {
        const { data: currentCustomer } = await supabase
          .from('customers')
          .select('balance')
          .eq('id', detail.customer_id)
          .single()
        const newBalance = (currentCustomer?.balance || 0) + paid
        await supabase.from('customers').update({ balance: newBalance }).eq('id', detail.customer_id)
        await supabase.from('customer_credit_history').insert([{
          customer_id: detail.customer_id,
          movement_id: detail.id,
          amount: paid,
          reason: 'Cancelación de apartado',
        }])
      }

      const { error } = await supabase
        .from('movements')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', detail.id)
      if (error) throw error

      setDetail(null)
      fetchApartados()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
      setConfirmCancelOpen(false)
    }
  }

  const badgeFor = (ap) => {
    if (ap.status === 'activo') {
      const days = daysUntilDue(ap)
      if (days === null) return { cls: 'badge-secondary', text: 'activo' }
      if (days < 0) return { cls: 'badge-danger', text: `VENCIDO hace ${Math.abs(days)}d` }
      if (days <= 3) return { cls: 'badge-warning', text: `vence en ${days}d` }
      return { cls: 'badge-success', text: `vence en ${days}d` }
    }
    if (ap.status == 'pagado') return { cls: 'badge-success', text: 'pagado' }
    if (ap.status === 'cancelado') return { cls: 'badge-danger', text: 'cancelado' }
    return { cls: 'badge-secondary', text: ap.status }
  }

  const filteredApartados = apartados.filter((a) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      (a.customer_name || '').toLowerCase().includes(q) ||
      (a.customers?.id_number || '').toLowerCase().includes(q) ||
      a.id.slice(0, 8).includes(q)
    )
  })

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}><BookmarkIcon size={22} /> Apartados</h1>
            <p className={styles.pageSubtitle}>Aparta prendas con inicial y paga en 15 días</p>
          </div>
          <div className={styles.topRight}>
            <button
              className={`btn ${view === 'nuevo' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setView('nuevo') }}
            >
              <Plus size={16} /> Nuevo apartado
            </button>
            <button
              className={`btn ${view === 'lista' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setView('lista') }}
            >
              <Package size={16} /> Apartados por pagar
            </button>
          </div>
        </div>

        {sessionLoading ? (
          <div className={styles.card}><p>Cargando caja...</p></div>
        ) : !session ? (
          <div className={styles.card}>
            <div className={styles.noSession}>
              <p><Lock size={28} /> No hay caja abierta</p>
              <p className={styles.muted}>Abre una caja en Caja para crear apartados o registrar abonos.</p>
            </div>
          </div>
        ) : view === 'nuevo' ? (
          <div className={styles.layout}>
            <div className={styles.leftPanel}>
              <div className={styles.card}>
                <div className={styles.customerRow}>
                  <div className={styles.field}>
                    <label>Cédula / RIF del cliente *</label>
                    <input
                      className={styles.input}
                      value={customer.id_number || ''}
                      onChange={(e) => setCustomer({ ...customer, id_number: e.target.value })}
                      placeholder="V-12345678"
            disabled={submitting}
                    />
                  </div>
                  <button
                    className={`btn btn-outline ${styles.customerSearch}`}
                    onClick={async () => {
                      const id = customer.id_number?.trim()
                      if (!id) return
                      const { data } = await supabase.from('customers').select('*').ilike('id_number', id).limit(2)
                      if (data && data.length === 1) {
                        setCustomer((prev) => ({
                          ...prev,
                          id: data[0].id,
                          name: data[0].name || '',
                          phone: data[0].phone || '',
                          balance: data[0].balance || 0,
                          points: data[0].points || 0,
                        }))
                      } else {
                        alert(data && data.length > 1 ? 'Hay varios clientes con esa cédula' : 'Cliente no registrado — completa el nombre')
                      }
                    }}
                  >
                    <Search size={16} />
                  </button>
                </div>
                <div className={styles.field}>
                  <label>Nombre del cliente *</label>
                  <input
                    className={styles.input}
                    value={customer.name || ''}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    placeholder="Nombre del cliente"
                  disabled={submitting}
                  />
                </div>
                <div className={styles.field}>
                  <label>Teléfono</label>
                  <input
                    className={styles.input}
                    value={customer.phone || ''}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="0414-0000000"
                  />
                </div>
              </div>

              <div className={styles.card}>
                <p className={styles.blockLabel}>Prendas a apartar</p>
                <POSProductSearch onAdd={addItem} wholesaleMode={false} exchangeRate={session.exchange_rate ? parseFloat(session.exchange_rate) : 0} />
              </div>
            </div>

            <div className={styles.rightPanel}>
              <POSCart
                items={items}
                subtotal={subtotal}
                discount={0}
                totalToPay={totalDueInicial}
                creditApplied={creditAppliedInicial}
                customer={customer}
                onCustomerChange={setCustomer}
                payments={payments}
                onPaymentsChange={setPayments}
                onUpdateQty={updateQuantity}
                onRemove={removeCartItem}
                onClear={clearCart}
                onPay={handleFinish}
                disabled={submitting}
                error={error}
                totalPaid={totalPaidInicial}
                difference={totalPaidInicial - totalDueInicial}
                appliedCoupon={null}
                onApplyCoupon={() => {}}
                onRemoveCoupon={() => {}}
                onRedeemCoupon={async () => {}}
                wholesaleMode={false}
                onToggleWholesale={() => {}}
                exchangeRate={session.exchange_rate}
                sessionDrawer={sessionDrawer}
                onAbastecer={handleAbastecer}
                summaryTopNode={(
                  <div className={styles.inicialBox}>
                    <div className={styles.inicialRow}>
                      <span>Inicial mínima (20%):</span>
                      <strong>${minInicial.toFixed(2)}</strong>
                    </div>
                    <div className={styles.inicialRow}>
                      <span>Inicial a recibir:</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={styles.inicialInput}
                        value={inicial}
                        onChange={(e) => setInicial(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        ) : (
          <>
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Buscar por cliente, cédula o recibo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loadingList ? (
              <p>Cargando...</p>
            ) : filteredApartados.length === 0 ? (
              <div className={styles.card}>No hay apartados por pagar.</div>
            ) : (
              <div className={styles.cardsGrid}>
                {filteredApartados.map((ap) => {
                  const paid = parseFloat(ap.paid_amount) || 0
                  const pending = stillPending(ap)
                  const badge = badgeFor(ap)
                  return (
                    <motion.button
                      key={ap.id}
                      className={styles.apartadoCard}
                      onClick={() => openDetail(ap)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className={styles.apartadoCardHead}>
                        <strong>{ap.customer_name || 'Cliente'}</strong>
                        <span className={`badge ${badge.cls}`}>{badge.text}</span>
                      </div>
                      <span className={styles.apartadoMeta}>
                        {ap.customers?.id_number || '—'} · #{ap.id.slice(0, 8)}
                      </span>
                      <div className={styles.apartadoCardBody}>
                        <span>{(ap.movement_items || []).length} prendas</span>
                        <span>Total: ${parseFloat(ap.total_amount).toFixed(2)}</span>
                        <span>Abonado: <strong className={styles.green}>${paid.toFixed(2)}</strong></span>
                        <span>Pendiente: <strong className={styles.red}>${pending.toFixed(2)}</strong></span>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title="¿Crear apartado?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeCreate}
        confirmText="Crear apartado"
        disabled={submitting}
      >
        <p>
          Se apartará {items.reduce((s, i) => s + i.quantity, 0)} prendas de <strong>{customer?.name}</strong>.
        </p>
        <ul>
          <li>Total: <strong>${subtotal.toFixed(2)}</strong></li>
          <li>Inicial a recibir: <strong>${Math.round((parseFloat(inicial) || 0) * 100) / 100}</strong></li>
          <li>Vence: <strong>{dueDateExtended(new Date().toISOString(), 0).toLocaleDateString()}</strong></li>
        </ul>
      </ConfirmModal>

      <AnimatePresence>
        {createdApartado && (
          <motion.div
            className={styles.modalOverlay}
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
              <div className={styles.modalHeader}>
                <h2>✅ Apartado creado</h2>
                <button className={styles.closeBtn} onClick={() => setCreatedApartado(null)}><X size={20} /></button>
              </div>
              <ApartadoReceiptView apartado={createdApartado} />
              <div style={{ marginTop: '1rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => printApartadoReceipt({ apartado: createdApartado })}
                >
                  <Printer size={16} /> Imprimir / Guardar PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createdAbono && (
          <motion.div
            className={styles.modalOverlay}
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
              <div className={styles.modalHeader}>
                <h2>✅ Abono registrado</h2>
                <button className={styles.closeBtn} onClick={() => setCreatedAbono(null)}><X size={20} /></button>
              </div>
              <AbonoReceiptView data={createdAbono} />
              <div style={{ marginTop: '1rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => printAbonoReceipt(createdAbono)}
                >
                  <Printer size={16} /> Imprimir / Guardar PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detail && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) closeDetailSafe() }}
          >
            <motion.div
              className={styles.modalLarge}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              {detailLoading ? <p>Cargando...</p> : (
                <>
                  <div className={styles.modalHeader}>
                    <h2>Apartado #{detail.id.slice(0, 8)}</h2>
                    <button className={styles.closeBtn} onClick={() => closeDetailSafe()}><X size={20} /></button>
                  </div>

                  <div className={styles.detailGrid}>
                    <div>
                      <div className={styles.card}>
                        <h3>Cliente</h3>
                        <p className={styles.detailStrong}>{detail.customer_name || 'Cliente'}</p>
                        <p className={styles.detailMeta}>{detail.customer_id_number || ''}{detail.customer_phone ? ` · ${detail.customer_phone}` : ''}</p>
                        <p className={styles.detailMeta}>
                          <CalendarClock size={13} /> {detail.status === 'activo'
                            ? `Vence: ${new Date(detail.due_date || detail.created_at).toLocaleDateString()}`
                            : `Estado: ${detail.status}`}
                        </p>
                      </div>

                      <div className={styles.card}>
                        <h3>Prendas apartadas</h3>
                        {(detail.movement_items || []).map((it) => (
                          <div key={it.id} className={styles.abonoRow}>
                            <span>{it.quantity}x {it.products?.name} {formatVariantLabel(it.product_variants, it.products?.categories?.size_label)}</span>
                            <strong>${(it.quantity * (it.unit_price || 0)).toFixed(2)}</strong>
                          </div>
                        ))}
                        <div className={styles.abonoRow} style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                          <span>Total:</span>
                          <strong className={styles.green}>${parseFloat(detail.total_amount).toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className={styles.card}>
                        <h3>Estado de cuenta</h3>
                        <div className={styles.abonoRow}><span>Abonado:</span><strong className={styles.green}>${(parseFloat(detail.paid_amount) || 0).toFixed(2)}</strong></div>
                        <div className={styles.abonoRow}><span>Pendiente:</span><strong className={styles.red}>${stillPending(detail).toFixed(2)}</strong></div>
                      </div>

                      <div className={styles.card}>
                        <h3>Abonos</h3>
                        {abonosConAcumulado.length === 0 ? (
                          <p className={styles.detailMeta}>Sin abonos aún</p>
                        ) : (
                          abonosConAcumulado.map(({ ab, paidTotal, pending }) => (
                            <div key={ab.id} className={styles.abonoRow}>
                              <span>
                                {new Date(ab.created_at).toLocaleDateString()}
                                {' · '}{(ab.movement_payments || []).map((p) => METHOD_LABELS[p.method] || p.method).join(' + ') || METHOD_LABELS[ab.payment_method] || '—'}
                                {ab.cash_sessions?.opened_at ? ` · turno ${new Date(ab.cash_sessions.opened_at).toLocaleDateString()}` : ''}
                                {ab.notes ? ` (${ab.notes})` : ''}
                              </span>
                              <strong>${(parseFloat(ab.total_amount) || 0).toFixed(2)}</strong>
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                title="Reimprimir abono"
                                onClick={() => printAbonoReceipt({
                                  abonoId: ab.id,
                                  apartadoId: detail.id,
                                  createdAt: ab.created_at,
                                  sessionOpenedAt: ab.cash_sessions?.opened_at || null,
                                  customer: {
                                    name: detailCustomer?.name || detail.customer_name,
                                    id_number: detailCustomer?.id_number,
                                    phone: detailCustomer?.phone || detail.customer_phone,
                                  },
                                  payments: (ab.movement_payments || []).map((p) => ({ method: p.method, amount: p.amount, reference: p.reference })),
                                  amount: parseFloat(ab.total_amount) || 0,
                                  paidTotal,
                                  pending,
                                })}
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {(detail.status || '').toLowerCase() === 'activo' && (
                        <>
                          <div className={styles.card}>
                            <h3>Hacer un abono</h3>
                            <div className={styles.abonoRow}>
                              <span>Monto del abono (máx: ${stillPending(detail).toFixed(2)}):</span>
                              <input
                                type="number"
                                min={0}
                                className={styles.abonoInput}
                                value={abonoAmount}
                                onChange={(e) => setAbonoAmount(e.target.value)}
                                disabled={submitting}
                              />
                            </div>
                            {detailBalance > 0 && (
                              <div className={styles.abonoRow}>
                                <span>Saldo del cliente: <strong className={styles.green}>${detailBalance.toFixed(2)}</strong></span>
                                <span className={styles.muted}>{detailPoints > 0 ? `${detailPoints} pts` : ''}</span>
                              </div>
                            )}
                            {abonoMax > 0 && (
                              <div className={styles.abonoRow}>
                                <span>Crédito a usar (máx: ${abonoMax.toFixed(2)}):</span>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    className={styles.abonoInput}
                                    value={abonoCredit === '' ? (abonoMax > 0 ? abonoMax.toFixed(2) : '') : abonoCredit}
                                    onChange={(e) => setAbonoCredit(e.target.value)}
                                    disabled={submitting}
                                  />
                                  {abonoCredit !== '' && (
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                      onClick={() => setAbonoCredit('')}
                                      disabled={submitting}
                                    >
                                      Auto
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                            {errorAB && <p className={styles.error}>{errorAB}</p>}
                            <div style={{ marginBottom: '0.7rem', color: 'var(--color-dark-soft)', fontSize: '0.85rem' }}>
                              Pagado en el panel: ${totalPaidAbono.toFixed(2)} · Crédito: ${abonoCreditApplied.toFixed(2)} del abono de ${(parseFloat(abonoAmount) || 0).toFixed(2)}
                            </div>
                            <POSPaymentPanel
                              totalAmount={totalDueAbono}
                              payments={abonoPayments}
                              onChange={setAbonoPayments}
                              exchangeRate={session.exchange_rate}
                              sessionDrawer={sessionDrawer}
                              onAbastecer={handleAbastecer}
                            />
                            <VueltoMixto
                              difference={totalPaidAbono - totalDueAbono}
                              payments={abonoPayments}
                              onPaymentsChange={setAbonoPayments}
                              exchangeRate={session.exchange_rate}
                              sessionDrawer={sessionDrawer}
                              customer={{ ...(detailCustomer || {}), id: detail.customer_id }}
                            />
                          </div>

                          <div className={styles.detailActions}>
                            <button className="btn btn-primary" onClick={handleAbono} disabled={submitting}>
                              Registrar abono
                            </button>
                            <button className="btn btn-outline" onClick={() => setConfirmExtendOpen(true)} disabled={submitting}>
                              <CalendarClock size={16} /> +15 días
                            </button>
                            <button className="btn btn-outline" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={() => setConfirmCancelOpen(true)}>
                              <Undo2 size={15} /> Cancelar apartado
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmAbonoOpen}
        title="¿Registrar abono?"
        onCancel={() => setConfirmAbonoOpen(false)}
        onConfirm={executeAbono}
        confirmText="Confirmar abono"
        disabled={submitting}
      >
        <p>Se abonarán <strong>${(parseFloat(abonoAmount) || 0).toFixed(2)}</strong> al apartado de <strong>{detail?.customer_name}</strong>.</p>
        {abonoCreditApplied > 0 && (
          <p>De ese monto, <strong>${abonoCreditApplied.toFixed(2)}</strong> se cubren con el saldo del cliente{totalDueAbono > 0 ? ` y $${totalDueAbono.toFixed(2)} se cobran en el panel.` : '.'}</p>
        )}
      </ConfirmModal>

      <ConfirmModal
        isOpen={confirmExtendOpen}
        title="¿Extender el plazo?"
        onCancel={() => setConfirmExtendOpen(false)}
        onConfirm={handleExtend}
        confirmText="Sí, +15 días"
        disabled={submitting}
      >
        <p>Nueva fecha límite: <strong>{detail ? (() => { const d = new Date(detail.due_date || detail.created_at); d.setDate(d.getDate() + 15); return d.toLocaleDateString() })() : '—'}</strong></p>
      </ConfirmModal>

      <ConfirmModal
        isOpen={confirmCancelOpen}
        title="¿Cancelar apartado?"
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={handleCancel}
        confirmText="Sí, cancelar"
        disabled={submitting}
      >
        <p>Se devolverá el stock de las prendas y <strong>${(parseFloat(detail?.paid_amount) || 0).toFixed(2)}</strong> quedará como crédito en tienda del cliente.</p>
      </ConfirmModal>

      <AnimatePresence>
        {completedSale && (
          <motion.div
            className={styles.modalOverlay}
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
              <div className={styles.modalHeader}>
                <h2>✅ Apartado completado — venta registrada</h2>
                <button className={styles.closeBtn} onClick={() => setCompletedSale(null)}><X size={20} /></button>
              </div>
              <ReceiptView
                movement={completedSale.movement}
                items={completedSale.items}
                payments={completedSale.payments}
                total={completedSale.movement.total_amount}
                createdAt={completedSale.createdAt}
              />
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={() => printReceipt({
                  movement: completedSale.movement,
                  items: completedSale.items,
                  payments: completedSale.payments,
                  total: completedSale.movement.total_amount,
                  createdAt: completedSale.createdAt,
                })}
              >
                <Printer size={16} /> Imprimir recibo normal
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
