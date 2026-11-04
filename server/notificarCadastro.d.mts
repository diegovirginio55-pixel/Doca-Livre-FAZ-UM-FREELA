export function montarEmailNotificacaoCadastro(input: {
  nome?: string
  tipo: 'profissional' | 'empresa'
  decisao: 'aprovado' | 'aprovada' | 'recusado' | 'recusada'
  motivo?: string
}): { assunto: string; texto: string; html: string }

export function notificarCadastro(input: {
  email?: string
  nome?: string
  tipo?: 'profissional' | 'empresa'
  decisao?: 'aprovado' | 'aprovada' | 'recusado' | 'recusada'
  motivo?: string
  env?: Record<string, string>
}): Promise<{ ok: true; status: number } | { ok: false; status: number; erro: string }>