import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { LOGO_DOCA_LIVRE_SRC } from '../../lib/brandAssets'
import {
  portalCadastroEnviarCodigo,
  portalCadastroVerificarCodigo,
  portalConsumeCadastroToken,
  portalConsumeSenhaToken,
  portalPeekCadastroToken,
  portalPeekSenhaToken,
  portalSenhaEnviarCodigo,
  portalSenhaVerificarCodigo,
  type PortalRole,
} from '../../lib/portalAuth'
import { useStore } from '../../lib/store'
import './PortalLoginScreen.css'

export type PortalLoginSuccess = {
  usuario: string
  role: string
  isSuperuser?: boolean
  precisaConfig?: boolean
  precisaPerfil?: boolean
}

type Props = {
  portal: PortalRole | 'admin'
  avisoInicial?: string | null
  onSuccess: (result: PortalLoginSuccess) => void
  onBack: () => void
}

type Mode = 'login' | 'cadastro' | 'senha'
type Step = 'form' | 'codigo' | 'dados'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string
}

function PasswordField({ id, className, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="portal-login__password-wrap">
      <input
        id={id}
        className={`portal-login__input portal-login__input--password${className ? ` ${className}` : ''}`}
        {...rest}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        className="portal-login__password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <span className="portal-login__password-toggle-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
            {visible ? (
              <path
                fill="currentColor"
                d="M2.1 3.5 3.5 2.1 21.9 20.5 20.5 21.9l-3.1-3.1A11.5 11.5 0 0 1 12 19.5C6.5 19.5 1.9 16 0 12c.7-1.5 1.8-2.9 3.1-4.1L2.1 3.5zm6.2 6.2 1.5 1.5a2.5 2.5 0 0 0 3.1 3.1l1.5 1.5A4.5 4.5 0 0 1 8.3 9.7zM12 6.5c5.5 0 10.1 3.5 12 7.5-.6 1.3-1.5 2.5-2.6 3.5l-1.5-1.5c.7-.7 1.3-1.5 1.7-2.4A10 10 0 0 0 12 8.5c-.7 0-1.3.1-1.9.2L8.5 7A11 11 0 0 1 12 6.5z"
              />
            ) : (
              <path
                fill="currentColor"
                d="M12 5C6.5 5 1.9 8.5 0 12.5 1.9 16.5 6.5 20 12 20s10.1-3.5 12-7.5C22.1 8.5 17.5 5 12 5zm0 12.5a5.5 5.5 0 1 1 0-10 5.5 5.5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
              />
            )}
          </svg>
        </span>
      </button>
    </div>
  )
}

const PORTAL_TITLE: Record<PortalRole | 'admin', string> = {
  empresa: 'Login Empresa',
  profissional: 'Login Profissional',
  admin: 'Login Admin',
}

const PORTAL_TAG: Record<PortalRole | 'admin', string> = {
  empresa: 'Contratantes · demandas · prestadores',
  profissional: 'Trabalhador · currículo · missões temporárias',
  admin: 'Administração · hierarquia · permissões',
}

