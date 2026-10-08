import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import logo from '../../assets/logo.png'
import { giftQrDataUrl, normalizeGiftCode, formatMoney, formatExpiry } from '../../lib/giftcards'
import styles from './GiftCardView.module.css'

function urlToDataUrl(url) {
  return fetch(url)
    .then((r) => r.blob())
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    }))
}

async function loadAssets(card) {
  const [qr, logoData] = await Promise.all([
    giftQrDataUrl(card?.code || '', 600),
    urlToDataUrl(logo).catch(() => null),
  ])
  return { qr, logoData }
}

export default function GiftCardView({ card }) {
  const [qr, setQr] = useState('')
  useEffect(() => {
    let alive = true
    giftQrDataUrl(card?.code || '', 320).then((d) => { if (alive) setQr(d) }).catch(() => {})
    return () => { alive = false }
  }, [card?.code])

  const c = card || {}
  return (
    <div className={styles.wrap}>
      <div className={styles.cardFront}>
        <div className={styles.frontTop}>
          <img src={logo} alt="Elite Store" className={styles.logo} />
          <div>
            <div className={styles.brandName}>Elite Store</div>
            <div className={styles.brandSub}>Tarjeta de Regalo</div>
          </div>
        </div>
        {c.recipient_name && (
          <div className={styles.recipient}>Para: <strong>{c.recipient_name}</strong></div>
        )}
        <div className={styles.amount}>{formatMoney(c.amount)}</div>
        <div className={styles.frontBottom}>
          <div className={styles.codeBox}>
            <span className={styles.codeLabel}>Código</span>
            <span className={styles.code}>{normalizeGiftCode(c.code)}</span>
          </div>
          <div className={styles.qrBox}>
            {qr ? <img src={qr} alt="QR" className={styles.qr} /> : <div className={styles.qrPlaceholder} />}
          </div>
        </div>
      </div>

      <div className={styles.cardBack}>
        <div className={styles.backHeader}>
          <img src={logo} alt="Elite Store" className={styles.logoSmall} />
          <span className={styles.brandNameSmall}>Elite Store</span>
        </div>
        <p className={styles.how}>Presenta este código en caja para usar tu saldo.</p>
        <ul className={styles.terms}>
          <li>Un solo uso por el monto total de la tarjeta.</li>
          <li>El excedente queda como saldo a favor en tu cuenta.</li>
          <li>Vence: <strong>{formatExpiry(c.expires_at)}</strong></li>
        </ul>
        <div className={styles.backCode}>{normalizeGiftCode(c.code)}</div>
        <div className={styles.backFooter}>@elitestoremcbo_ · Gracias por tu compra</div>
      </div>
    </div>
  )
}

function cardFrontHtml(c, qr, logoData) {
  return `
    <div class="card front">
      <div class="row">
        ${logoData ? `<img class="logo" src="${logoData}" />` : ''}
        <div>
          <div class="brand">ELITE STORE</div>
          <div class="brandsub">Tarjeta de Regalo</div>
        </div>
      </div>
      ${c.recipient_name ? `<div class="recipient">Para: ${c.recipient_name}</div>` : ''}
      <div class="amount">${formatMoney(c.amount)}</div>
      <div class="bottom">
        <div>
          <div class="codelabel">CÓDIGO</div>
          <div class="code">${normalizeGiftCode(c.code)}</div>
        </div>
        ${qr ? `<img class="qr" src="${qr}" />` : ''}
      </div>
    </div>`
}

function cardBackHtml(c, logoData) {
  return `
    <div class="card back">
      <div class="row">
        ${logoData ? `<img class="logosm" src="${logoData}" />` : ''}
        <div class="brandsm">Elite Store</div>
      </div>
      <p class="how">Presenta este código en caja para usar tu saldo.</p>
      <ul class="terms">
        <li>Un solo uso por el monto total de la tarjeta.</li>
        <li>El excedente queda como saldo a favor en tu cuenta.</li>
        <li>Vence: <b>${formatExpiry(c.expires_at)}</b></li>
      </ul>
      <div class="codebig">${normalizeGiftCode(c.code)}</div>
      <div class="foot">@elitestoremcbo_ · Gracias por tu compra</div>
    </div>`
}

