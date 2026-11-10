import type { CheckIn, Demanda } from './types'

/**
 * Data local no formato AAAA-MM-DD. `toISOString().slice(0, 10)` dá a data em UTC: depois das
 * 21h (Brasília) "hoje" virava amanhã — encerramento com a data errada, CNH que vence hoje
 * tratada como vencida.
 */
export function dataLocal(quando: Date | string | number = new Date()): string {
  const d = quando instanceof Date ? quando : new Date(quando)
  if (Number.isNaN(d.getTime())) return ''
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function hojeLocal() {
  return dataLocal(new Date())
}

/** Dia de um registro de ponto (registros antigos não tinham `data`: vale o dia da entrada). */
export function diaDoPonto(c: CheckIn): string {
  return c.data || (c.checkInAt ? dataLocal(c.checkInAt) : '')
}

export function pontosDe(checkIns: CheckIn[], demandaId: string, profissionalId: string) {
  return checkIns.filter((c) => c.demandaId === demandaId && c.profissionalId === profissionalId)
}

/** Registro de hoje, se houver entrada hoje. */
export function pontoDeHoje(checkIns: CheckIn[], demandaId: string, profissionalId: string) {
  const hoje = hojeLocal()
  return pontosDe(checkIns, demandaId, profissionalId).find((c) => c.checkInAt && diaDoPonto(c) === hoje)
}

/** Dias distintos com entrada registrada (presença). */
export function diasComPresenca(checkIns: CheckIn[], demandaId: string, profissionalId: string, ate?: string) {
  const dias = new Set(
    pontosDe(checkIns, demandaId, profissionalId)
      .filter((c) => c.checkInAt)
      .map(diaDoPonto)
      .filter((dia) => dia && (!ate || dia <= ate)),
  )
  return dias.size
}

export function horasRegistradas(checkIns: CheckIn[], demandaId: string, profissionalId: string) {
  return pontosDe(checkIns, demandaId, profissionalId).reduce((soma, c) => soma + (c.horasTrabalhadas ?? 0), 0)
}

/** Hoje está dentro do período da missão? */
export function missaoNoDia(demanda: Pick<Demanda, 'data' | 'dataFim'>, dia = hojeLocal()) {
  return dia >= demanda.data && dia <= (demanda.dataFim || demanda.data)
}

/** Dias corridos entre duas datas AAAA-MM-DD, inclusive. */
export function diasEntre(inicio: string, fim: string) {
  const a = new Date(`${inicio}T12:00:00`)
  const b = new Date(`${fim}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 1
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}
