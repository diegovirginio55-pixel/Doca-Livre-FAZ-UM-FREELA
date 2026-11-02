import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CATEGORIES } from '../../data/categories'
import { LOCAIS_OPERACAO } from '../../data/cidades'
import { AvailabilityToggle } from '../../components/AvailabilityToggle'
import { AceiteCadastro, todosAceitos } from '../../components/AceiteTermos'
import { AnexoCurriculo, CamposSobre, ListaExperiencias, conferirExperiencias } from '../../components/CurriculoCampos'
import type { TermoId } from '../../lib/termos'
import { ACCEPT_DOCUMENTO_CADASTRO, lerArquivoCadastro, type FotoDocumento, type PapelDocumento } from '../../lib/analisarDocumentoCadastro'
import { coordenadaDaCidade } from '../../lib/coordenadaCidade'
import { CERTIFICADOS_COMUNS, habilidadesDoTexto, mesclarCurriculo, nomeCertificado, semContato } from '../../lib/curriculo'
import type { LeituraCurriculo } from '../../lib/lerCurriculo'
import { validarChavePix } from '../../lib/pix'
import { erroCpf, erroRg, erroTelefone, mascararCpf, mascararRg, mascararTelefone } from '../../lib/documentosPessoais'
import { useStore } from '../../lib/store'
import type { Certificado, Disponibilidade, Experiencia } from '../../lib/types'

type Props = {
  onBack: () => void
  onDone: () => void
}

type LinhaDoc = {
  arquivo: FotoDocumento | null
}

const LINHA_VAZIA: LinhaDoc = { arquivo: null }

function copiaDocumento(foto: FotoDocumento) {
  return `data:${foto.mime};base64,${foto.dados}`
}

const RAIOS = [10, 25, 50, 100]
const ETAPAS = [
  'Currículo',
  'Seus dados',
  'Documentos',
  'Cargos',
  'Experiência',
  'Certificações',
  'Disponibilidade',
  'Raio de trabalho',
  'Pagamento',
]
const PASSO = {
  curriculo: 1,
  dados: 2,
  documentos: 3,
  cargos: 4,
  experiencia: 5,
  certificacoes: 6,
  disponibilidade: 7,
  raio: 8,
  pagamento: 9,
} as const

