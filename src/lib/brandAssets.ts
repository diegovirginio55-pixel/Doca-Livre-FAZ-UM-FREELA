// O "?v=" muda junto com a arte: o arquivo mantém o nome e, sem isso, o navegador podia seguir
// mostrando a logo antiga guardada em cache. Ao trocar a arte, troque a versão.
const VERSAO_LOGO = '2026-11-09'

/** Logo para fundo claro: contorno e "LIVRE" em azul-marinho (#043460), setas e "DOCA" em amarelo. */
export const LOGO_DOCA_LIVRE_SRC = `/logo-doca-livre.png?v=${VERSAO_LOGO}`
/** Logo para fundo escuro: contorno e "LIVRE" em branco. Use em qualquer superfície escura. */
export const LOGO_DOCA_LIVRE_ESCURO_SRC = `/logo-doca-livre-escuro.png?v=${VERSAO_LOGO}`
export const BRAND_COMPANY_NAME = 'DOCA LIVRE'
export const BRAND_PRODUCT_NAME = 'fazumfreela'
export const BRAND_SLOGAN = 'Conectando empresas aos melhores profissionais da operação.'
export const BRAND_FULL_TITLE = `${BRAND_COMPANY_NAME} ${BRAND_PRODUCT_NAME}`
