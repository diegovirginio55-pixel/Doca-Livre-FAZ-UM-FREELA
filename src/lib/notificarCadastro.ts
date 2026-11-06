import { chamarApi } from './api'
import { emDemo } from './modo'

export type NotificacaoCadastroInput = {
  email: string
  nome: string
  tipo: 'profissional' | 'empresa'
  decisao: 'aprovado' | 'recusado'
  motivo?: string
}

/** E-mail de aprovação/recusa. Só o admin logado consegue (a API confere o token). */
export async function notificarDecisaoCadastro(
  input: NotificacaoCadastroInput,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const email = String(input.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { ok: false, erro: 'E-mail do cadastro não encontrado.' }
  }
  // Na demonstração ninguém recebe e-mail.
  if (emDemo()) return { ok: true }
  const r = await chamarApi(
    '/api/portal/notificar-cadastro',
    {
      email,
      nome: String(input.nome || '').trim(),
      tipo: input.tipo,
      decisao: input.decisao,
      motivo: String(input.motivo || '').trim(),
    },
    { erroPadrao: 'Não foi possível enviar o e-mail. Tente de novo em instantes.' },
  )
  return r.ok ? { ok: true } : { ok: false, erro: r.erro }
}
