import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as L from 'leaflet'
import { cargoLabel } from '../../data/categories'
import { abrirCurriculoPdf } from '../../lib/curriculoPdf'
import { PerfilColaborador } from './PerfilColaborador'
import { useStore } from '../../lib/store'
import type { Disponibilidade, Empresa, Profissional } from '../../lib/types'
import 'leaflet/dist/leaflet.css'
import './mapa.css'

const RAIOS = [10, 25, 50, 100]

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

export function MapaMaoDeObra({ empresa }: { empresa: Empresa }) {
  const { state } = useStore()
  const telaRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const marcasRef = useRef(new Map<string, L.Marker>())
  const circuloRef = useRef<L.Circle | null>(null)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [raio, setRaio] = useState<number | null>(null)

  const pessoas = useMemo(() => {
    const bloqueados = new Set(empresa.bloqueados)
    return state.profissionais
      .filter((pessoa) => pessoa.status === 'aprovado' && !bloqueados.has(pessoa.id) && coordenadaOk(pessoa))
      .slice()
      .sort((a, b) => distanciaKm(empresa.endereco, a.endereco) - distanciaKm(empresa.endereco, b.endereco))
  }, [empresa.bloqueados, empresa.endereco, state.profissionais])

  const visiveis = useMemo(() => {
    if (raio == null) return pessoas
    return pessoas.filter((pessoa) => distanciaKm(empresa.endereco, pessoa.endereco) <= raio)
  }, [empresa.endereco, pessoas, raio])

  const selecionado = visiveis.find((pessoa) => pessoa.id === selecionadoId) ?? null

  useEffect(() => {
    const el = telaRef.current
    if (!el || mapaRef.current) return
    const mapa = L.map(el, { zoomControl: true, scrollWheelZoom: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa)
    mapa.on('click', (evento) => {
      const alvo = (evento as L.LeafletMouseEvent).originalEvent?.target
      if (alvo instanceof Element && alvo.closest('.mapa-pin')) return
      setSelecionadoId(null)
    })
    mapaRef.current = mapa
    const ajustar = () => mapa.invalidateSize()
    const quadro = window.requestAnimationFrame(ajustar)
    const depois = window.setTimeout(ajustar, 250)
    return () => {
      window.cancelAnimationFrame(quadro)
      window.clearTimeout(depois)
      mapa.remove()
      mapaRef.current = null
      marcasRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    marcasRef.current.forEach((marca) => marca.remove())
    marcasRef.current.clear()

    const limites = L.latLngBounds([])
    if (coordenadaEmpresa(empresa)) {
      const sede = L.marker([empresa.endereco.lat, empresa.endereco.lng], {
        icon: pinSede(),
        keyboard: false,
        zIndexOffset: -100,
      })
      sede.bindTooltip(empresa.nomeFantasia, { direction: 'top' })
      sede.addTo(mapa)
      marcasRef.current.set('sede', sede)
      limites.extend(sede.getLatLng())
    }

    for (const pessoa of visiveis) {
      const marca = L.marker([pessoa.endereco.lat, pessoa.endereco.lng], {
        icon: pinPessoa(pessoa.nome, false, pessoa.foto),
        title: pessoa.nome,
        keyboard: true,
      })
      marca.bindTooltip(pessoa.nome, { direction: 'top', offset: [0, -22] })
      marca.on('click', (evento) => {
        const original = (evento as L.LeafletMouseEvent).originalEvent
        if (original) L.DomEvent.stopPropagation(original)
        setSelecionadoId(pessoa.id)
      })
      marca.addTo(mapa)
      marcasRef.current.set(pessoa.id, marca)
      limites.extend(marca.getLatLng())
    }

    if (raio == null && limites.isValid()) mapa.fitBounds(limites.pad(0.28), { padding: [28, 28], maxZoom: 12 })
  }, [empresa, raio, visiveis])

  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    circuloRef.current?.remove()
    circuloRef.current = null
    if (raio == null || !coordenadaEmpresa(empresa)) return
    const circulo = L.circle([empresa.endereco.lat, empresa.endereco.lng], {
      radius: raio * 1000,
      color: '#111',
      weight: 2,
      fillColor: '#f9db00',
      fillOpacity: 0.14,
    }).addTo(mapa)
    circuloRef.current = circulo
    mapa.fitBounds(circulo.getBounds(), { padding: [24, 24] })
    return () => {
      circulo.remove()
      if (circuloRef.current === circulo) circuloRef.current = null
    }
  }, [empresa, raio])

  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    for (const pessoa of visiveis) {
      const marca = marcasRef.current.get(pessoa.id)
      if (!marca) continue
      const ativo = pessoa.id === selecionadoId
      marca.setIcon(pinPessoa(pessoa.nome, ativo, pessoa.foto))
      marca.setZIndexOffset(ativo ? 800 : 0)
    }
  }, [selecionadoId, visiveis])

  useLayoutEffect(() => {
    const mapa = mapaRef.current
    const el = cardRef.current
    if (!mapa || !el || !selecionado) return
    const latlng = L.latLng(selecionado.endereco.lat, selecionado.endereco.lng)
    const colocar = () => {
      const ponto = mapa.latLngToContainerPoint(latlng)
      const acima = ponto.y > 280
      el.style.left = `${ponto.x}px`
      el.style.top = `${ponto.y}px`
      el.style.transform = acima ? 'translate(-50%, calc(-100% - 16px))' : 'translate(-50%, 22px)'
      el.classList.toggle('mapa-flutuante--baixo', !acima)
    }
    const ponto = mapa.latLngToContainerPoint(latlng)
    const tamanho = mapa.getSize()
    const margemX = 200
    const dx = ponto.x < margemX ? ponto.x - margemX : ponto.x > tamanho.x - margemX ? ponto.x - (tamanho.x - margemX) : 0
    const dy = ponto.y < 300 ? ponto.y - 300 : 0
    if (dx !== 0 || dy !== 0) mapa.panBy([dx, dy], { animate: true })
    colocar()
    mapa.on('move zoom resize', colocar)
    return () => {
      mapa.off('move zoom resize', colocar)
    }
  }, [selecionado])

  return (
    <div className="mapa-page">
      <aside className="mapa-lado">
        <h1>Mapa fazumfreela</h1>
        <p>
          {visiveis.length} {visiveis.length === 1 ? 'profissional' : 'profissionais'}
          {raio == null ? ' no mapa' : ` em até ${raio} km`}.
        </p>
        <div className="mapa-filtros">
          <label className="mapa-raio">
            <span>Raio</span>
            <input
              type="number"
              min={1}
              max={500}
              inputMode="numeric"
              value={raio ?? ''}
              placeholder="km"
              aria-label="Raio em quilômetros"
              onChange={(event) => {
                const valor = Number(event.target.value)
                setRaio(event.target.value === '' || !Number.isFinite(valor) || valor <= 0 ? null : Math.min(500, valor))
              }}
            />
            <span>km</span>
          </label>
          <div className="mapa-opcoes">
            {RAIOS.map((km) => (
              <button key={km} type="button" className={raio === km ? 'on' : ''} onClick={() => setRaio(km)}>
                {km} km
              </button>
            ))}
            <button type="button" className={raio == null ? 'on' : ''} onClick={() => setRaio(null)}>
              Todos
            </button>
          </div>
        </div>
        <ul className="mapa-lista">
          {visiveis.map((pessoa) => (
            <li key={pessoa.id}>
              <button
                type="button"
                className={pessoa.id === selecionadoId ? 'mapa-lista--on' : ''}
                onClick={() => setSelecionadoId(pessoa.id)}
              >
                <strong>{pessoa.nome}</strong>
                <span>
                  {pessoa.profissoes[0] ? cargoLabel(pessoa.profissoes[0]) : 'Trabalhador'} · {pessoa.endereco.cidade}/
                  {pessoa.endereco.estado} · {formatarDistancia(distanciaKm(empresa.endereco, pessoa.endereco))}
                </span>
              </button>
            </li>
          ))}
          {visiveis.length === 0 && <li className="mapa-vazio">Nenhum profissional neste raio.</li>}
        </ul>
      </aside>
      <div className="mapa-palco">
        <div className="mapa-canvas" ref={telaRef} />
        {selecionado && (
          <div className="mapa-flutuante" ref={cardRef}>
            <FichaPessoa
              pessoa={selecionado}
              distancia={distanciaKm(empresa.endereco, selecionado.endereco)}
              onFechar={() => setSelecionadoId(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function FichaPessoa({
  pessoa,
  distancia,
  onFechar,
}: {
  pessoa: Profissional
  distancia: number
  onFechar: () => void
}) {
  const turnos = TURNOS.filter((item) => pessoa.disponibilidade[item.key])
  const [perfilAberto, setPerfilAberto] = useState(false)
  return (
    <article className="mapa-ficha">
      <header>
        <span className="mapa-avatar" aria-hidden>
          {pessoa.foto ? <img src={pessoa.foto} alt="" /> : iniciaisDe(pessoa.nome)}
        </span>
        <div>
          <strong>{pessoa.nome}</strong>
          <small>
            {pessoa.endereco.cidade}, {pessoa.endereco.estado}
          </small>
        </div>
        <button type="button" className="mapa-fechar" onClick={onFechar} aria-label="Fechar ficha">
          ×
        </button>
      </header>
      <dl className="mapa-fatos">
        <div>
          <dt>Distância</dt>
          <dd>{Number.isFinite(distancia) ? formatarDistancia(distancia).replace(' da empresa', '') : '—'}</dd>
        </div>
        <div>
          <dt>Avaliação</dt>
          <dd>{pessoa.avaliacaoMedia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</dd>
        </div>
        <div>
          <dt>Comparecimento</dt>
          <dd>{pessoa.taxaComparecimento}%</dd>
        </div>
      </dl>
      <div className="mapa-acoes">
        <button
          type="button"
          className="cf-btn cf-btn--dark"
          onClick={(event) => {
            event.stopPropagation()
            setPerfilAberto(true)
          }}
        >
          Ver perfil
        </button>
        <button type="button" className="cf-btn cf-btn--yellow" onClick={() => abrirCurriculoPdf(pessoa)}>
          Ver currículo
        </button>
      </div>
      {pessoa.profissoes.length > 0 && (
        <section className="mapa-bloco">
          <h3>Cargos</h3>
          <div className="mapa-chips">
            {pessoa.profissoes.map((id) => (
              <span key={id}>{cargoLabel(id)}</span>
            ))}
          </div>
        </section>
      )}
      {pessoa.experiencia.length > 0 && (
        <section className="mapa-bloco">
          <h3>Experiência</h3>
          <ul className="mapa-exp">
            {pessoa.experiencia.map((item) => (
              <li key={`${item.empresa}-${item.inicio}`}>
                <strong>{item.cargo}</strong>
                <span>
                  {item.empresa} · {periodo(item.inicio, item.fim)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(pessoa.certificados.length > 0 || pessoa.cnhCategoria) && (
        <section className="mapa-bloco">
          <h3>Certificações</h3>
          <div className="mapa-chips">
            {pessoa.cnhCategoria && <span>CNH {pessoa.cnhCategoria}</span>}
            {pessoa.certificados.map((item) => (
              <span key={item.tipo}>{item.tipo}</span>
            ))}
          </div>
        </section>
      )}
      {turnos.length > 0 && (
        <section className="mapa-bloco">
          <h3>Disponibilidade</h3>
          <div className="mapa-chips mapa-chips--soft">
            {turnos.map((item) => (
              <span key={item.key}>{item.label}</span>
            ))}
          </div>
        </section>
      )}
      {perfilAberto && (
        <PerfilColaborador pessoa={pessoa} distancia={distancia} onFechar={() => setPerfilAberto(false)} />
      )}
    </article>
  )
}

function coordenadaOk(pessoa: Profissional) {
  return coordenadaEmpresa({ endereco: pessoa.endereco })
}

function coordenadaEmpresa(origem: { endereco: { lat: number; lng: number } }) {
  const { lat, lng } = origem.endereco
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
}

function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  if (!Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return Number.NaN
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const lat1 = a.lat * rad
  const lat2 = b.lat * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function formatarDistancia(km: number) {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m da empresa`
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km da empresa`
}

function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? '' : ''
  return `${primeira}${ultima}`.toUpperCase()
}

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '"') return '&quot;'
    return '&#39;'
  })
}

function pinPessoa(nome: string, ativo: boolean, foto?: string) {
  const retrato = foto ? ` style="background-image:url('${urlCss(foto)}')"` : ''
  const miolo = foto ? '' : `<span>${escapar(iniciaisDe(nome))}</span>`
  return L.divIcon({
    className: 'mapa-pin-wrap',
    html: `<div class="mapa-pin${ativo ? ' mapa-pin--on' : ''}"${retrato}>${miolo}</div>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  })
}

function urlCss(valor: string) {
  return valor.replace(/['"\\()\s]/g, '')
}

function pinSede() {
  return L.divIcon({
    className: 'mapa-pin-wrap',
    html: `<div class="mapa-sede" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5H13v15" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M13 9h5.5A1.5 1.5 0 0 1 20 10.5V20" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M7.5 8.5h2.5M7.5 12h2.5M7.5 15.5h2.5M16 13h1.5M16 16.5h1.5M3 20h18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function mesAno(iso: string) {
  const [ano, mes] = iso.split('-')
  const nome = MESES[Number(mes) - 1]
  if (!ano || !nome) return iso
  return `${nome}/${ano}`
}

function periodo(inicio: string, fim: string) {
  return `${mesAno(inicio)} a ${fim ? mesAno(fim) : 'atual'}`
}
