import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AceiteTermosGate } from '../../components/AceiteTermos'
import { AvailabilityToggle } from '../../components/AvailabilityToggle'
import { BibliotecaDocumental } from '../../components/BibliotecaDocumental'
import { DocumentacaoProfissionalPanel } from '../../components/DocumentacaoPanel'
import { LevelBadge } from '../../components/LevelBadge'
import { PecaViewer } from '../../components/PecaViewer'
import { cargoLabel } from '../../data/categories'
import { distanciaKm } from '../../lib/matching'
import { formatarDistancia, rotuloPeriodo } from '../../lib/periodoMissao'
import { checklistProfissional, resumoDocumental } from '../../lib/documentos'
import { pendenciasParaIniciar } from '../../lib/dossieTemporario'
import { BRAND_PRODUCT_NAME, LOGO_DOCA_LIVRE_SRC } from '../../lib/brandAssets'
import { validarChavePix } from '../../lib/pix'
import { useStore } from '../../lib/store'
import type { CandidaturaStatus, Disponibilidade } from '../../lib/types'
import { PerfilEmpresa, logoDaEmpresa } from './PerfilEmpresa'
import { EditorPerfil, lerFotoPerfil } from './EditorPerfil'
import { useLocalizacaoAparelho } from './useLocalizacaoAparelho'
import { SinoTrabalhador } from './SinoTrabalhador'
import '../empresa/contratar.css'
import './perfil.css'

const TABS = [
  { id: 'inicio', label: 'Início', icon: <IconeInicio /> },
  { id: 'vagas', label: 'Vagas', icon: <IconeVagas /> },
  { id: 'agenda', label: 'Vagas aceitas', icon: <IconeMissoes /> },
  { id: 'financeiro', label: 'Financeiro', icon: <IconeFinanceiro /> },
  { id: 'perfil', label: 'Perfil', icon: <IconePerfil /> },
  { id: 'opcoes', label: 'Opções', icon: <IconeOpcoes /> },
] as const

type TabId = (typeof TABS)[number]['id']

export function ProfissionalApp({ onLogout }: { onLogout: () => void }) {
  const store = useStore()
  const prof = store.currentProfissional
  const [tab, setTab] = useState<TabId>('inicio')
  const [termoId, setTermoId] = useState<string | null>(null)
  const [menuFixo, setMenuFixo] = useState(false)
  const [menuHover, setMenuHover] = useState(false)
  const [telaEstreita, setTelaEstreita] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const atualizar = () => setTelaEstreita(mq.matches)
    atualizar()
    mq.addEventListener('change', atualizar)
    return () => mq.removeEventListener('change', atualizar)
  }, [])

  const menuAberto = menuFixo || (!telaEstreita && menuHover)

  if (!prof) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p>Profissional não encontrado.</p>
          <p className="muted" style={{ marginTop: 8 }}>
            Use uma conta de mão de obra (ex.: <strong>carlos</strong> / demo123) ou complete o cadastro.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={onLogout}>
            Voltar ao login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cf-shell">
      <header className="cf-topbar">
        <div className="cf-topbar-left">
          <button
            type="button"
            className="cf-topbar-menu"
            aria-label={menuFixo ? 'Recolher menu lateral' : 'Fixar menu expandido'}
            aria-pressed={menuFixo}
            onClick={() => setMenuFixo((valor) => !valor)}
          >
            <span className="cf-topbar-menu-icon" aria-hidden />
          </button>
          <div className="cf-topbar-brand">
            <img src={LOGO_DOCA_LIVRE_SRC} alt="Doca Livre" className="cf-topbar-logo" />
            <span className="cf-product">{BRAND_PRODUCT_NAME}</span>
          </div>
        </div>
        <div className="cf-topbar-right">
          <SinoTrabalhador
            onIr={(aba, pecaId) => {
              setTab(aba)
              setTermoId(pecaId ?? null)
            }}
          />
          <div className="cf-topbar-user">
            <span>
              <strong>{prof.nome.split(' ')[0]}</strong>
              <small>Trabalhador</small>
            </span>
            <LevelBadge nivel={prof.nivel} />
            <span className="cf-avatar-topo" aria-hidden>
              {iniciais(prof.nome)}
            </span>
          </div>
          <button type="button" className="cf-sair" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <div className="cf-workspace">
        {menuHover && !menuFixo && !telaEstreita && <div className="cf-menu-rail" aria-hidden />}
        {menuFixo && telaEstreita && (
          <button type="button" className="cf-menu-backdrop" aria-label="Fechar menu" onClick={() => setMenuFixo(false)} />
        )}
        <aside
          className={`cf-menu ${menuAberto ? 'cf-menu--wide' : ''} ${menuHover && !menuFixo ? 'cf-menu--flyout' : ''} ${menuFixo ? 'cf-menu--pinned' : ''}`}
          onMouseEnter={() => setMenuHover(true)}
          onMouseLeave={() => setMenuHover(false)}
        >
          <nav className="cf-menu-body" aria-label="Conta do trabalhador">
            {TABS.map((item) => {
              const ativo = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`cf-menu-link ${ativo ? 'cf-menu-link--on' : ''}`}
                  aria-current={ativo ? 'page' : undefined}
                  title={menuAberto ? undefined : item.label}
                  onClick={() => {
                    setTab(item.id)
                    if (telaEstreita) setMenuFixo(false)
                  }}
                >
                  <span className="cf-menu-icon">{item.icon}</span>
                  <span className="cf-menu-label">{item.label}</span>
                  <span className="cf-menu-chevron" aria-hidden>
                    ›
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>
        <main className="cf-main">
          <div className="cf-wrap">
            {tab === 'inicio' && <HomeTab onIr={setTab} />}
            {tab === 'vagas' && <VagasTab />}
            {tab === 'agenda' && <AgendaTab />}
            {tab === 'financeiro' && <FinanceiroTab />}
            {tab === 'perfil' && <PerfilTab />}
            {tab === 'opcoes' && <OpcoesTab onIr={setTab} />}
          </div>
        </main>
      </div>
      {termoId && (
        <PecaViewer pecaId={termoId} papel="trabalhador" nome={prof.nome} onClose={() => setTermoId(null)} />
      )}
      <AceiteTermosGate onSair={onLogout} />
    </div>
  )
}

function IconeBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  )
}

function IconeInicio() {
  return (
    <IconeBase>
      <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </IconeBase>
  )
}

function IconeVagas() {
  return (
    <IconeBase>
      <rect x="6" y="3.5" width="12" height="17" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 3.5h6v2.8H9z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 11h6M9 14.5h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </IconeBase>
  )
}

function IconeMissoes() {
  return (
    <IconeBase>
      <path d="M3 16V8h10v8M13 11h4l3 3v2h-7" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <circle cx="7" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17" cy="16.5" r="1.5" stroke="currentColor" strokeWidth="1.75" />
    </IconeBase>
  )
}

function IconeFinanceiro() {
  return (
    <IconeBase>
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="16" cy="14.5" r="1.2" fill="currentColor" />
    </IconeBase>
  )
}

function IconePerfil() {
  return (
    <IconeBase>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M5 19.5c1.2-3 3.6-4.5 7-4.5s5.8 1.5 7 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </IconeBase>
  )
}

function IconeOpcoes() {
  return (
    <IconeBase>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 3.5v2.2M12 18.3V20.5M3.5 12h2.2M18.3 12H20.5M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </IconeBase>
  )
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? '' : ''
  return `${primeira}${ultima}`.toUpperCase()
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}`
}

function rotuloFila(status: CandidaturaStatus) {
  if (status === 'confirmada') return 'Missão confirmada'
  if (status === 'aceita') return 'Interesse registrado'
  return 'Nova oferta'
}

function HomeTab({ onIr }: { onIr: (aba: TabId) => void }) {
  const { currentProfissional, state, updateDisponibilidade } = useStore()
  const prof = currentProfissional!
  const ofertas = state.candidaturas.filter(
    (c) => c.profissionalId === prof.id && c.status === 'pendente',
  ).length
  const interesses = state.candidaturas.filter(
    (c) => c.profissionalId === prof.id && c.status === 'aceita',
  ).length
  const missoes = state.candidaturas.filter(
    (c) => c.profissionalId === prof.id && c.status === 'confirmada',
  ).length
  const fila = useMemo(() => {
    return state.candidaturas
      .filter((c) => c.profissionalId === prof.id && (c.status === 'pendente' || c.status === 'aceita' || c.status === 'confirmada'))
      .map((c) => {
        const dem = state.demandas.find((d) => d.id === c.demandaId)
        const emp = dem ? state.empresas.find((e) => e.id === dem.empresaId) : null
        return { c, dem, emp }
      })
      .filter((item) => item.dem && (item.c.status === 'confirmada' || item.dem.status === 'aberta'))
      .sort((a, b) => Number(a.c.status !== 'pendente') - Number(b.c.status !== 'pendente'))
      .slice(0, 3)
  }, [prof.id, state.candidaturas, state.demandas, state.empresas])
  const docs = resumoDocumental(checklistProfissional(prof, state.documentos))
  const cargo = prof.profissoes[0] ? cargoLabel(prof.profissoes[0]) : 'Trabalhador'
  const nota = prof.avaliacaoMedia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const saudacao =
    ofertas === 1
      ? 'Há 1 oferta esperando a sua resposta.'
      : ofertas > 1
        ? `Há ${ofertas} ofertas esperando a sua resposta.`
        : interesses > 0
          ? 'Seu interesse já está registrado. A missão segue para validação.'
          : 'Seu perfil está visível para as empresas tomadoras.'

  return (
    <div className="td-home">
      <section className="td-home-hero">
        <div className="td-home-foto" aria-hidden>
          {prof.foto ? <img src={prof.foto} alt="" /> : <span>{iniciais(prof.nome)}</span>}
        </div>
        <div>
          <p className="td-home-kicker">Início</p>
          <h2>Olá, {prof.nome.split(' ')[0]}</h2>
          <p className="td-home-cargo">
            {cargo} · {prof.endereco.cidade}/{prof.endereco.estado}
          </p>
          <p className="td-home-saudacao">{saudacao}</p>
          <div className="td-home-meta">
            <LevelBadge nivel={prof.nivel} />
            <span className="td-home-pill">
              ★ <b>{nota}</b>
            </span>
            <span className="td-home-pill td-home-pill--claro">{prof.taxaComparecimento}% de comparecimento</span>
          </div>
        </div>
      </section>

      {prof.status === 'pendente' && <p className="warning-banner">Seu cadastro aguarda aprovação do admin.</p>}

      <section className="td-home-stats">
        <button type="button" className="td-home-stat td-home-stat--dark" onClick={() => onIr('financeiro')}>
          <span>Ganhos do mês</span>
          <strong>{moeda(prof.ganhosMes)}</strong>
          <small>Saldo {moeda(prof.saldo)}</small>
        </button>
        <button type="button" className="td-home-stat" onClick={() => onIr('perfil')}>
          <span>Avaliação</span>
          <strong>★ {nota}</strong>
          <small>Responde em {prof.tempoRespostaMin} min</small>
        </button>
        <button type="button" className="td-home-stat" onClick={() => onIr('vagas')}>
          <span>Ofertas</span>
          <strong>{ofertas}</strong>
          <small>{ofertas === 1 ? 'Aguardando você' : 'Na sua fila'}</small>
        </button>
        <button type="button" className="td-home-stat" onClick={() => onIr('agenda')}>
          <span>Vagas aceitas</span>
          <strong>{missoes}</strong>
          <small>{missoes === 1 ? 'Confirmada' : 'Confirmadas'}</small>
        </button>
      </section>

      <div className="td-home-grid">
        <section className="td-home-card">
          <header>
            <h3>Para você agora</h3>
            <div className="td-home-links">
              <button type="button" className="td-home-link" onClick={() => onIr('vagas')}>
                Vagas
              </button>
            </div>
          </header>
          {fila.map(({ c, dem, emp }) => (
            <button
              key={c.id}
              type="button"
              className="td-home-oferta"
              onClick={() => onIr(c.status === 'confirmada' ? 'agenda' : 'vagas')}
            >
              <span>
                <small>{rotuloFila(c.status)}</small>
                <strong>{cargoLabel(dem!.cargo)}</strong>
                <em>
                  {emp?.nomeFantasia ?? 'Empresa tomadora'} · {dem!.endereco.cidade} · {rotuloPeriodo(dem!.data, dem!.dataFim)}
                </em>
              </span>
              <b>{dem!.valorDiaria ? moeda(dem!.valorDiaria) : 'A combinar'}</b>
            </button>
          ))}
          {fila.length === 0 && (
            <p className="td-home-vazio">Nenhuma oferta ou missão agora. As vagas publicadas ficam na aba Vagas.</p>
          )}
        </section>

        <section className="td-home-card">
          <header>
            <h3>Seu perfil</h3>
            <button type="button" className="td-home-link" onClick={() => onIr('perfil')}>
              Abrir
            </button>
          </header>
          <div className="td-home-chips">
            {prof.profissoes.map((id) => (
              <span key={id} className="td-home-chip">
                {cargoLabel(id)}
              </span>
            ))}
            {prof.certificados.map((item) => (
              <span key={`${item.tipo}-${item.validade ?? ''}`} className="td-home-chip td-home-chip--soft">
                {item.tipo}
                {item.validade ? ` · ${dataCurta(item.validade)}` : ''}
              </span>
            ))}
            {prof.cnhCategoria && <span className="td-home-chip td-home-chip--soft">CNH {prof.cnhCategoria}</span>}
          </div>
          <ul className="td-home-facts">
            <li>Atende até {prof.raioKm} km de {prof.endereco.cidade}</li>
            <li>
              {prof.experiencia.length} {prof.experiencia.length === 1 ? 'experiência' : 'experiências'} no currículo
            </li>
          </ul>
          <div className="td-home-docs">
            <div>
              <span>Documentos obrigatórios</span>
              <strong>{docs.pct}%</strong>
            </div>
            <div className="td-home-bar" aria-hidden>
              <span style={{ width: `${docs.pct}%` }} />
            </div>
            <p>
              {docs.completo
                ? 'Documentação obrigatória em dia.'
                : `${docs.ok} de ${docs.total} documentos obrigatórios ok.`}
            </p>
          </div>
        </section>
      </div>

      <section className="td-home-card">
        <h3>Disponível para missões temporárias</h3>
        <p className="td-home-nota">A empresa tomadora vê quem pode ser colocado em uma missão.</p>
        <AvailabilityToggle value={prof.disponibilidade} onChange={(d) => updateDisponibilidade(prof.id, d)} />
      </section>
    </div>
  )
}

function VagasTab() {
  const { currentProfissional, state, candidatar, refuseOferta } = useStore()
  const prof = currentProfissional!
  const [aviso, setAviso] = useState<{ id: string; texto: string; ok: boolean } | null>(null)
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const { local, pedir } = useLocalizacaoAparelho()
  const aprovado = prof.status === 'aprovado'
  const verTodas = prof.verTodasVagas !== false

  const vagas = useMemo(() => {
    return state.demandas
      .filter((demanda) => demanda.status === 'aberta')
      .map((demanda) => {
        const empresa = state.empresas.find((item) => item.id === demanda.empresaId)
        const candidatura = state.candidaturas.find(
          (item) => item.demandaId === demanda.id && item.profissionalId === prof.id,
        )
        const dist = distanciaKm(prof.endereco, demanda.endereco)
        return { demanda, empresa, candidatura, dist }
      })
      .filter((item) => {
        if (item.empresa?.bloqueados.includes(prof.id)) return false
        if (!verTodas && !prof.profissoes.includes(item.demanda.cargo)) return false
        const mesmaCidade = semAcento(item.demanda.endereco.cidade) === semAcento(prof.endereco.cidade)
        const noRaio = Number.isFinite(item.dist) && item.dist <= prof.raioKm
        const semCoordenada = !Number.isFinite(item.dist)
        return mesmaCidade || noRaio || semCoordenada
      })
      .sort((a, b) => {
        const da = Number.isFinite(a.dist) ? a.dist : 9999
        const db = Number.isFinite(b.dist) ? b.dist : 9999
        return da - db
      })
  }, [prof.endereco, prof.id, prof.profissoes, prof.raioKm, state.candidaturas, state.demandas, state.empresas, verTodas])

  function recusar(demandaId: string) {
    refuseOferta(demandaId, prof.id)
    setAviso({
      id: demandaId,
      ok: true,
      texto: 'Convite recusado. A vaga continua aberta se você mudar de ideia.',
    })
  }

  function aplicar(demandaId: string) {
    const resp = candidatar(demandaId, prof.id)
    setAviso({
      id: demandaId,
      ok: resp.ok,
      texto: resp.ok
        ? 'Candidatura enviada. O contrato só nasce quando a empresa confirma.'
        : resp.error || 'Não foi possível enviar a candidatura.',
    })
  }

  const enviadas = vagas.filter(
    (item) => item.candidatura?.status === 'aceita' || item.candidatura?.status === 'confirmada',
  ).length

  return (
    <div className="td-vagas">
      <header className="td-vagas-intro">
        <p className="td-home-kicker">Vagas</p>
        <h2>Vagas abertas</h2>
        <p>
          {verTodas
            ? `Empresas tomadoras em ${prof.endereco.cidade} e até ${prof.raioKm} km.`
            : `Somente publicações dos seus cargos, em ${prof.endereco.cidade} e até ${prof.raioKm} km.`}{' '}
          A candidatura registra o interesse. A distância de cada vaga sai da localização do celular ou do computador.
        </p>
      </header>
      {local.estado !== 'pronta' && local.estado !== 'pedindo' && (
        <div className="td-vaga-local">
          <p>Ligue a localização do celular ou do computador e permita o acesso neste site para ver a distância exata.</p>
          <button type="button" onClick={pedir}>
            Ativar localização
          </button>
        </div>
      )}
      {vagas.length > 0 && (
        <div className="td-vaga-resumo">
          <span>
            <b>{vagas.length}</b> {vagas.length === 1 ? 'aberta' : 'abertas'}
          </span>
          <span>
            <b>{enviadas}</b> {enviadas === 1 ? 'candidatura sua' : 'candidaturas suas'}
          </span>
        </div>
      )}
      {vagas.length === 0 && (
        <section className="td-vaga td-vaga--vazia">
          <strong>Nenhuma vaga no seu raio agora.</strong>
          <p>
            {verTodas
              ? `Quando uma empresa publicar uma vaga em ${prof.endereco.cidade} ou até ${prof.raioKm} km, ela aparece aqui.`
              : 'Nenhuma publicação dos seus cargos neste raio. Em Opções dá para ver todas as publicações.'}
          </p>
        </section>
      )}
      {vagas.map(({ demanda, empresa, candidatura }) => {
        const enviada = candidatura?.status === 'aceita' || candidatura?.status === 'confirmada'
        const confirmada = candidatura?.status === 'confirmada'
        const periodo = rotuloPeriodo(demanda.data, demanda.dataFim)
        const texto = demanda.atividades || demanda.descricao
        const kmAparelho =
          local.estado === 'pronta' && local.lat != null && local.lng != null
            ? distanciaKm({ lat: local.lat, lng: local.lng }, demanda.endereco)
            : Number.NaN
        const distancia =
          local.estado === 'pedindo'
            ? 'Localizando…'
            : local.estado === 'pronta'
              ? formatarDistancia(kmAparelho)
              : 'Localização desligada'
        return (
          <Fragment key={demanda.id}>
          <article className="td-vaga">
            <div className="td-vaga-topo">
              <div>
                {confirmada ? (
                  <span className="td-vaga-selo td-vaga-selo--ok">Missão confirmada</span>
                ) : enviada ? (
                  <span className="td-vaga-selo">Candidatura enviada</span>
                ) : candidatura?.status === 'pendente' ? (
                  <span className="td-vaga-selo td-vaga-selo--convite">Convite da empresa</span>
                ) : (
                  <span className="td-vaga-selo td-vaga-selo--aberta">Aberta</span>
                )}
                <h3>{cargoLabel(demanda.cargo)}</h3>
                <button
                  type="button"
                  className="td-vaga-marca"
                  onClick={() => empresa && setPerfilId(demanda.id)}
                  disabled={!empresa}
                >
                  <span className="td-vaga-logo">
                    {empresa && logoDaEmpresa(empresa) ? (
                      <img src={logoDaEmpresa(empresa)} alt="" />
                    ) : (
                      iniciais(empresa?.nomeFantasia ?? 'Empresa')
                    )}
                  </span>
                  <span>
                    <strong>{empresa?.nomeFantasia ?? 'Empresa tomadora'}</strong>
                    <small>Ver perfil e localização</small>
                  </span>
                </button>
              </div>
              <div className="td-vaga-valor">
                <strong>{demanda.valorDiaria ? moeda(demanda.valorDiaria) : 'A combinar'}</strong>
                <small>por dia</small>
              </div>
            </div>
            <dl className="td-vaga-fatos">
              <div>
                <dt>Local</dt>
                <dd>
                  {demanda.endereco.cidade}/{demanda.endereco.estado}
                </dd>
              </div>
              <div>
                <dt>Distância</dt>
                <dd>
                  {distancia}
                  {local.estado === 'pronta' && <small>do seu aparelho</small>}
                  {local.estado !== 'pronta' && local.estado !== 'pedindo' && (
                    <button type="button" className="td-link" onClick={pedir}>
                      Ativar localização
                    </button>
                  )}
                </dd>
              </div>
              <div className="td-vaga-periodo">
                <dt>Período</dt>
                <dd>{periodo}</dd>
              </div>
              <div>
                <dt>Jornada</dt>
                <dd>
                  {demanda.horaInicio}–{demanda.horaFim}
                </dd>
              </div>
            </dl>
            {texto && <p className="td-vaga-texto">{texto}</p>}
            {(demanda.requisitos.length > 0 || demanda.beneficios) && (
              <div className="td-vaga-chips">
                {demanda.requisitos.map((item) => (
                  <span key={item} className="td-vaga-chip">
                    {item}
                  </span>
                ))}
                {demanda.beneficios && <span className="td-vaga-chip td-vaga-chip--soft">{demanda.beneficios}</span>}
              </div>
            )}
            <div className="td-vaga-acoes">
              {confirmada ? (
                <p className="td-vaga-nota">Você está nesta missão. O contrato aparece em Vagas aceitas.</p>
              ) : enviada ? (
                <p className="td-vaga-nota">Interesse registrado. O contrato só nasce quando a empresa confirma.</p>
              ) : candidatura?.status === 'pendente' ? (
                <>
                  <button type="button" className="td-vaga-btn" disabled={!aprovado} onClick={() => aplicar(demanda.id)}>
                    Tenho interesse
                  </button>
                  <button type="button" className="td-vaga-btn td-vaga-btn--ghost" disabled={!aprovado} onClick={() => recusar(demanda.id)}>
                    Não tenho interesse
                  </button>
                </>
              ) : (
                <button type="button" className="td-vaga-btn" disabled={!aprovado} onClick={() => aplicar(demanda.id)}>
                  {aprovado ? 'Candidatar-se' : 'Cadastro em análise'}
                </button>
              )}
            </div>
            {aviso?.id === demanda.id && <p className={aviso.ok ? 'success' : 'error'}>{aviso.texto}</p>}
          </article>
          {empresa && perfilId === demanda.id && (
            <PerfilEmpresa
              empresa={empresa}
              local={demanda.endereco}
              distanciaKm={Number.isFinite(kmAparelho) ? kmAparelho : undefined}
              distanciaTexto={local.estado === 'pronta' ? formatarDistancia(kmAparelho) : undefined}
              onFechar={() => setPerfilId(null)}
            />
          )}
          </Fragment>
        )
      })}
    </div>
  )
}

function semAcento(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function AgendaTab() {
  const { currentProfissional, state, doCheckIn, doCheckOut, addAvaliacao, currentUser, registrarEncerramento } = useStore()
  const prof = currentProfissional!
  const [pecaAberta, setPecaAberta] = useState<string | null>(null)

  const jobs = state.candidaturas
    .filter((c) => c.profissionalId === prof.id && c.status === 'confirmada')
    .map((c) => {
      const dem = state.demandas.find((d) => d.id === c.demandaId)!
      const emp = state.empresas.find((e) => e.id === dem.empresaId)
      const check = state.checkIns.find(
        (ch) => ch.demandaId === c.demandaId && ch.profissionalId === prof.id,
      )
      return { c, dem, emp, check }
    })
    .filter((job) => job.dem)

  return (
    <div className="panel panel--mobile">
      <h2>Vagas aceitas</h2>
      <ul className="list">
        {jobs.map(({ c, dem, emp, check }) => {
          const encerrada = dem.status === 'finalizada'
          const dias = dem.dataFim
            ? Math.round(
                (new Date(`${dem.dataFim}T12:00:00`).getTime() - new Date(`${dem.data}T12:00:00`).getTime()) /
                  86400000,
              ) + 1
            : 1
          const faltas = pendenciasParaIniciar({
            pecas: state.pecas ?? [],
            documentos: state.documentos,
            demandaId: dem.id,
            profissionalId: prof.id,
          })
          const documentos = (state.pecas ?? [])
            .filter(
              (p) =>
                p.demandaId === dem.id &&
                p.profissionalId === prof.id &&
                p.assinaturas.some((a) => a.papel === 'trabalhador'),
            )
            .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
          return (
            <li key={c.id} className="opportunity-card">
              <strong>Missão {dem.id.replace('dem_', '#')}</strong>
              <p>{cargoLabel(dem.cargo)}</p>
              <p className="muted">
                {emp?.nomeFantasia} · {rotuloPeriodo(dem.data, dem.dataFim)}
              </p>
              <p>{encerrada ? 'Encerrada' : faltas.length ? 'Aguardando admissão' : 'Em andamento'}</p>
              {faltas.length > 0 && !encerrada && (
                <p className="muted">Entrada bloqueada até concluir: {faltas.join('; ')}.</p>
              )}
              {encerrada && (
                <p className="muted">
                  Dias da missão: {dias}
                  {check?.horasTrabalhadas ? ` · Horas registradas: ${check.horasTrabalhadas}h` : ''}
                </p>
              )}
              {documentos.length > 0 && (
                <ul className="td-docs-missao">
                  {documentos.map((peca) => {
                    const pendente = peca.assinaturas.some(
                      (a) => a.papel === 'trabalhador' && a.status === 'pendente',
                    )
                    return (
                      <li key={peca.id}>
                        <button
                          type="button"
                          className={`btn ${pendente ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setPecaAberta(peca.id)}
                        >
                          {pendente ? `Assinar: ${peca.titulo}` : `${peca.titulo} · assinado`}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="row-actions">
                {!encerrada && !check?.checkInAt && faltas.length === 0 && (
                  <button type="button" className="btn btn-accent" onClick={() => doCheckIn(dem.id, prof.id)}>
                    Registrar entrada
                  </button>
                )}
                {!encerrada && check?.checkInAt && !check.checkOutAt && (
                  <button type="button" className="btn btn-primary" onClick={() => doCheckOut(dem.id, prof.id)}>
                    Registrar saída
                  </button>
                )}
                {check?.checkInAt && (
                  <span className="muted">
                    Entrada {new Date(check.checkInAt).toLocaleTimeString()}
                    {check.checkOutAt ? ` · Saída ${new Date(check.checkOutAt).toLocaleTimeString()}` : ''}
                  </span>
                )}
                {!encerrada && check?.checkOutAt && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      registrarEncerramento({
                        demandaId: dem.id,
                        dataEfetiva: new Date().toISOString().slice(0, 10),
                        motivo: 'término no prazo',
                        responsavel: 'ett',
                        observacoes: 'Encerramento ao fim da jornada registrada.',
                        profissionalId: prof.id,
                      })
                    }
                  >
                    Encerrar missão
                  </button>
                )}
                {check?.checkOutAt && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      addAvaliacao({
                        demandaId: dem.id,
                        deUserId: currentUser!.id,
                        paraUserId: emp!.userId,
                        deRole: 'profissional',
                        notas: { pontualidade: 5, qualidade: 5, educacao: 5, produtividade: 5 },
                        observacoes: 'Missão encerrada',
                      })
                    }
                  >
                    Avaliar empresa
                  </button>
                )}
              </div>
            </li>
          )
        })}
        {jobs.length === 0 && <p className="muted">Nenhuma missão confirmada. Quando houver contrato, ela aparece aqui.</p>}
      </ul>
      {pecaAberta && (
        <PecaViewer pecaId={pecaAberta} papel="trabalhador" nome={prof.nome} onClose={() => setPecaAberta(null)} />
      )}
    </div>
  )
}

