// Hierarquia das empresas no Painel Admin, no mesmo desenho do Oferta de Carga:
// Operador Logístico → Filial do Operador → Embarcador → Unidade → Transportadora.
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { erroCnpj, mascararCnpj } from '../../lib/apisPublicas'
import { coordenadaDaCidade } from '../../lib/coordenadaCidade'
import {
  ORG_TIPO_LABEL,
  ORG_TIPOS,
  TIPOS_NO_TOPO,
  contarNos,
  montarArvoreEmpresas,
  paisPossiveis,
  podeFicarAbaixo,
  tiposFilhos,
  type NoEmpresa,
} from '../../lib/orgHierarquia'
import { emDemo } from '../../lib/modo'
import { useStore } from '../../lib/store'
import type { Empresa, EmpresaTipo, OrgTipo } from '../../lib/types'
import './hierarquia.css'

// ---------- ícones (mesmo desenho do Oferta de Carga, em SVG para não trazer biblioteca) ----------
function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}
const IconeSeta = ({ aberto }: { aberto: boolean }) => <Svg>{aberto ? <path d="m6 9 6 6 6-6" /> : <path d="m9 18 6-6-6-6" />}</Svg>
const IconeLapis = () => <Svg size={14}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>
const IconeMais = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>
const IconeMenos = () => <Svg><path d="M5 12h14" /></Svg>
const IconeContas = () => <Svg size={15}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></Svg>
const IconeDocumento = () => <Svg size={12}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></Svg>
const ICONE_TIPO: Record<OrgTipo, () => ReactNode> = {
  operador_logistico: () => <Svg size={13}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></Svg>,
  filial_operador: () => <Svg size={13}><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M6 9v12M18 15V9a3 3 0 0 0-3-3H9" /></Svg>,
  embarcador: () => <Svg size={13}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></Svg>,
  unidade: () => <Svg size={13}><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" /><path d="M6 18h12M6 14h12" /></Svg>,
  transportadora: () => <Svg size={13}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></Svg>,
}
const CLASSE_TIPO: Record<OrgTipo, string> = {
  operador_logistico: 'operador',
  filial_operador: 'filial',
  embarcador: 'embarcador',
  unidade: 'unidade',
  transportadora: 'transportadora',
}

