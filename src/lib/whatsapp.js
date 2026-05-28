const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '584246594559'

export const formatWhatsAppMessage = (cartItems) => {
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const lines = cartItems.map(
    (item) =>
      `• ${item.quantity}x ${item.name} - Talla ${item.size} - $${(item.price * item.quantity).toFixed(2)}`
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