export function CadastroProfissionalScreen({ onBack, onDone }: Props) {
  const { registerProfissional, completeProfissionalPerfil, aceitarTermos, currentUser, state } = useStore()
  const completing = currentUser?.role === 'profissional' && currentUser.perfilCompleto === false
  const [step, setStep] = useState<number>(PASSO.curriculo)
  const [error, setError] = useState('')
  const [aceites, setAceites] = useState<TermoId[]>([])
  const [curriculo, setCurriculo] = useState<{ nome: string; copia?: string } | null>(null)
  const [certNovo, setCertNovo] = useState('')
  const [linhas, setLinhas] = useState<Record<PapelDocumento, LinhaDoc>>({
    documento: LINHA_VAZIA,
    verso: LINHA_VAZIA,
    selfie: LINHA_VAZIA,
  })
  const geracaoDoc = useRef<Partial<Record<PapelDocumento, number>>>({})
  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    rg: '',
    nascimento: '',
    telefone: '',
    email: currentUser?.email || '',
    senha: '',
    profissoes: [] as string[],
    experiencia: [] as Experiencia[],
    resumo: '',
    escolaridade: '',
    habilidades: '',
    certificados: [] as Certificado[],
    cnhCategoria: '',
    cnhValidade: '',
    disponibilidade: {
      hoje: true,
      amanha: true,
      estaSemana: true,
      finaisDeSemana: false,
      noturno: false,
      viagens: false,
      temporario: true,
      efetivo: false,
      freelancer: true,
    } as Disponibilidade,
    pix: '',
    cep: '',
    cidade: '',
    estado: 'SP',
    rua: '',
    numero: '',
    raioKm: null as number | null,
  })
  const formAtual = useRef(form)
  useEffect(() => {
    formAtual.current = form
  }, [form])

  const ufs = useMemo(() => [...new Set(LOCAIS_OPERACAO.map((local) => local.estado))].sort(), [])
  const cidades = useMemo(
    () => LOCAIS_OPERACAO.filter((local) => local.estado === form.estado).map((local) => local.cidade),
    [form.estado],
  )
  const pixInfo = form.pix.trim() ? validarChavePix(form.pix) : null
  const certsExtras = form.certificados.filter((item) => !CERTIFICADOS_COMUNS.includes(item.tipo))

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function aplicarCurriculo(leitura: LeituraCurriculo) {
    const atual = formAtual.current
    const { form: novo, entrou } = mesclarCurriculo(atual, leitura.lido)
    const comEmail = !completing && !atual.email.trim() && leitura.lido.email
    const final = comEmail ? { ...novo, email: leitura.lido.email } : novo
    formAtual.current = final
    setForm(final)
    setCurriculo({ nome: leitura.arquivoNome, copia: leitura.copia })
    return comEmail ? ['E-mail', ...entrou] : entrou
  }

  function toggleProf(id: string) {
    setForm((f) => ({
      ...f,
      profissoes: f.profissoes.includes(id) ? f.profissoes.filter((p) => p !== id) : [...f.profissoes, id],
    }))
  }

  function toggleCert(tipo: string) {
    setForm((f) => ({
      ...f,
      certificados: f.certificados.some((c) => c.tipo === tipo)
        ? f.certificados.filter((c) => c.tipo !== tipo)
        : [...f.certificados, { tipo, validade: '', valido: true }],
    }))
  }

  function validadeCert(tipo: string, validade: string) {
    setForm((f) => ({
      ...f,
      certificados: f.certificados.map((c) => (c.tipo === tipo ? { ...c, validade } : c)),
    }))
  }

  function incluirCert() {
    const tipo = nomeCertificado(certNovo)
    if (!tipo) return
    if (!form.certificados.some((c) => c.tipo.toLowerCase() === tipo.toLowerCase())) toggleCert(tipo)
    setCertNovo('')
  }

  function definirRaio(valor: string) {
    const numero = Number(valor)
    set('raioKm', valor === '' || !Number.isFinite(numero) || numero <= 0 ? null : Math.min(500, Math.round(numero)))
  }

  function documentosProntos() {
    return Boolean(linhas.documento.arquivo && linhas.selfie.arquivo)
  }

  function documentosEnviados() {
    const frente = linhas.documento.arquivo
    const face = linhas.selfie.arquivo
    const costas = linhas.verso.arquivo
    if (!frente || !face) return []
    return [
      {
        tipoId: 'rg_cpf',
        arquivoNome: [frente.nome, costas?.nome].filter(Boolean).join(', '),
        observacao: 'Aguardando validação manual.',
        arquivoDados: copiaDocumento(frente),
        versoNome: costas?.nome,
        versoDados: costas ? copiaDocumento(costas) : undefined,
      },
      {
        tipoId: 'selfie',
        arquivoNome: face.nome,
        observacao: 'Aguardando validação manual.',
        arquivoDados: copiaDocumento(face),
      },
      ...(curriculo
        ? [
            {
              tipoId: 'curriculo',
              arquivoNome: curriculo.nome,
              observacao: curriculo.copia
                ? 'Enviado no cadastro.'
                : 'Enviado no cadastro. O arquivo passou de 1 MB e ficou só a leitura dos campos.',
              arquivoDados: curriculo.copia,
            },
          ]
        : []),
    ]
  }

  async function escolherFoto(file: File | undefined, papel: PapelDocumento) {
    setError('')
    const vez = (geracaoDoc.current[papel] ?? 0) + 1
    geracaoDoc.current[papel] = vez
    if (!file) {
      setLinhas((atual) => ({ ...atual, [papel]: LINHA_VAZIA }))
      return
    }
    try {
      const foto = await lerArquivoCadastro(file)
      if (geracaoDoc.current[papel] !== vez) return
      setLinhas((atual) => ({ ...atual, [papel]: { arquivo: foto } }))
    } catch (falha) {
      if (geracaoDoc.current[papel] !== vez) return
      setLinhas((atual) => ({ ...atual, [papel]: LINHA_VAZIA }))
      setError(falha instanceof Error ? falha.message : 'Não foi possível ler o arquivo.')
    }
  }

  function next() {
    setError('')
    if (step === PASSO.dados) {
      const falhaDados =
        (form.nome.trim().split(/\s+/).length < 2 ? 'Informe o nome completo (nome e sobrenome).' : '') ||
        erroCpf(form.cpf) ||
        erroRg(form.rg) ||
        erroTelefone(form.telefone)
      if (falhaDados) {
        setError(falhaDados)
        return
      }
    }
    if (step === PASSO.documentos && !documentosProntos()) {
      setError('Envie o documento e a selfie para continuar.')
      return
    }
    if (step === PASSO.cargos && form.profissoes.length === 0) {
      setError('Selecione ao menos um cargo.')
      return
    }
    if (step === PASSO.experiencia) {
      const falha = conferirExperiencias(form.experiencia)
      if (falha) {
        setError(falha)
        return
      }
    }
    if (step === PASSO.raio) {
      if (!form.cidade.trim() || !form.estado.trim()) {
        setError('Informe a cidade e o estado onde você mora.')
        return
      }
      if (form.raioKm == null || form.raioKm < 1) {
        setError('Informe o raio máximo, em km, que você pode ir trabalhar.')
        return
      }
    }
    setStep((s) => Math.min(ETAPAS.length, s + 1))
  }

  function prev() {
    setError('')
    if (step === 1) onBack()
    else setStep((s) => s - 1)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!documentosProntos()) {
      setError('Envie o documento e a selfie antes de concluir.')
      setStep(PASSO.documentos)
      return
    }
    const falhaExp = conferirExperiencias(form.experiencia)
    if (falhaExp) {
      setError(falhaExp)
      setStep(PASSO.experiencia)
      return
    }
    if (form.raioKm == null || form.raioKm < 1) {
      setError('Informe o raio máximo, em km, que você pode ir trabalhar.')
      setStep(PASSO.raio)
      return
    }
    const chave = validarChavePix(form.pix)
    if (!chave.ok) {
      setError(chave.erro)
      setStep(PASSO.pagamento)
      return
    }
    if (!todosAceitos('profissional', aceites)) {
      setError('Marque todos os termos e consentimentos para concluir o cadastro.')
      return
    }
    const hoje = new Date().toISOString().slice(0, 10)
    const habilidades = habilidadesDoTexto(form.habilidades)
    const cnh = form.cnhCategoria.trim()
    const profissionalPayload = {
      nome: form.nome,
      cpf: form.cpf,
      rg: form.rg,
      nascimento: form.nascimento,
      telefone: form.telefone,
      resumo: semContato(form.resumo).slice(0, 600) || undefined,
      escolaridade: form.escolaridade || undefined,
      habilidades: habilidades.length ? habilidades : undefined,
      profissoes: form.profissoes,
      experiencia: form.experiencia
        .filter((item) => item.cargo.trim() || item.empresa.trim())
        .map((item) => ({
          ...item,
          cargo: item.cargo.trim(),
          empresa: item.empresa.trim(),
          descricao: semContato(item.descricao),
        })),
      certificados: form.certificados.map((item) => ({
        ...item,
        valido: !item.validade || item.validade >= hoje,
      })),
      cnhCategoria: cnh || undefined,
      cnhValidade: cnh && form.cnhValidade ? form.cnhValidade : undefined,
      disponibilidade: form.disponibilidade,
      endereco: {
        cep: form.cep,
        rua: form.rua,
        numero: form.numero,
        cidade: form.cidade.trim(),
        estado: form.estado.trim().toUpperCase(),
        ...coordenadaDaCidade(form.cidade, form.estado, [
          ...state.profissionais.map((pessoa) => pessoa.endereco),
          ...state.empresas.map((empresa) => empresa.endereco),
        ]),
      },
      raioKm: form.raioKm,
      pix: chave.chave,
    }
    const documentos = documentosEnviados()
    const res = completing
      ? completeProfissionalPerfil(profissionalPayload, documentos)
      : registerProfissional({ email: form.email, senha: form.senha }, profissionalPayload, documentos)
    if (!res.ok) {
      setError(res.error ?? 'Erro no cadastro')
      return
    }
    aceitarTermos(aceites)
    onDone()
  }

  return (
    <div className="auth-screen auth-screen--scroll">
      <form
        className="auth-card auth-card--wide"
        onSubmit={step === ETAPAS.length ? submit : (e) => { e.preventDefault(); next() }}
      >
        <button type="button" className="btn btn-ghost link-back" onClick={prev}>
          ← Voltar
        </button>
        <h1 className="auth-title">Cadastro de colaborador</h1>
        <p className="step-indicator">
          Etapa {step} de {ETAPAS.length} · {ETAPAS[step - 1]}
        </p>

        {step === PASSO.curriculo && (
          <>
            <p>
              Tem currículo pronto? Anexe aqui e a gente preenche o cadastro com as informações dele. Você confere
              tudo nas próximas etapas.
            </p>
            <AnexoCurriculo onLido={aplicarCurriculo} arquivoAtual={curriculo?.nome} />
            <p className="cv-nota">
              A empresa que contrata vê o currículo organizado pela plataforma: cargos, experiências, cursos e
              cidade. Telefone, CPF, endereço e o arquivo original ficam só com a equipe da fazumfreela.
            </p>
            {!curriculo && <p className="muted">Sem currículo, é só continuar e preencher os campos.</p>}
          </>
        )}
        {step === PASSO.dados && (
          <>
            <label className="field"><span>Nome completo</span><input value={form.nome} onChange={(e) => set('nome', e.target.value)} required /></label>
            <label className="field"><span>CPF</span><input value={form.cpf} onChange={(e) => set('cpf', mascararCpf(e.target.value))} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" maxLength={14} required /></label>
            {form.cpf.replace(/\D/g, '').length === 11 && erroCpf(form.cpf) && <p className="portal-login__erro">{erroCpf(form.cpf)}</p>}
            <label className="field"><span>RG</span><input value={form.rg} onChange={(e) => set('rg', mascararRg(e.target.value))} autoComplete="off" placeholder="00.000.000-0" maxLength={18} required /></label>
            <label className="field"><span>Nascimento</span><input type="date" value={form.nascimento} onChange={(e) => set('nascimento', e.target.value)} required /></label>
            <label className="field"><span>Telefone</span><input type="tel" value={form.telefone} onChange={(e) => set('telefone', mascararTelefone(e.target.value))} inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678" maxLength={15} required /></label>
            {!completing && (
              <>
                <label className="field"><span>E-mail</span><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required /></label>
                <label className="field"><span>Senha</span><input type="password" value={form.senha} onChange={(e) => set('senha', e.target.value)} required minLength={6} /></label>
              </>
            )}
            {completing && <p className="muted">Conta: {currentUser?.email}</p>}
          </>
        )}
        {step === PASSO.documentos && (
          <div className="docs-mock">
            <p>Envie o documento e a selfie. A validação é manual, um arquivo por vez, no painel administrativo.</p>
            <CampoDoc titulo="Documento (RG, CIN, CNH ou CPF)" papel="documento" linha={linhas.documento} onEscolher={escolherFoto} />
            <CampoDoc titulo="Verso, se tiver" papel="verso" linha={linhas.verso} onEscolher={escolherFoto} />
            <CampoDoc titulo="Selfie" papel="selfie" linha={linhas.selfie} onEscolher={escolherFoto} />
            <label className="field">
              <span>CNH (categoria, se aplicável)</span>
              <input
                value={form.cnhCategoria}
                onChange={(e) => set('cnhCategoria', e.target.value.toUpperCase())}
                placeholder="Ex: B, C, D, E"
              />
            </label>
            {form.cnhCategoria.trim() && (
              <label className="field">
                <span>Validade da CNH</span>
                <input type="date" value={form.cnhValidade} onChange={(e) => set('cnhValidade', e.target.value)} />
              </label>
            )}
          </div>
        )}
        {step === PASSO.cargos && (
          <div className="prof-select">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="prof-group">
                <h3>{cat.label}</h3>
                <div className="chip-wrap">
                  {cat.cargos.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`chip ${form.profissoes.includes(c.id) ? 'chip--on' : ''}`}
                      onClick={() => toggleProf(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {step === PASSO.experiencia && (
          <>
            <CamposSobre
              resumo={form.resumo}
              escolaridade={form.escolaridade}
              habilidades={form.habilidades}
              onChange={(campo, valor) => set(campo, valor)}
              classeCampo="field"
            />
            <ListaExperiencias itens={form.experiencia} onChange={(lista) => set('experiencia', lista)} classeCampo="field" />
          </>
        )}
        {step === PASSO.certificacoes && (
          <>
            <div className="chip-wrap">
              {CERTIFICADOS_COMUNS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip ${form.certificados.some((item) => item.tipo === c) ? 'chip--on' : ''}`}
                  onClick={() => toggleCert(c)}
                >
                  {c}
                </button>
              ))}
              {certsExtras.map((item) => (
                <button key={item.tipo} type="button" className="chip chip--on" onClick={() => toggleCert(item.tipo)}>
                  {item.tipo}
                </button>
              ))}
            </div>
            <div className="cv-certs__outro">
              <label className="field">
                <span>Outro curso ou certificado</span>
                <input
                  value={certNovo}
                  maxLength={60}
                  placeholder="Ex.: NR12, Direção defensiva"
                  onChange={(e) => setCertNovo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      incluirCert()
                    }
                  }}
                />
              </label>
              <button type="button" className="btn btn-ghost" onClick={incluirCert}>
                Incluir
              </button>
            </div>
            {form.certificados.length > 0 && (
              <div className="cv-certs">
                <p className="muted">Informe a validade de cada certificado que tiver data de vencimento.</p>
                {form.certificados.map((item) => (
                  <label key={item.tipo} className="field">
                    <span>Validade de {item.tipo}</span>
                    <input type="date" value={item.validade} onChange={(e) => validadeCert(item.tipo, e.target.value)} />
                  </label>
                ))}
              </div>
            )}
            <p className="cv-nota">
              Depois do cadastro, envie o certificado de cada curso em Documentos. As empresas encontram primeiro quem
              tem os certificados aprovados pela equipe da fazumfreela.
            </p>
          </>
        )}
        {step === PASSO.disponibilidade && (
          <AvailabilityToggle value={form.disponibilidade} onChange={(d) => set('disponibilidade', d)} />
        )}
        {step === PASSO.raio && (
          <div className="raio-passo">
            <p>A partir da sua cidade, você só entra em missões dentro desse raio.</p>
            <label className="field">
              <span>Estado</span>
              <select value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                {ufs.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cidade</span>
              <input
                value={form.cidade}
                list="cidades-colaborador"
                onChange={(e) => set('cidade', e.target.value)}
                placeholder="Onde você mora"
                required
              />
              <datalist id="cidades-colaborador">
                {cidades.map((cidade) => (
                  <option key={cidade} value={cidade} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Raio máximo para trabalhar</span>
              <span className="raio-linha">
                <input
                  type="number"
                  min={1}
                  max={500}
                  inputMode="numeric"
                  value={form.raioKm ?? ''}
                  placeholder="km"
                  aria-label="Raio máximo em quilômetros"
                  onChange={(e) => definirRaio(e.target.value)}
                />
                <span>km</span>
              </span>
            </label>
            <div className="raio-opcoes">
              {RAIOS.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={`chip ${form.raioKm === km ? 'chip--on' : ''}`}
                  onClick={() => set('raioKm', km)}
                >
                  {km} km
                </button>
              ))}
            </div>
            {form.cidade.trim() && form.raioKm != null && (
              <p className="raio-resumo">
                Você pode ir trabalhar em até {form.raioKm} km de {form.cidade.trim()}/{form.estado}.
              </p>
            )}
          </div>
        )}
        {step === PASSO.pagamento && (
          <>
            <p className="muted">
              Raio definido: até {form.raioKm} km de {form.cidade}/{form.estado}.
            </p>
            <label className="field">
              <span>Chave PIX</span>
              <input value={form.pix} onChange={(e) => set('pix', e.target.value)} placeholder="CPF, e-mail, celular ou chave aleatória" required />
            </label>
            {pixInfo?.ok && <p className="docs-ok">Chave de {pixInfo.rotulo} conferida.</p>}
            {pixInfo && !pixInfo.ok && <p className="error">{pixInfo.erro}</p>}
            <AceiteCadastro role="profissional" marcados={aceites} onMarcar={setAceites} />
          </>
        )}

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-accent btn-block">
          {step === ETAPAS.length ? 'Concluir cadastro' : 'Continuar'}
        </button>
      </form>
    </div>
  )
}

function CampoDoc({
  titulo,
  papel,
  linha,
  onEscolher,
}: {
  titulo: string
  papel: PapelDocumento
  linha: LinhaDoc
  onEscolher: (file: File | undefined, papel: PapelDocumento) => void
}) {
  return (
    <div className="docs-item">
      <label className="field">
        <span>{titulo}</span>
        <input
          type="file"
          accept={ACCEPT_DOCUMENTO_CADASTRO}
          onChange={(e) => onEscolher(e.target.files?.[0], papel)}
        />
        {linha.arquivo && <small className="muted">{linha.arquivo.nome}</small>}
      </label>
    </div>
  )
}
