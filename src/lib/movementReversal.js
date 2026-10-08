import { supabase } from './supabase'

/**
 * Revierte todos los efectos secundarios de una venta antes de anularla:
 * - devuelve el crédito en tienda usado (movement.credit_amount)
 * - quita los puntos ganados (movement.points_earned)
 * - revierte el vuelto dejado en crédito (vuelto_credito)
 * - reactiva la(s) giftcard(s) usada(s) y revierte su saldo a favor
 * - reactiva el cupón usado (customer_coupon_id)
 */
export async function reverseSaleEffects(movement) {
  const movementId = movement.id
  const customerId = movement.customer_id || null

  const { data: pays } = await supabase
    .from('movement_payments')
    .select('method, amount, vuelto_credito')
    .eq('movement_id', movementId)

  const vueltoCredito = (pays || []).reduce((s, p) => s + (parseFloat(p.vuelto_credito) || 0), 0)
  const creditUsed = parseFloat(movement.credit_amount) || 0
  const pointsEarned = parseInt(movement.points_earned, 10) || 0

  const { data: usedCards } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('used_movement_id', movementId)
    .eq('status', 'usada')

  const giftSurplus = (usedCards || []).reduce((s, gc) => s + (parseFloat(gc.balance_to_credit) || 0), 0)

  if (customerId) {
    const balanceDelta = Math.round((creditUsed - vueltoCredito - giftSurplus) * 100) / 100
    const pointsDelta = -pointsEarned

    if (balanceDelta !== 0) {
      const { data: cust } = await supabase.from('customers').select('balance').eq('id', customerId).single()
      await supabase.from('customers').update({ balance: (cust?.balance || 0) + balanceDelta }).eq('id', customerId)
    }
    if (pointsDelta !== 0) {
      const { data: cust } = await supabase.from('customers').select('points').eq('id', customerId).single()
      await supabase.from('customers').update({ points: (cust?.points || 0) + pointsDelta }).eq('id', customerId)
    }

    const rows = []
    if (creditUsed > 0) {
      rows.push({ customer_id: customerId, movement_id: movementId, amount: creditUsed, reason: `Anulación venta #${movementId.slice(0, 8)} (crédito devuelto)` })
    }
    if (vueltoCredito > 0) {
      rows.push({ customer_id: customerId, movement_id: movementId, amount: -vueltoCredito, reason: `Anulación venta #${movementId.slice(0, 8)} (vuelto en crédito revertido)` })
    }
    if (giftSurplus > 0) {
      rows.push({ customer_id: customerId, movement_id: movementId, amount: -giftSurplus, reason: `Anulación venta #${movementId.slice(0, 8)} (saldo a favor giftcard revertido)` })
    }
    if (rows.length > 0) {
      await supabase.from('customer_credit_history').insert(rows)
    }
    if (pointsDelta !== 0) {
      await supabase.from('customer_points_history').insert([{
        customer_id: customerId,
        movement_id: movementId,
        change: pointsDelta,
        reason: `Anulación venta #${movementId.slice(0, 8)} (puntos revertidos)`,
      }])
    }
  }

  // Reactivar giftcards usadas en esta venta
  for (const gc of usedCards || []) {
    await supabase.from('gift_cards').update({
      status: 'activa',
      used_movement_id: null,
      used_customer_id: null,
      used_amount: null,
      balance_to_credit: 0,
      used_at: null,
    }).eq('id', gc.id)
  }

  // Reactivar cupón usado
  if (movement.customer_coupon_id) {
    await supabase.from('customer_coupons').update({ status: 'active', used_at: null }).eq('id', movement.customer_coupon_id)
  }
}

/**
 * Anula la venta de una giftcard (movimiento tipo 'giftcard'):
 * - si la tarjeta está activa: la marca 'anulada' y devuelve el monto como
 *   crédito al saldo del comprador.
 * - si ya fue usada: no se anula (la tarjeta queda como está).
 */
export async function annulGiftcardPurchase(movement) {
  const { data: cards } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('purchase_movement_id', movement.id)

  for (const gc of cards || []) {
    if (gc.status === 'usada') continue

    const amount = parseFloat(gc.amount) || 0
    if (gc.status === 'activa' && gc.buyer_customer_id && amount > 0) {
      const { data: cust } = await supabase.from('customers').select('balance').eq('id', gc.buyer_customer_id).single()
      await supabase.from('customers').update({ balance: (cust?.balance || 0) + amount }).eq('id', gc.buyer_customer_id)
      await supabase.from('customer_credit_history').insert([{
        customer_id: gc.buyer_customer_id,
        movement_id: movement.id,
        amount,
        reason: `Anulación venta giftcard ${gc.code}`,
      }])
    }

    await supabase.from('gift_cards').update({
      status: 'anulada',
      annulled_at: new Date().toISOString(),
      annul_refund_method: 'credito',
      annul_movement_id: movement.id,
    }).eq('id', gc.id)
  }
}
