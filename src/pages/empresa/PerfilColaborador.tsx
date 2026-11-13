import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LevelBadge } from '../../components/LevelBadge'
import { cargoLabel } from '../../data/categories'
import { abrirCurriculoPdf } from '../../lib/curriculoPdf'
import { useStore } from '../../lib/store'
import type { Disponibilidade, Profissional } from '../../lib/types'
import './perfilColaborador.css'

const TURNOS: { key: keyof Disponibilidade; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'amanha', label: 'Amanhã' },
  { key: 'estaSemana', label: 'Esta semana' },
  { key: 'finaisDeSemana', label: 'Finais de semana' },
  { key: 'noturno', label: 'Noturno' },
  { key: 'viagens', label: 'Viagens' },
  { key: 'temporario', label: 'Temporário' },
  { key: 'efetivo', label: 'Efetivo' },
]

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function PerfilColaborador({
  pessoa,
  distancia,
  onFechar,
}: {
  pessoa: Profissional
  distancia?: number
  onFechar: () => void
}) {
  // A empresa recebe só a idade (vem pronta do servidor); a data de nascimento fica com a fazumfreela.
  const idade = pessoa.idade ?? idadeDe(pessoa.nascimento)
  const nota = pessoa.avaliacaoMedia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const turnos = TURNOS.filter((item) => pessoa.disponibilidade[item.key])
  const cargo = pessoa.profissoes[0] ? cargoLabel(pessoa.profissoes[0]) : 'Trabalhador'
  const { state } = useStore()

  useEffect(() => {
    function fechar(event: KeyboardEvent) {
      if (event.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', fechar)
    return () => document.removeEventListener('keydown', fechar)
  }, [onFechar])

  return createPortal(
    <div
      className="pc-fundo"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onFechar()
      }}
    >
      <article
        className="pc-folha"
        role="dialog"
        aria-modal="true"
        aria-label={`Perfil de ${pessoa.nome}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pc-capa">
          {pessoa.foto ? <img src={pessoa.foto} alt="" /> : <span>{iniciaisDe(pessoa.nome)}</span>}
          <button type="button" className="pc-fechar" onClick={onFechar} aria-label="Fechar perfil">
            ×
          </button>
        </div>
        <div className="pc-corpo">
          <div className="pc-topo">
            <h2>
              {pessoa.nome}
              {idade != null && <span> {idade}</span>}
            </h2>
            <LevelBadge nivel={pessoa.nivel} />
          </div>
          <p className="pc-lugar">
            {cargo} · {pessoa.endereco.cidade}, {pessoa.endereco.estado}
            {distancia != null && Number.isFinite(distancia) ? ` · ${formatarDistancia(distancia)}` : ''}
          </p>
          <ul className="pc-fatos">
            <li>Avaliação {nota}</li>
            <li>{pessoa.taxaComparecimento}% de comparecimento</li>
            <li>Responde em {pessoa.tempoRespostaMin} min</li>
            <li>Atende até {pessoa.raioKm} km</li>
            {pessoa.cnhCategoria && <li>CNH {pessoa.cnhCategoria}</li>}
            {pessoa.escolaridade && <li>{pessoa.escolaridade}</li>}
          </ul>
          {pessoa.resumo && (
            <section>
              <h3>Sobre</h3>
              <p className="pc-resumo">{pessoa.resumo}</p>
            </section>
          )}
          {pessoa.profissoes.length > 0 && (
            <section>
              <h3>Cargos</h3>
              <div className="pc-chips">
                {pessoa.profissoes.map((id) => (
                  <span key={id}>{cargoLabel(id)}</span>
                ))}
              </div>
            </section>
          )}
          {pessoa.experiencia.length > 0 && (
            <section>
              <h3>Experiência</h3>
              <ul className="pc-exp">
                {pessoa.experiencia.map((item) => (
                  <li key={`${item.empresa}-${item.inicio}`}>
                    <strong>{item.cargo}</strong>
                    <span>
                      {item.empresa} · {periodo(item.inicio, item.fim)}
                      {item.descricao ? ` · ${item.descricao}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {pessoa.certificados.length > 0 && (
            <section>
              <h3>Certificados</h3>
              <div className="pc-chips">
                {pessoa.certificados.map((item) => (
                  <span key={item.tipo}>
                    {item.tipo}
                    {item.valido ? '' : ' · vencido'}
                  </span>
                ))}
              </div>
            </section>
          )}
          {(pessoa.habilidades?.length ?? 0) > 0 && (
            <section>
              <h3>Habilidades</h3>
              <div className="pc-chips pc-chips--soft">
                {pessoa.habilidades?.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>
          )}
          {turnos.length > 0 && (
            <section>
              <h3>Disponibilidade</h3>
              <div className="pc-chips pc-chips--soft">
                {turnos.map((item) => (
                  <span key={item.key}>{item.label}</span>
                ))}
              </div>
            </section>
          )}
          <button type="button" className="pc-curriculo" onClick={() => abrirCurriculoPdf(pessoa, { documentos: state.documentos, distanciaKm: distancia })}>
            Ver currículo
          </button>
        </div>
      </article>
    </div>,
    document.body,
  )
}

function idadeDe(nascimento: string) {
  const nasc = new Date(`${nascimento}T12:00:00`)
  if (Number.isNaN(nasc.getTime())) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const aniversario = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())
  if (hoje < aniversario) idade -= 1
  return idade >= 0 ? idade : null
}

function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? '' : ''
  return `${primeira}${ultima}`.toUpperCase()
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

function formatarDistancia(km: number) {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m da empresa`
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km da empresa`
}
