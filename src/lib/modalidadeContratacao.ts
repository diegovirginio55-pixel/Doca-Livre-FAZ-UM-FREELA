export type Modalidade =
  | 'temporario'
  | 'prazo_determinado'
  | 'prazo_indeterminado'
  | 'intermitente'
  | 'autonomo'

export const MODALIDADES: { id: Modalidade; label: string }[] = [
  { id: 'temporario', label: 'Temporário' },
  { id: 'prazo_determinado', label: 'Prazo determinado' },
  { id: 'prazo_indeterminado', label: 'Prazo indeterminado' },
  { id: 'intermitente', label: 'Intermitente' },
  { id: 'autonomo', label: 'Autônomo / serviço independente' },
]

export function rotuloModalidade(id: Modalidade) {
  return MODALIDADES.find((m) => m.id === id)?.label ?? id
}

export type NivelAviso = 'ok' | 'alerta' | 'bloqueio'
export type SituacaoPessoa = 'compativel' | 'alerta' | 'bloqueado'

export type AvisoModalidade = {
  nivel: NivelAviso
  texto: string
}

export const MOTIVOS_TEMPORARIOS = [
  { id: 'substituicao', label: 'Substituição temporária de empregado' },
  { id: 'complementar_imprevisivel', label: 'Demanda complementar imprevisível' },
  { id: 'complementar_sazonal', label: 'Demanda complementar sazonal' },
  { id: 'complementar_periodica', label: 'Demanda complementar periódica/intermitente' },
] as const

export type MotivoTemporario = (typeof MOTIVOS_TEMPORARIOS)[number]['id']

export function rotuloMotivo(id: string) {
  return MOTIVOS_TEMPORARIOS.find((m) => m.id === id)?.label ?? id
}

export const AVISO_FORMALIZACAO =
  'A fazumfreela, neste fluxo, atua como empresa de trabalho temporário: recruta o trabalhador e o coloca à disposição da empresa tomadora. Essa atividade exige registro no Ministério do Trabalho, pelo SIRETT. O contrato com a tomadora é escrito e precisa trazer o motivo, o prazo, o valor da prestação e as regras de segurança e saúde.'

