export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '584246594559'

const formatVariant = (item) => {
  const parts = []
  if (item.color) parts.push(item.color)
  if (item.variant_name) parts.push(item.variant_name)
  if (item.size) parts.push(`Talla ${item.size}`)
  const variant = parts.join(' / ') || 'Única'
  return `${item.name} (${variant})`
}

export const formatWhatsAppMessage = (cartItems) => {
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const lines = cartItems.map(
    (item) =>
      `• ${item.quantity}x ${formatVariant(item)} - $${(item.price * item.quantity).toFixed(2)}`
  )

  const message = [
    '🌹 *PEDIDO ELITE STORE* 🌹',
    '',
    '📦 *Mis productos:*',
    ...lines,
    '',
    `💰 *Total: $${total.toFixed(2)}*`,
    '',
    '📍 Por favor confirmar disponibilidad y forma de envío.',
    '¡Gracias! 💕',
  ].join('\n')

  return message
}

export const sendWhatsAppOrder = (cartItems) => {
  const message = formatWhatsAppMessage(cartItems)
  const encoded = encodeURIComponent(message)
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`, '_blank')
}

export const formatWhatsAppReceipt = (items, total, movementId) => {
  const lines = items.map(
    (item) =>
      `• ${item.quantity}x ${item.product.name} - ${formatVariantLabel(item.variant)} - $${(item.price * item.quantity).toFixed(2)}`
  )

  return [
    '🌹 *ELITE STORE - FACTURA* 🌹',
    '',
    `Factura: #${movementId.slice(0, 8)}`,
    `Fecha: ${new Date().toLocaleString()}`,
    '',
    '📦 *Productos:*',
    ...lines,
    '',
    `💰 *Total: $${total.toFixed(2)}*`,
    '',
    '¡Gracias por preferirnos! 💕',
  ].join('\n')
}

function formatVariantLabel(item) {
  const parts = []
  if (item.color) parts.push(item.color)
  if (item.variant_name) parts.push(item.variant_name)
  if (item.size) parts.push(`Talla ${item.size}`)
  return parts.join(' / ') || 'Única'
}
