import { useMemo } from 'react'
import {
  formatDateTimeBr,
  formatMoneyBr,
  PLATAFORMA_DOCA,
  renderContratoHtml,
} from '../lib/contratoTemplate'
import { imprimirHtml } from '../lib/imprimir'
import { useStore } from '../lib/store'
import type { ContratoServico } from '../lib/types'
import { cargoLabel } from '../data/categories'

type Props = {
  contratoId: string
  onClose: () => void
  canAssinar?: boolean
}

export function ContratoViewer({ contratoId, onClose, canAssinar }: Props) {
  const { state, assinarContrato } = useStore()
  const contrato = state.contratos.find((c) => c.id === contratoId)

  const ctx = useMemo(() => {
    if (!contrato) return null
    const empresa = state.empresas.find((e) => e.id === contrato.empresaId)
    const profissional = state.profissionais.find((p) => p.id === contrato.profissionalId)
    const demanda = state.demandas.find((d) => d.id === contrato.demandaId)
    if (!empresa || !profissional || !demanda) return null
    return { empresa, profissional, demanda }
  }, [contrato, state])

  if (!contrato || !ctx) {
    return (
      <div className="px-modal-backdrop" onClick={onClose}>
        <div className="px-modal" onClick={(e) => e.stopPropagation()}>
          <p>Contrato não encontrado.</p>
          <button type="button" className="px-btn px-btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    )
  }

  function imprimir() {
    if (!contrato || !ctx) return
    const html = renderContratoHtml({
      contrato,
      empresa: ctx.empresa,
      profissional: ctx.profissional,
      demanda: ctx.demanda,
    })
    imprimirHtml(html, 'Contrato para impressão')
  }

  return (
    <div className="px-modal-backdrop" onClick={onClose}>
      <div className="px-modal px-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="px-modal-head">
          <div>
            <h2 style={{ margin: 0 }}>Contrato de Prestação de Serviço</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              ID {contrato.numero} · {PLATAFORMA_DOCA.produto} · {contrato.status.replace('_', ' ')}
            </p>
          </div>
          <button type="button" className="px-btn px-btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <ContratoPreview contrato={contrato} />

        <div className="px-row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="px-btn px-btn-outline" onClick={imprimir}>
            Imprimir / PDF
          </button>
          {canAssinar && contrato.status === 'gerado' && (
            <button
              type="button"
              className="px-btn px-btn-primary"
              onClick={() => assinarContrato(contrato.id)}
            >
              Assinar eletronicamente
            </button>
          )}
          {contrato.assinaturaProfissionalEm && (
            <span className="success">
              Assinado em {formatDateTimeBr(contrato.assinaturaProfissionalEm)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ContratoPreview({ contrato }: { contrato: ContratoServico }) {
  const { state } = useStore()
  const empresa = state.empresas.find((e) => e.id === contrato.empresaId)!
  const profissional = state.profissionais.find((p) => p.id === contrato.profissionalId)!
  const demanda = state.demandas.find((d) => d.id === contrato.demandaId)!

  return (
    <div className="contrato-preview">
      <p className="contrato-preview-title">
        CONTRATO DE PRESTAÇÃO DE SERVIÇO VIA PLATAFORMA DOCA LIVRE FAZUMFREELA — ID {contrato.numero}
      </p>
      <p>
        A <strong>{PLATAFORMA_DOCA.razaoSocial}</strong> (CNPJ {PLATAFORMA_DOCA.cnpj}), doravante{' '}
        <strong>DOCA LIVRE</strong>, intermedia o presente contrato entre:
      </p>
      <p>
        <strong>CONTRATANTE:</strong> {empresa.razaoSocial} — CNPJ {empresa.cnpj} —{' '}
        {empresa.endereco.cidade}/{empresa.endereco.estado}
      </p>
      <p>
        <strong>CONTRATADO:</strong> {profissional.nome} — CPF {profissional.cpf || 'registrado na fazumfreela'} — PIX{' '}
        {profissional.pix || 'registrado na fazumfreela'}
      </p>
      <p>
        <strong>Serviço:</strong> {cargoLabel(demanda.cargo)} · Início{' '}
        {formatDateTimeBr(contrato.inicioEm)} · Término previsto {formatDateTimeBr(contrato.fimEm)} ·
        Valor {formatMoneyBr(contrato.valor)}
      </p>
      <p>
        O contrato poderá ser rescindido de boa-fé pela plataforma Doca Livre. Rescisão antecipada
        imotivada pela CONTRATANTE implica multa de uma diária. Assinaturas eletrônicas são válidas
        nos termos da MP 2.200-2/2001 e da Lei 14.063/2020.
      </p>
      <h4>O que a empresa oferece</h4>
      <ul>
        {contrato.oQueEmpresaOferece.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <h4>EPIs / vestimenta</h4>
      <p className="muted">Fornecidos pela empresa:</p>
      <ul>
        {contrato.episEmpresa.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p className="muted">Prestador deve levar:</p>
      <ul>
        {contrato.episPrestador.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <h4>Tipos de serviço</h4>
      <ul>
        {contrato.tiposServico.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <h4>Instruções extras</h4>
      <pre className="contrato-instrucoes">{contrato.instrucoesExtras}</pre>
      <h4>Proibições</h4>
      <ul>
        {contrato.proibicoes.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <h4>Trilha</h4>
      <ul>
        <li>Oferta: {formatDateTimeBr(contrato.ofertaEm)}</li>
        <li>Ciência do contratado: {formatDateTimeBr(contrato.cienciaEm)}</li>
        <li>Seleção: {formatDateTimeBr(contrato.selecaoEm)}</li>
      </ul>
    </div>
  )
}

type ListProps = {
  empresaId?: string
  profissionalId?: string
  onOpen: (id: string) => void
}

export function ContratosList({ empresaId, profissionalId, onOpen }: ListProps) {
  const { state } = useStore()
  const list = state.contratos.filter((c) => {
    if (empresaId && c.empresaId !== empresaId) return false
    if (profissionalId && c.profissionalId !== profissionalId) return false
    return true
  })

  if (list.length === 0) {
    return (
      <div className="px-empty">
        <div className="px-empty-art">📄</div>
        <strong>Nenhum contrato gerado ainda</strong>
        <p className="muted">
          Ao aceitar um candidato em um contrato/demanda, o documento é gerado automaticamente no
          modelo Doca Livre.
        </p>
      </div>
    )
  }

  return (
    <ul className="px-list">
      {list.map((c) => {
        const p = state.profissionais.find((x) => x.id === c.profissionalId)
        const d = state.demandas.find((x) => x.id === c.demandaId)
        return (
          <li key={c.id} className="px-list-card">
            <div>
              <strong>Contrato #{c.numero}</strong>
              <p className="muted">
                {p?.nome} · {d ? cargoLabel(d.cargo) : '—'} · {formatMoneyBr(c.valor)} ·{' '}
                {formatDateTimeBr(c.inicioEm)}
              </p>
            </div>
            <div className="px-row-actions">
              <span className={`px-status`}>{c.status.replace('_', ' ')}</span>
              <button type="button" className="px-btn px-btn-outline" onClick={() => onOpen(c.id)}>
                Ver contrato
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
