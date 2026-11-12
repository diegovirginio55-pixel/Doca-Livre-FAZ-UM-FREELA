import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  MODULOS_POR_SISTEMA,
  SISTEMA_LABEL,
  getPermissoesUsuario,
  isLocalSuperUser,
  loadHierarquia,
  saveHierarquiaUsuario,
  savePermissoesUsuario,
  type ModuloAcesso,
  type NivelHierarquia,
  type SistemaId,
  type SistemaPermissao,
} from '../../lib/portalPermissoes'
import { useStore } from '../../lib/store'
import './PortalConfigScreen.css'

type Props = {
  onContinuar: () => void
  onSair: () => void
}

type UserRow = {
  userId: string
  usuario: string
  email: string
  role: string
  nivel: NivelHierarquia
  superior: string | null
}

type TreeNode = UserRow & { children: TreeNode[] }

const SISTEMAS: SistemaId[] = ['empresa', 'profissional', 'admin']
const NIVEIS: { id: NivelHierarquia; label: string }[] = [
  { id: 'super', label: 'Superusuário' },
  { id: 'gestor', label: 'Gestor' },
  { id: 'operador', label: 'Operador' },
]

function isHidden(usuario: string, email: string, role: string) {
  return role === 'super' || isLocalSuperUser(usuario) || isLocalSuperUser(email)
}

