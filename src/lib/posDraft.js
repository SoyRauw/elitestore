// Borrador local de la venta en curso del POS.
// Se guarda por usuario para que dos vendedores no compartan el mismo carrito.

const KEY_PREFIX = 'elite:pos:draft:v1:'
const DRAFT_VERSION = 1
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function storageAvailable() {
  return typeof window !== 'undefined' && !!window.localStorage
}

export function posDraftKey(userId) {
  return `${KEY_PREFIX}${userId}`
}

export function loadPosDraft(userId) {
  if (!userId || !storageAvailable()) return null

  try {
    const raw = window.localStorage.getItem(posDraftKey(userId))
    if (!raw) return null

    const draft = JSON.parse(raw)
    if (!draft || draft.version !== DRAFT_VERSION) {
      window.localStorage.removeItem(posDraftKey(userId))
      return null
    }

    const savedAt = draft.savedAt ? new Date(draft.savedAt).getTime() : 0
    if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(posDraftKey(userId))
      return null
    }

    if (!Array.isArray(draft.items) || !Array.isArray(draft.payments)) return null
    if (draft.customer && typeof draft.customer !== 'object') return null
    if (draft.paymentDrafts && typeof draft.paymentDrafts !== 'object') return null

    return draft
  } catch (error) {
    console.error('No se pudo leer la venta en curso:', error)
    return null
  }
}

export function savePosDraft(userId, draft) {
  if (!userId || !storageAvailable()) return

  try {
    window.localStorage.setItem(
      posDraftKey(userId),
      JSON.stringify({
        ...draft,
        version: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
      })
    )
  } catch (error) {
    // Si el navegador no deja guardar, la venta sigue funcionando en memoria.
    console.error('No se pudo guardar la venta en curso:', error)
  }
}

export function clearPosDraft(userId) {
  if (!userId || !storageAvailable()) return

  try {
    window.localStorage.removeItem(posDraftKey(userId))
  } catch (error) {
    console.error('No se pudo borrar la venta en curso:', error)
  }
}

export function posDraftHasContent(draft) {
  if (!draft) return false

  const customer = draft.customer || {}
  return (
    (draft.items || []).length > 0 ||
    (draft.payments || []).length > 0 ||
    Object.keys(draft.paymentDrafts || {}).length > 0 ||
    !!String(customer.id_number || '').trim() ||
    !!String(customer.name || '').trim() ||
    !!String(customer.phone || '').trim()
  )
}
