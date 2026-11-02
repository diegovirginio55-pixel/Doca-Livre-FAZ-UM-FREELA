import { LOGO_DOCA_LIVRE_SRC, BRAND_SLOGAN } from '../../lib/brandAssets'
import './PortalSelectScreen.css'

type Props = {
  onEmpresa: () => void
  onProfissional: () => void
  onAdmin: () => void
}

export function PortalSelectScreen({ onEmpresa, onProfissional, onAdmin }: Props) {
  return (
    <div className="portal-select">
      <div className="portal-select__inner">
        <img src={LOGO_DOCA_LIVRE_SRC} alt="fazumfreela" className="portal-select__logo" />
        <h1 className="portal-select__brand">Mão de Obra</h1>
        <p className="portal-select__slogan">{BRAND_SLOGAN}</p>

        <div className="portal-select__grid">
          <button type="button" className="portal-select__card" onClick={onEmpresa}>
            <span className="portal-select__card-kicker">Contratante</span>
            <strong className="portal-select__card-title">Empresa</strong>
            <span className="portal-select__card-desc">
              Publique demandas, gerencie prestadores, contratos e financeiro.
            </span>
          </button>
          <button type="button" className="portal-select__card" onClick={onProfissional}>
            <span className="portal-select__card-kicker">Mão de obra</span>
            <strong className="portal-select__card-title">Profissional</strong>
            <span className="portal-select__card-desc">
              Encontre oportunidades, agenda, documentos e pagamentos.
            </span>
          </button>
        </div>

        <button type="button" className="portal-select__admin" onClick={onAdmin}>
          Acesso Admin / Superusuário
        </button>
      </div>
    </div>
  )
}
