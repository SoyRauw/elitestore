import { lazy, Suspense } from 'react'
import 'yet-another-react-lightbox/styles.css'

const LazyLightbox = lazy(async () => {
  const [{ default: Lightbox }, { default: Zoom }] = await Promise.all([
    import('yet-another-react-lightbox'),
    import('yet-another-react-lightbox/plugins/zoom'),
  ])

  function Wrapped(props) {
    return (
      <Lightbox
        plugins={[Zoom]}
        zoom={{
          maxZoomPixelRatio: 4,
          zoomInMultiplier: 2,
          doubleTapDelay: 300,
          scrollToZoom: true,
        }}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true }}
        animation={{ swipe: 280 }}
        {...props}
      />
    )
  }

  return { default: Wrapped }
})

/**
 * Lightbox de imágenes con zoom (pinch en móvil, rueda/botones en PC),
 * arrastre y deslizamiento entre todas las fotos del producto.
 * Se carga diferido: la librería solo se descarga al abrir la primera foto.
 */
export default function ImageLightbox({ open, index = 0, images = [], alt = '', onClose }) {
  if (!open || !images?.length) return null

  return (
    <Suspense fallback={null}>
      <LazyLightbox
        open={open}
        close={onClose}
        index={Math.min(Math.max(0, index), images.length - 1)}
        slides={images.map((src) => ({ src, alt }))}
      />
    </Suspense>
  )
}