const CARD_CSS = `
  * { box-sizing: border-box; }
  @page { size: 85.6mm 54mm; margin: 0; }
  body { margin: 0; }
  .card { width: 85.6mm; height: 54mm; padding: 5mm; font-family: Georgia, 'Times New Roman', serif; position: relative; overflow: hidden; page-break-after: always; }
  .front { background: linear-gradient(135deg, #2b1f1f 0%, #3D2B2B 55%, #1f1414 100%); color: #FDF6F0; }
  .back { background: #FDF6F0; color: #3D2B2B; }
  .row { display: flex; align-items: center; gap: 3mm; }
  .logo { width: 12mm; height: 12mm; object-fit: contain; }
  .logosm { width: 7mm; height: 7mm; object-fit: contain; }
  .brand { font-size: 13pt; font-weight: 700; letter-spacing: 1.5px; color: #D4A017; }
  .brandsm { font-size: 10pt; font-weight: 700; letter-spacing: 1px; color: #3D2B2B; }
  .brandsub { font-size: 7pt; letter-spacing: 2px; text-transform: uppercase; color: #e8d9b5; }
  .recipient { margin-top: 2mm; font-size: 8pt; color: #e8d9b5; }
  .amount { margin-top: 1.5mm; font-size: 26pt; font-weight: 700; color: #D4A017; }
  .bottom { position: absolute; left: 5mm; right: 5mm; bottom: 4mm; display: flex; justify-content: space-between; align-items: flex-end; }
  .codelabel { font-size: 5.5pt; letter-spacing: 2px; color: #e8d9b5; }
  .code { font-family: ui-monospace, Consolas, monospace; font-size: 10pt; letter-spacing: 1px; color: #FDF6F0; }
  .qr { width: 16mm; height: 16mm; background: #fff; padding: 1mm; border-radius: 1.5mm; }
  .how { margin: 3mm 0 2mm; font-size: 8pt; }
  .terms { margin: 0; padding-left: 4mm; font-size: 7pt; line-height: 1.5; }
  .codebig { margin-top: 2mm; font-family: ui-monospace, Consolas, monospace; font-size: 9pt; text-align: center; letter-spacing: 1px; color: #3D2B2B; }
  .foot { position: absolute; left: 0; right: 0; bottom: 3mm; text-align: center; font-size: 6.5pt; color: #8a6d3b; }
`

export async function printGiftCard(card) {
  const { qr, logoData } = await loadAssets(card)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gift Card</title><style>${CARD_CSS}</style></head><body>${cardFrontHtml(card, qr, logoData)}${cardBackHtml(card, logoData)}</body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-9999px'
  iframe.style.left = '-9999px'
  iframe.style.width = '100%'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.style.opacity = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow.document
  doc.open(); doc.write(html); doc.close()
  const doPrint = () => { iframe.contentWindow.focus(); iframe.contentWindow.print() }
  if (iframe.contentWindow.document.readyState === 'complete') doPrint()
  else iframe.onload = doPrint
  setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 60000)
}

export async function downloadGiftCardPdf(card) {
  const { qr, logoData } = await loadAssets(card)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // Frente
  doc.setFillColor(43, 31, 31)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(61, 43, 43)
  doc.rect(0, H * 0.35, W, H * 0.65, 'F')
  doc.setDrawColor(212, 160, 23)
  doc.setLineWidth(0.6)
  doc.rect(1.5, 1.5, W - 3, H - 3)
  if (logoData) { try { doc.addImage(logoData, 'PNG', 6, 5, 11, 11) } catch { /* ignore */ } }
  doc.setTextColor(212, 160, 23)
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.text('ELITE STORE', 20, 11)
  doc.setFontSize(8)
  doc.setTextColor(232, 217, 181)
  doc.text('TARJETA DE REGALO', 20, 15)
  if (card.recipient_name) {
    doc.setFontSize(9)
    doc.setTextColor(232, 217, 181)
    doc.text(`Para: ${card.recipient_name}`, 6, 23)
  }
  doc.setFontSize(26)
  doc.setTextColor(212, 160, 23)
  doc.text(formatMoney(card.amount), 6, 32)
  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(253, 246, 240)
  doc.text(normalizeGiftCode(card.code), 6, H - 6)
  if (qr) { try { doc.addImage(qr, 'PNG', W - 22, H - 22, 16, 16) } catch { /* ignore */ } }

  // Reverso
  doc.addPage([85.6, 54], 'landscape')
  doc.setFillColor(253, 246, 240)
  doc.rect(0, 0, W, H, 'F')
  doc.setDrawColor(212, 160, 23)
  doc.rect(1.5, 1.5, W - 3, H - 3)
  if (logoData) { try { doc.addImage(logoData, 'PNG', 6, 5, 7, 7) } catch { /* ignore */ } }
  doc.setTextColor(61, 43, 43)
  doc.setFont('times', 'bold')
  doc.setFontSize(10)
  doc.text('Elite Store', 15, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Presenta este código en caja para usar tu saldo.', 6, 20)
  doc.setFontSize(7)
  doc.text('• Un solo uso por el monto total de la tarjeta.', 6, 26)
  doc.text('• El excedente queda como saldo a favor en tu cuenta.', 6, 30)
  doc.text(`• Vence: ${formatExpiry(card.expires_at)}`, 6, 34)
  doc.setFont('courier', 'bold')
  doc.setFontSize(9)
  doc.text(normalizeGiftCode(card.code), W / 2, 42, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(138, 109, 59)
  doc.text('@elitestoremcbo_ · Gracias por tu compra', W / 2, H - 4, { align: 'center' })

  doc.save(`GiftCard-${normalizeGiftCode(card.code) || 'elite'}.pdf`)
}
