import { cargoLabel } from '../data/categories'
import { rotuloMotivo } from './modalidadeContratacao'
import type { ContratoServico, Demanda, Empresa, Profissional } from './types'
import { nowIso, uid } from './seed'

/** Dados da plataforma Doca Livre (intermediadora) — demo localhost */
export const PLATAFORMA_DOCA = {
  razaoSocial: 'DOCA LIVRE MÃO DE OBRA LTDA',
  nomeFantasia: 'Doca Livre fazumfreela',
  cnpj: '00.000.000/0001-00',
  endereco:
    'Plataforma digital de força de trabalho para logística — ambiente de demonstração',
  site: 'docalivre.com.br',
  produto: 'Doca Livre fazumfreela',
}

export type { ContratoServico }

export function formatDateTimeBr(isoOrLocal: string) {
  const d = new Date(isoOrLocal.includes('T') ? isoOrLocal : isoOrLocal.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return isoOrLocal
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMoneyBr(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function buildContratoFromConfirmacao(params: {
  demanda: Demanda
  empresa: Empresa
  profissional: Profissional
  candidaturaId: string
}): ContratoServico {
  const { demanda, empresa, profissional, candidaturaId } = params
  const fimData = demanda.dataFim || demanda.data
  const inicio = `${demanda.data}T${demanda.horaInicio}:00`
  const fim = `${fimData}T${demanda.horaFim}:00`
  const now = nowIso()
  const numero = String(Math.floor(100000 + Math.random() * 900000))
  const temporario = Boolean(demanda.motivo)

  const episFromDemanda = demanda.epis
    ? demanda.epis.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    : []

  return {
    id: uid('ctr'),
    numero,
    demandaId: demanda.id,
    candidaturaId,
    empresaId: empresa.id,
    profissionalId: profissional.id,
    status: 'gerado',
    createdAt: now,
    ofertaEm: demanda.createdAt,
    cienciaEm: now,
    selecaoEm: now,
    valor: demanda.valorDiaria,
    inicioEm: inicio,
    fimEm: fim,
    oQueEmpresaOferece: ['Integração', 'Local para guardar pertences'],
    episEmpresa: episFromDemanda.length ? episFromDemanda : ['EPIs conforme NR aplicável'],
    episPrestador: ['Calçado de segurança', 'Calça comprida'],
    tiposServico: [cargoLabel(demanda.cargo), demanda.descricao || 'Prestação operacional logística'].filter(Boolean),
    instrucoesExtras: temporario
      ? [
          demanda.atividades,
          demanda.observacoes,
          `Motivo da contratação temporária: ${rotuloMotivo(demanda.motivo ?? '')}.`,
          `Período da missão: ${demanda.data} a ${fimData}, das ${demanda.horaInicio} às ${demanda.horaFim}.`,
          `Remuneração prevista: ${formatMoneyBr(demanda.valorDiaria)} por dia trabalhado.`,
          demanda.beneficios ? `Benefícios: ${demanda.beneficios}.` : '',
          'O trabalhador é contratado pela empresa de trabalho temporário e colocado à disposição da empresa tomadora pelo prazo e pelo motivo desta missão.',
          'O contrato entre a empresa de trabalho temporário e a tomadora é escrito e registra o motivo, o prazo, o valor da prestação e as regras de segurança e saúde.',
        ]
          .filter(Boolean)
          .join('\n')
      : [
      demanda.observacoes,
      'DETALHES DO SERVIÇO:',
      `• SERVIÇO: ${cargoLabel(demanda.cargo)}.`,
      '• REMUNERAÇÃO: Contrato pago por dia de serviço (diária).',
      '• VESTIMENTA E EQUIPAMENTOS: o profissional deverá se apresentar com calçado de segurança e calça comprida. Deverá usar os EPIs fornecidos pela empresa e devolvê-los ao final do contrato.',
      '• DESLOCAMENTO: custos de ida e volta até o local são por conta do profissional, salvo acordo diverso.',
      '• INTEGRAÇÃO: obrigatória (presencial ou online) antes do início, quando exigida pela contratante.',
      '• DIÁRIAS: contabilização pelos dias efetivamente trabalhados.',
      '• ALIMENTAÇÃO: custeada pelo próprio profissional, salvo oferta da contratante.',
      '• POLÍTICA DE REEMBOLSOS: somente com autorização prévia da empresa.',
    ]
      .filter(Boolean)
      .join('\n'),
    proibicoes: [
      'Uso indevido do celular durante o trabalho, inclusive fotos do local sem autorização.',
      'Fumar em locais proibidos pela empresa.',
    ],
  }
}

export function renderContratoHtml(params: {
  contrato: ContratoServico
  empresa: Empresa
  profissional: Profissional
  demanda: Demanda
}): string {
  const { contrato: c, empresa, profissional, demanda } = params
  const endEmp = empresa.endereco
  const endProf = profissional.endereco

  const lista = (items: string[]) =>
    items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Contrato Doca Livre — ${c.numero}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; line-height: 1.45; max-width: 800px; margin: 0 auto; padding: 32px 24px; font-size: 13px; }
    h1 { font-size: 1.15rem; text-align: center; margin: 0 0 20px; }
    h2 { font-size: 0.95rem; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .brand { text-align: center; margin-bottom: 8px; }
    .brand img { height: 48px; }
    .meta { text-align: center; color: #555; font-size: 0.85rem; margin-bottom: 24px; }
    p { margin: 0 0 10px; text-align: justify; }
    ul { margin: 4px 0 12px 18px; }
    .box { background: #f7f7f7; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 14px; margin: 12px 0; }
    .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 36px; }
    .assinatura { border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 0.8rem; }
    .footer { margin-top: 32px; font-size: 0.75rem; color: #666; text-align: center; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="brand">
    <img src="${PLATAFORMA_DOCA.site.startsWith('http') ? '' : '/logo-doca-livre.png'}" alt="Doca Livre" />
  </div>
  <h1>${
    demanda.motivo
      ? `CONTRATO DE TRABALHO TEMPORÁRIO — ID ${escapeHtml(c.numero)}`
      : `CONTRATO DE PRESTAÇÃO DE SERVIÇO VIA PLATAFORMA DOCA LIVRE FAZUMFREELA — ID ${escapeHtml(c.numero)}`
  }</h1>
  <p class="meta">${escapeHtml(PLATAFORMA_DOCA.produto)} · Documento gerado em ${formatDateTimeBr(c.createdAt)}</p>

  <p>
    A empresa <strong>${escapeHtml(PLATAFORMA_DOCA.razaoSocial)}</strong>, pessoa jurídica de direito privado,
    inscrita no CNPJ/MF sob o nº <strong>${escapeHtml(PLATAFORMA_DOCA.cnpj)}</strong>
    (${escapeHtml(PLATAFORMA_DOCA.endereco)}), doravante denominada <strong>"DOCA LIVRE"</strong>;
  </p>
  <p>${
    demanda.motivo
      ? 'A Doca Livre fazumfreela atua, neste fluxo, como empresa de trabalho temporário: contrata o trabalhador e o coloca à disposição da empresa tomadora. O registro dessa atividade é feito no Ministério do Trabalho, pelo SIRETT. O contrato com a tomadora é escrito.'
      : 'Intermedia o presente contrato de serviço, formalizado entre as partes abaixo nominadas:'
  }</p>

  <p>
    <strong>${escapeHtml(empresa.razaoSocial)}</strong>, pessoa jurídica de direito privado,
    inscrita no CNPJ/MF sob o nº <strong>${escapeHtml(empresa.cnpj)}</strong>,
    com sede à ${escapeHtml(endEmp.rua)}, nº ${escapeHtml(endEmp.numero)}, CEP ${escapeHtml(endEmp.cep)},
    na cidade de ${escapeHtml(endEmp.cidade)}/${escapeHtml(endEmp.estado)},
    doravante denominada <strong>"CONTRATANTE"</strong>;
  </p>

  <p>
    E, do outro lado, <strong>${escapeHtml(profissional.nome)}</strong>,
    inscrito(a) no CPF sob o nº <strong>${escapeHtml(profissional.cpf)}</strong>,
    residente em ${escapeHtml(endProf.rua)}, nº ${escapeHtml(endProf.numero)},
    ${escapeHtml(endProf.cidade)}/${escapeHtml(endProf.estado)}, CEP ${escapeHtml(endProf.cep)},
    doravante denominado <strong>"CONTRATADO"</strong>;
  </p>

  <p>
    Todas as partes declaram estar cientes e de acordo com os termos de uso da Doca Livre fazumfreela
    e com os termos adicionais do serviço identificado na Plataforma com identificador
    <strong>${escapeHtml(c.numero)}</strong>, abaixo compilados na Descrição do Serviço.
  </p>

  <p>
    Além dos termos de uso, a CONTRATANTE estipula que para esta prestação de serviço relativa ao
    presente contrato, que se inicia no dia <strong>${formatDateTimeBr(c.inicioEm)}</strong>
    e tem a data prevista para término no dia <strong>${formatDateTimeBr(c.fimEm)}</strong>,
    deverão ser seguidos pelo CONTRATADO os seguintes termos contratuais adicionais,
    conforme registrados na oferta de serviço aceita na Plataforma Doca Livre e especificados abaixo.
  </p>

  <p>
    O valor ofertado pela CONTRATANTE que será pago ao CONTRATADO mediante dedução dos créditos
    da CONTRATANTE na Plataforma Doca Livre, em conta/PIX indicado pelo CONTRATADO
    (<strong>${escapeHtml(profissional.pix || 'a informar')}</strong>), é de:
    <strong>${formatMoneyBr(c.valor)}</strong>, podendo sofrer alterações caso haja acordo mútuo
    ou por força dos termos de uso da Doca Livre ou dos termos do serviço abaixo.
  </p>

  <p>
    O presente Contrato poderá ser rescindido de boa-fé a qualquer tempo, tanto por iniciativa da
    CONTRATANTE como pelo CONTRATADO, bastando que a parte interessada comunique a outra por meio
    da Plataforma Doca Livre e que resguarde da melhor forma o patrimônio da outra, sendo que cada parte
    ficará responsável pelas obrigações já assumidas até a data do efetivo encerramento.
    Caso a CONTRATANTE solicite imotivadamente a rescisão antecipada, deverá pagar ao CONTRATADO
    multa correspondente ao valor de uma diária do contrato e, quando aplicável, suportar as despesas
    necessárias para retorno do CONTRATADO ao ponto de origem do contrato.
    Ambas as partes ficam sujeitas aos efeitos da avaliação pela contraparte na plataforma por eventual rescisão antecipada.
  </p>

  <p>
    As partes reconhecem como válidas e eficazes as assinaturas eletrônicas realizadas na Plataforma Doca Livre,
    registradas pelos respectivos logs de acesso, datas e horários, além dos IPs utilizados, para fins de
    rastreabilidade e comprovação, nos termos do art. 10, § 2º da Medida Provisória nº 2.200-2/2001
    e da Lei nº 14.063/2020.
  </p>

  <h2>Descrição do Serviço na plataforma</h2>

  <div class="box">
    <strong>Missão temporária</strong>
    <p style="margin:6px 0 0">
      ${escapeHtml(cargoLabel(demanda.cargo))} · ${escapeHtml(demanda.endereco?.cidade || endEmp.cidade)}/${escapeHtml(demanda.endereco?.estado || endEmp.estado)}
      · ${escapeHtml(demanda.horaInicio)} às ${escapeHtml(demanda.horaFim)}
      ${demanda.dataFim ? ` · ${escapeHtml(demanda.data)} a ${escapeHtml(demanda.dataFim)}` : ''}
      ${demanda.motivo ? ` · Motivo: ${escapeHtml(rotuloMotivo(demanda.motivo))}` : ''}
      ${demanda.quantidade > 1 ? ` · ${demanda.quantidade} trabalhadores` : ''}
    </p>
  </div>

  <p><strong>O que a empresa irá oferecer?</strong></p>
  <ul>${lista(c.oQueEmpresaOferece)}</ul>

  <p><strong>Itens de segurança e vestimenta — Fornecido pela empresa:</strong></p>
  <ul>${lista(c.episEmpresa)}</ul>

  <p><strong>Prestador deve ir com:</strong></p>
  <ul>${lista(c.episPrestador)}</ul>

  <p><strong>Tipos de serviços a serem realizados</strong></p>
  <ul>${lista(c.tiposServico)}</ul>

  <h2>Instruções extras deste contrato</h2>
  <pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(c.instrucoesExtras)}</pre>

  <h2>Proibições</h2>
  <ul>${lista(c.proibicoes)}</ul>

  <h2>Encerramento do contrato / responsabilidades</h2>
  <p>
    Ao encerrar, o CONTRATADO deverá recolher pertences pessoais, entregar documentos/comprovantes
    quando houver, e organizar equipamentos e local de trabalho. A CONTRATANTE e a DOCA LIVRE
    não se responsabilizam por objetos esquecidos no veículo ou no local de operação;
    bens deixados poderão ser considerados abandonados.
  </p>
  <p>
    O CONTRATADO declara conhecimento dos termos de uso da plataforma Doca Livre fazumfreela,
    comprometendo-se a seguir as normas de jornada previstas em lei e responsabilizando-se por
    danos causados por sua culpa, incluindo, quando aplicável, multas de trânsito.
  </p>

  <h2>Trilha de aceite na plataforma</h2>
  <ul>
    <li>Oferta registrada pela CONTRATANTE: ${formatDateTimeBr(c.ofertaEm)}</li>
    <li>CONTRATADO tomou ciência e aceitou os termos: ${formatDateTimeBr(c.cienciaEm)}</li>
    <li>CONTRATADO selecionado pela CONTRATANTE: ${formatDateTimeBr(c.selecaoEm)}</li>
    ${c.assinaturaProfissionalEm ? `<li>Assinatura eletrônica do CONTRATADO: ${formatDateTimeBr(c.assinaturaProfissionalEm)}</li>` : '<li>Assinatura eletrônica do CONTRATADO: pendente</li>'}
  </ul>

  <div class="assinaturas">
    <div class="assinatura">
      <strong>${escapeHtml(empresa.nomeFantasia)}</strong><br />
      CONTRATANTE<br />
      ${escapeHtml(empresa.responsavelNome)}
    </div>
    <div class="assinatura">
      <strong>${escapeHtml(profissional.nome)}</strong><br />
      CONTRATADO<br />
      CPF ${escapeHtml(profissional.cpf)}
    </div>
  </div>

  <p class="footer">
    ${escapeHtml(PLATAFORMA_DOCA.razaoSocial)} · ${escapeHtml(PLATAFORMA_DOCA.produto)} · ${escapeHtml(PLATAFORMA_DOCA.site)}
    <br />Contrato ID ${escapeHtml(c.numero)} · Status: ${escapeHtml(c.status)}
  </p>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
