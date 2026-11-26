import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { useCartStore } from './store/cartStore'
import './styles/variables.css'
import './styles/globals.css'
import './lib/firebase'

// Fuerza la hidratación del carrito guardado en localStorage.
// Zustand 5 no siempre completa la hidratación automática en producción.
useCartStore.persist?.rehydrate?.()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
