import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useCashSession, fetchSessionDrawer, insertBillMovements } from '../../hooks/useCashSession'
import { formatWhatsAppReceipt } from '../../lib/whatsapp'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import POSProductSearch from '../../components/admin/POSProductSearch'
import POSCart from '../../components/admin/POSCart'
import ReceiptView, { printReceipt } from '../../components/admin/ReceiptView'
import { formatVariantLabel } from '../../lib/sku'
import { fetchEuroRate, formatRate } from '../../lib/rate'
import { sumBills } from '../../lib/bills'
import {
  allocateDiscount,
  fetchDayDiscounts,
  findBestDayDiscount,
  localISODate,
} from '../../lib/dayDiscounts'
import { Lock, CheckCircle, Printer, MessageCircle, X, LockOpen, ArrowDownUp, Loader2 } from 'lucide-react'
import styles from './AdminPOS.module.css'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  efectivo_bs: 'Efectivo Bs',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  binance: 'Binance',
  rapikom: 'Rapikom',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  giftcard: 'Giftcard',
}

function calculateItemPrice(product, variant, isWholesale) {
  if (isWholesale) {
    return variant.wholesale_price || product.wholesale_price || variant.price || product.price || 0
  }
  return variant.price || product.price || 0
}

export default function AdminPOS() {
  const { user } = useAuth()
  const { session, loading: sessionLoading, updateSessionRate } = useCashSession(user?.id)

  // Cash drawer (bill-level) for the open session
  const [sessionDrawer, setSessionDrawer] = useState(null)
  const sessionId = session?.id || null

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

  const [items, setItems] = useState([])
  const [wholesaleMode, setWholesaleMode] = useState(false)
  const [customer, setCustomer] = useState({ id: '', id_number: '', name: '', phone: '', points: 0, balance: 0 })
  const [payments, setPayments] = useState([])
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [dayDiscounts, setDayDiscounts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completedSale, setCompletedSale] = useState(null)
  const [confirmPayOpen, setConfirmPayOpen] = useState(false)
  const [barcodeBuffer, setBarcodeBuffer] = useState('')
  const barcodeInputRef = useRef(null)
  const lastScanRef = useRef({ code: '', time: 0 })
  const [rateLoading, setRateLoading] = useState(false)

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [items])

  const retailSubtotal = useMemo(() => {
    return items
      .filter((item) => !item.wholesale)
      .reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [items])

  const todayISO = localISODate()
  const todayDayDiscount = useMemo(
    () => findBestDayDiscount(dayDiscounts, todayISO, retailSubtotal),
    [dayDiscounts, todayISO, retailSubtotal]
  )
  const dayDiscountAmount = todayDayDiscount.amount

  const getCouponFromApplied = useCallback(() => {
    if (!appliedCoupon) return null
    if (appliedCoupon.type === 'reward') return appliedCoupon.coupon
    if (appliedCoupon.type === 'customer') return appliedCoupon.coupon?.reward_coupons
    return null
  }, [appliedCoupon])

  const discount = useMemo(() => {
    if (!appliedCoupon || items.length === 0) return 0
    const coupon = getCouponFromApplied()
    if (!coupon) return 0
    if (coupon.discount_type === 'percentage') {
      const base = coupon.applies_to === 'product' && coupon.product_id
        ? items
            .filter((i) => i.product.id === coupon.product_id)
            .reduce((sum, i) => sum + i.price * i.quantity, 0)
        : subtotal
      return Math.min(base * (coupon.discount_value / 100), base)
    }
    const base = coupon.applies_to === 'product' && coupon.product_id
      ? items
          .filter((i) => i.product.id === coupon.product_id)
          .reduce((sum, i) => sum + i.price * i.quantity, 0)
      : subtotal
    return Math.min(coupon.discount_value, base)
  }, [appliedCoupon, getCouponFromApplied, items, subtotal])

  const total = Math.max(0, subtotal - discount - dayDiscountAmount)

  const creditApplied = useMemo(() => {
    return Math.min(customer.balance || 0, total)
  }, [customer.balance, total])

  const totalToPay = total - creditApplied

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  }, [payments])

  const difference = totalPaid - totalToPay

  const handleRefreshRate = useCallback(async () => {
    setRateLoading(true)
    try {
      const { rate } = await fetchEuroRate()
      await updateSessionRate(rate)
    } catch (e) {
      console.error('No se pudo actualizar la tasa:', e)
    } finally {
      setRateLoading(false)
    }
  }, [updateSessionRate])

  // Keep the euro rate fresh: poll every 5 min and on window focus
  useEffect(() => {
    if (!session) return
    const interval = setInterval(handleRefreshRate, 5 * 60 * 1000)
    window.addEventListener('focus', handleRefreshRate)
    return () => { clearInterval(interval); window.removeEventListener('focus', handleRefreshRate) }
  }, [session?.exchange_rate, session?.id, handleRefreshRate])

  // Auto-fill the rate if the session was opened without one
  useEffect(() => {
    if (!session || session.exchange_rate) return
    handleRefreshRate()
  }, [session?.exchange_rate, session?.id, handleRefreshRate])

  const refreshDayDiscounts = useCallback(async () => {
    try {
      setDayDiscounts(await fetchDayDiscounts('elite'))
    } catch (e) {
      // Si la migración aún no está aplicada, el POS sigue funcionando sin promo.
      console.error('Error cargando descuentos por días:', e)
      setDayDiscounts([])
    }
  }, [])

  useEffect(() => { refreshDayDiscounts() }, [refreshDayDiscounts])

  useEffect(() => {
    window.addEventListener('focus', refreshDayDiscounts)
    return () => window.removeEventListener('focus', refreshDayDiscounts)
  }, [refreshDayDiscounts])

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
        setCustomer(prev => ({
          ...prev,
          id: data[0].id,
          name: data[0].name || '',
          phone: data[0].phone || '',
          points: data[0].points || 0,
          balance: data[0].balance || 0,
        }))
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [customer.id_number])

  useEffect(() => {
    if (!appliedCoupon) return
    const coupon = getCouponFromApplied()
    if (!coupon) return
    const min = parseFloat(coupon.min_purchase_amount) || 0
    if (subtotal < min) {
      setAppliedCoupon(null)
      setError(`El cupón requiere compra mínima de $${min.toFixed(2)}. Se quitó del carrito.`)
    }
  }, [subtotal, appliedCoupon, getCouponFromApplied])

  useEffect(() => {
    if (dayDiscountAmount > 0 && appliedCoupon) setAppliedCoupon(null)
  }, [dayDiscountAmount, appliedCoupon])

  const addItem = useCallback((product, variant) => {
    if (wholesaleMode && !(variant.wholesale_price || product.wholesale_price)) {
      setError(`El producto ${product.name} no tiene precio al mayor`)
      return
    }
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
            ? { ...i, quantity: i.quantity + 1, wholesale: wholesaleMode, price: calculateItemPrice(i.product, i.variant, wholesaleMode) }
            : i
        )
      }

      return [...prev, { product, variant, quantity: 1, wholesale: wholesaleMode, price: calculateItemPrice(product, variant, wholesaleMode) }]
    })
  }, [wholesaleMode])

  const updateQuantity = useCallback((index, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((_, i) => i !== index)
      }
      const item = prev[index]
      if (quantity > item.variant.stock) return prev
      return prev.map((i, idx) =>
        idx === index
          ? { ...i, quantity, price: calculateItemPrice(i.product, i.variant, !!i.wholesale) }
          : i
      )
    })
  }, [])

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setCustomer({ id: '', id_number: '', name: '', phone: '', points: 0, balance: 0 })
    setPayments([])
    setAppliedCoupon(null)
    setError('')
  }, [])

  const toggleWholesaleMode = useCallback(() => {
    setWholesaleMode((prev) => !prev)
    setError('')
  }, [])

  const applyCoupon = useCallback((coupon) => {
    if (dayDiscountAmount > 0) {
      setError('Hoy hay descuento del día; no se acumulan cupones.')
      return
    }
    setAppliedCoupon(coupon)
  }, [dayDiscountAmount])

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null)
  }, [])

  const redeemCoupon = useCallback(async (coupon) => {
    if (dayDiscountAmount > 0) throw new Error('Hoy hay descuento del día; no se acumulan cupones')
    const isFree = (coupon.points_cost || 0) === 0
    if (!isFree && !customer?.id) throw new Error('Este cupón requiere cliente registrado (puntos)')
    if (!isFree && (customer?.points || 0) < coupon.points_cost) throw new Error('Puntos insuficientes')
    const min = parseFloat(coupon.min_purchase_amount) || 0
    if (subtotal < min) throw new Error(`Requiere compra mínima de $${min.toFixed(2)}`)

    setAppliedCoupon({ type: 'reward', coupon })
  }, [customer, subtotal, dayDiscountAmount])

  const handleBarcodeScan = async (code) => {
    if (!code || !session) return
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9\-.]/g, '')
    if (!cleanCode) return

    const now = Date.now()
    const last = lastScanRef.current
    if (cleanCode === last.code && now - last.time < 500) return
    lastScanRef.current = { code: cleanCode, time: now }

    setError('')

    try {
      let matching = []

      // 1. Si parece UUID, buscar por id de variante
      const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(cleanCode)
      if (isUUID) {
        const { data: byId, error: idError } = await supabase
          .from('product_variants')
          .select('*, products(*, categories(*))')
          .eq('id', cleanCode)
          .limit(1)
        if (idError) throw idError
        if (byId?.[0]) matching.push(byId[0])
      }

      // 2. Buscar por barcode o sku
      if (matching.length === 0) {
        const { data: variants, error: variantError } = await supabase
          .from('product_variants')
          .select('*, products(*, categories(*))')
          .or(`barcode.eq.${cleanCode},sku.eq.${cleanCode}`)
          .limit(10)

        if (variantError) throw variantError

        matching = (variants || []).filter(v =>
          v.barcode?.toUpperCase().replace(/[^A-Z0-9\-.]/g, '') === cleanCode ||
          v.sku?.toUpperCase().replace(/[^A-Z0-9\-.]/g, '') === cleanCode
        )
      }

      // 3. Si no hay coincidencia, buscar por id de producto padre
      if (matching.length === 0) {
        const { data: products, error: productError } = await supabase
          .from('products')
          .select('*, categories(*), product_variants(*)')
          .eq('id', cleanCode)
          .eq('active', true)
          .limit(1)

        if (productError) throw productError

        if (products && products.length > 0) {
          const product = products[0]
          const variant = (product.product_variants || []).find(v => v.stock > 0)
          if (variant) {
            addItem(product, variant)
            return
          } else {
            setError(`Sin stock para: ${product.name}`)
            return
          }
        }
      }

      if (matching.length === 0) {
        setError(`No se encontró producto con código: ${cleanCode}`)
        return
      }

      if (matching.length > 1) {
        setError(`Múltiples variantes encontradas para: ${cleanCode}. Selecciona manualmente.`)
        return
      }

      const variant = matching[0]
      const product = variant.products
      if (variant.stock <= 0) {
        setError(`Sin stock para: ${product.name} ${formatVariantLabel(variant, product.categories?.size_label)}`)
        return
      }

      addItem(product, variant)
    } catch (e) {
      console.error('Error escaneando:', e)
      setError('Error al buscar producto escaneado')
    }
  }

  useEffect(() => {
    if (barcodeInputRef.current && session) {
      barcodeInputRef.current.focus()
    }
  }, [session])

  const handlePay = () => {
    if (!session) {
      setError('No hay caja abierta. Abre una caja primero.')
      return
    }
    if (items.length === 0) {
      setError('Agrega al menos un producto al carrito')
      return
    }
    // Datos del cliente obligatorios: cédula + nombre
    const idNumber = customer?.id_number?.trim()
    const customerNameField = customer?.name?.trim()
    if (!idNumber || !customerNameField) {
      setError('Datos del cliente son obligatorios: cédula y nombre')
      return
    }
    // Half-cent tolerance absorbs float residuals from Bs conversions
    if (totalPaid + 0.005 < totalToPay) {
      setError(`Faltan $${(totalToPay - totalPaid).toFixed(2)} para completar el pago`)
      return
    }

    // Option A: if there is a change to give, bills + Bs vuelto + PM vuelto + crédito must cover it exactly
    const differenceDue = Math.round((totalPaid - totalToPay) * 100) / 100
    if (differenceDue > 0) {
      const hasCash = payments.some((p) => p.method === 'efectivo')
      if (hasCash) {
        const mixCovered = payments
          .filter((p) => p.method === 'efectivo')
          .reduce((sum, p) => {
            const bills = sumBills(p.changeBills || {})
            const bsCovered = (parseFloat(p.vueltoBs) || 0) / (session.exchange_rate || 1)
            const pm = parseFloat(p.vueltoPm) || 0
            const credito = parseFloat(p.vueltoCredito) || 0
            return sum + bills + bsCovered + pm + credito
          }, 0)
        if (Math.abs(differenceDue - mixCovered) > 0.004) {
          setError(`El vuelto no cuadra: falta $${(differenceDue - mixCovered).toFixed(2)} — completa el resto con billetes, Bs efectivo, pago móvil o crédito`)
          return
        }
      }
    }

    setError('')
    setConfirmPayOpen(true)
  }

  const executePay = async () => {
    setSubmitting(true)
    setError('')

    try {
      let customerId = customer?.id || null
      let customerName = customer?.name?.trim() || null
      let customerPhone = customer?.phone?.trim() || null

      if (customerName || customer?.id_number?.trim()) {
        const idNumber = customer?.id_number?.trim() || null
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
            .insert([{
              name: customerName || 'Cliente',
              id_number: idNumber,
              phone: customerPhone,
            }])
            .select()
            .single()
          if (customerError) throw customerError
          customerId = newCustomer.id
        }
      }

      const notes = payments
        .filter((p) => p.reference)
        .map((p) => `${PAYMENT_METHODS[p.method]}: ${p.reference}`)
        .join(' | ')

      const earned = Math.floor(total)

      let customerCouponId = null

      if (appliedCoupon && dayDiscountAmount <= 0) {
        if (appliedCoupon.type === 'reward') {
          const reward = appliedCoupon.coupon
          if (!customerId) throw new Error('Se requiere un cliente para canjear puntos')

          const { data: current } = await supabase
            .from('customers')
            .select('points')
            .eq('id', customerId)
            .single()
          if ((current?.points || 0) < reward.points_cost) throw new Error('Puntos insuficientes')

          const code = `EL-${Date.now().toString(36).toUpperCase()}`
          const { data: customerCoupon, error: ccError } = await supabase
            .from('customer_coupons')
            .insert([{
              customer_id: customerId,
              reward_coupon_id: reward.id,
              code,
              status: 'used',
              used_at: new Date().toISOString(),
            }])
            .select()
            .single()
          if (ccError) throw ccError

          customerCouponId = customerCoupon.id

          const newPoints = (current?.points || 0) - reward.points_cost
          const { error: pointsError } = await supabase
            .from('customers')
            .update({ points: newPoints })
            .eq('id', customerId)
          if (pointsError) throw pointsError

          const { error: historyError } = await supabase
            .from('customer_points_history')
            .insert([{
              customer_id: customerId,
              movement_id: null,
              change: -reward.points_cost,
              reason: `Canje de cupón: ${reward.name}`,
            }])
          if (historyError) throw historyError

          setCustomer(prev => ({ ...prev, points: newPoints }))
        } else if (appliedCoupon.type === 'customer') {
          const coupon = appliedCoupon.coupon
          const { error: usedError } = await supabase
            .from('customer_coupons')
            .update({ status: 'used', used_at: new Date().toISOString() })
            .eq('id', coupon.id)
          if (usedError) throw usedError
          customerCouponId = coupon.id
        }
      }

      const effectiveDiscount = Number((discount + dayDiscountAmount).toFixed(2))
      // El descuento del día se reparte solo entre las líneas de detal.
      const allocatedDiscounts = dayDiscountAmount > 0
        ? allocateDiscount(items, dayDiscountAmount, { onlyRetail: true })
        : allocateDiscount(items, discount)

      const hasWholesale = items.some((i) => !!i.wholesale)
      const hasRetail = items.some((i) => !i.wholesale)
      const saleType = hasWholesale && hasRetail ? 'mixed' : hasWholesale ? 'wholesale' : 'retail'

      const { data: movement, error: movError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'venta',
          status: 'pagado',
          user_id: user.id,
          cash_session_id: session.id,
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_method: payments.length === 1 ? payments[0].method : 'multiple',
          total_amount: total,
          discount_amount: effectiveDiscount,
          day_discount_id: dayDiscountAmount > 0 ? todayDayDiscount.discount?.id || null : null,
          day_discount_amount: dayDiscountAmount,
          day_discount_name: dayDiscountAmount > 0 ? todayDayDiscount.discount?.name || null : null,
          credit_amount: creditApplied,
          customer_coupon_id: customerCouponId,
          points_earned: earned,
          notes: notes || null,
          sale_type: saleType,
        }])
        .select()
        .single()

      if (movError) throw movError

      const movementItems = items.map((item, index) => ({
        movement_id: movement.id,
        product_id: item.product.id,
        variant_id: item.variant.id,
        size: item.variant.size || '',
        quantity: item.quantity,
        unit_price: item.price,
        discount_amount: allocatedDiscounts[index] || 0,
        is_wholesale: !!item.wholesale,
        unit_cost: (parseFloat(item.product.cost_price) || 0)
          + (parseFloat(item.product.shipping_cost) || 0)
          + (parseFloat(item.product.freight_cost) || 0),
      }))

      const { error: itemsError } = await supabase
        .from('movement_items')
        .insert(movementItems)

      if (itemsError) throw itemsError

      const movementPayments = payments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          movement_id: movement.id,
          cash_session_id: session.id,
          method: p.method,
          amount: parseFloat(p.amount),
          reference: p.reference?.trim() || (p.bs ? `Bs ${Math.round(p.bs).toLocaleString('es-VE')} @ ${(session.exchange_rate || 0).toLocaleString('es-VE')}` : null),
          bs_amount: p.bs ? Math.round(p.bs * 100) / 100 : null,
          bs_rate: p.bs ? (session.exchange_rate || null) : null,
        }))

      if (movementPayments.length > 0) {
        const { error: paymentsError } = await supabase
          .from('movement_payments')
          .insert(movementPayments)
        if (paymentsError) throw paymentsError
      }

      // Save the mixed change (Bs efectivo / pago móvil / crédito) on the cash payment row
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
          .eq('movement_id', movement.id)
          .eq('method', 'efectivo')
      }

      // Vuelto left as store credit: add to the customer's balance + history
      const vueltoCreditoTotal = cashPayments.reduce((sum, p) => sum + (parseFloat(p.vueltoCredito) || 0), 0)
      if (vueltoCreditoTotal > 0 && customerId) {
        const { data: currentCustomer, error: custErr } = await supabase
          .from('customers')
          .select('balance')
          .eq('id', customerId)
          .single()
        if (custErr) throw custErr
        const vueltoCreditoBalance = (currentCustomer?.balance || 0) + vueltoCreditoTotal
        const { error: balErr } = await supabase
          .from('customers')
          .update({ balance: vueltoCreditoBalance })
          .eq('id', customerId)
        if (balErr) throw balErr
        const { error: histErr } = await supabase
          .from('customer_credit_history')
          .insert([{
            customer_id: customerId,
            movement_id: movement.id,
            amount: vueltoCreditoTotal,
            reason: 'Vuelto dejado en la tienda (crédito)',
          }])
        if (histErr) throw histErr
      }

      // Cash drawer ledger: bills received (venta) + bills given as change (vuelto)
      const billRows = []
      for (const p of payments) {
        if (p.method === 'efectivo' && p.bills) {
          for (const [denom, qty] of Object.entries(p.bills)) {
            if (parseInt(qty, 10) > 0) {
              billRows.push({
                session_id: session.id,
                movement_id: movement.id,
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
                session_id: session.id,
                movement_id: movement.id,
                type: 'vuelto',
                denomination: parseFloat(denom),
                quantity: parseInt(qty, 10),
              })
            }
          }
        }
      }
      if (billRows.length > 0) {
        const { error: billsError } = await supabase
          .from('cash_bill_movements')
          .insert(billRows)
        if (billsError) throw billsError
      }
      refreshDrawer()

      for (const item of items) {
        const newStock = Math.max(0, item.variant.stock - item.quantity)
        const { error: stockError } = await supabase
          .from('product_variants')
          .update({ stock: newStock })
          .eq('id', item.variant.id)
        if (stockError) throw stockError
      }

      if (customerId && earned > 0) {
        const { data: current } = await supabase
          .from('customers')
          .select('points')
          .eq('id', customerId)
          .single()
        const newPoints = (current?.points || 0) + earned
        const { error: pointsUpdateError } = await supabase
          .from('customers')
          .update({ points: newPoints })
          .eq('id', customerId)
        if (pointsUpdateError) throw pointsUpdateError

        const { error: historyError } = await supabase
          .from('customer_points_history')
          .insert([{
            customer_id: customerId,
            movement_id: movement.id,
            change: earned,
            reason: 'Puntos ganados por compra',
          }])
        if (historyError) throw historyError
      }

      if (customerId && creditApplied > 0) {
        const { data: current } = await supabase
          .from('customers')
          .select('balance')
          .eq('id', customerId)
          .single()
        const newBalance = Math.max(0, (current?.balance || 0) - creditApplied)
        const { error: balanceError } = await supabase
          .from('customers')
          .update({ balance: newBalance })
          .eq('id', customerId)
        if (balanceError) throw balanceError

        const { error: creditHistoryError } = await supabase
          .from('customer_credit_history')
          .insert([{
            customer_id: customerId,
            movement_id: movement.id,
            amount: -creditApplied,
            reason: 'Usado en compra',
          }])
        if (creditHistoryError) throw creditHistoryError
      }

      // Giftcard como método de pago: marcar usada y sobrante → saldo
      const giftPayment = payments.find((p) => p.method === 'giftcard' && p.giftcard)
      if (giftPayment) {
        const applied = Math.round((parseFloat(giftPayment.amount) || 0) * 100) / 100
        const cardValue = parseFloat(giftPayment.giftcard.amount) || 0
        const excess = Math.max(0, Math.round((cardValue - applied) * 100) / 100)

        const { error: giftErr } = await supabase
          .from('gift_cards')
          .update({
            status: 'usada',
            used_movement_id: movement.id,
            used_customer_id: customerId || null,
            used_amount: applied,
            balance_to_credit: excess,
            used_at: new Date().toISOString(),
          })
          .eq('id', giftPayment.giftcard.id)
          .eq('status', 'activa')
        if (giftErr) throw giftErr

        if (excess > 0 && customerId) {
          const { data: cur } = await supabase.from('customers').select('balance').eq('id', customerId).single()
          const { error: balErr } = await supabase
            .from('customers')
            .update({ balance: (cur?.balance || 0) + excess })
            .eq('id', customerId)
          if (balErr) throw balErr
          const { error: histErr } = await supabase
            .from('customer_credit_history')
            .insert([{
              customer_id: customerId,
              movement_id: movement.id,
              amount: excess,
              reason: `Sobrante de giftcard ${giftPayment.reference || ''}`.trim(),
            }])
          if (histErr) throw histErr
        }
      }

      setCompletedSale({
        movement,
        items,
        subtotal,
        discount,
        dayDiscountAmount,
        dayDiscount: todayDayDiscount.discount,
        total,
        payments,
        customer,
        appliedCoupon,
        createdAt: new Date().toISOString(),
      })
      clearCart()
    } catch (e) {
      console.error('Error en venta:', e)
      setError(e.message || 'Error al procesar la venta')
    } finally {
      setSubmitting(false)
      setConfirmPayOpen(false)
    }
  }

  const sendWhatsApp = () => {
    if (!completedSale) return
    const message = formatWhatsAppReceipt(completedSale.items, completedSale.total, completedSale.movement.id)
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/${completedSale.customer?.phone || '584226594559'}?text=${encoded}`, '_blank')
  }

  if (sessionLoading) {
    return (
      <AdminLayout>
        <div className={styles.page}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p>Cargando caja...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <h1 className={styles.pageTitle}>Punto de Venta</h1>
          <div className={styles.topBarRight}>
            {session && !rateLoading && (
              <button
                className={`${styles.ratePill} ${session.exchange_rate ? '' : styles.ratePillMissing}`}
                onClick={handleRefreshRate}
                disabled={rateLoading}
                title="Tasa euro — clic para actualizar"
              >
                {session.exchange_rate ? (
                  <><ArrowDownUp size={13} /> Tasa Euro: {formatRate(session.exchange_rate)} Bs/$</>
                ) : (
                  <>Sin tasa — clic para actualizar</>
                )}
              </button>
            )}
            {session && rateLoading && (
              <span className={`${styles.ratePill} ${styles.ratePillLoading}`}>
                <Loader2 size={13} className={styles.spin} /> Buscando tasa...
              </span>
            )}
            <div className={`${styles.sessionBadge} ${session ? styles.sessionOpen : styles.sessionClosed}`}>
              {session ? <><LockOpen size={14} /> Caja abierta</> : <><Lock size={14} /> Caja cerrada</>}
            </div>
          </div>
        </div>

        {!session ? (
          <div className={styles.noSession}>
            <Lock size={64} className={styles.noSessionIcon} />
            <h2 className={styles.noSessionTitle}>No hay caja abierta</h2>
            <p>Ve a Caja y abre un turno para poder vender.</p>
          </div>
        ) : (
          <>
          <div className={styles.barcodeRow}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const code = barcodeBuffer.trim()
                setBarcodeBuffer('')
                if (code) handleBarcodeScan(code)
              }}
              style={{ width: '100%', margin: 0 }}
            >
              <input
                ref={barcodeInputRef}
                type="text"
                className={styles.barcodeInput}
                value={barcodeBuffer}
                onChange={(e) => setBarcodeBuffer(e.target.value)}
                placeholder="Escanea el código de barras..."
                disabled={submitting}
              />
            </form>
          </div>

          <div className={styles.layout}>
            <div className={styles.leftPanel}>
              <POSProductSearch onAdd={addItem} wholesaleMode={wholesaleMode} exchangeRate={session.exchange_rate ? parseFloat(session.exchange_rate) : 0} />
            </div>
            <div className={styles.rightPanel}>
              <POSCart
                items={items}
                subtotal={subtotal}
                discount={discount}
                dayDiscount={todayDayDiscount.discount}
                dayDiscountAmount={dayDiscountAmount}
                total={total}
                totalToPay={totalToPay}
                creditApplied={creditApplied}
                customer={customer}
                onCustomerChange={setCustomer}
                payments={payments}
                onPaymentsChange={setPayments}
                onUpdateQty={updateQuantity}
                onRemove={removeItem}
                onClear={clearCart}
                onPay={handlePay}
                disabled={submitting}
                error={error}
                totalPaid={totalPaid}
                difference={difference}
                appliedCoupon={appliedCoupon}
                onApplyCoupon={applyCoupon}
                onRemoveCoupon={removeCoupon}
                onRedeemCoupon={redeemCoupon}
                wholesaleMode={wholesaleMode}
                onToggleWholesale={toggleWholesaleMode}
                exchangeRate={session.exchange_rate}
                sessionDrawer={sessionDrawer}
                onAbastecer={handleAbastecer}
              />
            </div>
          </div>
          </>
        )}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 className={styles.modalTitle}>
                    <CheckCircle size={22} color="#16a34a" /> Venta completada
                  </h2>
                  <button className="btn btn-ghost" onClick={() => setCompletedSale(null)}>
                    <X size={20} />
                  </button>
                </div>

                <ReceiptView
                  movement={completedSale.movement}
                  items={completedSale.items}
                  payments={completedSale.payments.filter((p) => parseFloat(p.amount) > 0)}
                  customer={completedSale.customer}
                  subtotal={completedSale.subtotal}
                  discount={completedSale.discount}
                  dayDiscount={completedSale.dayDiscount}
                  dayDiscountAmount={completedSale.dayDiscountAmount}
                  appliedCoupon={completedSale.appliedCoupon}
                  total={completedSale.total}
                  createdAt={completedSale.createdAt}
                />

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => printReceipt({
                      movement: completedSale.movement,
                      items: completedSale.items,
                      payments: completedSale.payments.filter((p) => parseFloat(p.amount) > 0),
                      customer: completedSale.customer,
                      subtotal: completedSale.subtotal,
                      discount: completedSale.discount,
                      dayDiscount: completedSale.dayDiscount,
                      dayDiscountAmount: completedSale.dayDiscountAmount,
                      appliedCoupon: completedSale.appliedCoupon,
                      total: completedSale.total,
                      createdAt: completedSale.createdAt,
                    })}
                    style={{ flex: 1 }}
                  >
                    <Printer size={16} /> Imprimir / Guardar PDF
                  </button>
                  <button className="btn btn-outline" onClick={sendWhatsApp} style={{ flex: 1 }}>
                    <MessageCircle size={16} /> Enviar WhatsApp
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <ConfirmModal
          isOpen={confirmPayOpen}
          title="¿Completar venta?"
          onCancel={() => setConfirmPayOpen(false)}
          onConfirm={executePay}
          confirmText="Confirmar venta"
          disabled={submitting}
        >
          <ul className={styles.summaryList}>
            <li><span className={styles.summaryLabel}>Productos</span><span className={styles.summaryValue}>{items.reduce((s, i) => s + i.quantity, 0)} uds</span></li>
            <li><span className={styles.summaryLabel}>Subtotal</span><span className={styles.summaryValue}>${subtotal.toFixed(2)}</span></li>
            {discount > 0 && <li><span className={styles.summaryLabel}>Descuento</span><span className={styles.summaryValue}>-${discount.toFixed(2)}</span></li>}
            <li><span className={styles.summaryLabel}>Total</span><span className={styles.summaryValue}>${total.toFixed(2)}</span></li>
            {creditApplied > 0 && <li><span className={styles.summaryLabel}>Crédito usado</span><span className={styles.summaryValue}>-${creditApplied.toFixed(2)}</span></li>}
            <li><span className={styles.summaryLabel}>A pagar</span><span className={styles.summaryValue}>${totalToPay.toFixed(2)}</span></li>
            <li><span className={styles.summaryLabel}>Recibido</span><span className={styles.summaryValue}>${totalPaid.toFixed(2)}</span></li>
            <li><span className={styles.summaryLabel}>Cambio</span><span className={styles.summaryValue}>${Math.max(0, difference).toFixed(2)}</span></li>
          </ul>
        </ConfirmModal>
      </div>
    </AdminLayout>
  )
}