function FinanceiroTab() {
  const { currentProfissional, state } = useStore()
  const prof = currentProfissional!
  const [filtro, setFiltro] = useState<'todos' | 'receber' | 'pagos'>('todos')
  const chavePix = validarChavePix(prof.pix)

  const linhas = useMemo(() => {
    const pagos = state.pagamentos
      .filter((pagamento) => pagamento.profissionalId === prof.id)
      .map((pagamento) => {
        const demanda = state.demandas.find((item) => item.id === pagamento.demandaId)
        const empresa = state.empresas.find((item) => item.id === pagamento.empresaId)
        const tipo = pagamento.status === 'pago' ? 'pago' : pagamento.status === 'estornado' ? 'estornado' : 'receber'
        return {
          id: pagamento.id,
          tipo,
          valor: pagamento.valor,
          quando: pagamento.createdAt,
          cargo: demanda ? cargoLabel(demanda.cargo) : 'Missão temporária',
          empresa: empresa?.nomeFantasia ?? 'Empresa tomadora',
          detalhe: demanda
            ? `${rotuloPeriodo(demanda.data, demanda.dataFim)} · ${demanda.horaInicio}–${demanda.horaFim}`
            : 'Pagamento da missão',
          status: tipo === 'pago' ? 'Pago' : tipo === 'estornado' ? 'Estornado' : 'A receber',
        }
      })
    const demandasPagas = new Set(
      state.pagamentos.filter((pagamento) => pagamento.profissionalId === prof.id).map((pagamento) => pagamento.demandaId),
    )
    const previstos = state.candidaturas
      .filter((candidatura) => candidatura.profissionalId === prof.id && candidatura.status === 'confirmada')
      .flatMap((candidatura) => {
        const demanda = state.demandas.find((item) => item.id === candidatura.demandaId)
        if (!demanda || demanda.status === 'finalizada' || demandasPagas.has(demanda.id)) return []
        const empresa = state.empresas.find((item) => item.id === demanda.empresaId)
        const dias = diasDaMissao(demanda.data, demanda.dataFim)
        return [
          {
            id: `previsto-${candidatura.id}`,
            tipo: 'receber' as const,
            valor: demanda.valorDiaria * dias,
            quando: demanda.data,
            cargo: cargoLabel(demanda.cargo),
            empresa: empresa?.nomeFantasia ?? 'Empresa tomadora',
            detalhe: `${dias} ${dias === 1 ? 'dia' : 'dias'} · ${moeda(demanda.valorDiaria)} por dia`,
            status: 'A receber',
          },
        ]
      })
    return [...previstos, ...pagos].sort((a, b) => b.quando.localeCompare(a.quando))
  }, [prof.id, state.candidaturas, state.demandas, state.empresas, state.pagamentos])

  const aReceber = linhas.filter((linha) => linha.tipo === 'receber').reduce((total, linha) => total + linha.valor, 0)
  const visiveis = linhas.filter((linha) => {
    if (filtro === 'receber') return linha.tipo === 'receber'
    if (filtro === 'pagos') return linha.tipo === 'pago'
    return true
  })

  return (
    <div className="td-fin">
      <header className="td-vagas-intro">
        <p className="td-home-kicker">Financeiro</p>
        <h2>Seus recebimentos</h2>
        <p>Saldo, ganhos do mês e o que ainda entra quando a missão confirmada termina.</p>
      </header>
      <section className="td-fin-resumo">
        <article className="td-fin-stat td-fin-stat--dark">
          <span>Saldo disponível</span>
          <strong>{moeda(prof.saldo)}</strong>
          <small>Já creditado</small>
        </article>
        <article className="td-fin-stat">
          <span>Ganhos do mês</span>
          <strong>{moeda(prof.ganhosMes)}</strong>
          <small>Neste mês</small>
        </article>
        <article className="td-fin-stat td-fin-stat--amarelo">
          <span>A receber</span>
          <strong>{moeda(aReceber)}</strong>
          <small>Missões confirmadas</small>
        </article>
      </section>
      <section className="td-fin-extrato">
        <header>
          <h3>Extrato</h3>
          <div className="td-fin-filtros">
            {(
              [
                ['todos', 'Todos'],
                ['receber', 'A receber'],
                ['pagos', 'Pagos'],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                className={filtro === id ? 'on' : ''}
                onClick={() => setFiltro(id)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </header>
        {visiveis.length === 0 && (
          <p className="td-fin-vazio">
            {filtro === 'todos'
              ? 'Nenhum lançamento ainda. O valor entra aqui quando uma missão confirmada é encerrada.'
              : 'Nenhum lançamento neste filtro.'}
          </p>
        )}
        <ul>
          {visiveis.map((linha) => (
            <li key={linha.id}>
              <div>
                <strong>{linha.cargo}</strong>
                <span>
                  {linha.empresa} · {linha.detalhe}
                </span>
              </div>
              <div className="td-fin-valor">
                <b>{linha.tipo === 'estornado' ? moeda(linha.valor) : `+ ${moeda(linha.valor)}`}</b>
                <small className={`td-fin-selo td-fin-selo--${linha.tipo}`}>{linha.status}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="td-fin-pix">
        <span>Chave PIX</span>
        <strong>{prof.pix}</strong>
        <small>
          {chavePix.ok
            ? `Chave de ${chavePix.rotulo}. Os pagamentos das missões caem aqui.`
            : 'Os pagamentos das missões são creditados nesta chave.'}
        </small>
      </section>
    </div>
  )
}

function diasDaMissao(inicio: string, fim?: string) {
  if (!fim) return 1
  const a = new Date(`${inicio}T12:00:00`)
  const b = new Date(`${fim}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 1
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function OpcoesTab({ onIr }: { onIr: (aba: TabId) => void }) {
  const { currentProfissional, definirVerTodasVagas, atualizarPix } = useStore()
  const prof = currentProfissional!
  const verTodas = prof.verTodasVagas !== false
  const [pix, setPix] = useState(prof.pix)
  const [erroPix, setErroPix] = useState('')
  const [avisoPix, setAvisoPix] = useState('')
  const conferencia = pix.trim() ? validarChavePix(pix) : null
  const atual = validarChavePix(prof.pix)

  function salvarPix() {
    const res = atualizarPix(prof.id, pix)
    if (!res.ok) {
      setErroPix(res.error)
      setAvisoPix('')
      return
    }
    setPix(res.chave)
    setErroPix('')
    setAvisoPix(`Chave de ${res.rotulo} salva.`)
  }

  return (
    <div className="td-opcoes">
      <header className="td-vagas-intro">
        <p className="td-home-kicker">Opções</p>
        <h2>Preferências</h2>
        <p>Configure o perfil e escolha quais publicações aparecem nas vagas.</p>
      </header>
      <section className="td-opcao">
        <h3>Perfil</h3>
        <p>Foto, dados, documentos e o que as empresas veem sobre você.</p>
        <button type="button" className="td-vaga-btn" onClick={() => onIr('perfil')}>
          Configurar perfil
        </button>
      </section>
      <section className="td-opcao">
        <h3>Chave PIX</h3>
        <p>Os pagamentos das missões caem nesta chave. CPF e CNPJ são conferidos pelos dígitos; e-mail, celular e chave aleatória pelo formato.</p>
        <p className="td-pix-atual">
          Chave atual: <strong>{prof.pix || 'nenhuma'}</strong>
          {atual.ok ? ` · ${atual.rotulo}` : ''}
        </p>
        <label className="td-pix-campo">
          <span>Nova chave</span>
          <input
            value={pix}
            inputMode="text"
            autoComplete="off"
            placeholder="CPF, e-mail, celular ou chave aleatória"
            onChange={(e) => {
              setPix(e.target.value)
              setErroPix('')
              setAvisoPix('')
            }}
          />
        </label>
        {conferencia?.ok && <p className="docs-ok">Chave de {conferencia.rotulo} conferida: {conferencia.chave}</p>}
        {conferencia && !conferencia.ok && <p className="error">{conferencia.erro}</p>}
        {erroPix && conferencia?.ok !== false && <p className="error">{erroPix}</p>}
        {avisoPix && <p className="docs-ok">{avisoPix}</p>}
        <button type="button" className="td-editor-pri" onClick={salvarPix}>
          Salvar chave PIX
        </button>
      </section>
      <section className="td-opcao">
        <h3>Publicações</h3>
        <p>Defina se a aba Vagas e o sininho mostram tudo no seu raio ou só o que combina com o seu cargo. O convite de uma empresa aparece no sininho mesmo assim.</p>
        <div className="td-opcao-escolha">
          <button type="button" className={verTodas ? 'on' : ''} onClick={() => definirVerTodasVagas(prof.id, true)}>
            <strong>Todas as publicações</strong>
            <span>Vagas abertas na sua cidade e no seu raio, de qualquer cargo.</span>
          </button>
          <button type="button" className={!verTodas ? 'on' : ''} onClick={() => definirVerTodasVagas(prof.id, false)}>
            <strong>Somente as da minha vaga</strong>
            <span>Apenas publicações dos cargos cadastrados no seu perfil.</span>
          </button>
        </div>
        {prof.profissoes.length > 0 && (
          <div className="td-vaga-chips">
            {prof.profissoes.map((id) => (
              <span key={id} className="td-vaga-chip">
                {cargoLabel(id)}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PerfilTab() {
  const { currentProfissional } = useStore()
  const prof = currentProfissional!
  const [docsOpen, setDocsOpen] = useState(false)
  const [editando, setEditando] = useState(false)
  const [fotoAoVivo, setFotoAoVivo] = useState<string | undefined>()
  const [erroFoto, setErroFoto] = useState('')
  const [salvo, setSalvo] = useState(false)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [slide, setSlide] = useState(0)
  const toque = useRef({ x: 0, y: 0 })
  const idade = idadeDe(prof.nascimento)
  const cargo = prof.profissoes[0] ? cargoLabel(prof.profissoes[0]) : 'Trabalhador'
  const nota = prof.avaliacaoMedia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const turnos = TURNOS.filter((item) => prof.disponibilidade[item.key])
  const fotoCapa = editando && fotoAoVivo ? fotoAoVivo : prof.foto

  function pararToque(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
  }

  function abrirFoto() {
    setSalvo(false)
    setErroFoto('')
    setEditando(true)
    arquivoRef.current?.click()
  }

  async function escolherFoto(file: File | undefined) {
    if (!file) return
    try {
      setFotoAoVivo(await lerFotoPerfil(file))
      setErroFoto('')
    } catch (falha) {
      setErroFoto(falha instanceof Error ? falha.message : 'Não foi possível ler a foto.')
    }
  }

  const slides = useMemo(() => {
    const itens: { id: string; node: ReactNode }[] = [
      {
        id: 'capa',
        node: (
          <div className="td-cover">
            {fotoCapa ? (
              <img src={fotoCapa} alt="" />
            ) : (
              <div className="td-mono" aria-hidden>
                <span>{iniciais(prof.nome)}</span>
              </div>
            )}
            <div className="td-shade" />
            <div className="td-badges">
              <LevelBadge nivel={prof.nivel} />
              <span className={`td-status td-status--${prof.status}`}>{rotuloStatus(prof.status)}</span>
            </div>
            <div className="td-copy">
              <h1>
                {prof.nome}
                {idade != null && <span> {idade}</span>}
              </h1>
              <p className="td-job">{cargo}</p>
              <p className="td-place">
                {prof.endereco.cidade}, {prof.endereco.estado}
              </p>
            </div>
          </div>
        ),
      },
    ]
    prof.experiencia.slice(0, 2).forEach((item, index) => {
      itens.push({
        id: `exp-${index}`,
        node: (
          <div className="td-prompt">
            <small>Experiência</small>
            <h2>{item.cargo}</h2>
            <p>{item.empresa}</p>
            <span>
              {periodo(item.inicio, item.fim)}
              {item.descricao ? ` · ${item.descricao}` : ''}
            </span>
          </div>
        ),
      })
    })
    if (prof.certificados.length || prof.cnhCategoria) {
      itens.push({
        id: 'certs',
        node: (
          <div className="td-prompt td-prompt--ink">
            <small>Certificados</small>
            <h2>{prof.certificados[0]?.tipo ?? `CNH ${prof.cnhCategoria}`}</h2>
            <p>
              {[
                prof.cnhCategoria ? `CNH ${prof.cnhCategoria}` : '',
                ...prof.certificados.map((c) => c.tipo),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        ),
      })
    }
    return itens
  }, [cargo, fotoCapa, idade, prof])

  function ir(delta: number) {
    setSlide((atual) => Math.min(slides.length - 1, Math.max(0, atual + delta)))
  }

  function soltar(event: ReactPointerEvent<HTMLDivElement>) {
    if (slides.length < 2) return
    const dx = event.clientX - toque.current.x
    const dy = event.clientY - toque.current.y
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 24) return
    if (dx <= -36) {
      ir(1)
      return
    }
    if (dx >= 36) {
      ir(-1)
      return
    }
    if (Math.abs(dx) > 16) return
    const caixa = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - caixa.left
    ir(x < caixa.width * 0.35 ? -1 : 1)
  }

  return (
    <div className="td-page">
      <input
        ref={arquivoRef}
        className="td-arquivo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          void escolherFoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <article
        className="td-hero"
        onPointerDown={(event) => {
          toque.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerUp={soltar}
      >
        <div className="td-bars" aria-hidden>
          {slides.map((item, index) => (
            <span key={item.id} className={index <= slide ? 'on' : ''} />
          ))}
        </div>
        <div className="td-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
          {slides.map((item) => (
            <div className="td-slide" key={item.id}>
              {item.node}
            </div>
          ))}
        </div>
        {slide === 0 && (
          <button
            type="button"
            className="td-foto-btn"
            onPointerDown={pararToque}
            onPointerUp={pararToque}
            onClick={abrirFoto}
          >
            Trocar foto
          </button>
        )}
      </article>

      <div className="td-painel">
      {salvo && !editando && <p className="docs-ok">Perfil atualizado.</p>}
      {erroFoto && <p className="error">{erroFoto}</p>}
      {!editando && (
        <button
          type="button"
          className="td-editor-pri"
          onClick={() => {
            setSalvo(false)
            setEditando(true)
          }}
        >
          Editar perfil
        </button>
      )}
      {editando ? (
        <EditorPerfil
          prof={prof}
          fotoNova={fotoAoVivo}
          onFechar={() => {
            setEditando(false)
            setFotoAoVivo(undefined)
          }}
          onSalvou={() => {
            setEditando(false)
            setFotoAoVivo(undefined)
            setSalvo(true)
          }}
        />
      ) : (
        <>
      <section className="td-card">
        <h2>Sobre</h2>
        <p>{prof.resumo || textoSobre(prof.experiencia, cargo, prof.endereco.cidade)}</p>
      </section>

      <section className="td-card">
        <h2>O básico</h2>
        <ul className="td-facts">
          <li>
            <IconeBolha>
              <path d="M4 9h16v10H4z" stroke="currentColor" strokeWidth="1.75" />
              <path d="M9 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.75" />
            </IconeBolha>
            <span>{cargo}</span>
          </li>
          <li>
            <IconeBolha>
              <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="12" cy="11" r="1.6" fill="currentColor" />
            </IconeBolha>
            <span>
              {prof.endereco.cidade}, {prof.endereco.estado} · até {prof.raioKm} km
            </span>
          </li>
          <li>
            <IconeBolha>
              <path d="m12 3 2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.8 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
            </IconeBolha>
            <span>Avaliação {nota}</span>
          </li>
          <li>
            <IconeBolha>
              <path d="m5 12 4.2 4.2L19 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </IconeBolha>
            <span>{prof.taxaComparecimento}% de comparecimento · {prof.faltas} {prof.faltas === 1 ? 'falta' : 'faltas'}</span>
          </li>
          <li>
            <IconeBolha>
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
              <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </IconeBolha>
            <span>Responde em {prof.tempoRespostaMin} min</span>
          </li>
          {prof.cnhCategoria && (
            <li>
              <IconeBolha>
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
                <path d="M7 12h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </IconeBolha>
              <span>CNH {prof.cnhCategoria}</span>
            </li>
          )}
          {prof.escolaridade && (
            <li>
              <IconeBolha>
                <path d="m3 9 9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
                <path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4" stroke="currentColor" strokeWidth="1.75" />
              </IconeBolha>
              <span>{prof.escolaridade}</span>
            </li>
          )}
        </ul>
      </section>

      {prof.profissoes.length > 0 && (
        <section className="td-card">
          <h2>Profissões</h2>
          <div className="td-chips">
            {prof.profissoes.map((id, index) => (
              <span key={id} className={index === 0 ? 'td-chip td-chip--on' : 'td-chip'}>
                {cargoLabel(id)}
              </span>
            ))}
          </div>
        </section>
      )}

      {prof.experiencia.length > 0 && (
        <section className="td-card">
          <h2>Experiência</h2>
          <ul className="td-jobs">
            {prof.experiencia.map((item) => (
              <li key={`${item.empresa}-${item.inicio}`}>
                <strong>{item.cargo}</strong>
                <span>
                  {item.empresa} · {periodo(item.inicio, item.fim)}
                </span>
                {item.descricao && <p>{item.descricao}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {prof.certificados.length > 0 && (
        <section className="td-card">
          <h2>Certificados</h2>
          <div className="td-chips">
            {prof.certificados.map((item) => (
              <span key={item.tipo} className="td-chip td-chip--on">
                {item.tipo}
                {item.valido ? '' : ' · vencido'}
              </span>
            ))}
          </div>
        </section>
      )}

      {(prof.habilidades?.length ?? 0) > 0 && (
        <section className="td-card">
          <h2>Habilidades</h2>
          <div className="td-chips">
            {prof.habilidades?.map((item) => (
              <span key={item} className="td-chip">
                {item}
              </span>
            ))}
          </div>
        </section>
      )}

      {turnos.length > 0 && (
        <section className="td-card">
          <h2>Disponibilidade</h2>
          <div className="td-chips">
            {turnos.map((item) => (
              <span key={item.key} className="td-chip">
                {item.label}
              </span>
            ))}
          </div>
        </section>
      )}
        </>
      )}

      <section className="td-card">
        <button
          type="button"
          className="td-fold"
          aria-expanded={docsOpen}
          onClick={() => setDocsOpen((aberto) => !aberto)}
        >
          <span>Meus documentos</span>
          <small>{docsOpen ? 'Ocultar' : 'Abrir'}</small>
        </button>
        {docsOpen && (
          <div className="td-docs">
            <DocumentacaoProfissionalPanel profissional={prof} />
            <BibliotecaDocumental modo="trabalhador" />
          </div>
        )}
      </section>
      </div>
    </div>
  )
}

const TURNOS: { key: keyof Disponibilidade; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'amanha', label: 'Amanhã' },
  { key: 'estaSemana', label: 'Esta semana' },
  { key: 'finaisDeSemana', label: 'Finais de semana' },
  { key: 'noturno', label: 'Noturno' },
  { key: 'viagens', label: 'Viagens' },
  { key: 'temporario', label: 'Temporário' },
  { key: 'efetivo', label: 'Efetivo' },
  { key: 'freelancer', label: 'Freelancer' },
]

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function idadeDe(nascimento: string) {
  const nasc = new Date(`${nascimento}T12:00:00`)
  if (Number.isNaN(nasc.getTime())) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const aniversario = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())
  if (hoje < aniversario) idade -= 1
  return idade >= 0 ? idade : null
}

function mesAno(iso: string) {
  const [ano, mes] = iso.split('-')
  const nome = MESES[Number(mes) - 1]
  if (!ano || !nome) return iso
  return `${nome}/${ano}`
}

function periodo(inicio: string, fim: string) {
  return `${mesAno(inicio)} a ${fim ? mesAno(fim) : 'atual'}`
}

function rotuloStatus(status: 'pendente' | 'aprovado' | 'bloqueado') {
  if (status === 'aprovado') return 'Aprovado'
  if (status === 'bloqueado') return 'Bloqueado'
  return 'Em análise'
}

function textoSobre(
  experiencia: { cargo: string; empresa: string; descricao: string }[],
  cargo: string,
  cidade: string,
) {
  const ultima = experiencia[0]
  if (!ultima) return `${cargo} em ${cidade}.`
  const detalhe = ultima.descricao ? ` ${ultima.descricao}.` : ''
  return `${ultima.cargo} na ${ultima.empresa}.${detalhe} Atua como ${cargo} em ${cidade}.`
}

function IconeBolha({ children }: { children: ReactNode }) {
  return (
    <span className="td-ico" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        {children}
      </svg>
    </span>
  )
}
