// Abas Demandas, Financeiro e Auditoria do Painel Admin.
// Antes eram só um título e uma lista: sem dados, a página ficava em branco.
import { useMemo, useState } from 'react'
import { cargoLabel } from '../../data/categories'
import { useStore } from '../../lib/store'
import type { DemandaStatus } from '../../lib/types'

const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function dataBr(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

function dataHoraBr(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="px-card ad-vazio">
      <strong>{titulo}</strong>
      <p className="muted">{texto}</p>
    </section>
  )
}

const ROTULO_DEMANDA: Record<DemandaStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}

// ---------------------------------------------------------------- Demandas
export function DemandasAdmin() {
  const { state, cancelDemanda } = useStore()
  const [filtro, setFiltro] = useState<DemandaStatus | 'todas'>('todas')
  const conta = (s: DemandaStatus) => state.demandas.filter((d) => d.status === s).length
  const lista = useMemo(
    () =>
      [...state.demandas]
        .filter((d) => filtro === 'todas' || d.status === filtro)
        .sort((a, b) => (b.createdAt || b.data).localeCompare(a.createdAt || a.data)),
    [state.demandas, filtro],
  )

  return (
    <div className="px-page">
      <h1 className="px-title">Demandas</h1>
      <p className="ad-lead">Vagas publicadas pelas empresas, do início ao encerramento.</p>
      <div className="ad-kpis">
        <div className="ad-kpi"><span>Abertas</span><strong>{conta('aberta')}</strong><small>recebendo candidaturas</small></div>
        <div className="ad-kpi"><span>Em andamento</span><strong>{conta('em_andamento')}</strong><small>com profissional trabalhando</small></div>
        <div className="ad-kpi"><span>Finalizadas</span><strong>{conta('finalizada')}</strong><small>{conta('cancelada')} canceladas</small></div>
      </div>

      {state.demandas.length === 0 ? (
        <Vazio
          titulo="Nenhuma vaga publicada ainda."
          texto="Quando uma empresa publicar uma vaga, ela aparece aqui com o período, a cidade, quantas pessoas precisa e a diária."
        />
      ) : (
        <>
          <div className="ad-filtros" role="group" aria-label="Filtrar por situação">
            {(['todas', 'aberta', 'em_andamento', 'finalizada', 'cancelada'] as const).map((s) => (
              <button key={s} type="button" className={`ad-filtro${filtro === s ? ' is-on' : ''}`} onClick={() => setFiltro(s)}>
                {s === 'todas' ? `Todas (${state.demandas.length})` : `${ROTULO_DEMANDA[s]} (${conta(s)})`}
              </button>
            ))}
          </div>
          {lista.length === 0 ? (
            <p className="muted">Nenhuma vaga nessa situação.</p>
          ) : (
            <ul className="px-list">
              {lista.map((d) => {
                const emp = state.empresas.find((e) => e.id === d.empresaId)
                const confirmadas = state.candidaturas.filter((c) => c.demandaId === d.id && c.status === 'confirmada').length
                const candidatos = state.candidaturas.filter((c) => c.demandaId === d.id).length
                return (
                  <li key={d.id} className="px-list-card">
                    <div>
                      <strong>{cargoLabel(d.cargo)}</strong>
                      <p className="muted">
                        {emp?.nomeFantasia ?? 'Empresa'} · {d.endereco?.cidade || '—'}/{d.endereco?.estado || '—'} ·{' '}
                        {dataBr(d.data)}
                        {d.dataFim && d.dataFim !== d.data ? ` a ${dataBr(d.dataFim)}` : ''} · {d.horaInicio}–{d.horaFim}
                      </p>
                      <p className="muted">
                        {confirmadas}/{d.quantidade} confirmados · {candidatos} candidatura{candidatos === 1 ? '' : 's'} · diária{' '}
                        {brl(d.valorDiaria)}
                      </p>
                    </div>
                    <div className="px-row-actions">
                      <span className={`px-status px-status--${d.status}`}>{ROTULO_DEMANDA[d.status] ?? d.status}</span>
                      {d.status === 'aberta' && (
                        <button
                          type="button"
                          className="px-btn px-btn-ghost"
                          onClick={() => {
                            if (window.confirm(`Cancelar a vaga de ${cargoLabel(d.cargo)} de ${emp?.nomeFantasia ?? 'empresa'}?`)) {
                              cancelDemanda(d.id)
                            }
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Financeiro
export function FinanceiroAdmin() {
  const { state } = useStore()
  const pagamentos = useMemo(
    () => [...state.pagamentos].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [state.pagamentos],
  )
  const soma = (f: (p: (typeof pagamentos)[number]) => boolean, campo: 'valor' | 'comissao') =>
    pagamentos.filter(f).reduce((s, p) => s + (Number(p[campo]) || 0), 0)
  const validos = (p: (typeof pagamentos)[number]) => p.status !== 'estornado'

  return (
    <div className="px-page">
      <h1 className="px-title">Financeiro</h1>
      <p className="ad-lead">Pagamentos das missões aos profissionais e a comissão da Doca Livre.</p>
      <div className="ad-kpis">
        <div className="ad-kpi"><span>Volume das diárias</span><strong>{brl(soma(validos, 'valor'))}</strong><small>{pagamentos.length} pagamentos</small></div>
        <div className="ad-kpi"><span>Comissões</span><strong>{brl(soma(validos, 'comissao'))}</strong><small>sem os estornados</small></div>
        <div className="ad-kpi">
          <span>A pagar</span>
          <strong>{brl(soma((p) => p.status === 'pendente', 'valor'))}</strong>
          <small>{pagamentos.filter((p) => p.status === 'pendente').length} pendentes</small>
        </div>
      </div>

      {pagamentos.length === 0 ? (
        <Vazio
          titulo="Nenhum pagamento ainda."
          texto="Quando uma missão terminar, o pagamento ao profissional aparece aqui com a empresa, a vaga, o valor e a comissão. A transferência por PIX é feita fora do sistema."
        />
      ) : (
        <section className="px-card ad-tabela-card">
          <div className="ad-tabela-rolagem">
            <table className="ad-tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Empresa</th>
                  <th>Profissional</th>
                  <th>Vaga</th>
                  <th className="ad-num">Valor</th>
                  <th className="ad-num">Comissão</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => {
                  const emp = state.empresas.find((e) => e.id === p.empresaId)
                  const prof = state.profissionais.find((x) => x.id === p.profissionalId)
                  const dem = state.demandas.find((d) => d.id === p.demandaId)
                  return (
                    <tr key={p.id}>
                      <td>{dataBr(p.createdAt)}</td>
                      <td>{emp?.nomeFantasia ?? '—'}</td>
                      <td>{prof?.nome ?? '—'}</td>
                      <td>{dem ? cargoLabel(dem.cargo) : '—'}</td>
                      <td className="ad-num">{brl(p.valor)}</td>
                      <td className="ad-num">{brl(p.comissao)}</td>
                      <td>
                        <span className={`px-status px-status--${p.status}`}>
                          {p.status === 'pago' ? 'Pago' : p.status === 'pendente' ? 'Pendente' : 'Estornado'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Auditoria
type Evento = { em: string; tipo: string; titulo: string; detalhe: string }

const ROTULO_DOC: Record<string, string> = {
  rg_cpf: 'Documento com foto',
  selfie: 'Selfie',
  curriculo: 'Currículo',
  contrato_social: 'Contrato social',
  cartao_cnpj: 'Cartão CNPJ',
  comprovante_endereco_empresa: 'Comprovante de endereço',
  comprovante_residencia: 'Comprovante de residência',
  aso: 'ASO (exame admissional)',
  pix_dados: 'Dados do PIX',
  cnh: 'CNH',
}

function rotuloDocumento(tipoId: string) {
  if (ROTULO_DOC[tipoId]) return ROTULO_DOC[tipoId]
  if (/^nr\d+$/i.test(tipoId)) return `Certificado ${tipoId.toUpperCase().replace(/^NR/, 'NR-')}`
  return tipoId.replace(/_/g, ' ')
}

const TIPOS_EVENTO = ['Contas', 'Documentos', 'Vagas', 'Candidaturas', 'Contratos', 'Pagamentos', 'Neste navegador'] as const

export function AuditoriaAdmin() {
  const { state } = useStore()
  const [filtro, setFiltro] = useState<string>('Todos')

  // A linha do tempo vem do que está gravado no banco (vale em qualquer aparelho) e do registro
  // local deste navegador, que guarda as ações feitas aqui.
  const eventos = useMemo(() => {
    const lista: Evento[] = []
    const nomeConta = (id: string) => state.users.find((u) => u.id === id)
    const nomeEmpresa = (id: string) => state.empresas.find((e) => e.id === id)?.nomeFantasia ?? 'Empresa'
    const nomeProf = (id: string) => state.profissionais.find((p) => p.id === id)?.nome ?? 'Profissional'
    for (const u of state.users) {
      if (!u.createdAt || u.role === 'super' || u.role === 'admin') continue
      lista.push({
        em: u.createdAt,
        tipo: 'Contas',
        titulo: `Conta criada (${u.role === 'empresa' ? 'empresa' : 'profissional'})`,
        detalhe: `${u.usuario || u.email}${u.perfilCompleto ? '' : ' · perfil ainda não preenchido'}`,
      })
    }
    for (const d of state.documentos) {
      if (!d.enviadoEm) continue
      const dono = d.donoTipo === 'empresa' ? nomeEmpresa(d.donoId) : d.donoTipo === 'profissional' ? nomeProf(d.donoId) : 'Doca Livre'
      lista.push({
        em: d.enviadoEm,
        tipo: 'Documentos',
        titulo: `Documento enviado: ${rotuloDocumento(d.tipoId)}`,
        detalhe: `${dono} · ${d.status.replace(/_/g, ' ')}`,
      })
    }
    for (const d of state.demandas) {
      lista.push({
        em: d.createdAt || d.data,
        tipo: 'Vagas',
        titulo: `Vaga publicada: ${cargoLabel(d.cargo)}`,
        detalhe: `${nomeEmpresa(d.empresaId)} · ${d.endereco?.cidade || ''} · ${ROTULO_DEMANDA[d.status] ?? d.status}`,
      })
    }
    for (const c of state.candidaturas) {
      const dem = state.demandas.find((d) => d.id === c.demandaId)
      lista.push({
        em: c.createdAt,
        tipo: 'Candidaturas',
        titulo: c.origem === 'convite' ? 'Convite enviado' : 'Candidatura',
        detalhe: `${nomeProf(c.profissionalId)} · ${dem ? cargoLabel(dem.cargo) : 'vaga'} · ${c.status}`,
      })
    }
    for (const c of state.contratos) {
      lista.push({ em: c.createdAt, tipo: 'Contratos', titulo: `Contrato gerado ${c.numero}`, detalhe: `${nomeEmpresa(c.empresaId)} · ${nomeProf(c.profissionalId)}` })
      if (c.assinaturaProfissionalEm) {
        lista.push({ em: c.assinaturaProfissionalEm, tipo: 'Contratos', titulo: `Contrato assinado ${c.numero}`, detalhe: nomeProf(c.profissionalId) })
      }
    }
    for (const p of state.pagamentos) {
      lista.push({
        em: p.createdAt,
        tipo: 'Pagamentos',
        titulo: `Pagamento ${p.status}`,
        detalhe: `${nomeProf(p.profissionalId)} · ${brl(p.valor)} · ${nomeEmpresa(p.empresaId)}`,
      })
    }
    for (const l of state.auditLogs) {
      const quem = nomeConta(l.actorId)
      lista.push({ em: l.at, tipo: 'Neste navegador', titulo: l.action.replace(/_/g, ' '), detalhe: `${l.detail}${quem ? ` · por ${quem.usuario || quem.email}` : ''}` })
    }
    return lista.filter((e) => e.em).sort((a, b) => b.em.localeCompare(a.em))
  }, [state])

  const visiveis = filtro === 'Todos' ? eventos : eventos.filter((e) => e.tipo === filtro)

  return (
    <div className="px-page">
      <h1 className="px-title">Auditoria</h1>
      <p className="ad-lead">O que aconteceu no sistema, do mais recente para o mais antigo.</p>
      {eventos.length === 0 ? (
        <Vazio titulo="Nada registrado ainda." texto="Cadastros, documentos, vagas, candidaturas, contratos e pagamentos aparecem aqui conforme acontecem." />
      ) : (
        <>
          <div className="ad-filtros" role="group" aria-label="Filtrar por tipo">
            {['Todos', ...TIPOS_EVENTO].map((t) => {
              const n = t === 'Todos' ? eventos.length : eventos.filter((e) => e.tipo === t).length
              if (t !== 'Todos' && n === 0) return null
              return (
                <button key={t} type="button" className={`ad-filtro${filtro === t ? ' is-on' : ''}`} onClick={() => setFiltro(t)}>
                  {t} ({n})
                </button>
              )
            })}
          </div>
          <section className="px-card ad-tabela-card">
            <div className="ad-tabela-rolagem">
              <table className="ad-tabela">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Tipo</th>
                    <th>O que aconteceu</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.slice(0, 300).map((e, i) => (
                    <tr key={`${e.em}-${i}`}>
                      <td className="ad-nowrap">{dataHoraBr(e.em)}</td>
                      <td className="ad-nowrap">{e.tipo}</td>
                      <td>{e.titulo}</td>
                      <td className="muted">{e.detalhe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {visiveis.length > 300 && <p className="muted">Mostrando os 300 mais recentes.</p>}
        </>
      )}
    </div>
  )
}
