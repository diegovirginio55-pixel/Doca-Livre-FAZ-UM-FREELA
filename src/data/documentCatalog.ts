/**
 * Catálogo documental fazumfreela
 * Base: briefing operacional + contrato de prestação + práticas de logística/RH.
 */

export type DocCategoria =
  | 'identidade'
  | 'habilitacao'
  | 'certificacao'
  | 'saude'
  | 'financeiro'
  | 'empresa'
  | 'operacao'
  | 'plataforma'

export type DocObrigatorioPara = 'todos' | 'motorista' | 'equipamentos' | 'empresa' | 'demanda'

export type DocumentDef = {
  id: string
  label: string
  categoria: DocCategoria
  descricao: string
  /** Se true, exige data de validade */
  temValidade: boolean
  obrigatorio: DocObrigatorioPara
  /** Códigos de cargo/requisito que exigem este doc */
  requisitos?: string[]
  /** Não entra na completude (ex.: MEI se houver, procuração se aplicável) */
  opcional?: boolean
}

/** Documentos do profissional */
export const DOCS_PROFISSIONAL: DocumentDef[] = [
  {
    id: 'rg_cpf',
    label: 'RG / CPF (frente e verso)',
    categoria: 'identidade',
    descricao: 'Documento de identidade com foto e CPF legível.',
    temValidade: false,
    obrigatorio: 'todos',
  },
  {
    id: 'selfie',
    label: 'Selfie de validação',
    categoria: 'identidade',
    descricao: 'Foto do rosto para conferência com o documento.',
    temValidade: false,
    obrigatorio: 'todos',
  },
  {
    id: 'comprovante_residencia',
    label: 'Comprovante de residência',
    categoria: 'identidade',
    descricao: 'Conta de água, luz, gás ou extrato bancário (até 90 dias).',
    temValidade: false,
    obrigatorio: 'todos',
  },
  {
    id: 'cnh',
    label: 'CNH',
    categoria: 'habilitacao',
    descricao: 'Carteira Nacional de Habilitação — categoria e EAR quando aplicável.',
    temValidade: true,
    obrigatorio: 'motorista',
    requisitos: ['CNH'],
  },
  {
    id: 'mopp',
    label: 'MOPP',
    categoria: 'certificacao',
    descricao: 'Curso de Movimentação de Produtos Perigosos.',
    temValidade: true,
    obrigatorio: 'demanda',
    requisitos: ['MOPP', 'mopp'],
  },
  {
    id: 'nr11',
    label: 'NR-11 (Empilhadeira / movimentação)',
    categoria: 'certificacao',
    descricao: 'Treinamento e habilitação para operação de equipamentos de movimentação.',
    temValidade: true,
    obrigatorio: 'demanda',
    requisitos: ['NR11', 'empilhadeira', 'paleteira', 'reach'],
  },
  {
    id: 'nr35',
    label: 'NR-35 (Trabalho em altura)',
    categoria: 'certificacao',
    descricao: 'Obrigatório quando a operação envolver altura.',
    temValidade: true,
    obrigatorio: 'demanda',
    requisitos: ['NR35'],
  },
  {
    id: 'nr10',
    label: 'NR-10 (Eletricidade)',
    categoria: 'certificacao',
    descricao: 'Para eletricistas e serviços com risco elétrico.',
    temValidade: true,
    obrigatorio: 'demanda',
    requisitos: ['NR10', 'eletricista'],
  },
  {
    id: 'nr20',
    label: 'NR-20 (Inflamáveis e combustíveis)',
    categoria: 'certificacao',
    descricao: 'Quando a operação envolver inflamáveis/combustíveis.',
    temValidade: true,
    obrigatorio: 'demanda',
    requisitos: ['NR20'],
  },
  {
    id: 'munck',
    label: 'Operador de Munck',
    categoria: 'certificacao',
    descricao: 'Certificado de operador de guindaste munck.',
    temValidade: true,
    obrigatorio: 'demanda',
    requisitos: ['Munck', 'munck'],
  },
  {
    id: 'ponte_rolante',
    label: 'Ponte rolante',
    categoria: 'certificacao',
    descricao: 'Certificado de operador de ponte rolante.',
    temValidade: true,
    obrigatorio: 'demanda',
    requisitos: ['Ponte Rolante', 'ponte'],
  },
  {
    id: 'aso',
    label: 'ASO — Atestado de Saúde Ocupacional',
    categoria: 'saude',
    descricao: 'Atestado emitido pelo serviço de saúde ocupacional. O sistema guarda o documento e a conclusão recebida. Não emite ASO.',
    temValidade: true,
    obrigatorio: 'todos',
  },
  {
    id: 'aptidao_gr',
    label: 'Aptidão GR / Seguradora',
    categoria: 'saude',
    descricao: 'Aptidão junto à seguradora/GR do cliente, exigida em rota de truck, carreta, bitrem e rodotrem.',
    temValidade: true,
    obrigatorio: 'demanda',
    requisitos: ['GR', 'motorista_truck', 'carreteiro', 'bitrem', 'rodotrem'],
  },
  {
    id: 'pix_dados',
    label: 'Dados de pagamento (PIX / conta)',
    categoria: 'financeiro',
    descricao: 'Chave PIX ou dados bancários para o pagamento da missão.',
    temValidade: false,
    obrigatorio: 'todos',
  },
  {
    id: 'ctps',
    label: 'CTPS',
    categoria: 'identidade',
    descricao: 'Carteira de Trabalho. O sistema controla o documento; a admissão segue o fluxo do contrato temporário.',
    temValidade: false,
    obrigatorio: 'todos',
    opcional: true,
  },
  {
    id: 'curriculo',
    label: 'Currículo (PDF ou Word)',
    categoria: 'identidade',
    descricao: 'Arquivo original do currículo. Fica com a equipe da Mão de Obra. A empresa vê o currículo organizado pela plataforma.',
    temValidade: false,
    obrigatorio: 'todos',
    opcional: true,
  },
  {
    id: 'mei_cnpj',
    label: 'MEI / CNPJ do prestador (se houver)',
    categoria: 'financeiro',
    descricao: 'Cartão CNPJ ou certificado MEI quando o prestador emitir NF.',
    temValidade: false,
    obrigatorio: 'todos',
    opcional: true,
  },
]

