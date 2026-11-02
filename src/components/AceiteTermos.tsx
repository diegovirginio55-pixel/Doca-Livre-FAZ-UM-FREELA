import { useState } from 'react'
import { useStore } from '../lib/store'
import { VERSAO_TERMOS, termosDoPerfil, termosPendentes, type TermoId, type TermoPlataforma } from '../lib/termos'
import type { User } from '../lib/types'
import './termos.css'

export function CaixasAceite({
  termos,
  marcados,
  onMarcar,
}: {
  termos: TermoPlataforma[]
  marcados: TermoId[]
  onMarcar: (proximos: TermoId[]) => void
}) {
  const [aberto, setAberto] = useState<TermoId | null>(null)
  return (
    <div className="termos-lista">
      {termos.map((termo) => {
        const marcado = marcados.includes(termo.id)
        return (
          <div key={termo.id} className={`termos-item ${marcado ? 'termos-item--ok' : ''}`}>
            <label className="termos-check">
              <input
                type="checkbox"
                checked={marcado}
                onChange={() =>
                  onMarcar(marcado ? marcados.filter((id) => id !== termo.id) : [...marcados, termo.id])
                }
              />
              <span>{termo.rotuloAceite}</span>
            </label>
            <button
              type="button"
              className="termos-ler"
              aria-expanded={aberto === termo.id}
              onClick={() => setAberto((atual) => (atual === termo.id ? null : termo.id))}
            >
              {aberto === termo.id ? 'Fechar texto' : `Ler ${termo.titulo.toLowerCase()}`}
            </button>
            {aberto === termo.id && (
              <div className="termos-texto">
                {termo.paragrafos.map((paragrafo) => (
                  <p key={paragrafo}>{paragrafo}</p>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <p className="termos-versao">
        Versão {VERSAO_TERMOS}. O aceite fica registrado com data e hora. Texto de controle, sujeito a revisão jurídica.
      </p>
    </div>
  )
}

export function AceiteCadastro({
  role,
  marcados,
  onMarcar,
}: {
  role: User['role']
  marcados: TermoId[]
  onMarcar: (proximos: TermoId[]) => void
}) {
  return (
    <section className="termos-cadastro">
      <h2>Termos e consentimentos</h2>
      <CaixasAceite termos={termosDoPerfil(role)} marcados={marcados} onMarcar={onMarcar} />
    </section>
  )
}

export function todosAceitos(role: User['role'], marcados: TermoId[]) {
  return termosDoPerfil(role).every((termo) => marcados.includes(termo.id))
}

export function AceiteTermosGate({ onSair }: { onSair: () => void }) {
  const { currentUser, aceitarTermos } = useStore()
  const pendentes = termosPendentes(currentUser)
  const [marcados, setMarcados] = useState<TermoId[]>([])
  if (pendentes.length === 0) return null
  const prontos = pendentes.every((termo) => marcados.includes(termo.id))

  return (
    <div className="termos-fundo" role="dialog" aria-modal="true" aria-labelledby="termos-titulo">
      <div className="termos-modal">
        <h2 id="termos-titulo">Antes de continuar</h2>
        <p>Leia e aceite os termos atualizados da fazumfreela para usar o painel.</p>
        <CaixasAceite termos={pendentes} marcados={marcados} onMarcar={setMarcados} />
        <div className="termos-acoes">
          <button type="button" className="termos-sair" onClick={onSair}>
            Sair
          </button>
          <button
            type="button"
            className="termos-ok"
            disabled={!prontos}
            onClick={() => aceitarTermos(pendentes.map((termo) => termo.id))}
          >
            Concordo e continuar
          </button>
        </div>
      </div>
    </div>
  )
}