export function diasInclusivos(inicio: string, fim: string) {
  const a = new Date(`${inicio}T12:00:00`)
  const b = new Date(`${fim}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function dataMais(iso: string, anos = 0, meses = 0) {
  const d = new Date(`${iso}T12:00:00`)
  if (anos) d.setFullYear(d.getFullYear() + anos)
  if (meses) d.setMonth(d.getMonth() + meses)
  return d
}

function isoMaiorQue(iso: string, limite: Date) {
  return new Date(`${iso}T12:00:00`).getTime() > limite.getTime()
}

function intervaloDias(anterior: string, seguinte: string) {
  return diasInclusivos(anterior, seguinte) - 1
}

/** Regras do pedido, antes de olhar pessoa por pessoa. */
export function validarNecessidade(modalidade: Modalidade, inicio: string, fim: string): AvisoModalidade {
  const dias = diasInclusivos(inicio, fim)
  if (dias < 1) {
    return { nivel: 'bloqueio', texto: 'O fim da necessidade precisa ser no mesmo dia ou depois do início.' }
  }

  if (modalidade === 'temporario') {
    if (dias > 270) {
      return {
        nivel: 'bloqueio',
        texto: 'Trabalho temporário admite até 180 dias, consecutivos ou não, e uma prorrogação de até 90 dias. Este pedido passa de 270 dias.',
      }
    }
    if (dias > 180) {
      return {
        nivel: 'alerta',
        texto: 'Acima de 180 dias o temporário só cabe como prorrogação de até 90 dias, se continuarem as condições que justificaram a contratação. A busca confere isso no histórico de cada pessoa com a sua empresa.',
      }
    }
    return {
      nivel: 'ok',
      texto: `Necessidade de ${dias} dia${dias === 1 ? '' : 's'}. No temporário, o prazo inicial com a mesma empresa é de até 180 dias, consecutivos ou não.`,
    }
  }

  if (modalidade === 'prazo_determinado') {
    if (isoMaiorQue(fim, dataMais(inicio, 2))) {
      return {
        nivel: 'bloqueio',
        texto: 'Contrato por prazo determinado, em regra, não pode ultrapassar 2 anos.',
      }
    }
    return {
      nivel: 'ok',
      texto: `Necessidade de ${dias} dia${dias === 1 ? '' : 's'}. Prazo determinado não se confunde com trabalho temporário: em regra vai até 2 anos e só admite uma prorrogação.`,
    }
  }

  if (modalidade === 'prazo_indeterminado') {
    return {
      nivel: 'alerta',
      texto: `Estas datas (${dias} dia${dias === 1 ? '' : 's'}) descrevem a necessidade da operação. Prazo indeterminado não se encerra automaticamente no fim informado.`,
    }
  }

  if (modalidade === 'intermitente') {
    return {
      nivel: 'alerta',
      texto: 'Estas datas são a janela da necessidade. No intermitente a convocação é formal e o contrato de trabalho não é por prazo determinado.',
    }
  }

  return {
    nivel: 'alerta',
    texto: 'Estas datas descrevem a necessidade do serviço. Elas não criam, por si, contrato de trabalho. A formalização é de serviço independente, com cuidado para não caracterizar vínculo.',
  }
}

function cicloTemporario(datas: string[], inicioPedido: string) {
  const passadas = [...new Set(datas.filter((d) => d < inicioPedido))].sort()
  if (passadas.length === 0) return { dias: 0, ultimo: null as string | null, intervalo: null as number | null }
  const ultimo = passadas[passadas.length - 1]
  const intervalo = intervaloDias(ultimo, inicioPedido)
  if (intervalo >= 90) return { dias: 0, ultimo, intervalo }
  const grupo = [ultimo]
  for (let i = passadas.length - 2; i >= 0; i--) {
    const maisAntigo = grupo[grupo.length - 1]
    if (intervaloDias(passadas[i], maisAntigo) >= 90) break
    grupo.push(passadas[i])
  }
  return { dias: grupo.length, ultimo, intervalo }
}

export function avaliarPessoaModalidade(params: {
  modalidade: Modalidade
  inicio: string
  fim: string
  datasAnteriores: string[]
}): { situacao: SituacaoPessoa; texto: string } {
  const { modalidade, inicio, fim, datasAnteriores } = params
  const diasPedido = diasInclusivos(inicio, fim)
  const sobreposto = datasAnteriores.find((d) => d >= inicio && d <= fim)
  if (sobreposto) {
    return {
      situacao: 'bloqueado',
      texto: `Indisponível neste período: já existe alocação desta pessoa na sua empresa em ${formatarData(sobreposto)}.`,
    }
  }

  const passadas = datasAnteriores.filter((d) => d < inicio).sort()
  const ultimo = passadas[passadas.length - 1] ?? null
  const intervalo = ultimo ? intervaloDias(ultimo, inicio) : null

  if (modalidade === 'temporario') {
    const ciclo = cicloTemporario(datasAnteriores, inicio)
    if (ciclo.dias === 0) {
      if (diasPedido > 180) {
        return {
          situacao: 'bloqueado',
          texto: 'Sem temporário em curso nesta empresa, o período inicial vai até 180 dias. A prorrogação de até 90 dias não serve para abrir um pedido novo acima desse teto.',
        }
      }
      const folga = ciclo.intervalo !== null && ciclo.intervalo >= 90
      return {
        situacao: 'compativel',
        texto: folga
          ? `O temporário anterior terminou em ${formatarData(ciclo.ultimo!)}, com 90 dias ou mais de intervalo. Este pedido de ${diasPedido} dia${diasPedido === 1 ? '' : 's'} pode iniciar outro ciclo, até o teto de 180 dias.`
          : `Não há temporário anterior desta pessoa com a sua empresa. ${diasPedido} dia${diasPedido === 1 ? '' : 's'} cabem no prazo inicial de até 180 dias, consecutivos ou não.`,
      }
    }
    const total = ciclo.dias + diasPedido
    if (total <= 180) {
      return {
        situacao: 'compativel',
        texto: `Cabe no temporário: ${ciclo.dias} dia${ciclo.dias === 1 ? '' : 's'} já computados nesta empresa neste ciclo, mais ${diasPedido} deste pedido, ainda dentro dos 180 dias, consecutivos ou não.`,
      }
    }
    if (total <= 270) {
      return {
        situacao: 'alerta',
        texto: `Passa de 180 dias (${ciclo.dias} anteriores + ${diasPedido} deste pedido). Só cabe como prorrogação de até 90 dias, se continuarem as condições que justificaram o temporário.`,
      }
    }
    return {
      situacao: 'bloqueado',
      texto: `Não cabe temporário agora. O ciclo nesta empresa já soma ${ciclo.dias} dia${ciclo.dias === 1 ? '' : 's'} e este pedido soma ${diasPedido}. O teto é 180 dias mais uma prorrogação de até 90. Depois disso, a mesma pessoa só volta como temporária para a mesma empresa após 90 dias.`,
    }
  }

  if (modalidade === 'prazo_determinado') {
    if (isoMaiorQue(fim, dataMais(inicio, 2))) {
      return {
        situacao: 'bloqueado',
        texto: 'Este período ultrapassa 2 anos. Prazo determinado, em regra, não pode passar desse limite.',
      }
    }
    if (ultimo && !isoMaiorQue(inicio, dataMais(ultimo, 0, 6))) {
      return {
        situacao: 'alerta',
        texto: `Há alocação anterior em ${formatarData(ultimo)}, há menos de 6 meses. Um novo prazo determinado nesse intervalo pode ser considerado prazo indeterminado, e essa modalidade só admite uma prorrogação.`,
      }
    }
    return {
      situacao: 'compativel',
      texto: 'As datas descrevem a necessidade. Se a formalização for prazo determinado, o limite geral é de 2 anos, com uma única prorrogação.',
    }
  }

  if (modalidade === 'prazo_indeterminado') {
    return {
      situacao: 'alerta',
      texto: 'As datas não encerram um contrato por prazo indeterminado. Elas só marcam a necessidade desta operação. A formalização segue depois da escolha da pessoa.',
    }
  }

  if (modalidade === 'intermitente') {
    return {
      situacao: 'alerta',
      texto: 'Janela de necessidade, não contrato por prazo determinado. No intermitente a convocação é feita à parte, por escrito, e o trabalhador pode aceitar ou não.',
    }
  }

  if (ultimo && intervalo !== null && intervalo < 90) {
    return {
      situacao: 'alerta',
      texto: `Já houve prestação para a sua empresa em ${formatarData(ultimo)}. Repetir serviço seguido aumenta o risco de reconhecimento de vínculo. As datas não geram contrato de trabalho.`,
    }
  }
  return {
    situacao: 'compativel',
    texto: 'Pedido de serviço independente. A formalização não é contrato trabalhista e precisa evitar subordinação e habitualidade.',
  }
}

function formatarData(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}
