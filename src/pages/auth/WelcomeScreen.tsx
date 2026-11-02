import { BRAND_SLOGAN, LOGO_DOCA_LIVRE_SRC } from '../../lib/brandAssets'

type Props = {
  onLogin: () => void
  onRegister: () => void
  onDemoEmpresa: () => void
}

export function WelcomeScreen({ onLogin, onRegister, onDemoEmpresa }: Props) {
  return (
    <div className="auth-screen">
      <div className="auth-card auth-card--wide">
        <img src={LOGO_DOCA_LIVRE_SRC} alt="Doca Livre" className="auth-logo" />
        <h1 className="auth-title">fazumfreela</h1>
        <p className="auth-slogan">{BRAND_SLOGAN}</p>
        <button type="button" className="demo-login-btn demo-login-btn--primary" onClick={onDemoEmpresa}>
          <strong>Abrir Painel Empresa (demo PX)</strong>
          <span>Contratos, Prestadores, Campanhas, Modelos…</span>
        </button>
        <div className="auth-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onLogin}>
            Entrar
          </button>
          <button type="button" className="btn btn-accent btn-block" onClick={onRegister}>
            Criar conta
          </button>
        </div>
      </div>
    </div>
  )
}