export function PortalLoginScreen({ portal, avisoInicial, onSuccess, onBack }: Props) {
  const store = useStore()
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('form')

  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [email, setEmail] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [codigo, setCodigo] = useState('')
  const [verifyToken, setVerifyToken] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(avisoInicial ?? null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (avisoInicial) setAviso(avisoInicial)
  }, [avisoInicial])

  function resetMessages() {
    setErro(null)
    setInfo(null)
  }

  function goMode(next: Mode) {
    setMode(next)
    setStep('form')
    setCodigo('')
    setVerifyToken('')
    setSenha('')
    setConfirmarSenha('')
    setErro(null)
    setInfo(null)
    if (next === 'cadastro') setUsuario('')
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const result = store.loginPortal(usuario.trim(), senha, portal)
      if (!result.ok) {
        if (result.aviso) setAviso(result.error || 'Seu cadastro ainda aguarda aprovação.')
        else {
          setAviso(null)
          setErro(result.error || 'Falha no login.')
        }
        return
      }
      setAviso(null)
      onSuccess({
        usuario: result.usuario || usuario.trim(),
        role: result.role || portal,
        isSuperuser: result.isSuperuser,
        precisaConfig: result.precisaConfig,
        precisaPerfil: result.precisaPerfil,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCadastroEnviar(e: FormEvent) {
    e.preventDefault()
    if (portal === 'admin') {
      setErro('Cadastro pelo Admin não está disponível. Peça a um superusuário.')
      return
    }
    resetMessages()
    const em = email.trim().toLowerCase()
    if (store.state.users.some((usuarioCadastrado) => usuarioCadastrado.email.toLowerCase() === em)) {
      setErro('Este e-mail já está sendo utilizado.')
      return
    }
    setLoading(true)
    try {
      const result = await portalCadastroEnviarCodigo(email.trim(), portal)
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setInfo(result.mensagem)
      setStep('codigo')
    } finally {
      setLoading(false)
    }
  }

  async function handleCadastroVerificar(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const result = await portalCadastroVerificarCodigo(email.trim(), codigo.trim())
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setVerifyToken(result.verify_token)
      setInfo(result.mensagem)
      setUsuario('')
      setSenha('')
      setConfirmarSenha('')
      setStep('dados')
      setCodigo('')
    } finally {
      setLoading(false)
    }
  }

  async function handleCadastroConcluir(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    const peeked = portalPeekCadastroToken(verifyToken)
    if (!peeked) {
      setErro('Sessão de cadastro expirada. Solicite um novo código.')
      return
    }
    setLoading(true)
    try {
      const reg = store.portalRegisterUser({
        email: peeked.email,
        usuario: usuario.trim(),
        senha,
        role: peeked.portalRole,
      })
      if (!reg.ok) {
        setErro(reg.error || 'Não foi possível cadastrar.')
        return
      }
      portalConsumeCadastroToken(verifyToken)
      onSuccess({
        usuario: usuario.trim(),
        role: peeked.portalRole,
        precisaPerfil: true,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSenhaEnviar(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const result = await portalSenhaEnviarCodigo(identificador.trim(), (id) =>
        store.resolveEmailByIdentificador(id),
      )
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setEmail(result.email)
      setInfo(result.mensagem)
      setStep('codigo')
    } finally {
      setLoading(false)
    }
  }

  async function handleSenhaVerificar(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const result = await portalSenhaVerificarCodigo(email.trim(), codigo.trim())
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setVerifyToken(result.verify_token)
      setInfo(result.mensagem)
      setSenha('')
      setConfirmarSenha('')
      setStep('dados')
      setCodigo('')
    } finally {
      setLoading(false)
    }
  }

  async function handleSenhaRedefinir(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    const em = portalPeekSenhaToken(verifyToken)
    if (!em) {
      setErro('Sessão expirada. Solicite um novo código.')
      return
    }
    setLoading(true)
    try {
      const res = store.portalResetSenha(em, senha)
      if (!res.ok) {
        setErro(res.error || 'Não foi possível alterar a senha.')
        return
      }
      portalConsumeSenhaToken(verifyToken)
      setInfo('Senha alterada. Faça login.')
      goMode('login')
      setInfo('Senha alterada. Faça login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-login">
      <div className="portal-login__card">
        <div className="portal-login__header">
          <img src={LOGO_DOCA_LIVRE_SRC} alt="Doca Livre" className="portal-login__logo" />
          <h1 className="portal-login__title">{mode === 'cadastro' ? 'Cadastro' : PORTAL_TITLE[portal]}</h1>
          <p className="portal-login__tagline">{PORTAL_TAG[portal]}</p>
        </div>

        {mode === 'login' && aviso && (
          <p className="portal-login__aviso" role="status">
            {aviso}
          </p>
        )}

        {mode === 'login' && (
          <form className="portal-login__form" onSubmit={handleLogin}>
            <label className="portal-login__label" htmlFor="pl-usuario">
              Usuário ou e-mail
            </label>
            <input
              id="pl-usuario"
              className="portal-login__input"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              required
            />
            <label className="portal-login__label" htmlFor="pl-senha">
              Senha
            </label>
            <PasswordField
              id="pl-senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
            {erro && <p className="portal-login__erro">{erro}</p>}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}

        {mode === 'cadastro' && portal !== 'admin' && step === 'form' && (
          <form className="portal-login__form" onSubmit={handleCadastroEnviar}>
            <p className="portal-login__hint">
              Enviaremos um código de 6 dígitos para confirmar seu e-mail.
            </p>
            <label className="portal-login__label" htmlFor="pl-email">
              E-mail
            </label>
            <input
              id="pl-email"
              type="email"
              className="portal-login__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {erro && <p className="portal-login__erro">{erro}</p>}
            {info && <p className="portal-login__info">{info}</p>}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar código'}
            </button>
          </form>
        )}

        {mode === 'cadastro' && step === 'codigo' && (
          <form className="portal-login__form" onSubmit={handleCadastroVerificar}>
            <p className="portal-login__hint">
              Enviamos um código para <strong>{email}</strong>. Abra o e-mail, copie o código e cole abaixo.
            </p>
            <label className="portal-login__label" htmlFor="pl-otp">
              Código
            </label>
            <input
              id="pl-otp"
              className="portal-login__input portal-login__input--otp"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
            {erro && <p className="portal-login__erro">{erro}</p>}
            <button type="submit" className="portal-login__submit" disabled={loading || codigo.length < 6}>
              {loading ? 'Verificando…' : 'Verificar código'}
            </button>
          </form>
        )}

        {mode === 'cadastro' && step === 'dados' && (
          <form className="portal-login__form" onSubmit={handleCadastroConcluir}>
            <label className="portal-login__label" htmlFor="pl-new-user">
              Usuário
            </label>
            <input
              id="pl-new-user"
              className="portal-login__input"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="off"
              required
            />
            <label className="portal-login__label" htmlFor="pl-new-pass">
              Senha
            </label>
            <PasswordField
              id="pl-new-pass"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            <label className="portal-login__label" htmlFor="pl-new-pass2">
              Confirmar senha
            </label>
            <PasswordField
              id="pl-new-pass2"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            {erro && <p className="portal-login__erro">{erro}</p>}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Salvando…' : 'Concluir cadastro'}
            </button>
          </form>
        )}

        {mode === 'senha' && step === 'form' && (
          <form className="portal-login__form" onSubmit={handleSenhaEnviar}>
            <p className="portal-login__hint">Informe usuário ou e-mail para receber o código.</p>
            <label className="portal-login__label" htmlFor="pl-id">
              Usuário ou e-mail
            </label>
            <input
              id="pl-id"
              className="portal-login__input"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              required
            />
            {erro && <p className="portal-login__erro">{erro}</p>}
            {info && <p className="portal-login__info">{info}</p>}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar código'}
            </button>
          </form>
        )}

        {mode === 'senha' && step === 'codigo' && (
          <form className="portal-login__form" onSubmit={handleSenhaVerificar}>
            <p className="portal-login__hint">
              Enviamos um código para <strong>{email}</strong>. Abra o e-mail, copie o código e cole abaixo.
            </p>
            <label className="portal-login__label" htmlFor="pl-otp-s">
              Código
            </label>
            <input
              id="pl-otp-s"
              className="portal-login__input portal-login__input--otp"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
            {erro && <p className="portal-login__erro">{erro}</p>}
            <button type="submit" className="portal-login__submit" disabled={loading || codigo.length < 6}>
              {loading ? 'Verificando…' : 'Verificar código'}
            </button>
          </form>
        )}

        {mode === 'senha' && step === 'dados' && (
          <form className="portal-login__form" onSubmit={handleSenhaRedefinir}>
            <label className="portal-login__label" htmlFor="pl-np">
              Nova senha
            </label>
            <PasswordField
              id="pl-np"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
            />
            <label className="portal-login__label" htmlFor="pl-np2">
              Confirmar nova senha
            </label>
            <PasswordField
              id="pl-np2"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={6}
            />
            {erro && <p className="portal-login__erro">{erro}</p>}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Salvando…' : 'Redefinir senha'}
            </button>
          </form>
        )}

        <div className="portal-login__links">
          {mode !== 'login' && (
            <button type="button" className="portal-login__link" onClick={() => goMode('login')}>
              Voltar ao login
            </button>
          )}
          {mode === 'login' && portal !== 'admin' && (
            <button type="button" className="portal-login__link" onClick={() => goMode('cadastro')}>
              Criar conta
            </button>
          )}
          {mode === 'login' && (
            <button type="button" className="portal-login__link" onClick={() => goMode('senha')}>
              Esqueci a senha
            </button>
          )}
          <button type="button" className="portal-login__link" onClick={onBack}>
            Trocar tipo de acesso
          </button>
        </div>

        {mode === 'login' && (
          <p className="portal-login__hint" style={{ marginTop: 16, textAlign: 'center' }}>
            Superusuários: <strong>Diego</strong> / <strong>Elder</strong> — senha{' '}
            <code>demo123</code>
          </p>
        )}
      </div>
    </div>
  )
}
