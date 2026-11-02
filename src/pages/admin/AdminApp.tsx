import { useState } from 'react'
import { CentralDocumentacaoAdmin } from '../../components/DocumentacaoPanel'
import { BibliotecaDocumental } from '../../components/BibliotecaDocumental'
import { LevelBadge } from '../../components/LevelBadge'
import { cargoLabel } from '../../data/categories'
import { LOGO_DOCA_LIVRE_SRC } from '../../lib/brandAssets'
import { useStore } from '../../lib/store'
import { AdminDashboard } from './AdminDashboard'
import '../empresa/empresa-px.css'
import './admin.css'

const ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'profissionais', label: 'Profissionais' },
  { id: 'documentacao', label: 'Documentação' },
  { id: 'demandas', label: 'Demandas' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'auditoria', label: 'Auditoria' },
]

export function AdminApp({
  onLogout,
  onOpenConfig,
}: {
  onLogout: () => void
  onOpenConfig?: () => void
}) {
  const store = useStore()
  const [section, setSection] = useState('dashboard')

  function irParaEmpresaDemo() {
    const res = store.login('empresa@logexpress.com', 'demo123')
    if (!res.ok) {
      onLogout()
      return
    }
    try {
      sessionStorage.setItem('mao-portal-ativo', 'empresa')
    } catch {
      /* ignore */
    }
    window.location.reload()
  }

  const navItems = [
    ...ITEMS,
    ...(onOpenConfig ? [{ id: 'config', label: 'Hierarquia' }] : []),
  ]
  const alertaAba: Record<string, number> = {
    empresas: store.state.empresas.filter((empresa) => empresa.status === 'pendente').length,
    profissionais: store.state.profissionais.filter((pessoa) => pessoa.status === 'pendente').length,
  }

  return (
    <div className="px-shell px-shell--admin">
      <div className="px-banner-switch">
        <span>
          Este é o <strong>Admin</strong>. O painel estilo PX (Contratos, Prestadores, Campanhas) fica no login de
          Empresa.
        </span>
        <button type="button" className="px-btn px-btn-primary" onClick={irParaEmpresaDemo}>
          Abrir Painel Empresa agora
        </button>
      </div>
      <header className="px-topbar">
        <div className="px-topbar-left">
          <img src={LOGO_DOCA_LIVRE_SRC} alt="fazumfreela" className="px-topbar-logo" />
          <div>
            <strong className="px-topbar-brand">Painel Administrativo</strong>
            <p className="px-topbar-sub">fazumfreela</p>
          </div>
        </div>
        <div className="px-topbar-right" style={{ marginLeft: 'auto' }}>
          {onOpenConfig && (
            <button type="button" className="px-btn px-btn-outline" onClick={onOpenConfig}>
              Hierarquia / Permissões
            </button>
          )}
          <button type="button" className="px-btn px-btn-ghost" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <div className="px-body">
        <aside className="px-sidebar">
          <nav className="px-sidebar-nav">
            <p className="px-sidebar-kicker">Painel</p>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`px-nav-link ${section === item.id ? 'px-nav-link--active' : ''}`}
                onClick={() => {
                  if (item.id === 'config' && onOpenConfig) {
                    onOpenConfig()
                    return
                  }
                  setSection(item.id)
                }}
              >
                <span className="px-nav-ico" aria-hidden>
                  <IconeAba id={item.id} />
                </span>
                <span>{item.label}</span>
                {(alertaAba[item.id] ?? 0) > 0 && (
                  <span className="ad-nav-alerta">{alertaAba[item.id]}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="px-main">
          {section === 'dashboard' && <AdminDashboard />}
          {section === 'empresas' && <EmpresasAdmin />}
          {section === 'profissionais' && <ProfissionaisAdmin />}
          {section === 'documentacao' && (
            <>
              <BibliotecaDocumental modo="ett" />
              <CentralDocumentacaoAdmin />
            </>
          )}
          {section === 'demandas' && <DemandasAdmin />}
          {section === 'financeiro' && <FinanceiroAdmin />}
          {section === 'auditoria' && <AuditoriaAdmin />}
        </main>
      </div>
      <button type="button" className="px-chat-fab" title="Suporte">
        💬
      </button>
    </div>
  )
}

function IconeAba({ id }: { id: string }) {
  const traco = {
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg viewBox="0 0 24 24" fill="none">
      {id === 'dashboard' && (
        <>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" {...traco} />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" {...traco} />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" {...traco} />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" {...traco} />
        </>
      )}
      {id === 'empresas' && (
        <>
          <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5H13v15" {...traco} />
          <path d="M13 9h5.5A1.5 1.5 0 0 1 20 10.5V20" {...traco} />
          <path d="M7.5 8.5h2.5M7.5 12h2.5M7.5 15.5h2.5M16 13h1.5M16 16.5h1.5" {...traco} />
        </>
      )}
      {id === 'profissionais' && (
        <>
          <circle cx="9" cy="8" r="2.4" {...traco} />
          <circle cx="16" cy="9" r="2" {...traco} />
          <path d="M4.5 18.5c.6-2.6 2.5-4 4.5-4s3.9 1.4 4.5 4" {...traco} />
          <path d="M13.5 14.8c1.3-.5 2.6-.4 3.7.4 1.1.8 1.7 2 2 3.3" {...traco} />
        </>
      )}
      {id === 'documentacao' && (
        <>
          <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" {...traco} />
          <path d="M14 3.8V8h4.2M8.5 12h7M8.5 15.5h5" {...traco} />
        </>
      )}
      {id === 'demandas' && (
        <>
          <path d="M8 6.5h11M8 12h11M8 17.5h11" {...traco} />
          <circle cx="4.6" cy="6.5" r="1.15" fill="currentColor" />
          <circle cx="4.6" cy="12" r="1.15" fill="currentColor" />
          <circle cx="4.6" cy="17.5" r="1.15" fill="currentColor" />
        </>
      )}
      {id === 'financeiro' && (
        <>
          <rect x="3.5" y="6" width="17" height="12" rx="2" {...traco} />
          <path d="M3.5 10h17" {...traco} />
          <path d="M7 14.5h4" {...traco} />
        </>
      )}
      {id === 'auditoria' && (
        <>
          <path d="M12 3.5l7 2.4v5.4c0 4.2-2.8 7.2-7 8.7-4.2-1.5-7-4.5-7-8.7V5.9l7-2.4z" {...traco} />
          <path d="M8.8 12.1l2.1 2.1 4.3-4.4" {...traco} />
        </>
      )}
      {id === 'config' && (
        <>
          <circle cx="8" cy="8" r="2.2" {...traco} />
          <circle cx="16" cy="16" r="2.2" {...traco} />
          <path d="M10.1 9.2l3.8 5.6M8 10.2V20M16 4v9.6" {...traco} />
        </>
      )}
    </svg>
  )
}

function ordemAprovacao(status: string) {
  if (status === 'pendente') return 0
  if (status === 'bloqueada' || status === 'bloqueado') return 2
  return 1
}

function EmpresasAdmin() {
  const { state, setEmpresaStatus } = useStore()
  const empresas = [...state.empresas].sort((a, b) => ordemAprovacao(a.status) - ordemAprovacao(b.status))
  const pendentes = empresas.filter((empresa) => empresa.status === 'pendente').length
  return (
    <div className="px-page">
      <h1 className="px-title">Empresas</h1>
      {pendentes > 0 && (
        <p className="ad-pendente-nota">
          {pendentes === 1 ? '1 empresa aguardando aprovação.' : `${pendentes} empresas aguardando aprovação.`}
        </p>
      )}
      <ul className="px-list">
        {empresas.map((e) => (
          <li key={e.id} className={`px-list-card${e.status === 'pendente' ? ' px-list-card--pendente' : ''}`}>
            <div>
              <strong>{e.nomeFantasia}</strong>
              {e.status === 'pendente' && <span className="ad-pendente-tag">Aguardando aprovação</span>}
              <p className="muted">{e.cnpj} · {e.tipo} · {e.plano} · {e.endereco.cidade}</p>
            </div>
            <div className="px-row-actions">
              <span className={`px-status px-status--${e.status}`}>{e.status}</span>
              {e.status !== 'aprovada' && (
                <button type="button" className="px-btn px-btn-primary" onClick={() => setEmpresaStatus(e.id, 'aprovada')}>
                  Aprovar
                </button>
              )}
              {e.status !== 'bloqueada' && (
                <button type="button" className="px-btn px-btn-ghost" onClick={() => setEmpresaStatus(e.id, 'bloqueada')}>
                  Bloquear
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProfissionaisAdmin() {
  const { state, setProfissionalStatus } = useStore()
  const profissionais = [...state.profissionais].sort(
    (a, b) => ordemAprovacao(a.status) - ordemAprovacao(b.status),
  )
  const pendentes = profissionais.filter((pessoa) => pessoa.status === 'pendente').length
  return (
    <div className="px-page">
      <h1 className="px-title">Profissionais</h1>
      {pendentes > 0 && (
        <p className="ad-pendente-nota">
          {pendentes === 1
            ? '1 colaborador aguardando aprovação.'
            : `${pendentes} colaboradores aguardando aprovação.`}
        </p>
      )}
      <ul className="px-list">
        {profissionais.map((p) => (
          <li key={p.id} className={`px-list-card${p.status === 'pendente' ? ' px-list-card--pendente' : ''}`}>
            <div>
              <strong>{p.nome}</strong>
              {p.status === 'pendente' && <span className="ad-pendente-tag">Aguardando aprovação</span>}
              <p className="muted">
                {p.profissoes.map(cargoLabel).join(', ')} · {p.endereco.cidade} · ★ {p.avaliacaoMedia.toFixed(1)}
              </p>
              <LevelBadge nivel={p.nivel} />
            </div>
            <div className="px-row-actions">
              <span className={`px-status px-status--${p.status}`}>{p.status}</span>
              {p.status !== 'aprovado' && (
                <button type="button" className="px-btn px-btn-primary" onClick={() => setProfissionalStatus(p.id, 'aprovado')}>
                  Aprovar
                </button>
              )}
              {p.status !== 'bloqueado' && (
                <button type="button" className="px-btn px-btn-ghost" onClick={() => setProfissionalStatus(p.id, 'bloqueado')}>
                  Bloquear
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DemandasAdmin() {
  const { state, cancelDemanda } = useStore()
  return (
    <div className="px-page">
      <h1 className="px-title">Demandas</h1>
      <ul className="px-list">
        {state.demandas.map((d) => {
          const emp = state.empresas.find((e) => e.id === d.empresaId)
          return (
            <li key={d.id} className="px-list-card">
              <div>
                <strong>{cargoLabel(d.cargo)}</strong>
                <p className="muted">
                  {emp?.nomeFantasia} · {d.data} · {d.endereco.cidade} · R$ {d.valorDiaria}
                </p>
              </div>
              <div className="px-row-actions">
                <span className={`px-status px-status--${d.status}`}>{d.status}</span>
                {d.status === 'aberta' && (
                  <button type="button" className="px-btn px-btn-ghost" onClick={() => cancelDemanda(d.id)}>
                    Cancelar
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FinanceiroAdmin() {
  const { state } = useStore()
  const total = state.pagamentos.reduce((s, p) => s + p.valor, 0)
  const comissao = state.pagamentos.reduce((s, p) => s + p.comissao, 0)
  return (
    <div className="px-page">
      <h1 className="px-title">Financeiro</h1>
      <div className="px-stat-3" style={{ marginBottom: 16 }}>
        <div className="px-mini-card"><span className="muted">Volume diárias</span><strong>R$ {total}</strong></div>
        <div className="px-mini-card"><span className="muted">Comissões</span><strong>R$ {comissao}</strong></div>
        <div className="px-mini-card"><span className="muted">Pagamentos</span><strong>{state.pagamentos.length}</strong></div>
      </div>
      <ul className="px-list">
        {state.pagamentos.map((p) => (
          <li key={p.id} className="px-list-card">
            <span>R$ {p.valor} (comissão R$ {p.comissao})</span>
            <span className="muted">{p.status}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AuditoriaAdmin() {
  const { state } = useStore()
  return (
    <div className="px-page">
      <h1 className="px-title">Auditoria</h1>
      <ul className="px-list">
        {state.auditLogs.map((l) => (
          <li key={l.id} className="px-list-card">
            <div>
              <strong>{l.action}</strong>
              <p className="muted">{l.detail}</p>
            </div>
            <span className="muted">{new Date(l.at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
