/**
 * Usuário e senha do cadastro sem burocracia: a pessoa digita do jeito dela ("Diego Isidoro") e o site
 * transforma num usuário que o servidor aceita ("diego.isidoro": 3 a 30 letras, números, ponto, hífen ou
 * sublinhado). As regras continuam as mesmas do servidor (api/rotasAuth.mjs).
 */

export function normalizarUsuario(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/([._-])[._-]+/g, '$1')
    .replace(/^[._-]+/, '')
    .slice(0, 30)
    .replace(/[._-]+$/, '')
}

/** Sugestão de usuário a partir do e-mail (a parte antes do @). */
export function usuarioDoEmail(email: string) {
  const sugestao = normalizarUsuario(email.split('@')[0] ?? '')
  return sugestao.length >= 3 ? sugestao : ''
}

/** Outra opção quando o usuário já existe: o mesmo nome com três números no fim. */
export function usuarioComNumero(base: string) {
  const raiz = (normalizarUsuario(base) || 'usuario').slice(0, 26).replace(/[._-]+$/, '')
  return `${raiz}${Math.floor(100 + Math.random() * 900)}`
}

export const REGRAS_SENHA = [
  { id: 'tamanho', texto: 'Pelo menos 8 caracteres', ok: (senha: string) => senha.length >= 8 },
  { id: 'mistura', texto: 'Letras e números', ok: (senha: string) => /[A-Za-z]/.test(senha) && /\d/.test(senha) },
] as const

/** Mesmo critério do servidor para contas de empresa e de profissional. */
export function problemaSenhaCadastro(senha: string) {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (senha.length > 128) return 'A senha pode ter no máximo 128 caracteres.'
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.'
  return null
}
