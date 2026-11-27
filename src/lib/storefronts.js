import womenLogo from '../assets/logo.png'
import womenLogoLight from '../assets/portal/women-logo-cream.png'
import menLogoLight from '../assets/portal/men-logo-light.png'
import menMarkLight from '../assets/portal/men-mark-light.png'
import menMarkDark from '../assets/portal/men-mark-dark.png'
import usaLogo from '../assets/portal/usa-logo.webp'

/**
 * Configuración de cada tienda pública.
 * Las rutas de Women se mantienen (/catalog y /product/:id) para no romper SEO.
 */
export const STOREFRONTS = {
  elite: {
    id: 'elite',
    theme: 'women',
    fullName: 'Elite Store Women',
    shortName: 'Women',
    navTitle: null,
    homePath: '/women',
    catalogPath: '/catalog',
    productPath: (id) => `/product/${id}`,
    catalogTitle: 'Colección',
    catalogSubtitle: 'Elegancia que te abraza',
    catalogSeoTitle: 'Catálogo | Elite Store',
    catalogSeoDescription:
      'Explora el catálogo de Elite Store: pijamas, conjuntos, blusas, calzado y accesorios elegantes para damas.',
    footerTitle: 'Elite Store',
    footerDescription:
      'Elegancia en tu día a día. Moda, tendencias y accesorios para ti.',
    navLinks: [
      { to: '/women', label: 'Inicio' },
      { to: '/catalog', label: 'Catálogo' },
      { to: '/nosotros', label: 'Nosotros' },
      { to: '/', label: 'Tiendas' },
    ],
    footerLinks: [
      { to: '/women', label: 'Inicio' },
      { to: '/catalog', label: 'Catálogo' },
      { to: '/nosotros', label: 'Nosotros' },
      { to: '/', label: 'Tiendas' },
    ],
    logo: womenLogo,
    logoLight: womenLogoLight,
    navLogoHeight: 60,
    instagram: 'https://www.instagram.com/elitestoremcbo_/',
    instagramHandle: '@elitestoremcbo_',
    tiktok: 'https://www.tiktok.com/@elitestoremcbo_',
    tiktokHandle: '@elitestoremcbo_',
    accent: '#C4788A',
  },
  usa: {
    id: 'usa',
    theme: 'usa',
    fullName: 'USA Super Store',
    shortName: 'USA',
    navTitle: 'USA Super Store',
    homePath: '/usa',
    catalogPath: '/usa/catalog',
    productPath: (id) => `/usa/product/${id}`,
    catalogTitle: 'Catálogo USA',
    catalogSubtitle: 'La manera más fácil y económica',
    catalogSeoTitle: 'Catálogo USA | USA Super Store',
    catalogSeoDescription:
      'Compra comida, medicamentos, belleza, hogar y más en USA Super Store. Pide por WhatsApp y recibe fácil.',
    footerTitle: 'USA Super Store',
    footerDescription:
      'Comida, medicamentos, belleza y hogar. La manera más fácil y económica de comprar.',
    navLinks: [
      { to: '/usa', label: 'Inicio' },
      { to: '/usa/catalog', label: 'Catálogo' },
      { to: '/', label: 'Tiendas' },
    ],
    footerLinks: [
      { to: '/usa', label: 'Inicio' },
      { to: '/usa/catalog', label: 'Catálogo' },
      { to: '/', label: 'Tiendas' },
    ],
    logo: usaLogo,
    logoLight: usaLogo,
    navLogoHeight: 56,
    instagram: 'https://www.instagram.com/usasuperstoremcbo_/',
    instagramHandle: '@usasuperstoremcbo_',
    tiktok: null,
    tiktokHandle: null,
    accent: '#B91C1C',
  },
  men: {
    id: 'men',
    theme: 'men',
    fullName: "Elite Store Men's",
    shortName: 'Men',
    navTitle: "Elite Store Men's",
    homePath: '/men',
    catalogPath: null,
    productPath: null,
    catalogTitle: null,
    catalogSubtitle: null,
    catalogSeoTitle: null,
    catalogSeoDescription: null,
    footerTitle: "Elite Store Men's",
    footerDescription: 'Explora tu estilo. Muy pronto.',
    navLinks: [],
    footerLinks: [
      { to: '/men', label: 'Inicio' },
      { to: '/', label: 'Tiendas' },
    ],
    logo: menLogoLight,
    logoLight: menLogoLight,
    markLight: menMarkLight,
    markDark: menMarkDark,
    navLogoHeight: 64,
    instagram: 'https://www.instagram.com/elitestoremens/',
    instagramHandle: '@elitestoremens',
    tiktok: null,
    tiktokHandle: null,
    accent: '#3B6FE0',
  },
}

export const PORTAL_STORES = [
  {
    ...STOREFRONTS.elite,
    portalLabel: 'WOMEN',
    portalTagline: 'Elegancia en tu día a día',
    portalCta: 'Entrar',
    portalLogo: STOREFRONTS.elite.logoLight,
  },
  {
    ...STOREFRONTS.men,
    portalLabel: 'MEN',
    portalTagline: 'Explora tu estilo',
    portalCta: 'Ver más',
    portalLogo: STOREFRONTS.men.markLight,
    portalBadge: 'PRÓXIMAMENTE',
  },
  {
    ...STOREFRONTS.usa,
    portalLabel: 'USA SUPER STORE',
    portalTagline: 'Compra online y pide por WhatsApp',
    portalCta: 'Entrar',
    portalLogo: STOREFRONTS.usa.logo,
    portalBadge: 'NUEVO · ONLINE',
  },
]