const TIPO_NEGOCIO: Record<EmpresaTipo, string> = {
  transportadora: 'Transportadora',
  operador_logistico: 'Operador logístico',
  industria: 'Indústria',
  centro_distribuicao: 'Centro de distribuição',
  atacadista: 'Atacadista',
  varejo: 'Varejo',
  outro: 'Outro',
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// ---------- tela ----------
export function HierarquiaEmpresas() {
  const store = useStore()
  const { state } = store
  const { raizes, fora } = useMemo(() => montarArvoreEmpresas(state.empresas), [state.empresas])
  const [fechados, setFechados] = useState<Set<string>>(() => new Set())
  const [novo, setNovo] = useState<{ paiId: string | null; tipos: OrgTipo[] } | null>(null)
  const [posicionar, setPosicionar] = useState<Empresa | null>(null)

  function alternar(id: string) {
    setFechados((atual) => {
      const prox = new Set(atual)
      if (prox.has(id)) prox.delete(id)
      else prox.add(id)
      return prox
    })
  }

  async function tirar(no: NoEmpresa) {
    const abaixo = contarNos(no) - 1
    const aviso = abaixo
      ? ` As ${abaixo} empresa(s) abaixo dela sobem um nível.`
      : ''
    if (!window.confirm(`Tirar "${no.empresa.nomeFantasia}" da hierarquia?${aviso} A empresa e a conta continuam existindo.`)) return
    const r = await store.adminTirarDaHierarquia(no.empresa.id)
    if (!r.ok) window.alert(r.error || 'Não foi possível tirar da hierarquia.')
  }

  return (
    <div className="px-page">
      <h1 className="px-title">Hierarquia</h1>
      <p className="muted hq-dica">
        Operador Logístico → Filial do Operador → Embarcador → Unidade → Transportadora. Use a seta para abrir ou
        fechar cada grupo; o <strong>+</strong> cadastra uma empresa logo abaixo.
      </p>
      <div className="org-tree__toolbar">
        {TIPOS_NO_TOPO.map((tipo) => (
          <button key={tipo} type="button" className="px-btn px-btn-outline" onClick={() => setNovo({ paiId: null, tipos: [tipo] })}>
            + {ORG_TIPO_LABEL[tipo]}
          </button>
        ))}
      </div>
      {raizes.length === 0 ? (
        <p className="org-tree__empty">Nenhuma empresa na hierarquia ainda. Use + Operador Logístico ou + Embarcador.</p>
      ) : (
        <ArvoreNos
          nos={raizes}
          fechados={fechados}
          aninhado={false}
          onAlternar={alternar}
          onAdicionar={(no) => setNovo({ paiId: no.empresa.id, tipos: tiposFilhos(no.tipo) })}
          onEditar={(no) => setPosicionar(no.empresa)}
          onTirar={(no) => void tirar(no)}
        />
      )}

      {fora.length > 0 && (
        <section className="hq-fora">
          <h2>Fora da hierarquia</h2>
          <p className="muted">Empresas que se cadastraram sozinhas ou foram tiradas da hierarquia. Escolha onde cada uma fica.</p>
          <ul className="org-tree">
            {fora.map((empresa) => (
              <li key={empresa.id} className="org-tree__node">
                <div className="org-tree__card hq-card--fora">
                  <div className="org-tree__left">
                    <span className="org-tree__logo org-tree__logo--empty hq-logo--fora" aria-hidden>{iniciais(empresa.nomeFantasia)}</span>
                    <div className="org-tree__meta">
                      <strong className="org-tree__name">{empresa.nomeFantasia}</strong>
                      {empresa.cnpj && <span className="org-tree__cnpj"><IconeDocumento />{empresa.cnpj}</span>}
                    </div>
                  </div>
                  <div className="org-tree__right">
                    {empresa.status !== 'aprovada' && <span className={`px-status px-status--${empresa.status}`}>{empresa.status}</span>}
                    <button type="button" className="px-btn px-btn-outline" onClick={() => setPosicionar(empresa)}>
                      Colocar na hierarquia
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {novo && <NovaEmpresaModal paiInicial={novo.paiId} tiposPermitidos={novo.tipos} onFechar={() => setNovo(null)} />}
      {posicionar && <PosicionarModal empresa={posicionar} onFechar={() => setPosicionar(null)} />}
    </div>
  )
}

function ArvoreNos({
  nos,
  fechados,
  aninhado = true,
  onAlternar,
  onAdicionar,
  onEditar,
  onTirar,
}: {
  nos: NoEmpresa[]
  fechados: Set<string>
  aninhado?: boolean
  onAlternar: (id: string) => void
  onAdicionar: (no: NoEmpresa) => void
  onEditar: (no: NoEmpresa) => void
  onTirar: (no: NoEmpresa) => void
}) {
  return (
    <ul className={`org-tree${aninhado ? ' org-tree--nested' : ''}`}>
      {nos.map((no) => {
        const aberto = !fechados.has(no.empresa.id)
        const filhos = tiposFilhos(no.tipo)
        const classe = CLASSE_TIPO[no.tipo]
        const Icone = ICONE_TIPO[no.tipo]
        const { empresa } = no
        return (
          <li key={empresa.id} className="org-tree__node">
            <div className={`org-tree__card org-tree__card--${classe}`}>
              <div className="org-tree__left">
                {no.filhos.length > 0 ? (
                  <button
                    type="button"
                    className="org-tree__toggle"
                    aria-expanded={aberto}
                    aria-label={aberto ? 'Recolher' : 'Expandir'}
                    onClick={() => onAlternar(empresa.id)}
                  >
                    <IconeSeta aberto={aberto} />
                  </button>
                ) : null}
                <span className={`org-tree__logo org-tree__logo--empty org-tree__logo--${classe}`} aria-hidden>
                  {iniciais(empresa.nomeFantasia)}
                </span>
                <div className="org-tree__meta">
                  <strong className="org-tree__name">{empresa.nomeFantasia}</strong>
                  {empresa.cnpj ? (
                    <span className="org-tree__cnpj">
                      <IconeDocumento />
                      {empresa.cnpj}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="org-tree__right">
                {empresa.status !== 'aprovada' && <span className={`px-status px-status--${empresa.status}`}>{empresa.status}</span>}
                <span className={`org-tree__badge org-tree__badge--${classe}`}>
                  <Icone />
                  {ORG_TIPO_LABEL[no.tipo]}
                </span>
                <span className="org-tree__users" title="Contas de acesso neste nível e abaixo">
                  <IconeContas />
                  {contarNos(no)}
                </span>
                <button type="button" className="org-tree__icon-btn" title="Editar lugar na hierarquia" onClick={() => onEditar(no)}>
                  <IconeLapis />
                </button>
                {filhos.length > 0 && (
                  <button
                    type="button"
                    className="org-tree__icon-btn"
                    title={`Cadastrar ${filhos.map((t) => ORG_TIPO_LABEL[t]).join(' ou ')} abaixo`}
                    onClick={() => onAdicionar(no)}
                  >
                    <IconeMais />
                  </button>
                )}
                <button type="button" className="org-tree__icon-btn org-tree__icon-btn--danger" title="Tirar da hierarquia" onClick={() => onTirar(no)}>
                  <IconeMenos />
                </button>
              </div>
            </div>
            {aberto && no.filhos.length > 0 && (
              <ArvoreNos
                nos={no.filhos}
                fechados={fechados}
                onAlternar={onAlternar}
                onAdicionar={onAdicionar}
                onEditar={onEditar}
                onTirar={onTirar}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------- lugar na hierarquia de uma empresa que já existe ----------
function PosicionarModal({ empresa, onFechar }: { empresa: Empresa; onFechar: () => void }) {
  const store = useStore()
  const [tipo, setTipo] = useState<OrgTipo>(empresa.orgTipo ?? 'embarcador')
  const [paiId, setPaiId] = useState<string>(empresa.orgPaiId ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const pais = paisPossiveis(store.state.empresas, tipo, empresa.id)
  const paiValido = paiId && pais.some((p) => p.id === paiId) ? paiId : ''
  const podeTopo = TIPOS_NO_TOPO.includes(tipo)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!paiValido && !podeTopo) {
      setErro(`Escolha abaixo de quem a ${ORG_TIPO_LABEL[tipo]} fica.`)
      return
    }
    setSalvando(true)
    const r = await store.adminPosicionarEmpresa(empresa.id, { orgTipo: tipo, orgPaiId: paiValido || null })
    setSalvando(false)
    if (!r.ok) {
      setErro(r.error || 'Não foi possível salvar.')
      return
    }
    onFechar()
  }

  return (
    <div className="px-modal-backdrop" onClick={onFechar}>
      <form className="px-modal hq-modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar} role="dialog" aria-modal="true">
        <div className="px-modal-head">
          <div>
            <h2 style={{ margin: 0 }}>Lugar na hierarquia</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>{empresa.nomeFantasia}</p>
          </div>
          <button type="button" className="px-btn px-btn-ghost" onClick={onFechar}>
            Fechar
          </button>
        </div>
        <CamposPosicao tipo={tipo} tipos={ORG_TIPOS} onTipo={setTipo} paiId={paiValido} pais={pais} podeTopo={podeTopo} onPai={setPaiId} />
        {erro && <p className="error">{erro}</p>}
        <div className="hq-acoes">
          <button type="button" className="px-btn px-btn-ghost" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="px-btn px-btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CamposPosicao({
  tipo,
  tipos,
  onTipo,
  paiId,
  pais,
  podeTopo,
  onPai,
}: {
  tipo: OrgTipo
  tipos: OrgTipo[]
  onTipo: (t: OrgTipo) => void
  paiId: string
  pais: Empresa[]
  podeTopo: boolean
  onPai: (id: string) => void
}) {
  return (
    <div className="hq-grade">
      <label className="field">
        <span>Tipo na hierarquia *</span>
        <select value={tipo} onChange={(e) => onTipo(e.target.value as OrgTipo)}>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {ORG_TIPO_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Fica abaixo de {podeTopo ? '' : '*'}</span>
        <select value={paiId} onChange={(e) => onPai(e.target.value)}>
          {podeTopo ? <option value="">— Topo da hierarquia —</option> : <option value="">Escolha...</option>}
          {pais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nomeFantasia} ({p.orgTipo ? ORG_TIPO_LABEL[p.orgTipo] : ''})
            </option>
          ))}
        </select>
        {!podeTopo && pais.length === 0 && (
          <small className="muted">Ainda não há empresa que possa ficar acima de uma {ORG_TIPO_LABEL[tipo]}.</small>
        )}
      </label>
    </div>
  )
}

// ---------- cadastro de empresa pela gestão ----------
const VAZIO = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  tipoNegocio: 'outro' as EmpresaTipo,
  telefone: '',
  responsavelNome: '',
  responsavelCargo: '',
  cep: '',
  rua: '',
  numero: '',
  cidade: '',
  estado: '',
  email: '',
  usuario: '',
}

export function NovaEmpresaModal({
  paiInicial = null,
  tiposPermitidos,
  onFechar,
}: {
  paiInicial?: string | null
  tiposPermitidos?: OrgTipo[]
  onFechar: () => void
}) {
  const store = useStore()
  const { state } = store
  const pai = paiInicial ? state.empresas.find((e) => e.id === paiInicial) : undefined
  const tipos = tiposPermitidos?.length ? tiposPermitidos : ORG_TIPOS
  const [tipo, setTipo] = useState<OrgTipo>(tipos[0])
  const [paiId, setPaiId] = useState<string>(paiInicial ?? '')
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState<{ usuario: string; email: string; senha: string; emailEnviado: boolean } | null>(null)
  const pais = paisPossiveis(state.empresas, tipo)
  const paiValido = paiId && pais.some((p) => p.id === paiId) ? paiId : ''
  const podeTopo = TIPOS_NO_TOPO.includes(tipo)
  const set = (campo: keyof typeof VAZIO, valor: string) => setForm((f) => ({ ...f, [campo]: valor }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (emDemo()) {
      setErro('Na demonstração não dá para cadastrar empresa de verdade.')
      return
    }
    if (!paiValido && !podeTopo) return setErro(`Escolha abaixo de quem a ${ORG_TIPO_LABEL[tipo]} fica.`)
    if (paiValido) {
      const p = pais.find((x) => x.id === paiValido)
      if (p && !podeFicarAbaixo(tipo, p.orgTipo)) return setErro('Esse tipo não pode ficar abaixo da empresa escolhida.')
    }
    if (!form.razaoSocial.trim() || !form.nomeFantasia.trim()) return setErro('Informe a razão social e o nome fantasia.')
    const falhaCnpj = erroCnpj(form.cnpj)
    if (falhaCnpj) return setErro(falhaCnpj)
    if (!form.cidade.trim() || form.estado.trim().length !== 2) return setErro('Informe a cidade e a UF (2 letras).')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setErro('Informe um e-mail válido para o acesso da empresa.')
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(form.usuario.trim())) {
      return setErro('O usuário deve ter de 3 a 30 letras, números, ponto, hífen ou sublinhado.')
    }
    const coord = coordenadaDaCidade(form.cidade, form.estado, [
      ...state.empresas.map((x) => x.endereco),
      ...state.profissionais.map((x) => x.endereco),
    ])
    setEnviando(true)
    const r = await store.adminCriarEmpresa({
      usuario: form.usuario.trim(),
      email: form.email.trim(),
      orgTipo: tipo,
      orgPaiId: paiValido || null,
      empresa: {
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        cnpj: mascararCnpj(form.cnpj),
        tipo: form.tipoNegocio,
        telefone: form.telefone.trim(),
        responsavelNome: form.responsavelNome.trim(),
        responsavelCargo: form.responsavelCargo.trim(),
        endereco: {
          cep: form.cep.trim(),
          rua: form.rua.trim(),
          numero: form.numero.trim(),
          cidade: form.cidade.trim(),
          estado: form.estado.trim().toUpperCase(),
          lat: coord.lat,
          lng: coord.lng,
        },
      },
    })
    setEnviando(false)
    if (!r.ok) return setErro(r.error)
    setPronto(r)
  }

  return (
    <div className="px-modal-backdrop" onClick={onFechar}>
      <div className="px-modal px-modal--wide hq-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="px-modal-head">
          <div>
            <h2 style={{ margin: 0 }}>Cadastrar empresa</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {pai ? `Abaixo de ${pai.nomeFantasia}` : 'A empresa entra já aprovada e recebe o acesso por e-mail.'}
            </p>
          </div>
          <button type="button" className="px-btn px-btn-ghost" onClick={onFechar}>
            Fechar
          </button>
        </div>

        {pronto ? (
          <div className="hq-pronto">
            <p className="docs-ok">Empresa cadastrada e já aprovada.</p>
            <dl className="ad-dl">
              <div><dt>Usuário</dt><dd><strong>{pronto.usuario}</strong></dd></div>
              <div><dt>E-mail</dt><dd>{pronto.email}</dd></div>
              <div><dt>Senha provisória</dt><dd><code className="hq-senha">{pronto.senha}</code></dd></div>
            </dl>
            <p className="muted">
              {pronto.emailEnviado
                ? 'O login e a senha provisória foram enviados para o e-mail da empresa.'
                : 'Não foi possível mandar o e-mail agora: passe o login e a senha provisória para a empresa.'}{' '}
              No primeiro acesso ela cria a própria senha.
            </p>
            <div className="hq-acoes">
              <button type="button" className="px-btn px-btn-ghost" onClick={() => void navigator.clipboard?.writeText(`Usuário: ${pronto.usuario}\nSenha provisória: ${pronto.senha}`)}>
                Copiar acesso
              </button>
              <button type="button" className="px-btn px-btn-primary" onClick={onFechar}>
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={salvar}>
            <h3 className="hq-secao">Lugar na hierarquia</h3>
            <CamposPosicao tipo={tipo} tipos={tipos} onTipo={setTipo} paiId={paiValido} pais={pais} podeTopo={podeTopo} onPai={setPaiId} />

            <h3 className="hq-secao">Dados da empresa</h3>
            <div className="hq-grade">
              <label className="field"><span>Razão social *</span><input value={form.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} /></label>
              <label className="field"><span>Nome fantasia *</span><input value={form.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} /></label>
              <label className="field"><span>CNPJ *</span><input value={form.cnpj} inputMode="numeric" onChange={(e) => set('cnpj', mascararCnpj(e.target.value))} /></label>
              <label className="field">
                <span>Ramo</span>
                <select value={form.tipoNegocio} onChange={(e) => set('tipoNegocio', e.target.value)}>
                  {(Object.keys(TIPO_NEGOCIO) as EmpresaTipo[]).map((t) => (
                    <option key={t} value={t}>{TIPO_NEGOCIO[t]}</option>
                  ))}
                </select>
              </label>
              <label className="field"><span>Telefone</span><input value={form.telefone} inputMode="tel" onChange={(e) => set('telefone', e.target.value)} /></label>
              <label className="field"><span>Responsável</span><input value={form.responsavelNome} onChange={(e) => set('responsavelNome', e.target.value)} /></label>
              <label className="field"><span>Cargo do responsável</span><input value={form.responsavelCargo} onChange={(e) => set('responsavelCargo', e.target.value)} /></label>
              <label className="field"><span>CEP</span><input value={form.cep} inputMode="numeric" onChange={(e) => set('cep', e.target.value)} /></label>
              <label className="field"><span>Rua</span><input value={form.rua} onChange={(e) => set('rua', e.target.value)} /></label>
              <label className="field"><span>Número</span><input value={form.numero} onChange={(e) => set('numero', e.target.value)} /></label>
              <label className="field"><span>Cidade *</span><input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} /></label>
              <label className="field"><span>UF *</span><input value={form.estado} maxLength={2} onChange={(e) => set('estado', e.target.value.toUpperCase())} /></label>
            </div>

            <h3 className="hq-secao">Acesso da empresa</h3>
            <div className="hq-grade">
              <label className="field"><span>E-mail *</span><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
              <label className="field"><span>Usuário (login) *</span><input value={form.usuario} autoCapitalize="none" onChange={(e) => set('usuario', e.target.value)} /></label>
            </div>
            <p className="muted">O sistema gera uma senha provisória e manda o login por e-mail. No primeiro acesso a empresa cria a própria senha.</p>

            {erro && <p className="error">{erro}</p>}
            <div className="hq-acoes">
              <button type="button" className="px-btn px-btn-ghost" onClick={onFechar}>Cancelar</button>
              <button type="submit" className="px-btn px-btn-primary" disabled={enviando}>{enviando ? 'Cadastrando...' : 'Cadastrar empresa'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
