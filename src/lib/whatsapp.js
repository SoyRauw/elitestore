export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '584226594559'

const STORE_LABELS = {
  elite: 'Women',
  usa: 'USA Super Store',
  men: "Elite Store Men's",
}

const STORE_EMOJIS = {
  elite: '👗',
  usa: '🇺🇸',
  men: '👔',
}

const formatVariant = (item) => {
  const parts = []
  if (item.color) parts.push(item.color)
  if (item.variant_name) parts.push(item.variant_name)
  if (item.size) parts.push(`${item.size_label || 'Talla'} ${item.size}`)
  const variant = parts.join(' / ') || 'Única'
  return `${item.name} (${variant})`
}

export const formatWhatsAppMessage = (cartItems) => {
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const groups = new Map()
  cartItems.forEach((item) => {
    const storeId = item.store_id || 'elite'
    if (!groups.has(storeId)) groups.set(storeId, [])
    groups.get(storeId).push(item)
  })

  const lines = []
  groups.forEach((items, storeId) => {
    lines.push(`${STORE_EMOJIS[storeId] || '🛍️'} *${STORE_LABELS[storeId] || 'Elite Store'}*`)
    items.forEach((item) => {
      lines.push(
        `• ${item.quantity}x ${formatVariant(item)} - $${(item.price * item.quantity).toFixed(2)}`
      )
    })
    lines.push('')
  })

  const message = [
    '🛍️ *PEDIDO ELITE STORE*',
    '',
    '📦 *Mis productos:*',
    ...lines,
    `💰 *Total: $${total.toFixed(2)}*`,
    '',
    '📍 Por favor confirmar disponibilidad y forma de entrega.',
    '¡Gracias! ✨',
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
  if (item.size) parts.push(`${item.size_label || 'Talla'} ${item.size}`)
  return parts.join(' / ') || 'Única'
}
