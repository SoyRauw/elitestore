import { useEffect, useId, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Camera, X } from 'lucide-react'
import styles from './CodeScannerModal.module.css'

export default function CodeScannerModal({ title = 'Escanear código', onResult, onClose }) {
  const elementId = useId().replace(/[:]/g, '_')
  const scannerRef = useRef(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      elementId,
      { fps: 10, qrbox: { width: 240, height: 240 }, formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      false
    )
    scannerRef.current = scanner
    scanner.render(
      (res) => { scanner.clear().catch(() => {}); onResult(res) },
      () => {}
    )
    return () => { scanner.clear().catch(() => {}) }
  }, [elementId, onResult])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3><Camera size={18} /> {title}</h3>
          <button type="button" className={styles.close} onClick={onClose}><X size={18} /></button>
        </div>
        <p className={styles.hint}>Apunta la cámara al código QR</p>
        <div id={elementId} className={styles.reader} />
      </div>
    </div>
  )
}
