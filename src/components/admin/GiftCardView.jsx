import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import logo from '../../assets/logo.png'
import { giftQrDataUrl, normalizeGiftCode } from '../../lib/giftcards'
import {
  buildGiftCardFront,
  buildGiftCardBack,
  svgToDataUrl,
  svgToPngDataUrl,
} from './giftCardArt'
import styles from './GiftCardView.module.css'

const BRAND = 'Élite Store'

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
    giftQrDataUrl(card?.code || '', 700),
    urlToDataUrl(logo).catch(() => null),
  ])
  return { qr, logoData }
}

function dataFor(card) {
  return {
    amount: card?.amount,
    recipient: card?.recipient_name,
    buyer: card?.buyer_name,
    code: normalizeGiftCode(card?.code),
    expires: card?.expires_at,
    brand: BRAND,
  }
}

export default function GiftCardView({ card }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  useEffect(() => {
    let alive = true
    loadAssets(card)
      .then(({ qr, logoData }) => {
        if (!alive) return
        const d = dataFor(card)
        setFront(svgToDataUrl(buildGiftCardFront({ ...d, logoData })))
        setBack(svgToDataUrl(buildGiftCardBack({ ...d, qr, logoData })))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [card?.code, card?.amount, card?.recipient_name, card?.buyer_name, card?.expires_at])

  return (
    <div className={styles.wrap}>
      {front && <img className={styles.cardArt} src={front} alt="Gift card frente" />}
      {back && <img className={styles.cardArt} src={back} alt="Gift card reverso" />}
    </div>
  )
}

export async function printGiftCard(card) {
  const { qr, logoData } = await loadAssets(card)
  const d = dataFor(card)
  const front = buildGiftCardFront({ ...d, logoData })
  const back = buildGiftCardBack({ ...d, qr, logoData })

  const html = `<!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>Gift Card</title>
    <style>
      @page { size: 85.6mm 54mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      svg { width: 85.6mm; height: 54mm; display: block; page-break-after: always; }
    </style></head>
    <body>${front}${back}</body></html>`

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
  const d = dataFor(card)
  const front = buildGiftCardFront({ ...d, logoData })
  const back = buildGiftCardBack({ ...d, qr, logoData })

  const scale = 3
  const [pngFront, pngBack] = await Promise.all([
    svgToPngDataUrl(front, 856 * scale, 540 * scale),
    svgToPngDataUrl(back, 856 * scale, 540 * scale),
  ])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] })
  doc.addImage(pngFront, 'PNG', 0, 0, 85.6, 54)
  doc.addPage([85.6, 54], 'landscape')
  doc.addImage(pngBack, 'PNG', 0, 0, 85.6, 54)
  doc.save(`GiftCard-${normalizeGiftCode(card?.code) || 'gift'}.pdf`)
}
