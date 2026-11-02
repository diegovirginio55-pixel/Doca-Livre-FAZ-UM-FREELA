import { useState } from 'react'
import { usePwaInstall } from './usePwaInstall'
import './pwa.css'

export function PwaInstallBanner() {
  const { canInstall, isIosSafari, isAndroidChrome, isDesktopChrome, installed, dismissed, promptInstall, dismiss } =
    usePwaInstall()
  const [showHelp, setShowHelp] = useState(false)

  if (installed || dismissed) return null
  if (!canInstall && !isIosSafari && !isAndroidChrome && !isDesktopChrome) return null

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Instalar aplicativo">
      <div className="pwa-install-icon" aria-hidden>
        <img src="/icon-192.png" alt="" width={40} height={40} />
      </div>
      <div className="pwa-install-text">
        <strong>Instalar o fazumfreela</strong>
        <span>Adicione o app à tela inicial para abrir em tela cheia, como um aplicativo.</span>
        {showHelp && isIosSafari && (
          <span className="pwa-install-help">
            Toque em Compartilhar e depois em “Adicionar à Tela de Início”.
          </span>
        )}
        {showHelp && isAndroidChrome && !canInstall && (
          <span className="pwa-install-help">
            Toque nos três pontos do Chrome e escolha “Instalar app” ou “Adicionar à tela inicial”.
          </span>
        )}
        {showHelp && isDesktopChrome && !canInstall && (
          <span className="pwa-install-help">
            Clique no ícone de instalação na barra de endereço ou no menu do Chrome em “Instalar página como app”.
          </span>
        )}
      </div>
      <div className="pwa-install-actions">
        {canInstall ? (
          <button type="button" className="pwa-install-btn" onClick={() => void promptInstall()}>
            Instalar
          </button>
        ) : (
          <button type="button" className="pwa-install-btn" onClick={() => setShowHelp((valor) => !valor)}>
            Como instalar
          </button>
        )}
        <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Dispensar">
          ×
        </button>
      </div>
    </div>
  )
}
