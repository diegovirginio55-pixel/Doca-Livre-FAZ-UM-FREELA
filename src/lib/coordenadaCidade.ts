const BASES: Record<string, { lat: number; lng: number }> = {
  'cajamar|SP': { lat: -23.355, lng: -46.878 },
  'guarulhos|SP': { lat: -23.4543, lng: -46.5337 },
  'campinas|SP': { lat: -22.9056, lng: -47.0608 },
  'sao paulo|SP': { lat: -23.5505, lng: -46.6333 },
  'jundiai|SP': { lat: -23.186, lng: -46.884 },
  'osasco|SP': { lat: -23.532, lng: -46.792 },
  'barueri|SP': { lat: -23.511, lng: -46.876 },
  'rio de janeiro|RJ': { lat: -22.9068, lng: -43.1729 },
  'belo horizonte|MG': { lat: -19.9167, lng: -43.9345 },
  'curitiba|PR': { lat: -25.4284, lng: -49.2733 },
  'porto alegre|RS': { lat: -30.0346, lng: -51.2177 },
  'brasilia|DF': { lat: -15.7975, lng: -47.8919 },
  'salvador|BA': { lat: -12.9777, lng: -38.5016 },
  'recife|PE': { lat: -8.0476, lng: -34.877 },
  'fortaleza|CE': { lat: -3.7319, lng: -38.5267 },
  'manaus|AM': { lat: -3.119, lng: -60.0217 },
  'belem|PA': { lat: -1.4558, lng: -48.4902 },
  'goiania|GO': { lat: -16.6869, lng: -49.2648 },
  'florianopolis|SC': { lat: -27.5954, lng: -48.548 },
  'vitoria|ES': { lat: -20.3155, lng: -40.3128 },
}

function semAcento(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function coordenadaDaCidade(
  cidade: string,
  estado: string,
  conhecidos: { cidade: string; estado: string; lat: number; lng: number }[],
) {
  const uf = estado.trim().toUpperCase()
  const chave = `${semAcento(cidade)}|${uf}`
  const achou = conhecidos.find(
    (local) =>
      semAcento(local.cidade) === semAcento(cidade) &&
      local.estado.toUpperCase() === uf &&
      Number.isFinite(local.lat) &&
      Number.isFinite(local.lng),
  )
  const origem = achou ?? BASES[chave]
  // Cidade desconhecida fica sem coordenada (antes virava São Paulo: distâncias falsas e convites
  // errados, e o erro passava para os próximos cadastros da mesma cidade).
  if (!origem) return { lat: Number.NaN, lng: Number.NaN }
  return {
    lat: Number((origem.lat + (Math.random() - 0.5) * 0.02).toFixed(5)),
    lng: Number((origem.lng + (Math.random() - 0.5) * 0.02).toFixed(5)),
  }
}
