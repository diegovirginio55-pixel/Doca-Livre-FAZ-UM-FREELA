import { useEffect, useMemo, useState } from 'react'
import { cargoLabel } from '../../data/categories'
import { DOCS_EMPRESA, DOCS_PROFISSIONAL } from '../../data/documentCatalog'
import { urlArquivoDocumento } from '../../lib/documentoUrl'
import { notificarDecisaoCadastro } from '../../lib/notificarCadastro'
import type { DocumentoRegistro, Empresa, Profissional, User } from '../../lib/types'

const DISP_LABELS: Record<string, string> = {
  hoje: 'Disponível hoje',
  amanha: 'Disponível amanhã',
  estaSemana: 'Esta semana',
  finaisDeSemana: 'Finais de semana',
  noturno: 'Noturno',
  viagens: 'Viagens',
  temporario: 'Trabalho temporário',
  efetivo: 'Efetivo',
  freelancer: 'Freelancer',
}

function rotuloDoc(tipoId: string) {
  return (
    DOCS_PROFISSIONAL.find((d) => d.id === tipoId)?.label ||
    DOCS_EMPRESA.find((d) => d.id === tipoId)?.label ||
    tipoId
  )
}

function abrirUrl(url: string, nome?: string) {
  if (url.startsWith('data:')) {
    const partes = url.split(',')
    const mime = /data:([^;]+)/.exec(partes[0] || '')?.[1] || 'application/octet-stream'
    const binario = atob(partes[1] || '')
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }))
    const a = document.createElement('a')
    a.href = blobUrl
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    if (nome) {
      // a foto do documento pode ser a 1a pagina do PDF convertida em imagem: salva com a extensao certa
      const ext = mime.startsWith('image/') ? '.' + (mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1]) : ''
      a.download = ext ? nome.replace(/\.[^.]+$/, '') + ext : nome
    }
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    return
  }
  window.open(url, '_blank', 'noopener')
}

function DocPreview({ doc }: { doc: DocumentoRegistro }) {
  const [url, setUrl] = useState<string | null>(doc.arquivoDados?.startsWith('data:') ? doc.arquivoDados : null)
  const [verso, setVerso] = useState<string | null>(
    doc.meta?.versoDados?.startsWith('data:') ? doc.meta.versoDados : null,
  )
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    void (async () => {
      if (!doc.arquivoDados?.startsWith('data:') && doc.meta?.storagePath) {
        const signed = await urlArquivoDocumento({ storagePath: doc.meta.storagePath })
        if (vivo) {
          if (signed) setUrl(signed)
          else setErro('Arquivo indisponível para preview (só metadados na nuvem).')
        }
      } else if (!doc.arquivoDados) {
        if (vivo) setErro('Arquivo não foi armazenado neste cadastro.')
      }
      if (doc.meta?.versoDados?.startsWith('data:')) {
        if (vivo) setVerso(doc.meta.versoDados)
      }
    })()
    return () => {
      vivo = false
    }
  }, [doc])

  const imagem = Boolean(url && (url.startsWith('data:image/') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)))
  const pdf = Boolean(url && (url.startsWith('data:application/pdf') || /\.pdf(\?|$)/i.test(url)))

  return (
    <div className="ad-doc-card">
      <strong>{rotuloDoc(doc.tipoId)}</strong>
      <p className="muted">
        {doc.arquivoNome || 'sem nome'} · {doc.status}
        {doc.enviadoEm ? ` · ${new Date(doc.enviadoEm).toLocaleString('pt-BR')}` : ''}
      </p>
      {doc.observacao && (
        <p className={doc.observacao.includes('NÃO CONFERE') ? 'error' : 'muted'}>{doc.observacao}</p>
      )}
      {erro && <p className="muted">{erro}</p>}
      {url && imagem && <img src={url} alt={rotuloDoc(doc.tipoId)} className="ad-doc-preview" />}
      {verso && <img src={verso} alt="Verso" className="ad-doc-preview" />}
      <div className="px-row-actions" style={{ marginTop: 8 }}>
        {url && (
          <button type="button" className="px-btn px-btn-ghost" onClick={() => abrirUrl(url, doc.arquivoNome)}>
            {pdf || !imagem ? 'Abrir / baixar' : 'Abrir arquivo'}
          </button>
        )}
        {verso && (
          <button
            type="button"
            className="px-btn px-btn-ghost"
            onClick={() => abrirUrl(verso, doc.meta?.versoNome)}
          >
            Abrir verso
          </button>
        )}
      </div>
    </div>
  )
}

