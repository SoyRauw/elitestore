// Arte vectorial (SVG) de la giftcard — estilo tarjeta de regalo rosa.
// Se reutiliza para pantalla, impresión y PDF.

const W = 856
const H = 540

const MAUVE = '#C4788A'
const MAUVE_DARK = '#B5697C'
const PINK = '#EFA9BC'
const PINK_LIGHT = '#F7CBD6'
const PINK_DARK = '#E08CA3'
const STRIPE_A = '#FAE0E7'
const STRIPE_B = '#FDF0F4'

function escapeXml(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
}

function waveLine(y, amp = 12, seg = 46) {
  let d = `M -24 ${y}`
  let x = -24
  let up = true
  while (x < W + 24) {
    const nx = x + seg
    d += ` Q ${x + seg / 2} ${up ? y - amp : y + amp} ${nx} ${y}`
    x = nx
    up = !up
  }
  return d
}

function stripesBg() {
  let out = ''
  let i = 0
  for (let y = -24; y < H + 26; y += 38) {
    out += `<path d="${waveLine(y)}" fill="none" stroke="${i % 2 ? STRIPE_A : STRIPE_B}" stroke-width="22"/>`
    i++
  }
  return out
}

function wavySide(x1, y1, x2, y2, n, amp, ox, oy) {
  const ddx = (x2 - x1) / n
  const ddy = (y2 - y1) / n
  let d = ''
  for (let i = 0; i < n; i++) {
    const sx = x1 + ddx * i
    const sy = y1 + ddy * i
    const ex = x1 + ddx * (i + 1)
    const ey = y1 + ddy * (i + 1)
    const s = i % 2 === 0 ? 1 : -1
    d += ` Q ${(sx + ex) / 2 + ox * amp * s} ${(sy + ey) / 2 + oy * amp * s} ${ex} ${ey}`
  }
  return d
}

function scallopRect(x, y, w, h, seg = 46, amp = 5) {
  const nTop = Math.max(6, Math.round(w / seg))
  const nSide = Math.max(6, Math.round(h / seg))
  return `M ${x} ${y}` +
    wavySide(x, y, x + w, y, nTop, amp, 0, -1) +
    wavySide(x + w, y, x + w, y + h, nSide, amp, 1, 0) +
    wavySide(x + w, y + h, x, y + h, nTop, amp, 0, 1) +
    wavySide(x, y + h, x, y, nSide, amp, -1, 0) +
    ' Z'
}

function bow(cx, cy, s = 1) {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <path d="M -3 2 C -50 -34 -96 -26 -82 8 C -71 36 -28 24 -3 2 Z" fill="${PINK}"/>
    <path d="M -8 -1 C -42 -22 -74 -16 -64 5 C -57 21 -25 12 -8 -1 Z" fill="${PINK_LIGHT}" opacity="0.85"/>
    <path d="M 3 2 C 50 -34 96 -26 82 8 C 71 36 28 24 3 2 Z" fill="${PINK}"/>
    <path d="M 8 -1 C 42 -22 74 -16 64 5 C 57 21 25 12 8 -1 Z" fill="${PINK_LIGHT}" opacity="0.85"/>
    <path d="M -9 7 C -26 46 -46 70 -72 90 C -50 84 -34 73 -21 58 C -25 75 -33 90 -46 104 C -21 90 -3 64 7 44 Z" fill="${PINK}"/>
    <path d="M 9 7 C 26 46 46 70 72 90 C 50 84 34 73 21 58 C 25 75 33 90 46 104 C 21 90 3 64 -7 44 Z" fill="${PINK_LIGHT}"/>
    <ellipse cx="0" cy="3" rx="13" ry="10" fill="${PINK_DARK}"/>
  </g>`
}

function field(label, value, y, labelEndX, lineW) {
  const lineX = labelEndX + 14
  return `
    <text x="${labelEndX}" y="${y}" text-anchor="end" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="#FFFFFF">${escapeXml(label)}</text>
    <line x1="${lineX}" y1="${y + 6}" x2="${lineX + lineW}" y2="${y + 6}" stroke="#FFFFFF" stroke-opacity="0.9" stroke-width="2"/>
    ${value ? `<text x="${lineX + 8}" y="${y - 1}" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="27" fill="#FFFFFF">${escapeXml(value)}</text>` : ''}
  `
}

function svgDoc(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`
}

function logoTag(logoData, x, y, size) {
  if (!logoData) return ''
  return `<image href="${logoData}" xlink:href="${logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
}

function logoChip(logoData, x, y, size, radius = 16) {
  if (!logoData) return ''
  const pad = Math.round(size * 0.12)
  return `
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="#FFFFFF" fill-opacity="0.94"/>
    ${logoTag(logoData, x + pad, y + pad, size - pad * 2)}
  `
}

function formatAmount(amount) {
  const n = Number(amount || 0)
  return Number.isInteger(n) ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`
}

export function buildGiftCardFront({ amount, recipient, buyer, brand = 'Élite Store', logoData } = {}) {
  const cx = 428
  const card = { x: 52, y: 42, w: 752, h: 456 }
  const amountText = `Monto de regalo: ${formatAmount(amount)}`
  return svgDoc(`
    ${stripesBg()}
    <path d="${scallopRect(card.x, card.y, card.w, card.h)}" fill="${MAUVE}"/>
    ${bow(cx, card.y + 10, 0.9)}
    ${logoChip(logoData, 76, 58, 74)}
    <text x="${cx}" y="212" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="82" letter-spacing="6" fill="#FFFFFF">GIFT CARD</text>
    ${field('Para:', recipient, 302, 372, 380)}
    ${field('De:', buyer, 354, 372, 380)}
    <rect x="248" y="384" width="360" height="52" rx="5" fill="#FFFFFF"/>
    <text x="${cx}" y="419" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="${MAUVE_DARK}">${escapeXml(amountText)}</text>
    <text x="${cx}" y="478" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="25" fill="#FFFFFF">Válido para canjear solo en ${escapeXml(brand)}</text>
  `)
}

export function buildGiftCardBack({ code, expires, brand = 'Élite Store', qr, logoData } = {}) {
  const cx = 428
  const card = { x: 52, y: 42, w: 752, h: 456 }
  const exp = expires
    ? new Date(expires).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Sin vencimiento'
  return svgDoc(`
    ${stripesBg()}
    <path d="${scallopRect(card.x, card.y, card.w, card.h)}" fill="${MAUVE}"/>
    ${logoChip(logoData, cx - 37, 56, 74, 37)}
    <text x="${cx}" y="158" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="38" letter-spacing="3" fill="#FFFFFF">${escapeXml(brand.toUpperCase())}</text>
    <rect x="${cx - 107}" y="176" width="214" height="214" rx="12" fill="#FFFFFF"/>
    ${qr ? `<image href="${qr}" xlink:href="${qr}" x="${cx - 95}" y="188" width="190" height="190"/>` : ''}
    <text x="${cx}" y="424" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="30" letter-spacing="2" fill="#FFFFFF">${escapeXml(code || '')}</text>
    <text x="${cx}" y="458" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="#FFFFFF">Presenta este código en caja</text>
    <text x="${cx}" y="484" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="#FFFFFF">Vence: ${escapeXml(exp)} · Un solo uso</text>
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
