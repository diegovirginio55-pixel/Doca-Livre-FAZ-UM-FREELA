import { useState, type FormEvent } from 'react'
import { LOGO_DOCA_LIVRE_SRC } from '../../lib/brandAssets'
import { useStore } from '../../lib/store'

type Props = {
  onBack: () => void
  onSuccess: () => void
}

const DEMOS = [
  {
    label: 'Painel Empresa (estilo PX)',
    email: 'empresa@logexpress.com',
    senha: 'demo123',
    hint: 'Contratos, Prestadores, Campanhas…',
    primary: true,
  },
  {
    label: 'CD Cajamar (Empresa)',
    email: 'rh@cdcajamar.com',
    senha: 'demo123',
    hint: 'Outra empresa demo',
  },
  {
    label: 'Admin',
    email: 'admin@docalivre.com',
    senha: 'admin123',
    hint: 'Aprovação e auditoria',
  },
  {
    label: 'Profissional',
    email: 'carlos@email.com',
    senha: 'demo123',
    hint: 'App do prestador',
  },
]

export function LoginScreen({ onBack, onSuccess }: Props) {
  const { login } = useStore()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')

  async function doLogin(em: string, pass: string) {
    const res = await login(em.trim(), pass)
    if (!res.ok) {
      setError(res.error ?? 'Falha no login')
      return
    }
    onSuccess()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    doLogin(email, senha)
  }

  return (
    <div className="auth-screen auth-screen--scroll">
      <form className="auth-card auth-card--wide" onSubmit={handleSubmit}>
        <button type="button" className="btn btn-ghost link-back" onClick={onBack}>
          ← Voltar
        </button>
        <img src={LOGO_DOCA_LIVRE_SRC} alt="" className="auth-logo auth-logo--sm" />
        <h1 className="auth-title">Entrar</h1>

        <div className="demo-login-box">
          <p className="demo-login-title">Acesso rápido demo</p>
          <p className="muted" style={{ margin: 0 }}>
            O menu com Contratos / Prestadores / Campanhas só aparece no login de{' '}
            <strong>Empresa</strong>.
          </p>
          <div className="demo-login-grid">
            {DEMOS.map((d) => (
              <button
                key={d.email}
                type="button"
                className={`demo-login-btn ${d.primary ? 'demo-login-btn--primary' : ''}`}
                onClick={() => doLogin(d.email, d.senha)}
              >
                <strong>{d.label}</strong>
                <span>{d.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="auth-divider">ou entre com e-mail</div>

        <label className="field">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-accent btn-block">
          Entrar
        </button>
      </form>
    </div>
  )
}
