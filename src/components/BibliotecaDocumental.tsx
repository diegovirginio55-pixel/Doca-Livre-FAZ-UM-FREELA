import { useEffect, useId, useRef, useState } from 'react'
import { DOCS_ETT } from '../data/documentCatalog'
import { cargoLabel } from '../data/categories'
import {
  AVISO_MINUTA,
  ETT_ID,
  PASTAS_DOCUMENTAIS,
  VISIVEL_PARA_TOMADORA,
  pendenciasParaIniciar,
} from '../lib/dossieTemporario'
import { effectiveStatus } from '../lib/documentos'
import { useStore } from '../lib/store'
import type { PecaDocumental } from '../lib/types'
import { PecaViewer } from './PecaViewer'
import './biblioteca.css'

const ROTULO: Record<PecaDocumental['tipo'], string> = {
  solicitacao: 'Solicitação de trabalho temporário',
  contrato_ett_tomadora: 'Contrato ETT ↔ tomadora',
  contrato_individual: 'Contrato individual temporário',
  termo_integracao: 'Termo de integração',
  ficha_epi: 'Ficha de entrega de EPI',
  encerramento: 'Encerramento',
  recibo: 'Recibo de pagamento',
}

export function BibliotecaDocumental({
  modo,
  empresaId,
}: {
  modo: 'ett' | 'tomadora' | 'trabalhador'
  empresaId?: string
}) {
  const store = useStore()
  const { state } = store
  const ett = state.cadastroEtt
  const prof = store.currentProfissional
  const pecas = (state.pecas ?? []).filter((p) => {
    if (modo === 'tomadora' && empresaId) return p.empresaId === empresaId && p.tipo !== 'recibo'
    if (modo === 'trabalhador' && prof) {
      const participa = state.candidaturas.some(
        (c) => c.demandaId === p.demandaId && c.profissionalId === prof.id,
      )
      if (p.profissionalId) return p.profissionalId === prof.id
      return p.tipo === 'solicitacao' && participa
    }
    return true
  })

  return (
    <div className="bib">
      <p className="bib-aviso">{AVISO_MINUTA}</p>
      {!ett.registroSirett.trim() && (
        <p className="bib-alerta">
          O registro SIRETT ainda não foi informado.
          <InfoSirett />
        </p>
      )}

      <div className="bib-pastas">
        {PASTAS_DOCUMENTAIS.map((pasta) => (
          <article key={pasta.id}>
            <strong>{pasta.titulo}</strong>
            <span>{pasta.itens.join(' · ')}</span>
          </article>
        ))}
      </div>

      {modo === 'ett' && <CadastroEttForm />}
      {modo === 'tomadora' && (
        <section className="bib-bloco">
          <h2>O que a tomadora vê do trabalhador</h2>
          <ul>
            {VISIVEL_PARA_TOMADORA.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            CPF, documentos pessoais completos e dados bancários ficam com a empresa de trabalho
            temporário. A tomadora recebe o necessário para a missão.
          </p>
        </section>
      )}
      {modo === 'trabalhador' && prof && <Consentimentos profissionalId={prof.id} />}

      <section className="bib-bloco">
        <h2>Peças da contratação</h2>
        {pecas.length === 0 && <p>Nenhuma solicitação ou contrato gerado ainda.</p>}
        {pecas.map((peca) => (
          <PecaCard key={peca.id} peca={peca} modo={modo} />
        ))}
      </section>

      {(modo === 'ett' || modo === 'tomadora') && <EncerramentoForm empresaId={empresaId} />}
    </div>
  )
}

function InfoSirett() {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLSpanElement>(null)
  const painelId = useId()

  useEffect(() => {
    if (!aberto) return
    function fechar(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  return (
    <span className="bib-info" ref={caixa}>
      <button
        type="button"
        className="bib-info-btn"
        aria-label="Como conseguir o registro SIRETT"
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAberto((valor) => !valor)}
      >
        i
      </button>
      {aberto && (
        <span className="bib-info-pop" id={painelId} role="note">
          <strong>Como conseguir o registro SIRETT</strong>
          <ol>
            <li>A empresa de trabalho temporário pede o registro no SIRETT. Depois de preencher os dados, o SIRETT gera o requerimento.</li>
            <li>
              Esse requerimento, assinado, é protocolado no Ministério do Trabalho e Emprego pelo SEI, com o CNPJ, o registro na
              Junta Comercial da sede e a prova de capital social de pelo menos R$ 100.000,00.
            </li>
            <li>O certificado de registro volta pelo processo no SEI.</li>
            <li>O número desse certificado é informado aqui. Este sistema não gera nem inventa o registro.</li>
          </ol>
          <a href="https://www.gov.br/pt-br/servicos/solicitar-registro-de-empresa-de-trabalho-temporario" target="_blank" rel="noreferrer">
            Serviço oficial no gov.br
          </a>
        </span>
      )}
    </span>
  )
}

function CadastroEttForm() {
  const { state, atualizarCadastroEtt, enviarDocumento } = useStore()
  const [form, setForm] = useState(state.cadastroEtt)
  const [arquivo, setArquivo] = useState('certificado-sirett.pdf')
  const [tipoId, setTipoId] = useState('ett_sirett')

  function campo(chave: keyof typeof form, label: string) {
    return (
      <label>
        <span>{label}</span>
        <input value={form[chave]} onChange={(e) => setForm({ ...form, [chave]: e.target.value })} />
      </label>
    )
  }

  return (
    <section className="bib-bloco">
      <h2>Cadastro da empresa de trabalho temporário</h2>
      <p>Capital social mínimo informado pelo MTE para o registro: R$ 100 mil. O CNAE precisa ser compatível com a atividade.</p>
      <div className="bib-form">
        {campo('razaoSocial', 'Razão social')}
        {campo('nomeFantasia', 'Nome fantasia')}
        {campo('cnpj', 'CNPJ')}
        {campo('juntaComercial', 'Junta Comercial')}
        {campo('socios', 'Sócios')}
        {campo('documentosSocios', 'Documentos dos sócios')}
        {campo('capitalSocial', 'Capital social')}
        {campo('cnae', 'CNAE')}
        {campo('sede', 'Sede')}
        <label>
          <span>
            Número do registro SIRETT
            <InfoSirett />
          </span>
          <input value={form.registroSirett} onChange={(e) => setForm({ ...form, registroSirett: e.target.value })} />
        </label>
        {campo('certificadoRegistro', 'Certificado de registro')}
        {campo('certificadoDigital', 'Certificado digital')}
        {campo('procuracoes', 'Procurações')}
      </div>
      <button type="button" className="bib-btn" onClick={() => atualizarCadastroEtt(form)}>
        Guardar cadastro
      </button>
      <div className="bib-form" style={{ marginTop: 16 }}>
        <label>
          <span>Anexar documento da ETT</span>
          <select value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
            {DOCS_ETT.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Nome do arquivo</span>
          <input value={arquivo} onChange={(e) => setArquivo(e.target.value)} />
        </label>
      </div>
      <button
        type="button"
        className="bib-btn"
        onClick={() =>
          enviarDocumento({
            tipoId,
            donoTipo: 'ett',
            donoId: ETT_ID,
            arquivoNome: arquivo,
          })
        }
      >
        Enviar para a pasta da ETT
      </button>
      <ul>
        {state.documentos
          .filter((d) => d.donoTipo === 'ett')
          .map((d) => (
            <li key={d.id}>
              {DOCS_ETT.find((def) => def.id === d.tipoId)?.label ?? d.tipoId}: {d.arquivoNome} ({effectiveStatus(d)})
            </li>
          ))}
      </ul>
    </section>
  )
}

function Consentimentos({ profissionalId }: { profissionalId: string }) {
  const { state, registrarConsentimento } = useStore()
  const prof = state.profissionais.find((p) => p.id === profissionalId)
  const c = prof?.consentimentoPrivacidade
  const itens = [
    ['politica', 'Aceite da política de privacidade', c?.politicaEm],
    ['curriculo', 'Armazenamento do currículo', c?.curriculoEm],
    ['compartilhamento', 'Compartilhamento com empresas tomadoras, limitado ao que a missão precisa', c?.compartilhamentoEm],
  ] as const

  return (
    <section className="bib-bloco">
      <h2>Privacidade e proteção de dados</h2>
      {itens.map(([campo, texto, em]) => (
        <label key={campo} className="bib-check">
          <input
            type="checkbox"
            checked={Boolean(em)}
            onChange={(e) => registrarConsentimento(profissionalId, campo, e.target.checked)}
          />
          <span>
            {texto}
            {em ? ` — registrado em ${new Date(em).toLocaleString('pt-BR')}` : ''}
          </span>
        </label>
      ))}
    </section>
  )
}

function PecaCard({ peca, modo }: { peca: PecaDocumental; modo: 'ett' | 'tomadora' | 'trabalhador' }) {
  const { state, assinarPeca, marcarEsocial, currentEmpresa, currentProfissional } = useStore()
  const [leitura, setLeitura] = useState(false)
  const demanda = state.demandas.find((d) => d.id === peca.demandaId)
  const pendencias =
    peca.profissionalId && demanda
      ? pendenciasParaIniciar({
          pecas: state.pecas ?? [],
          documentos: state.documentos,
          demandaId: demanda.id,
          profissionalId: peca.profissionalId,
        })
      : []

  return (
    <article className="bib-peca">
      <header>
        <strong>
          {ROTULO[peca.tipo]} {peca.numero}
        </strong>
        <span>{peca.status === 'aguardando_assinatura' ? 'Aguardando assinatura' : peca.status}</span>
      </header>
      {demanda && <p>{cargoLabel(demanda.cargo)}</p>}
      <ul>
        {peca.resumo.map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>
      {peca.assinaturas.length > 0 && (
        <ul>
          {peca.assinaturas.map((a) => (
            <li key={a.papel}>
              {a.papel}: {a.status === 'assinado' ? `assinado por ${a.nome}` : 'aguardando assinatura'}
              {a.em ? ` em ${new Date(a.em).toLocaleString('pt-BR')}` : ''}
            </li>
          ))}
        </ul>
      )}
      <p>{peca.aviso}</p>
      <div className="bib-acoes">
        {modo === 'ett' && peca.assinaturas.some((a) => a.papel === 'ett' && a.status === 'pendente') && (
          <button type="button" className="bib-btn" onClick={() => assinarPeca(peca.id, 'ett', state.cadastroEtt.nomeFantasia)}>
            Assinar como empresa de trabalho temporário
          </button>
        )}
        {modo === 'tomadora' && peca.assinaturas.some((a) => a.papel === 'tomadora' && a.status === 'pendente') && (
          <button type="button" className="bib-btn" onClick={() => setLeitura(true)}>
            Ler e assinar como tomadora
          </button>
        )}
        {modo === 'trabalhador' && peca.assinaturas.some((a) => a.papel === 'trabalhador' && a.status === 'pendente') && (
          <button type="button" className="bib-btn" onClick={() => setLeitura(true)}>
            Ler e assinar
          </button>
        )}
        {leitura && (
          <PecaViewer
            pecaId={peca.id}
            papel={modo === 'tomadora' ? 'tomadora' : 'trabalhador'}
            nome={modo === 'tomadora' ? currentEmpresa?.responsavelNome : currentProfissional?.nome}
            onClose={() => setLeitura(false)}
          />
        )}
        {modo === 'ett' && peca.tipo === 'contrato_individual' && peca.meta?.esocial !== 'informado' && (
          <button type="button" className="bib-btn" onClick={() => marcarEsocial(peca.id)}>
            Registrar que o S-2200 foi informado
          </button>
        )}
      </div>
      {peca.tipo === 'contrato_individual' && pendencias.length > 0 && (
        <p>A missão ainda não libera a entrada. Falta: {pendencias.join('; ')}.</p>
      )}
    </article>
  )
}

function EncerramentoForm({ empresaId }: { empresaId?: string }) {
  const { state, registrarEncerramento } = useStore()
  // Só missões em aberto/andamento (antes listava também as já encerradas e canceladas).
  const demandas = state.demandas.filter(
    (d) => (!empresaId || d.empresaId === empresaId) && d.status !== 'finalizada' && d.status !== 'cancelada',
  )
  const [demandaId, setDemandaId] = useState(demandas[0]?.id ?? '')
  const [dataEfetiva, setDataEfetiva] = useState('')
  const [motivo, setMotivo] = useState('pedido da tomadora')
  const [responsavel, setResponsavel] = useState('tomadora')
  const [observacoes, setObservacoes] = useState('')
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)
  const selecionada = demandas.find((d) => d.id === demandaId) ?? demandas[0]

  if (demandas.length === 0) return null

  return (
    <section className="bib-bloco">
      <h2>Encerrar antes do prazo</h2>
      <div className="bib-form">
        <label>
          <span>Contrato / missão</span>
          <select value={selecionada?.id ?? ''} onChange={(e) => setDemandaId(e.target.value)}>
            {demandas.map((d) => (
              <option key={d.id} value={d.id}>
                {cargoLabel(d.cargo)} · término previsto {d.dataFim || d.data}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Data efetiva</span>
          <input type="date" value={dataEfetiva} onChange={(e) => setDataEfetiva(e.target.value)} />
        </label>
        <label>
          <span>Motivo</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="pedido da tomadora">Pedido da tomadora</option>
            <option value="pedido do trabalhador">Pedido do trabalhador</option>
            <option value="acordo">Acordo</option>
            <option value="término no prazo">Término no prazo</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label>
          <span>Responsável</span>
          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            <option value="tomadora">Empresa tomadora</option>
            <option value="trabalhador">Trabalhador</option>
            <option value="ett">Empresa de trabalho temporário</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label>
          <span>Observações</span>
          <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </label>
      </div>
      <button
        type="button"
        className="bib-btn"
        onClick={() => {
          if (!selecionada) return
          if (!dataEfetiva) {
            setAviso({ texto: 'Informe a data efetiva do encerramento.', erro: true })
            return
          }
          if (dataEfetiva < selecionada.data) {
            setAviso({ texto: 'A data efetiva não pode ser antes do início da missão.', erro: true })
            return
          }
          registrarEncerramento({ demandaId: selecionada.id, dataEfetiva, motivo, responsavel, observacoes })
          setAviso({ texto: 'Missão encerrada. Pagamentos e recibos gerados pelos dias com presença.', erro: false })
          setDataEfetiva('')
        }}
      >
        Gerar encerramento
      </button>
      {aviso && <p className={aviso.erro ? 'error' : 'muted'}>{aviso.texto}</p>}
    </section>
  )
}
