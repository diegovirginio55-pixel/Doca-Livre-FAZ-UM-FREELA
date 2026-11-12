import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './mobile.css'
// Tema no padrão do WMS Doca Livre: por último, para valer sobre os estilos de cada tela.
import './tema-docalivre.css'

const TelaMapaTokens = lazy(() => import('./pages/mapaTokens/TelaMapaTokens'))
const naTelaDeTokens = window.location.pathname.replace(/\/+$/, '') === '/mapa-tokens'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {naTelaDeTokens ? (
      <Suspense fallback={null}>
        <TelaMapaTokens />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          void reg.update()
        })
        .catch(() => {
          /* o registro é opcional para a instalação */
        })
    })
  } else {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister()
    })
  }
}
