import QRCode from 'qrcode'

/**
 * Gift cards: código único + QR, venta (movimiento 'giftcard') y uso como
 * método de pago en el POS. Vive en Elite (autoridad) y se comparte con USA.
 */

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function segment(length = 4) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return out
}

export function generateGiftCode() {
  return `GIFT-${segment()}-${segment()}`
}

export function normalizeGiftCode(code) {
  return (code || '').toUpperCase().trim()
}

export function isExpired(card) {
  if (!card?.expires_at) return false
  return new Date(card.expires_at).getTime() < Date.now()
}

/** estado efectivo: activa | vencida | usada | anulada */
export function effectiveStatus(card) {
  if (!card) return '—'
  if (card.status === 'activa' && isExpired(card)) return 'vencida'
  return card.status
}

export function statusLabel(card) {
  const s = effectiveStatus(card)
  const map = { activa: 'Activa', usada: 'Usada', anulada: 'Anulada', vencida: 'Vencida' }
  return map[s] || s
}

/** Badge global (badge-success/warning/danger/info/secondary) */
export function statusBadge(card) {
  switch (effectiveStatus(card)) {
    case 'activa': return 'badge-success'
    case 'vencida': return 'badge-warning'
    case 'usada': return 'badge-info'
    case 'anulada': return 'badge-danger'
    default: return 'badge-secondary'
  }
}

export async function giftQrDataUrl(code, size = 512) {
  return QRCode.toDataURL(normalizeGiftCode(code), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#3D2B2B', light: '#FFFFFF' },
  })
}

export function formatMoney(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

export function formatExpiry(expiresAt) {
  if (!expiresAt) return 'Sin vencimiento'
  return new Date(expiresAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })
}
