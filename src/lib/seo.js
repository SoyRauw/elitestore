import { useEffect, useMemo } from 'react'

export const SITE_URL = 'https://elitestoremcbo.web.app'
export const SITE_NAME = 'Elite Store'
export const DEFAULT_TITLE = 'Elite Store | Pijamas y ropa elegante para damas'
export const DEFAULT_DESCRIPTION =
  'Elite Store - Elegancia que te abraza. Pijamas, conjuntos y ropa elegante para damas. Envios a toda Venezuela.'
export const DEFAULT_IMAGE = `${SITE_URL}/logo.png`

function upsertMeta(attribute, key, content) {
  if (!content) return
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function upsertLink(rel, href) {
  if (!href) return
  let element = document.head.querySelector(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

function setJsonLd(data) {
  let element = document.getElementById('page-jsonld')
  if (!data) {
    element?.remove()
    return
  }
  if (!element) {
    element = document.createElement('script')
    element.type = 'application/ld+json'
    element.id = 'page-jsonld'
    document.head.appendChild(element)
  }
  element.textContent = data
}

export function absoluteUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function cleanText(value, maxLength = 160) {
  const text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

export function usePageMeta({
  title,
  description,
  image,
  path,
  type = 'website',
  noindex = false,
  jsonLd = null,
}) {
  const jsonLdString = useMemo(() => (jsonLd ? JSON.stringify(jsonLd) : ''), [jsonLd])

  useEffect(() => {
    const pageTitle = title || DEFAULT_TITLE
    const pageDescription = description || DEFAULT_DESCRIPTION
    const pageImage = image ? absoluteUrl(image) : DEFAULT_IMAGE
    const canonical = absoluteUrl(path || window.location.pathname)

    document.title = pageTitle
    upsertMeta('name', 'description', pageDescription)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    upsertLink('canonical', canonical)

    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:title', pageTitle)
    upsertMeta('property', 'og:description', pageDescription)
    upsertMeta('property', 'og:image', pageImage)
    upsertMeta('property', 'og:url', canonical)

    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', pageTitle)
    upsertMeta('name', 'twitter:description', pageDescription)
    upsertMeta('name', 'twitter:image', pageImage)

    setJsonLd(jsonLdString)

    return () => setJsonLd('')
  }, [title, description, image, path, type, noindex, jsonLdString])
}
