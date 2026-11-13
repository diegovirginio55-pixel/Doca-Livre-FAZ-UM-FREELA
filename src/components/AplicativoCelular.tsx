import { useCallback, useEffect, useState } from 'react'
import { chamarApi } from '../lib/api'
import {
  APK_URL,
  ehAndroid,
  ehIphone,
  estaNoApp,
  lerVersaoDoApp,
  linkDeAtivacao,
  type VersaoDoApp,
} from '../lib/aplicativo'
import { emDemo } from '../lib/modo'
import './aplicativo-celular.css'

/** Ícone do menu "Aplicativo" (mesmo traço dos outros ícones do menu). */
export function IconeCelular() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6.5" y="2.75" width="11" height="18.5" rx="2.2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M10.5 18h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

type Papel = 'empresa' | 'profissional' | 'gestao'

type Aparelho = { id: string; versao: string | null; criadoEm: string; vistoEm: string | null }

const VANTAGENS: Record<Papel, string[]> = {
  profissional: [
    'Aviso no celular quando chega um convite, quando a empresa confirma a sua contratação e quando sai vaga nova perto de você.',
    'Widget na tela inicial com convites, vagas novas e trabalhos confirmados.',
    'Atalhos: segure o ícone do app para ir direto a Vagas, Vagas aceitas ou Financeiro.',
  ],
  empresa: [
    'Aviso no celular quando um profissional se candidata ou aceita o seu convite.',
    'Widget na tela inicial com vagas abertas, candidatos para confirmar e quem está em serviço agora.',
    'Atalhos: segure o ícone do app para ir direto a Publicar vaga, Vagas Publicadas ou Contratações.',
  ],
  gestao: [
    'Aviso no celular quando chega cadastro de empresa ou de profissional para aprovar.',
    'Widget na tela inicial com cadastros para aprovar e vagas abertas.',
    'Atalhos: segure o ícone do app para ir direto a Empresas ou Profissionais.',
  ],
}

