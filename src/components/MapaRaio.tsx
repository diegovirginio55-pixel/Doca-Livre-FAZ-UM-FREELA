import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import type { OrigemPonto, Ponto } from '../lib/localizacaoEndereco'
import 'leaflet/dist/leaflet.css'
import './mapa-raio.css'

const TEXTO_ORIGEM: Record<OrigemPonto, string> = {
  manual: 'Posição ajustada por você.',
  salvo: 'Posição salva no seu perfil.',
  endereco: 'Posição pela rua e número.',
  cep: 'Posição aproximada pelo CEP.',
  cidade: 'Posição aproximada pelo centro da cidade. Informe a rua e o número ou arraste o marcador até a sua casa.',
}

function pinCasa() {
  return L.divIcon({
    className: 'casa-raio-pin',
    html: '<span aria-hidden="true"></span>',
    iconSize: [28, 38],
    iconAnchor: [14, 36],
  })
}

/** Mapa do cadastro: onde a pessoa mora e o círculo do raio em que aceita trabalhar. */
export function MapaRaio({
  ponto,
  origem,
  raioKm,
  cidade,
  onMover,
}: {
  ponto: Ponto | null
  origem: OrigemPonto | null
  raioKm: number | null
  cidade: string
  onMover: (ponto: Ponto) => void
}) {
  const telaRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const marcaRef = useRef<L.Marker | null>(null)
  const circuloRef = useRef<L.Circle | null>(null)
  const onMoverRef = useRef(onMover)

  useEffect(() => {
    onMoverRef.current = onMover
  }, [onMover])

  useEffect(() => {
    const el = telaRef.current
    if (!el || mapaRef.current) return
    // Sem zoom pela rodinha: o mapa fica no meio do formulário e não pode prender a rolagem da página.
    const mapa = L.map(el, { zoomControl: true, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa)
    mapa.setView([-23.55, -46.63], 9)
    mapaRef.current = mapa
    const ajustar = () => mapa.invalidateSize()
    const quadro = window.requestAnimationFrame(ajustar)
    const depois = window.setTimeout(ajustar, 250)
    return () => {
      window.cancelAnimationFrame(quadro)
      window.clearTimeout(depois)
      mapa.remove()
      mapaRef.current = null
      marcaRef.current = null
      circuloRef.current = null
    }
  }, [])

  const lat = ponto?.lat
  const lng = ponto?.lng
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    if (lat == null || lng == null) {
      marcaRef.current?.remove()
      marcaRef.current = null
      circuloRef.current?.remove()
      circuloRef.current = null
      return
    }
    if (!marcaRef.current) {
      const marca = L.marker([lat, lng], { icon: pinCasa(), draggable: true, keyboard: true, title: 'Sua casa' })
      marca.bindTooltip('Sua casa · arraste para ajustar', { direction: 'top', offset: [0, -34] })
      marca.on('dragend', () => {
        const atual = marca.getLatLng()
        onMoverRef.current({ lat: Number(atual.lat.toFixed(6)), lng: Number(atual.lng.toFixed(6)) })
      })
      marca.addTo(mapa)
      marcaRef.current = marca
    } else {
      marcaRef.current.setLatLng([lat, lng])
    }
    if (raioKm != null && raioKm > 0) {
      if (!circuloRef.current) {
        circuloRef.current = L.circle([lat, lng], {
          radius: raioKm * 1000,
          color: '#1a237e',
          weight: 2,
          fillColor: '#f9db00',
          fillOpacity: 0.16,
          interactive: false,
        }).addTo(mapa)
      } else {
        circuloRef.current.setLatLng([lat, lng]).setRadius(raioKm * 1000)
      }
      mapa.fitBounds(circuloRef.current.getBounds(), { padding: [18, 18] })
    } else {
      circuloRef.current?.remove()
      circuloRef.current = null
      mapa.setView([lat, lng], 14)
    }
  }, [lat, lng, raioKm])

  return (
    <div className="casa-raio">
      <div
        ref={telaRef}
        className="casa-raio-tela"
        role="img"
        aria-label={
          ponto
            ? `Mapa com a sua casa${raioKm ? ` e o raio de ${raioKm} km` : ''}${cidade ? ` em ${cidade}` : ''}`
            : 'Mapa do raio de trabalho'
        }
      />
      {!ponto && <p className="casa-raio-vazio">Informe o CEP ou a cidade para ver o mapa.</p>}
      {ponto && (
        <p className="casa-raio-legenda">
          <span className="casa-raio-legenda-casa" aria-hidden="true" /> Sua casa
          {raioKm ? (
            <>
              <span className="casa-raio-legenda-raio" aria-hidden="true" /> Até {raioKm} km
            </>
          ) : null}
          {origem && <small>{TEXTO_ORIGEM[origem]}</small>}
          <small>A empresa não vê o seu endereço: só a cidade e a distância aproximada.</small>
        </p>
      )}
    </div>
  )
}