/** Documentos da empresa contratante */
export const DOCS_EMPRESA: DocumentDef[] = [
  {
    id: 'contrato_social',
    label: 'Contrato social / ato constitutório',
    categoria: 'empresa',
    descricao: 'Documento societário atualizado.',
    temValidade: false,
    obrigatorio: 'empresa',
  },
  {
    id: 'cartao_cnpj',
    label: 'Cartão CNPJ',
    categoria: 'empresa',
    descricao: 'Comprovante de inscrição e situação cadastral.',
    temValidade: false,
    obrigatorio: 'empresa',
  },
  {
    id: 'comprovante_endereco_empresa',
    label: 'Comprovante de endereço da empresa',
    categoria: 'empresa',
    descricao: 'Conta de consumo ou IPTU do estabelecimento.',
    temValidade: false,
    obrigatorio: 'empresa',
  },
  {
    id: 'doc_responsavel',
    label: 'Documento do responsável legal',
    categoria: 'empresa',
    descricao: 'RG/CPF do responsável cadastrado na plataforma.',
    temValidade: false,
    obrigatorio: 'empresa',
  },
  {
    id: 'dados_bancarios',
    label: 'Dados bancários',
    categoria: 'financeiro',
    descricao: 'Controle interno da plataforma para pagamento à tomadora ou reembolso, quando houver.',
    temValidade: false,
    obrigatorio: 'empresa',
    opcional: true,
  },
  {
    id: 'documentos_adicionais',
    label: 'Documentos adicionais',
    categoria: 'empresa',
    descricao: 'Controle interno. Não é exigência automática de cada contratação temporária.',
    temValidade: false,
    obrigatorio: 'empresa',
    opcional: true,
  },
]

/** Documentos gerados / exigidos na operação */
export const DOCS_OPERACAO: DocumentDef[] = [
  {
    id: 'contrato_prestacao',
    label: 'Contrato de prestação de serviço',
    categoria: 'operacao',
    descricao: 'Gerado pela plataforma ao confirmar o prestador (modelo fazumfreela).',
    temValidade: false,
    obrigatorio: 'demanda',
  },
  {
    id: 'termo_integracao',
    label: 'Termo de integração',
    categoria: 'operacao',
    descricao: 'Ciência das regras de segurança e integração (presencial ou online).',
    temValidade: false,
    obrigatorio: 'demanda',
  },
  {
    id: 'checklist_epis',
    label: 'Checklist de EPIs',
    categoria: 'operacao',
    descricao: 'Registro de entrega/devolução de EPIs no início e fim do contrato.',
    temValidade: false,
    obrigatorio: 'demanda',
  },
  {
    id: 'comprovante_entrega',
    label: 'Comprovantes de entrega / recebimento',
    categoria: 'operacao',
    descricao: 'Canhotos, fotos ou assinaturas de entrega quando a operação exigir.',
    temValidade: false,
    obrigatorio: 'demanda',
  },
  {
    id: 'ocorrencia',
    label: 'Registro de ocorrência',
    categoria: 'operacao',
    descricao: 'Infrações, sinistros ou incidentes durante a operação.',
    temValidade: false,
    obrigatorio: 'demanda',
  },
]