type PropsProf = {
  profissional: Profissional
  conta?: User
  documentos: DocumentoRegistro[]
  onClose: () => void
  onAprovar: () => Promise<void>
  onRecusar: (motivo: string) => Promise<void>
}

export function CadastroProfissionalDetalhe({
  profissional,
  conta,
  documentos,
  onClose,
  onAprovar,
  onRecusar,
}: PropsProf) {
  const [motivo, setMotivo] = useState('')
  const [recusando, setRecusando] = useState(false)
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState('')
  const pendente = profissional.status === 'pendente'
  const disp = useMemo(
    () =>
      Object.entries(profissional.disponibilidade || {})
        .filter(([, v]) => Boolean(v))
        .map(([k]) => DISP_LABELS[k] || k),
    [profissional.disponibilidade],
  )

  async function aprovar() {
    setBusy(true)
    setAviso('')
    try {
      await onAprovar()
      const email = conta?.email || ''
      const mail = await notificarDecisaoCadastro({
        email,
        nome: profissional.nome,
        tipo: 'profissional',
        decisao: 'aprovado',
      })
      setAviso(
        mail.ok
          ? 'Cadastro aprovado e e-mail enviado.'
          : `Cadastro aprovado, mas o e-mail falhou: ${mail.erro}`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function recusar() {
    const razao = motivo.trim()
    if (!razao) {
      setAviso('Informe o motivo da recusa.')
      return
    }
    setBusy(true)
    setAviso('')
    try {
      await onRecusar(razao)
      const email = conta?.email || ''
      const mail = await notificarDecisaoCadastro({
        email,
        nome: profissional.nome,
        tipo: 'profissional',
        decisao: 'recusado',
        motivo: razao,
      })
      setAviso(
        mail.ok
          ? 'Cadastro recusado e e-mail enviado.'
          : `Cadastro recusado, mas o e-mail falhou: ${mail.erro}`,
      )
      setRecusando(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-modal-backdrop" onClick={onClose}>
      <div
        className="px-modal px-modal--wide ad-cadastro-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-modal-head">
          <div>
            <h2 style={{ margin: 0 }}>Cadastro — {profissional.nome}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Status: {profissional.status}
              {profissional.motivoRecusa ? ` · Motivo: ${profissional.motivoRecusa}` : ''}
            </p>
          </div>
          <button type="button" className="px-btn px-btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="ad-cadastro-grid">
          <section>
            <h3>Dados pessoais</h3>
            <dl className="ad-dl">
              <div>
                <dt>E-mail</dt>
                <dd>{conta?.email || '—'}</dd>
              </div>
              <div>
                <dt>Usuário</dt>
                <dd>{conta?.usuario || '—'}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{profissional.telefone || '—'}</dd>
              </div>
              <div>
                <dt>CPF</dt>
                <dd>{profissional.cpf || '—'}</dd>
              </div>
              <div>
                <dt>RG</dt>
                <dd>{profissional.rg || '—'}</dd>
              </div>
              <div>
                <dt>Nascimento</dt>
                <dd>{profissional.nascimento || '—'}</dd>
              </div>
              <div>
                <dt>Endereço</dt>
                <dd>
                  {profissional.endereco
                    ? `${profissional.endereco.rua}, ${profissional.endereco.numero} — ${profissional.endereco.cidade}/${profissional.endereco.estado} (CEP ${profissional.endereco.cep})`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Cargos</dt>
                <dd>{profissional.profissoes.map(cargoLabel).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>CNH</dt>
                <dd>
                  {profissional.cnhCategoria
                    ? `${profissional.cnhCategoria} (val. ${profissional.cnhValidade || '—'})`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Disponibilidade</dt>
                <dd>{disp.length ? disp.join(', ') : '—'}</dd>
              </div>
              <div>
                <dt>Raio</dt>
                <dd>{profissional.raioKm ? `${profissional.raioKm} km` : '—'}</dd>
              </div>
              <div>
                <dt>PIX</dt>
                <dd>{profissional.pix || '—'}</dd>
              </div>
              <div>
                <dt>Escolaridade</dt>
                <dd>{profissional.escolaridade || '—'}</dd>
              </div>
              <div>
                <dt>Resumo</dt>
                <dd>{profissional.resumo || '—'}</dd>
              </div>
              <div>
                <dt>Habilidades</dt>
                <dd>{(profissional.habilidades || []).join(', ') || '—'}</dd>
              </div>
            </dl>
            {profissional.experiencia?.length > 0 && (
              <>
                <h3>Experiência</h3>
                <ul className="ad-exp">
                  {profissional.experiencia.map((exp, i) => (
                    <li key={i}>
                      <strong>{exp.cargo}</strong> · {exp.empresa} ({exp.inicio} – {exp.fim || 'atual'})
                      {exp.descricao ? <p className="muted">{exp.descricao}</p> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {profissional.certificados?.length > 0 && (
              <>
                <h3>Certificações</h3>
                <ul className="ad-exp">
                  {profissional.certificados.map((c, i) => (
                    <li key={i}>
                      {c.tipo} {c.validade ? `(val. ${c.validade})` : ''}{' '}
                      {c.valido === false ? '· inválido' : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section>
            <h3>Documentos enviados</h3>
            {documentos.length === 0 && <p className="muted">Nenhum documento neste cadastro.</p>}
            <div className="ad-docs">
              {documentos.map((d) => (
                <DocPreview key={d.id} doc={d} />
              ))}
            </div>
          </section>
        </div>

        {aviso && (
          <p className={aviso.includes('falhou') || aviso.includes('Informe') ? 'error' : 'ad-ok'}>{aviso}</p>
        )}

        {pendente && (
          <div className="ad-cadastro-acoes">
            {!recusando ? (
              <>
                <button type="button" className="px-btn px-btn-primary" disabled={busy} onClick={() => void aprovar()}>
                  Aprovar cadastro
                </button>
                <button type="button" className="px-btn px-btn-ghost" disabled={busy} onClick={() => setRecusando(true)}>
                  Recusar
                </button>
              </>
            ) : (
              <div className="ad-recusa-box">
                <label>
                  Motivo da recusa (obrigatório)
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    placeholder="Explique o que precisa ser corrigido..."
                  />
                </label>
                <div className="px-row-actions">
                  <button type="button" className="px-btn px-btn-primary" disabled={busy} onClick={() => void recusar()}>
                    Confirmar recusa e enviar e-mail
                  </button>
                  <button
                    type="button"
                    className="px-btn px-btn-ghost"
                    disabled={busy}
                    onClick={() => setRecusando(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type PropsEmp = {
  empresa: Empresa
  conta?: User
  documentos: DocumentoRegistro[]
  onClose: () => void
  onAprovar: () => Promise<void>
  onRecusar: (motivo: string) => Promise<void>
}

export function CadastroEmpresaDetalhe({
  empresa,
  conta,
  documentos,
  onClose,
  onAprovar,
  onRecusar,
}: PropsEmp) {
  const [motivo, setMotivo] = useState('')
  const [recusando, setRecusando] = useState(false)
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState('')
  const pendente = empresa.status === 'pendente'

  async function aprovar() {
    setBusy(true)
    setAviso('')
    try {
      await onAprovar()
      const mail = await notificarDecisaoCadastro({
        email: conta?.email || '',
        nome: empresa.nomeFantasia || empresa.razaoSocial,
        tipo: 'empresa',
        decisao: 'aprovado',
      })
      setAviso(
        mail.ok
          ? 'Cadastro aprovado e e-mail enviado.'
          : `Cadastro aprovado, mas o e-mail falhou: ${mail.erro}`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function recusar() {
    const razao = motivo.trim()
    if (!razao) {
      setAviso('Informe o motivo da recusa.')
      return
    }
    setBusy(true)
    setAviso('')
    try {
      await onRecusar(razao)
      const mail = await notificarDecisaoCadastro({
        email: conta?.email || '',
        nome: empresa.nomeFantasia || empresa.razaoSocial,
        tipo: 'empresa',
        decisao: 'recusado',
        motivo: razao,
      })
      setAviso(
        mail.ok
          ? 'Cadastro recusado e e-mail enviado.'
          : `Cadastro recusado, mas o e-mail falhou: ${mail.erro}`,
      )
      setRecusando(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-modal-backdrop" onClick={onClose}>
      <div
        className="px-modal px-modal--wide ad-cadastro-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-modal-head">
          <div>
            <h2 style={{ margin: 0 }}>Cadastro — {empresa.nomeFantasia}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Status: {empresa.status}
              {empresa.motivoRecusa ? ` · Motivo: ${empresa.motivoRecusa}` : ''}
            </p>
          </div>
          <button type="button" className="px-btn px-btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="ad-cadastro-grid">
          <section>
            <h3>Dados da empresa</h3>
            <dl className="ad-dl">
              <div>
                <dt>E-mail</dt>
                <dd>{conta?.email || '—'}</dd>
              </div>
              <div>
                <dt>Usuário</dt>
                <dd>{conta?.usuario || '—'}</dd>
              </div>
              <div>
                <dt>CNPJ</dt>
                <dd>{empresa.cnpj || '—'}</dd>
              </div>
              <div>
                <dt>Razão social</dt>
                <dd>{empresa.razaoSocial || '—'}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{empresa.tipo || '—'}</dd>
              </div>
              <div>
                <dt>Plano</dt>
                <dd>{empresa.plano || '—'}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{empresa.telefone || '—'}</dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>
                  {empresa.responsavelNome || '—'} · CPF {empresa.responsavelCpf || '—'} ·{' '}
                  {empresa.responsavelCargo || '—'}
                </dd>
              </div>
              <div>
                <dt>Endereço</dt>
                <dd>
                  {empresa.endereco
                    ? `${empresa.endereco.rua}, ${empresa.endereco.numero} — ${empresa.endereco.cidade}/${empresa.endereco.estado} (CEP ${empresa.endereco.cep})`
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Documentos enviados</h3>
            {documentos.length === 0 && <p className="muted">Nenhum documento neste cadastro.</p>}
            <div className="ad-docs">
              {documentos.map((d) => (
                <DocPreview key={d.id} doc={d} />
              ))}
            </div>
          </section>
        </div>

        {aviso && (
          <p className={aviso.includes('falhou') || aviso.includes('Informe') ? 'error' : 'ad-ok'}>{aviso}</p>
        )}

        {pendente && (
          <div className="ad-cadastro-acoes">
            {!recusando ? (
              <>
                <button type="button" className="px-btn px-btn-primary" disabled={busy} onClick={() => void aprovar()}>
                  Aprovar cadastro
                </button>
                <button type="button" className="px-btn px-btn-ghost" disabled={busy} onClick={() => setRecusando(true)}>
                  Recusar
                </button>
              </>
            ) : (
              <div className="ad-recusa-box">
                <label>
                  Motivo da recusa (obrigatório)
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    placeholder="Explique o que precisa ser corrigido..."
                  />
                </label>
                <div className="px-row-actions">
                  <button type="button" className="px-btn px-btn-primary" disabled={busy} onClick={() => void recusar()}>
                    Confirmar recusa e enviar e-mail
                  </button>
                  <button
                    type="button"
                    className="px-btn px-btn-ghost"
                    disabled={busy}
                    onClick={() => setRecusando(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