export function PortalConfigScreen({ onContinuar, onSair }: Props) {
  const store = useStore()
  // A hierarquia das empresas foi para o painel (menu "Hierarquia", no desenho do Oferta de Carga).
  // Aqui ficam as permissões de cada conta.
  const [tab, setTab] = useState<'hierarquia' | 'permissoes'>('permissoes')
  const [selected, setSelected] = useState('')
  const [filtro, setFiltro] = useState('')
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [nivelDraft, setNivelDraft] = useState<NivelHierarquia>('operador')
  const [superiorDraft, setSuperiorDraft] = useState('')
  const [permsDraft, setPermsDraft] = useState<Record<SistemaId, SistemaPermissao> | null>(null)

  const usuarios = useMemo((): UserRow[] => {
    void tick
    const hier = loadHierarquia()
    return store.state.users
      .filter((u) => !isHidden(u.usuario || '', u.email, u.role))
      .map((u) => {
        const usuario = u.usuario || u.email.split('@')[0]
        const h = hier.find((x) => x.usuario === usuario)
        return {
          userId: u.id,
          usuario,
          email: u.email,
          role: u.role,
          nivel: (h?.nivel || u.nivelHierarquia || 'operador') as NivelHierarquia,
          superior: h?.superior_usuario ?? u.superiorUsuario ?? null,
        }
      })
  }, [store.state.users, tick])

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter(
      (u) =>
        u.usuario.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.includes(q),
    )
  }, [usuarios, filtro])

  const current = filtrados.find((u) => u.usuario === selected) || filtrados[0] || null

  useEffect(() => {
    if (!current) return
    setSelected(current.usuario)
    setNivelDraft(current.nivel)
    setSuperiorDraft(current.superior || '')
    setPermsDraft(getPermissoesUsuario(current.usuario, current.email, current.role))
  }, [current?.usuario, tick])

  useEffect(() => {
    if (!okMsg) return
    const t = window.setTimeout(() => setOkMsg(null), 3500)
    return () => window.clearTimeout(t)
  }, [okMsg])

  async function excluirContaSelecionada() {
    if (!current) return
    if (
      !window.confirm(
        `Excluir a conta "${current.usuario}" (${current.email})? Perfil, documentos e acesso serão removidos. Esta ação não tem volta.`,
      )
    ) {
      return
    }
    const res = await store.excluirUsuario(current.userId)
    if (!res.ok) {
      window.alert(res.error || 'Não foi possível excluir.')
      return
    }
    setSelected('')
    setOkMsg('Conta excluída.')
    setTick((x) => x + 1)
  }

  function saveHier() {
    if (!current) return
    saveHierarquiaUsuario({
      usuario: current.usuario,
      nivel: nivelDraft,
      superior_usuario: superiorDraft.trim() || null,
    })
    store.patchState((s) => ({
      ...s,
      users: s.users.map((u) =>
        (u.usuario || u.email.split('@')[0]) === current.usuario
          ? {
              ...u,
              nivelHierarquia: nivelDraft,
              superiorUsuario: superiorDraft.trim() || null,
            }
          : u,
      ),
    }))
    setOkMsg('Hierarquia salva.')
    setTick((t) => t + 1)
  }

  function savePerms() {
    if (!current || !permsDraft) return
    savePermissoesUsuario(current.usuario, permsDraft)
    // Avisa a sincronização: a matriz vai para o banco e passa a valer em todos os aparelhos.
    store.patchState((s) => ({ ...s }))
    setOkMsg('Permissões salvas.')
    setTick((t) => t + 1)
  }

  function setSistemaAcesso(sis: SistemaId, pode: boolean) {
    if (!permsDraft) return
    setPermsDraft({
      ...permsDraft,
      [sis]: { ...permsDraft[sis], pode_acessar: pode },
    })
  }

  function setModulo(sis: SistemaId, modId: string, acesso: ModuloAcesso) {
    if (!permsDraft) return
    const base = permsDraft[sis]
    const mods = { ...(base.modulos || {}) }
    mods[modId] = acesso
    setPermsDraft({
      ...permsDraft,
      [sis]: { ...base, modulos: mods },
    })
  }

  const treeRoots = useMemo((): TreeNode[] => {
    const byUser = new Map<string, TreeNode>()
    for (const u of usuarios) {
      byUser.set(u.usuario, { ...u, children: [] })
    }
    const roots: TreeNode[] = []
    for (const u of usuarios) {
      const node = byUser.get(u.usuario)!
      if (u.superior && byUser.has(u.superior)) {
        byUser.get(u.superior)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }, [usuarios])

  function renderTree(nodes: TreeNode[], depth = 0): ReactNode {
    return nodes.map((n) => (
      <div key={n.usuario} className="pconfig-tree-node" style={{ paddingLeft: depth * 16 }}>
        <button
          type="button"
          className={`pconfig-tree-btn ${current?.usuario === n.usuario ? 'is-active' : ''}`}
          onClick={() => setSelected(n.usuario)}
        >
          <strong>{n.usuario}</strong>
          <span>
            {n.nivel} · {n.role}
          </span>
        </button>
        {n.children.length > 0 ? renderTree(n.children, depth + 1) : null}
      </div>
    ))
  }

  return (
    <div className="pconfig">
      <header className="pconfig-header">
        <div>
          <h1>Permissões</h1>
          <p>
            Controle de acesso dos portais Empresa, Profissional e Admin. Superusuários têm acesso
            total. A hierarquia das empresas fica no painel, no menu Hierarquia.
          </p>
        </div>
        <div className="pconfig-actions">
          <button type="button" className="pconfig-btn pconfig-btn--ghost" onClick={onSair}>
            Sair
          </button>
          <button type="button" className="pconfig-btn pconfig-btn--primary" onClick={onContinuar}>
            Continuar para o painel
          </button>
        </div>
      </header>

      <div className="pconfig-tabs">
        <button
          type="button"
          className={tab === 'permissoes' ? 'is-active' : ''}
          onClick={() => setTab('permissoes')}
        >
          Permissões
        </button>
      </div>

      {okMsg && <p className="pconfig-ok">{okMsg}</p>}

      <div className="pconfig-layout">
        <aside className="pconfig-list">
          <input
            className="pconfig-search"
            placeholder="Filtrar usuários…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          <div className="pconfig-users">
            {filtrados.map((u) => (
              <button
                key={u.usuario}
                type="button"
                className={`pconfig-user ${current?.usuario === u.usuario ? 'is-active' : ''}`}
                onClick={() => setSelected(u.usuario)}
              >
                <strong>{u.usuario}</strong>
                <span>
                  {u.nivel} · {u.role}
                </span>
                <span className="muted">{u.email}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="pconfig-main">
          {!current && <p>Nenhum usuário editável.</p>}

          {current && tab === 'hierarquia' && (
            <>
              <h2>{current.usuario}</h2>
              <label className="pconfig-label">Nível</label>
              <select
                className="pconfig-input"
                value={nivelDraft}
                onChange={(e) => setNivelDraft(e.target.value as NivelHierarquia)}
              >
                {NIVEIS.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
              <label className="pconfig-label">Superior</label>
              <select
                className="pconfig-input"
                value={superiorDraft}
                onChange={(e) => setSuperiorDraft(e.target.value)}
              >
                <option value="">— nenhum —</option>
                {usuarios
                  .filter((u) => u.usuario !== current.usuario)
                  .map((u) => (
                    <option key={u.usuario} value={u.usuario}>
                      {u.usuario}
                    </option>
                  ))}
              </select>
              <button type="button" className="pconfig-btn pconfig-btn--primary" onClick={saveHier}>
                Salvar hierarquia
              </button>
              {current.userId !== store.currentUser?.id && (
                <button
                  type="button"
                  className="pconfig-btn pconfig-btn--ghost"
                  onClick={() => void excluirContaSelecionada()}
                  style={{ marginLeft: 8, color: '#b91c1c' }}
                >
                  Excluir conta
                </button>
              )}

              <h3 className="pconfig-subtitle">Árvore</h3>
              <div className="pconfig-tree">{renderTree(treeRoots)}</div>
            </>
          )}

          {current && tab === 'permissoes' && permsDraft && (
            <>
              <h2>Permissões — {current.usuario}</h2>
              {SISTEMAS.map((sis) => (
                <div key={sis} className="pconfig-sis">
                  <div className="pconfig-sis-head">
                    <strong>{SISTEMA_LABEL[sis]}</strong>
                    <label className="pconfig-check">
                      <input
                        type="checkbox"
                        checked={permsDraft[sis]?.pode_acessar !== false}
                        onChange={(e) => setSistemaAcesso(sis, e.target.checked)}
                      />
                      Pode acessar
                    </label>
                  </div>
                  {permsDraft[sis]?.pode_acessar !== false && (
                    <div className="pconfig-mods">
                      {MODULOS_POR_SISTEMA[sis].map((m) => (
                        <label key={m.id} className="pconfig-mod">
                          <span>{m.label}</span>
                          <select
                            value={permsDraft[sis].modulos?.[m.id] || 'editar'}
                            onChange={(e) =>
                              setModulo(sis, m.id, e.target.value as ModuloAcesso)
                            }
                          >
                            <option value="editar">Editar</option>
                            <option value="visualizar">Visualizar</option>
                            <option value="oculto">Oculto</option>
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="pconfig-btn pconfig-btn--primary" onClick={savePerms}>
                Salvar permissões
              </button>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
