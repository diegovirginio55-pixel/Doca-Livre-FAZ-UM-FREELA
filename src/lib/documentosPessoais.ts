import { DDDS_VALIDOS } from './apisPublicas'
import { cpfValido } from './pix'

export function soDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

export function mascararCpf(valor: string) {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function erroCpf(valor: string) {
  const d = soDigitos(valor)
  if (d.length !== 11) return 'O CPF precisa ter 11 números.'
  if (!cpfValido(d)) return 'CPF inválido. Confira os números.'
  return ''
}

function limparRg(valor: string) {
  return valor.toUpperCase().replace(/[^0-9X]/g, '').replace(/X(?=.)/g, '').slice(0, 14)
}

export function mascararRg(valor: string) {
  const r = limparRg(valor)
  if (r.length === 9) return `${r.slice(0, 2)}.${r.slice(2, 5)}.${r.slice(5, 8)}-${r.slice(8)}`
  if (r.length === 8 && /^\d+$/.test(r)) return `${r.slice(0, 2)}.${r.slice(2, 5)}.${r.slice(5)}`
  return r
}

function digitoRgSp(base: string) {
  let soma = 0
  for (let i = 0; i < 8; i += 1) soma += Number(base[i]) * (i + 2)
  const resto = 11 - (soma % 11)
  if (resto === 10) return 'X'
  if (resto === 11) return '0'
  return String(resto)
}

export function erroRg(valor: string, estado?: string) {
  const r = limparRg(valor)
  if (r.length < 5) return 'Informe o RG completo.'
  if (/^(\d)\1+$/.test(r)) return 'RG inválido. Confira os números.'
  // O dígito verificador é a regra de SP; RG de outro estado com 9 dígitos não pode ser barrado.
  if (estado?.toUpperCase() === 'SP' && r.length === 9 && /^\d{8}[\dX]$/.test(r)) {
    if (digitoRgSp(r.slice(0, 8)) !== r[8]) return 'RG inválido. Confira o dígito final.'
  }
  return ''
}

export function mascararTelefone(valor: string) {
  const d = soDigitos(valor).replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function erroTelefone(valor: string) {
  const d = soDigitos(valor)
  if (d.length < 10) return 'Informe o telefone com DDD.'
  const ddd = Number(d.slice(0, 2))
  if (!DDDS_VALIDOS.has(ddd)) return 'DDD inválido.'
  if (d.length === 11 && d[2] !== '9') return 'Celular deve começar com 9 depois do DDD.'
  return ''
}
