// Peças do topo e da tela inicial no mesmo desenho do Oferta de Carga: relógio com data e versão,
// botão de atualizar, usuário com avatar e a tela "Bem Vindo" com a logo apagada no centro.
import { useEffect, useState } from 'react'
import { LOGO_DOCA_LIVRE_SRC } from '../lib/brandAssets'
import './topo-doca-livre.css'

export const VERSAO_SISTEMA = 'v1.0'

function horaEData(agora: Date) {
  return {
    hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    data: agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  }
}

export function iniciaisDoNome(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'DL'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase()
}

export function RelogioTopo() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  const { hora, data } = horaEData(agora)
  return (
    <div className="dl-topo-meta" aria-label="Data e hora">
      <span className="dl-topo-meta-hora">{hora}</span>
      <span className="dl-topo-meta-data">{data}</span>
      <span className="dl-topo-meta-versao">{VERSAO_SISTEMA}</span>
    </div>
  )
}

/** Busca de novo os dados do servidor (sem recarregar a página e sem perder o que está aberto). */
export function BotaoAtualizar({ onAtualizar }: { onAtualizar: () => Promise<void> | void }) {
  const [girando, setGirando] = useState(false)
  async function atualizar() {
    if (girando) return
    setGirando(true)
    try {
      await onAtualizar()
    } finally {
      window.setTimeout(() => setGirando(false), 400)
    }
  }
  return (
    <button
      type="button"
      className={`dl-topo-atualizar${girando ? ' dl-topo-atualizar--girando' : ''}`}
      onClick={() => void atualizar()}
      title="Atualizar"
      aria-label="Atualizar os dados"
    >
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden>
        <path d="M20 6v5h-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 11a7 7 0 1 0-2.05 4.95" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export function UsuarioTopo({ nome, papel }: { nome: string; papel: string }) {
  return (
    <div className="dl-topo-usuario">
      <span className="dl-topo-usuario-texto">
        <strong>{nome}</strong>
        <span>{papel}</span>
      </span>
      <span className="dl-topo-avatar" aria-hidden>
        {iniciaisDoNome(nome)}
      </span>
    </div>
  )
}

/** Tela inicial: a logo da Doca Livre apagada no centro e "Bem Vindo" logo abaixo. */
export function BoasVindas() {
  return (
    <section className="dl-boas-vindas" aria-label="Bem Vindo">
      <img src={LOGO_DOCA_LIVRE_SRC} alt="" className="dl-boas-vindas-logo" />
      <p className="dl-boas-vindas-texto">Bem Vindo</p>
    </section>
  )
}
