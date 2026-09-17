import { supabase } from './supabase'

/**
 * Reverts a completed return movement:
 *  - Restores returned_quantity on the original sale lines (via original_item_id)
 *  - Subtracts the returned units back from variant stock
 *  - Subtracts the credit from the customer's balance (may go negative)
 *  - Restores the points that were deducted by the return (may go negative)
 *  - Writes a negative entry in customer_credit_history and a positive
 *    entry in customer_points_history
 *  - Marks the return movement as 'anulada'
 *
 * Only works for returns whose movement_items have original_item_id set
 * (returns created after the reversal migration).
 */
export async function revertReturnMovement(returnMovement) {
  if (!returnMovement?.id) throw new Error('Devolución inválida')
  if (returnMovement.movement_type !== 'devolucion') {
    throw new Error('Solo se pueden revertir devoluciones')
  }
  if (returnMovement.status !== 'completada') {
    throw new Error('Esta devolución ya fue revertida')
  }

  // 1. Fetch the return's line items with variant info
  const { data: returnItems, error: itemsError } = await supabase
    .from('movement_items')
    .select('id, variant_id, quantity, unit_price, returned_quantity, original_item_id, product_variants(id, stock)')
    .eq('movement_id', returnMovement.id)
  if (itemsError) throw itemsError

  const lines = returnItems || []
  if (lines.length === 0) throw new Error('La devolución no tiene ítems')

  const missingOriginal = lines.filter((l) => !l.original_item_id)
  if (missingOriginal.length === lines.length) {
    throw new Error('Esta devolución es anterior a la migración de reversión y no se puede revertir')
  }

  const creditTotal = lines.reduce((sum, l) => sum + (l.unit_price || 0) * (l.quantity || 0), 0)

  // 2. Per-line: restore original line's returned_quantity and subtract stock
  for (const line of lines) {
    if (!line.original_item_id) continue

    // Restore original item's returned_quantity
    const { data: originalItem, error: originalError } = await supabase
      .from('movement_items')
      .select('id, returned_quantity')
      .eq('id', line.original_item_id)
      .single()
    if (originalError) throw originalError
    if (!originalItem) throw new Error('No se encontró la línea original de la factura')

    const newReturned = Math.max(0, (originalItem.returned_quantity || 0) - (line.quantity || 0))
    const { error: restoreError } = await supabase
      .from('movement_items')
      .update({ returned_quantity: newReturned })
      .eq('id', originalItem.id)
    if (restoreError) throw restoreError

    // Subtract stock back from the variant
    const variant = line.product_variants
    if (variant) {
      const newStock = (variant.stock || 0) - (line.quantity || 0)
      const { error: stockError } = await supabase
        .from('product_variants')
        .update({ stock: newStock })
        .eq('id', variant.id)
      if (stockError) throw stockError
    }
  }

  // 3. Customer balance: subtract the credit (may go negative)
  if (returnMovement.customer_id) {
    const { data: currentCustomer, error: customerError } = await supabase
      .from('customers')
      .select('balance, points')
      .eq('id', returnMovement.customer_id)
      .single()
    if (customerError) throw customerError

    const newBalance = (currentCustomer?.balance || 0) - creditTotal
    const { error: balanceError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', returnMovement.customer_id)
    if (balanceError) throw balanceError

    // 4. Negative entry in credit history
    const { error: creditHistoryError } = await supabase
      .from('customer_credit_history')
      .insert([{
        customer_id: returnMovement.customer_id,
        movement_id: returnMovement.id,
        amount: -creditTotal,
        reason: 'Reversión de devolución',
      }])
    if (creditHistoryError) throw creditHistoryError

    // 5. Restore the points deducted by the return (floor of total, symmetric)
    const pointsRestored = Math.floor(creditTotal)
    if (pointsRestored > 0) {
      const newPoints = (currentCustomer?.points || 0) + pointsRestored
      const { error: pointsError } = await supabase
        .from('customers')
        .update({ points: newPoints })
        .eq('id', returnMovement.customer_id)
      if (pointsError) throw pointsError

      const { error: pointsHistoryError } = await supabase
        .from('customer_points_history')
        .insert([{
          customer_id: returnMovement.customer_id,
          movement_id: returnMovement.id,
          change: pointsRestored,
          reason: 'Reversión de devolución (puntos)',
        }])
      if (pointsHistoryError) throw pointsHistoryError
    }
  }

  // 6. Mark the return movement as reverted
  const { error: statusError } = await supabase
    .from('movements')
    .update({ status: 'anulada' })
    .eq('id', returnMovement.id)
  if (statusError) throw statusError

  return { creditTotal }
}
