import { useEffect, useState } from 'react'

/** APIs públicas e gratuitas (com CORS) chamadas direto do navegador. */

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

/** DDDs em uso no Brasil (Anatel). */
export const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

function digitos(valor: string) {
  return String(valor || '').replace(/\D/g, '')
}

async function getJson(url: string, ms = 8000): Promise<unknown | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) })
    if (!r.ok) return r.status === 404 ? { __404: true } : null
    return await r.json()
  } catch {
    return null
  }
}

// ---------- CEP ----------

export function mascararCep(valor: string) {
  const d = digitos(valor).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export type EnderecoCep = { rua: string; bairro: string; cidade: string; estado: string }

/** null = serviço fora do ar; 'nao_encontrado' = CEP não existe. */
export async function buscarCep(cep: string): Promise<EnderecoCep | 'nao_encontrado' | null> {
  const d = digitos(cep)
  if (d.length !== 8) return 'nao_encontrado'
  const b = (await getJson(`https://brasilapi.com.br/api/cep/v2/${d}`)) as Record<string, string> | null
  if (b && !('__404' in b) && b.city) {
    return { rua: b.street || '', bairro: b.neighborhood || '', cidade: b.city || '', estado: (b.state || '').toUpperCase() }
  }
  const v = (await getJson(`https://viacep.com.br/ws/${d}/json/`)) as Record<string, string | boolean> | null
  if (v && !('__404' in v) && !v.erro && v.localidade) {
    return {
      rua: String(v.logradouro || ''),
      bairro: String(v.bairro || ''),
      cidade: String(v.localidade || ''),
      estado: String(v.uf || '').toUpperCase(),
    }
  }
  if ((b && '__404' in b) || (v && (('__404' in v) || v.erro))) return 'nao_encontrado'
  return null
}

/** Busca o CEP quando ele fica com 8 dígitos e devolve uma mensagem de status. */
export function useCepAutomatico(cep: string, aoAchar: (e: EnderecoCep) => void) {
  const [status, setStatus] = useState<{ texto: string; erro: boolean }>({ texto: '', erro: false })
  const d = digitos(cep)
  useEffect(() => {
    if (d.length !== 8) {
      setStatus({ texto: '', erro: false })
      return
    }
    let vivo = true
    setStatus({ texto: 'Buscando endereço do CEP...', erro: false })
    void buscarCep(d).then((res) => {
      if (!vivo) return
      if (res === 'nao_encontrado') setStatus({ texto: 'CEP não encontrado. Confira o número.', erro: true })
      else if (!res) setStatus({ texto: 'Não foi possível buscar o CEP agora. Preencha o endereço manualmente.', erro: false })
      else {
        aoAchar(res)
        setStatus({ texto: 'Endereço preenchido pelo CEP. Confira e informe o número.', erro: false })
      }
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])
  return status
}

// ---------- CNPJ ----------

export function mascararCnpj(valor: string) {
  const d = digitos(valor).slice(0, 14)
  let s = d.slice(0, 2)
  if (d.length > 2) s += `.${d.slice(2, 5)}`
  if (d.length > 5) s += `.${d.slice(5, 8)}`
  if (d.length > 8) s += `/${d.slice(8, 12)}`
  if (d.length > 12) s += `-${d.slice(12)}`
  return s
}

export function cnpjValido(valor: string) {
  const d = digitos(valor)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = base.split('').reduce((t, c, i) => t + Number(c) * pesos[i], 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = calc(d.slice(0, 12))
  const d2 = calc(d.slice(0, 12) + d1)
  return d1 === Number(d[12]) && d2 === Number(d[13])
}

export function erroCnpj(valor: string) {
  const d = digitos(valor)
  if (!d) return 'Informe o CNPJ.'
  if (d.length !== 14) return 'O CNPJ precisa ter 14 números.'
  if (!cnpjValido(d)) return 'CNPJ inválido. Confira os números.'
  return ''
}

export type DadosCnpj = {
  razaoSocial: string
  nomeFantasia: string
  situacao: string
  ativa: boolean
  mei: boolean
  cep: string
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  telefone: string
}

/** null = serviço fora do ar; 'nao_encontrado' = CNPJ não existe na Receita. */
export async function buscarCnpj(cnpj: string): Promise<DadosCnpj | 'nao_encontrado' | null> {
  const d = digitos(cnpj)
  const b = (await getJson(`https://brasilapi.com.br/api/cnpj/v1/${d}`, 10000)) as Record<string, unknown> | null
  if (b && !('__404' in b) && b.razao_social) {
    const situacao = String(b.descricao_situacao_cadastral || '').toUpperCase()
    const tipo = String(b.descricao_tipo_de_logradouro || '').trim()
    const log = String(b.logradouro || '').trim()
    return {
      razaoSocial: String(b.razao_social || ''),
      nomeFantasia: String(b.nome_fantasia || ''),
      situacao,
      ativa: situacao === 'ATIVA',
      mei: b.opcao_pelo_mei === true,
      cep: String(b.cep || ''),
      rua: tipo && !log.toUpperCase().startsWith(tipo.toUpperCase()) ? `${tipo} ${log}` : log,
      numero: String(b.numero || ''),
      bairro: String(b.bairro || ''),
      cidade: String(b.municipio || ''),
      estado: String(b.uf || '').toUpperCase(),
      telefone: digitos(String(b.ddd_telefone_1 || '')),
    }
  }
  const o = (await getJson(`https://api.opencnpj.org/${d}`, 10000)) as Record<string, unknown> | null
  if (o && !('__404' in o) && o.razao_social) {
    const situacao = String(o.situacao_cadastral || '').toUpperCase()
    const tel = Array.isArray(o.telefones) ? (o.telefones[0] as { ddd?: string; numero?: string } | undefined) : undefined
    const tipo = String(o.tipo_logradouro || '').trim()
    const log = String(o.logradouro || '').trim()
    return {
      razaoSocial: String(o.razao_social || ''),
      nomeFantasia: String(o.nome_fantasia || ''),
      situacao,
      ativa: situacao === 'ATIVA',
      mei: String(o.opcao_mei || '').toUpperCase() === 'S',
      cep: String(o.cep || ''),
      rua: tipo && !log.toUpperCase().startsWith(tipo.toUpperCase()) ? `${tipo} ${log}` : log,
      numero: String(o.numero || ''),
      bairro: String(o.bairro || ''),
      cidade: String(o.municipio || ''),
      estado: String(o.uf || '').toUpperCase(),
      telefone: tel ? digitos(`${tel.ddd || ''}${tel.numero || ''}`) : '',
    }
  }
  if (b && '__404' in b && o && '__404' in o) return 'nao_encontrado'
  return null
}

/** Nome próprio a partir de texto em CAIXA ALTA da Receita ("SAO PAULO" -> "Sao Paulo"). */
export function capitalizar(texto: string) {
  const minusc = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && minusc.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

// ---------- Municípios IBGE ----------

const cacheMunicipios = new Map<string, string[]>()

export async function municipiosDaUf(uf: string): Promise<string[]> {
  const chave = uf.trim().toUpperCase()
  if (!UFS.includes(chave)) return []
  const salvo = cacheMunicipios.get(chave)
  if (salvo) return salvo
  const data = (await getJson(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${chave}/municipios?orderBy=nome`,
    10000,
  )) as { nome?: string }[] | null
  const lista = Array.isArray(data) ? data.map((m) => String(m.nome || '')).filter(Boolean) : []
  if (lista.length) cacheMunicipios.set(chave, lista)
  return lista
}

/** Junta as cidades conhecidas do sistema com a lista oficial do IBGE da UF. */
export function useCidadesDaUf(uf: string, conhecidas: string[]) {
  const [ibge, setIbge] = useState<string[]>([])
  useEffect(() => {
    let vivo = true
    setIbge([])
    void municipiosDaUf(uf).then((lista) => {
      if (vivo) setIbge(lista)
    })
    return () => {
      vivo = false
    }
  }, [uf])
  const vistos = new Set<string>()
  const out: string[] = []
  for (const c of [...conhecidas, ...ibge]) {
    const k = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (vistos.has(k)) continue
    vistos.add(k)
    out.push(c)
  }
  return out
}