function dataHora(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/**
 * Tela "Aplicativo": baixar o app Android, como instalar e, com a conta aberta, ligar o widget e os avisos
 * neste celular. `publico` = na tela de entrada (sem conta): só o download e o passo a passo.
 */
export function AplicativoCelular({ papel, publico = false }: { papel?: Papel; publico?: boolean }) {
  const [versao, setVersao] = useState<VersaoDoApp | null | 'buscando'>('buscando')
  const [aparelhos, setAparelhos] = useState<Aparelho[] | null>(null)
  const [ativando, setAtivando] = useState(false)
  const [linkAtivar, setLinkAtivar] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null)
  const noApp = estaNoApp()
  const android = ehAndroid()
  const iphone = ehIphone()
  const demo = emDemo()
  const comConta = !publico && !demo

  useEffect(() => {
    let vivo = true
    void lerVersaoDoApp().then((v) => {
      if (vivo) setVersao(v)
    })
    return () => {
      vivo = false
    }
  }, [])

  const carregarAparelhos = useCallback(async () => {
    const r = await chamarApi<{ aparelhos: Aparelho[] }>('/api/app/aparelhos', undefined, { metodo: 'GET' })
    if (r.ok) setAparelhos(r.aparelhos)
  }, [])

  useEffect(() => {
    if (comConta) void carregarAparelhos()
  }, [comConta, carregarAparelhos])

  async function ativar() {
    setAtivando(true)
    setMensagem(null)
    const r = await chamarApi<{ token: string }>('/api/app/ativar', {}, { erroPadrao: 'Não foi possível ativar agora.' })
    setAtivando(false)
    if (!r.ok) {
      setMensagem({ ok: false, texto: r.erro })
      return
    }
    const link = linkDeAtivacao(r.token)
    setLinkAtivar(link)
    void carregarAparelhos()
    // Abre a tela "App do fazumfreela" do app já com o código deste celular.
    window.location.href = link
  }

  async function desativar(id: string) {
    const r = await chamarApi('/api/app/desativar', { id }, { erroPadrao: 'Não foi possível desativar.' })
    setMensagem(
      r.ok
        ? {
            ok: true,
            texto:
              id === 'todos'
                ? 'Todos os celulares foram desativados. O widget e os avisos param neles.'
                : 'Celular desativado. O widget e os avisos param nele.',
          }
        : { ok: false, texto: r.erro },
    )
    void carregarAparelhos()
  }

  const apk = versao !== 'buscando' && versao !== null ? versao : null
  const versaoAtual = apk ? apk.versao : null
  const vantagens = VANTAGENS[papel ?? 'profissional']

  return (
    <div className="app-cel">
      <header className="app-cel-topo">
        <div className="app-cel-marca" aria-hidden>
          <img src="/icon-192.png" alt="" width={56} height={56} />
        </div>
        <div className="app-cel-titulo">
          <p className="app-cel-kicker">Aplicativo</p>
          <h2>fazumfreela no celular</h2>
          <p>
            O app para Android abre o fazumfreela em tela cheia, com ícone próprio, sem a barra do navegador e já na
            sua conta. Ele não está na Play Store: o instalador é baixado daqui.
          </p>
        </div>
        <div className="app-cel-baixar">
          {noApp ? (
            <span className="app-cel-selo app-cel-selo--ok">Você já está usando o app</span>
          ) : apk ? (
            <a className="app-cel-btn app-cel-btn--principal" href={APK_URL} download="fazumfreela.apk">
              Baixar o app para Android
              <small>
                versão {apk.versao}
                {apk.tamanhoMb ? ` · ${String(apk.tamanhoMb).replace('.', ',')} MB` : ''}
              </small>
            </a>
          ) : versao === null ? (
            <span className="app-cel-selo">O instalador ainda não foi publicado.</span>
          ) : null}
        </div>
      </header>

      {!noApp && iphone && (
        <div className="app-cel-aviso">
          <strong>iPhone:</strong> o app é só para Android. No iPhone, use o fazumfreela pelo Safari, em{' '}
          <strong>fazumfreela.com.br</strong>.
        </div>
      )}

      <div className="app-cel-grade">
        <section className="app-cel-cartao">
          <h3>O que o app tem a mais que o site</h3>
          <ul>
            <li>Abre em tela cheia, com ícone próprio, sem a barra do navegador e já logado.</li>
            {(publico ? [...VANTAGENS.profissional.slice(0, 1), ...VANTAGENS.empresa.slice(0, 1)] : vantagens).map(
              (texto) => (
                <li key={texto}>{texto}</li>
              ),
            )}
            <li>Links do fazumfreela recebidos por WhatsApp ou e-mail abrem direto no app.</li>
          </ul>
        </section>

        <section className="app-cel-cartao">
          <h3>Como instalar</h3>
          <ol>
            <li>
              No celular Android, toque em <strong>Baixar o app para Android</strong>.
            </li>
            <li>
              Abra o arquivo baixado. Se o celular perguntar, <strong>permita instalar desta fonte</strong>.
            </li>
            <li>
              Se o Play Protect avisar que não conhece o app, toque em <strong>Instalar mesmo assim</strong>.
            </li>
            <li>
              Abra o <strong>fazumfreela</strong> e entre com o seu usuário.
            </li>
            <li>
              No app, abra o menu <strong>Aplicativo</strong> e toque em <strong>Ativar neste celular</strong> para
              ligar o widget e os avisos.
            </li>
          </ol>
          <p className="app-cel-nota">
            Para atualizar, baixe de novo e instale por cima. O app usa o Google Chrome do celular. O atalho antigo,
            instalado pelo navegador, não abre mais o sistema: pode apagá-lo.
          </p>
        </section>
      </div>

      {!publico && (
        <section className="app-cel-cartao app-cel-ativacao">
          <h3>Widget e avisos neste celular</h3>
          {demo ? (
            <p>Na demonstração a ativação não funciona. Entre no sistema real para ligar o widget e os avisos.</p>
          ) : (
            <>
              <p>
                Para mostrar o widget e avisar das novidades com o app fechado, o celular recebe um código próprio, que
                só busca os números e as novidades da sua conta. Você pode desativar quando quiser.
              </p>
              <div className="app-cel-acoes">
                <button
                  type="button"
                  className="app-cel-btn app-cel-btn--principal"
                  disabled={ativando || !android}
                  onClick={() => void ativar()}
                >
                  {ativando ? 'Ativando…' : 'Ativar neste celular'}
                </button>
                {aparelhos && aparelhos.length > 1 && (
                  <button type="button" className="app-cel-btn" onClick={() => void desativar('todos')}>
                    Desativar todos
                  </button>
                )}
              </div>
              {!android && (
                <p className="app-cel-nota">
                  O botão <strong>Ativar neste celular</strong> funciona no celular Android, com o app instalado. Abra
                  esta tela pelo app.
                </p>
              )}
              {linkAtivar && (
                <p className="app-cel-nota">
                  O app não abriu? <a href={linkAtivar}>Toque aqui para concluir a ativação</a>. Sem o app instalado, o
                  celular baixa o instalador.
                </p>
              )}
              {mensagem && (
                <p className={mensagem.ok ? 'app-cel-msg app-cel-msg--ok' : 'app-cel-msg app-cel-msg--erro'}>
                  {mensagem.texto}
                </p>
              )}
              {aparelhos && aparelhos.length > 0 && (
                <ul className="app-cel-aparelhos">
                  {aparelhos.map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>Celular Android</strong>
                        <span>
                          {a.vistoEm
                            ? `${a.versao ? `App ${a.versao} · ` : ''}último sinal em ${dataHora(a.vistoEm)}`
                            : `Ativado em ${dataHora(a.criadoEm)} · aguardando o primeiro sinal`}
                        </span>
                        {versaoAtual && a.versao && a.versao !== versaoAtual && (
                          <span className="app-cel-atualizar">
                            Há uma versão mais nova ({versaoAtual}): baixe de novo e instale por cima.
                          </span>
                        )}
                      </div>
                      <button type="button" className="app-cel-btn app-cel-btn--leve" onClick={() => void desativar(a.id)}>
                        Desativar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

/** Janela com o download e o passo a passo, para a tela de entrada (antes de entrar na conta). */
export function AplicativoJanela({ onFechar }: { onFechar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onFechar])
  return (
    <div className="app-cel-janela" role="dialog" aria-modal="true" aria-label="Aplicativo para celular" onClick={onFechar}>
      <div className="app-cel-janela-caixa" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="app-cel-fechar" onClick={onFechar} aria-label="Fechar">
          ×
        </button>
        <AplicativoCelular publico />
      </div>
    </div>
  )
}

/**
 * Tela no lugar do sistema quando ele é aberto como "app instalado pelo navegador" (atalho do Chrome/Edge ou
 * "Adicionar à Tela de Início" do iPhone). Esse jeito de instalar foi desligado: no celular, só o app Android.
 */
export function AppDoNavegadorDesativado() {
  const [versao, setVersao] = useState<VersaoDoApp | null>(null)
  const android = ehAndroid()
  const iphone = ehIphone()
  useEffect(() => {
    void lerVersaoDoApp().then(setVersao)
  }, [])
  return (
    <div className="app-cel-bloqueio">
      <div className="app-cel-bloqueio-caixa">
        <img src="/icon-192.png" alt="" width={72} height={72} className="app-cel-bloqueio-icone" />
        <h1>Este atalho do fazumfreela foi desativado</h1>
        <p>
          O fazumfreela instalado pelo navegador não funciona mais. No celular, agora o fazumfreela é o{' '}
          <strong>aplicativo para Android</strong>.
        </p>
        {android ? (
          <>
            <a className="app-cel-btn app-cel-btn--principal app-cel-bloqueio-baixar" href={APK_URL} download="fazumfreela.apk">
              Baixar o app para Android
              {versao && <small>versão {versao.versao}</small>}
            </a>
            <ol>
              <li>Abra o arquivo baixado e instale (se o celular perguntar, permita instalar desta fonte).</li>
              <li>Entre no app novo com o seu usuário e a sua senha de sempre.</li>
              <li>
                Apague este ícone antigo: segure o ícone e toque em <strong>Desinstalar</strong> ou{' '}
                <strong>Remover</strong>.
              </li>
            </ol>
          </>
        ) : iphone ? (
          <p>
            No iPhone, abra <strong>fazumfreela.com.br</strong> no Safari. Este ícone pode ser apagado: segure o ícone
            e toque em <strong>Remover App</strong>.
          </p>
        ) : (
          <p>
            No computador, use o fazumfreela pelo navegador, em <strong>fazumfreela.com.br</strong>. Este atalho pode
            ser desinstalado.
          </p>
        )}
      </div>
    </div>
  )
}