/** Documentos da empresa de trabalho temporário. O registro no SIRETT é informado, não gerado. */
export const DOCS_ETT: DocumentDef[] = [
  {
    id: 'ett_cnpj',
    label: 'CNPJ',
    categoria: 'plataforma',
    descricao: 'Inscrição da empresa de trabalho temporário.',
    temValidade: false,
    obrigatorio: 'empresa',
  },
  {
    id: 'ett_contrato_social',
    label: 'Contrato social e alterações',
    categoria: 'plataforma',
    descricao: 'Ato constitutivo e alterações registradas na Junta Comercial.',
    temValidade: false,
    obrigatorio: 'empresa',
  },
  {
    id: 'ett_sede',
    label: 'Comprovante da sede',
    categoria: 'plataforma',
    descricao: 'Comprovante do endereço da sede.',
    temValidade: false,
    obrigatorio: 'empresa',
  },
  {
    id: 'ett_sirett',
    label: 'Certificado de registro no SIRETT',
    categoria: 'plataforma',
    descricao: 'Registro da empresa de trabalho temporário no Ministério do Trabalho. O sistema guarda o número informado.',
    temValidade: true,
    obrigatorio: 'empresa',
  },
  {
    id: 'ett_certificado_digital',
    label: 'Certificado digital',
    categoria: 'plataforma',
    descricao: 'Certificado usado nas obrigações da empresa de trabalho temporário.',
    temValidade: true,
    obrigatorio: 'empresa',
    opcional: true,
  },
  {
    id: 'ett_procuracao',
    label: 'Procuração',
    categoria: 'plataforma',
    descricao: 'Quando um representante assina pela empresa de trabalho temporário.',
    temValidade: false,
    obrigatorio: 'empresa',
    opcional: true,
  },
]

/** Documentos institucionais da plataforma */
export const DOCS_PLATAFORMA: DocumentDef[] = [
  {
    id: 'termos_uso',
    label: 'Termos de uso',
    categoria: 'plataforma',
    descricao: 'Condições gerais de uso da fazumfreela.',
    temValidade: false,
    obrigatorio: 'todos',
  },
  {
    id: 'politica_privacidade',
    label: 'Política de privacidade (LGPD)',
    categoria: 'plataforma',
    descricao: 'Tratamento de dados pessoais conforme LGPD.',
    temValidade: false,
    obrigatorio: 'todos',
  },
]

export function allDocumentDefs() {
  return [...DOCS_PROFISSIONAL, ...DOCS_EMPRESA, ...DOCS_OPERACAO, ...DOCS_PLATAFORMA, ...DOCS_ETT]
}

/** Curso do currículo sem tipo próprio no catálogo. O nome do curso vai depois do prefixo. */
export const PREFIXO_CURSO = 'curso:'

export function defDoCurso(nome: string): DocumentDef {
  return {
    id: `${PREFIXO_CURSO}${nome}`,
    label: `Certificado: ${nome}`,
    categoria: 'certificacao',
    descricao: 'Certificado do curso informado no currículo.',
    temValidade: false,
    obrigatorio: 'demanda',
  }
}

export function docDefById(id: string) {
  if (id.startsWith(PREFIXO_CURSO)) return defDoCurso(id.slice(PREFIXO_CURSO.length))
  return allDocumentDefs().find((d) => d.id === id)
}

/** Docs obrigatórios base para qualquer profissional */
export function requiredDocsForProfissional(profissoes: string[], requisitosDemanda: string[] = []) {
  const reqs = new Set(requisitosDemanda)
  const isMotorista = profissoes.some(
    (p) =>
      p.includes('motorista') ||
      p.includes('carret') ||
      p.includes('bitrem') ||
      p.includes('rodotrem') ||
      p.includes('mopp') ||
      p.includes('munck') ||
      p.includes('vuc') ||
      p.includes('manobrista'),
  )
  return DOCS_PROFISSIONAL.filter((d) => docExigido(d, profissoes, reqs, isMotorista))
}

function profissaoCombina(profissoes: string[], token: string) {
  const t = token.toLowerCase()
  return profissoes.some((p) => {
    const id = p.toLowerCase()
    return id === t || id.includes(t)
  })
}

function docExigido(
  d: DocumentDef,
  profissoes: string[],
  reqs: Set<string>,
  isMotorista: boolean,
) {
  if (d.opcional) return false
  if (d.obrigatorio === 'todos') return true
  if (d.obrigatorio === 'motorista' && isMotorista) return true
  if (d.requisitos?.some((r) => reqs.has(r) || profissaoCombina(profissoes, r))) return true
  return false
}

/** Docs obrigatórios da empresa. Procuração fica de fora da completude. */
export function requiredDocsForEmpresa() {
  return DOCS_EMPRESA.filter((d) => !d.opcional)
}

export const DIAS_ALERTA_VENCIMENTO = 30
