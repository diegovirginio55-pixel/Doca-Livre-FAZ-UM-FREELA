import { abrirCurriculoPdf, baixarCurriculoPdf } from '../lib/curriculoPdf'
import { montarCurriculo, type ExtrasCurriculo } from '../lib/curriculoDetalhado'
import type { Profissional } from '../lib/types'
import './curriculo-detalhado.css'

/** Currículo completo aberto no cartão do profissional ("Ver currículo"). Sem contato nem documento pessoal. */
export function CurriculoDetalhado({ profissional, extras = {} }: { profissional: Profissional; extras?: ExtrasCurriculo }) {
  const cv = montarCurriculo(profissional, extras)

  return (
    <section className="cvd" aria-label={`Currículo de ${cv.nome}`}>
      <header className="cvd-topo">
        <div>
          <strong>Currículo completo</strong>
          <small>Dados do cadastro na fazumfreela · atualizado em {cv.geradoEm}</small>
        </div>
        <div className="cvd-acoes">
          <button type="button" className="cvd-btn" onClick={() => abrirCurriculoPdf(profissional, extras)}>
            Abrir PDF
          </button>
          <button type="button" className="cvd-btn cvd-btn--leve" onClick={() => baixarCurriculoPdf(profissional, extras)}>
            Baixar PDF
          </button>
        </div>
      </header>

      <div className="cvd-destaques">
        {cv.destaques.map((item) => (
          <div key={item.rotulo} className="cvd-destaque">
            <span>{item.rotulo}</span>
            <strong>{item.valor}</strong>
          </div>
        ))}
      </div>

      {cv.resumo && (
        <div className="cvd-bloco">
          <h4>Resumo profissional</h4>
          {cv.resumo
            .split(/\n+/)
            .filter((parte) => parte.trim())
            .map((parte, indice) => (
              <p key={indice} className="cvd-texto">
                {parte}
              </p>
            ))}
        </div>
      )}

      <div className="cvd-bloco">
        <h4>Dados profissionais</h4>
        <dl className="cvd-dados">
          {cv.dados.map((item) => (
            <div key={item.rotulo}>
              <dt>{item.rotulo}</dt>
              <dd>{item.valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="cvd-bloco">
        <h4>Histórico na fazumfreela</h4>
        <dl className="cvd-dados">
          {cv.historico.map((item) => (
            <div key={item.rotulo}>
              <dt>{item.rotulo}</dt>
              <dd>{item.valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      {cv.cargos.length > 0 && (
        <div className="cvd-bloco">
          <h4>Cargos de interesse</h4>
          <div className="cvd-chips cvd-chips--marca">
            {cv.cargos.map((cargo) => (
              <span key={cargo}>{cargo}</span>
            ))}
          </div>
        </div>
      )}

      <div className="cvd-bloco">
        <h4>Experiência profissional</h4>
        {cv.experiencias.length ? (
          <ol className="cvd-exp">
            {cv.experiencias.map((item, indice) => (
              <li key={`${item.empresa}-${item.periodo}-${indice}`}>
                <div className="cvd-exp-topo">
                  <strong>{item.cargo}</strong>
                  <span>{item.periodo}</span>
                </div>
                <p className="cvd-exp-sub">
                  {item.empresa}
                  {item.duracao && <> · {item.duracao}</>}
                  {item.atual && <em className="cvd-selo cvd-selo--ok">Trabalho atual</em>}
                </p>
                {item.descricao && <p className="cvd-texto">{item.descricao}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="cvd-vazio">O profissional ainda não descreveu experiências no currículo.</p>
        )}
      </div>

      <div className="cvd-bloco">
        <h4>Certificações e cursos</h4>
        {cv.certificados.length ? (
          <>
            <ul className="cvd-certs">
              {cv.certificados.map((item) => (
                <li key={item.nome}>
                  <strong>{item.nome}</strong>
                  <span>Validade: {item.validade}</span>
                  <em className={`cvd-selo cvd-selo--${item.tom}`}>{item.situacao}</em>
                </li>
              ))}
            </ul>
            <p className="cvd-nota">
              {cv.certificadosConferidos
                ? 'A situação vem da conferência dos certificados enviados pelo profissional à fazumfreela.'
                : 'Cursos informados pelo profissional no currículo.'}
            </p>
          </>
        ) : (
          <p className="cvd-vazio">Nenhuma certificação registrada no currículo.</p>
        )}
      </div>

      {cv.habilidades.length > 0 && (
        <div className="cvd-bloco">
          <h4>Habilidades</h4>
          <div className="cvd-chips">
            {cv.habilidades.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      )}

      <div className="cvd-bloco">
        <h4>Disponibilidade</h4>
        <ul className="cvd-disp">
          {cv.disponibilidade.map((item) => (
            <li key={item.rotulo} className={item.ok ? 'cvd-disp--sim' : 'cvd-disp--nao'}>
              <span aria-hidden>{item.ok ? '✓' : '–'}</span>
              {item.rotulo}
              <span className="cvd-oculto">{item.ok ? ': sim' : ': não'}</span>
            </li>
          ))}
        </ul>
      </div>

      {cv.analise?.situacao && <p className="cvd-aviso">{cv.analise.situacao}</p>}

      <p className="cvd-privacidade">Telefone, e-mail, CPF e endereço do profissional ficam protegidos pela fazumfreela.</p>
    </section>
  )
}
