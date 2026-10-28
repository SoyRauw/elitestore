// Arte de la giftcard basado en el diseño del PDF del diseñador.
// Frente: fondo floral + tarjeta blanca, con nombre y monto superpuestos.
// Reverso: patrón floral + panel blanco con QR, código y vencimiento.

const W = 856
const H = 540

const MAUVE = '#AC6174'
const DARK = '#221A1C'
const MUTED = '#7B5961'
const PINK_FALLBACK = '#F7CBD6'

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[char]))
}

function svgDoc(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`
}

function formatAmount(amount) {
  const value = Number(amount || 0)
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`
}

function fitFontSize(text, maxWidth, baseSize, factor = 0.57) {
  const length = Math.max(1, String(text || '').length)
  const estimated = length * baseSize * factor
  return estimated > maxWidth ? Math.max(10, (baseSize * maxWidth) / estimated) : baseSize
}

function background(image) {
  return `<rect width="${W}" height="${H}" fill="${PINK_FALLBACK}"/>` +
    (image
      ? `<image href="${image}" xlink:href="${image}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
      : '')
}

function fontFace(fontData) {
  if (!fontData) return ''
  return `<style>@font-face{font-family:'Chau Philomene One';src:url('${fontData}') format('truetype');font-weight:normal;font-style:normal;}</style>`
}

export function buildGiftCardFront({ amount, recipient, buyer, frontBg, fontData } = {}) {
  const nameX = 290
  const paraY = 286
  const deY = 339
  const maxNameWidth = 350
  const recipientSize = fitFontSize(recipient, maxNameWidth, 25)
  const buyerSize = fitFontSize(buyer, maxNameWidth, 25)
  const frontFont = "'Chau Philomene One', Arial, Helvetica, sans-serif"

  const amountValue = formatAmount(amount)
  const amountLine = `Monto de regalo: ${amountValue}`
  const amountFont = fitFontSize(amountLine, 320, 24, 0.6)
  const box = { x: 248, y: 370, w: 360, h: 54, r: 12 }

  return svgDoc(`
    ${fontFace(fontData)}
    ${background(frontBg)}
    ${recipient ? `<text x="${nameX}" y="${paraY}" font-family="${frontFont}" font-weight="700" font-size="${recipientSize}" fill="${DARK}">${escapeXml(recipient)}</text>` : ''}
    ${buyer ? `<text x="${nameX}" y="${deY}" font-family="${frontFont}" font-weight="700" font-size="${buyerSize}" fill="${DARK}">${escapeXml(buyer)}</text>` : ''}
    <rect x="${box.x + 3}" y="${box.y + 3}" width="${box.w}" height="${box.h}" rx="${box.r}" fill="#000000" opacity="0.06"/>
    <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${box.r}" fill="#FFFFFF" stroke="${MAUVE}" stroke-width="2.5"/>
    <text x="${W / 2}" y="404" text-anchor="middle" font-family="${frontFont}" font-size="${amountFont}" fill="${MAUVE}">Monto de regalo: <tspan font-weight="800">${escapeXml(amountValue)}</tspan></text>
    <text x="${W / 2}" y="452" text-anchor="middle" font-family="${frontFont}" font-size="16.5" fill="${MAUVE}">Válido para canjear solo en Élite Store</text>
  `)
}

export function buildGiftCardBack({ code, expires, qr, backBg, brand = 'Élite Store' } = {}) {
  const panel = { x: 256, y: 78, w: 344, h: 432, r: 30 }
  const qrSize = 252
  const qrX = (W - qrSize) / 2
  const qrY = 118
  const expirationDate = expires ? new Date(expires) : null
  const expiration = expirationDate && !Number.isNaN(expirationDate.getTime())
    ? expirationDate.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sin vencimiento'

  return svgDoc(`
    ${background(backBg)}
    <rect x="${panel.x - 5}" y="${panel.y - 5}" width="${panel.w + 10}" height="${panel.h + 10}" rx="${panel.r + 5}" fill="#000000" opacity="0.10"/>
    <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="${panel.r}" fill="#FFFFFF"/>
    ${qr ? `<image href="${qr}" xlink:href="${qr}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>` : ''}
    <text x="${W / 2}" y="425" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="23" font-weight="700" letter-spacing="1.5" fill="${MAUVE}">${escapeXml(code || '')}</text>
    <text x="${W / 2}" y="462" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="600" fill="${MUTED}">Canjeable en ${escapeXml(brand)}</text>
    <text x="${W / 2}" y="487" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12.5" fill="${MUTED}">${escapeXml(expiration)} · Un solo uso</text>
  `)
}

export function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export async function svgToPngDataUrl(svg, width, height) {
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = svgToDataUrl(svg)
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

/**
 * Convierte el SVG a JPEG. jsPDF inserta el JPEG tal cual (DCTDecode),
 * sin descomprimir/recomprimir píxeles como hace con PNG. Eso evita que
 * el PDF pese decenas de MB.
 */
export async function svgToJpegDataUrl(svg, width, height, quality = 0.93) {
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = svgToDataUrl(svg)
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // JPEG no tiene transparencia: fondo blanco por si acaso.
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}
