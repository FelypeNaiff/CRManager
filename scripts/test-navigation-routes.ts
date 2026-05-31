import fs from 'fs'
import path from 'path'

console.log('=== AUDITORIA DE ROTAS DO MENU DO SISTEMA ===\n')

const BASE_DIR = path.join(__dirname, '..')
const APP_DIR = path.join(BASE_DIR, 'src', 'app')

const routesToTest = [
  // Dashboard
  { route: '/dashboard', label: 'Dashboard' },
  // CRM
  { route: '/crm/dashboard', label: 'CRM Dashboard' },
  { route: '/crm/clientes', label: 'CRM Clientes' },
  { route: '/crm/filhos', label: 'CRM Filhos' },
  { route: '/crm/aniversariantes', label: 'CRM Aniversariantes' },
  { route: '/crm/campanhas', label: 'CRM Campanhas' },
  { route: '/crm/carteira', label: 'CRM Carteira' },
  { route: '/crm/trocas', label: 'CRM Trocas' },
  { route: '/crm/clientes-com-saldo', label: 'CRM Clientes com Saldo' },
  { route: '/crm/configuracoes', label: 'CRM Configurações' },
  // Comercial
  { route: '/comercial/vendas', label: 'Comercial Vendas' },
  { route: '/comercial/metas', label: 'Comercial Metas' },
  { route: '/comercial/comissoes', label: 'Comercial Comissões' },
  { route: '/comercial/trocas', label: 'Comercial Trocas' },
  { route: '/comercial/relatorios', label: 'Comercial Relatórios' },
  // PDV
  { route: '/pdv', label: 'PDV' },
  // Estoque
  { route: '/produtos', label: 'Produtos' },
  { route: '/movimentacoes', label: 'Movimentações' },
  { route: '/estoque', label: 'Estoque' },
  // Financeiro
  { route: '/financeiro', label: 'Financeiro Dashboard' },
  { route: '/financeiro/caixas', label: 'Financeiro Caixas' },
  { route: '/financeiro/contas-a-receber', label: 'Financeiro Contas a Receber' },
  { route: '/financeiro/contas-bancarias', label: 'Financeiro Contas Bancárias' },
  { route: '/financeiro/formas-pagamento', label: 'Financeiro Formas de Pagamento' },
  // Configurações
  { route: '/configuracoes', label: 'Configurações Dashboard' },
  { route: '/configuracoes/usuarios', label: 'Configurações Usuários' },
  { route: '/configuracoes/perfis', label: 'Configurações Perfis de Acesso' },
  { route: '/configuracoes/permissoes', label: 'Configurações Permissões' },
  // Legacy Redirects
  { route: '/clients', label: 'Legacy Clients' },
  { route: '/clientes', label: 'Legacy Clientes' },
  { route: '/children', label: 'Legacy Children' },
  { route: '/filhos', label: 'Legacy Filhos' },
  { route: '/birthdays', label: 'Legacy Birthdays' },
  { route: '/wallet', label: 'Legacy Wallet' },
  { route: '/returns', label: 'Legacy Returns' },
  { route: '/settings', label: 'Legacy Settings' },
  { route: '/sales', label: 'Legacy Sales' },
  { route: '/products', label: 'Legacy Products' },
  { route: '/usuarios', label: 'Legacy Usuários' },
]

interface AuditResult {
  route: string
  label: string
  status: string
  target: string | null
  ok: boolean
}

const auditResults: AuditResult[] = []

function resolveRoutePath(route: string): { filePath: string; relativePath: string } | null {
  // Try directly under src/app
  const directPath = path.join(APP_DIR, route, 'page.tsx')
  if (fs.existsSync(directPath)) {
    return { filePath: directPath, relativePath: path.relative(BASE_DIR, directPath) }
  }

  // Try under (dashboard) route group
  const dashboardPath = path.join(APP_DIR, '(dashboard)', route, 'page.tsx')
  if (fs.existsSync(dashboardPath)) {
    return { filePath: dashboardPath, relativePath: path.relative(BASE_DIR, dashboardPath) }
  }

  return null
}

function extractRedirect(filePath: string): string | null {
  const content = fs.readFileSync(filePath, 'utf-8')
  // Match standard redirect('...') or redirect("...") or router.replace("...")
  const redirectMatch = content.match(/redirect\(['"]([^'"]+)['"]\)/)
  if (redirectMatch) {
    return redirectMatch[1]
  }
  const routerMatch = content.match(/router\.replace\(['"]([^'"]+)['"]\)/)
  if (routerMatch) {
    return routerMatch[1]
  }
  return null
}

console.log('Verificando rotas...')

routesToTest.forEach(({ route, label }) => {
  const resolved = resolveRoutePath(route)
  if (!resolved) {
    auditResults.push({
      route,
      label,
      status: '404 - Arquivo não encontrado',
      target: null,
      ok: false,
    })
    return
  }

  const redirectTarget = extractRedirect(resolved.filePath)
  if (redirectTarget) {
    // Check if the redirect target exists
    // Remove query params for check
    const cleanTarget = redirectTarget.split('?')[0]
    const targetResolved = resolveRoutePath(cleanTarget)
    if (targetResolved) {
      // Check for circular redirect loops
      const secondRedirect = extractRedirect(targetResolved.filePath)
      if (secondRedirect && secondRedirect.split('?')[0] === route) {
        auditResults.push({
          route,
          label,
          status: `LOOP DE REDIRECIONAMENTO DETECTADO (-> ${redirectTarget} -> ${secondRedirect})`,
          target: redirectTarget,
          ok: false,
        })
      } else {
        auditResults.push({
          route,
          label,
          status: `Redirect (Server) -> ${redirectTarget}`,
          target: redirectTarget,
          ok: true,
        })
      }
    } else {
      auditResults.push({
        route,
        label,
        status: `Redirect quebrado -> ${redirectTarget} (404)`,
        target: redirectTarget,
        ok: false,
      })
    }
  } else {
    auditResults.push({
      route,
      label,
      status: '200 OK - Carrega Componente',
      target: null,
      ok: true,
    })
  }
})

console.log('\n=== RESULTADO DA AUDITORIA ===\n')
console.log(
  '| ' +
    'ROTA'.padEnd(35) +
    ' | ' +
    'MÓDULO / DESCRIÇÃO'.padEnd(30) +
    ' | ' +
    'STATUS'.padEnd(50) +
    ' | ' +
    'FUNCIONA?' +
    ' |'
)
console.log('|' + '-'.repeat(37) + '|' + '-'.repeat(32) + '|' + '-'.repeat(52) + '|' + '-'.repeat(11) + '|')

auditResults.forEach((res) => {
  const routeStr = res.route.padEnd(35)
  const labelStr = res.label.padEnd(30)
  const statusStr = res.status.padEnd(50)
  const worksStr = (res.ok ? 'SIM' : 'NÃO').padEnd(9)
  console.log(`| ${routeStr} | ${labelStr} | ${statusStr} | ${worksStr} |`)
})

const hasErrors = auditResults.some((r) => !r.ok)
console.log(`\nFase de Auditoria Finalizada. ${hasErrors ? 'ERROS DETECTADOS!' : 'TODAS AS ROTAS PASSARAM COM SUCESSO!'}`)
process.exit(hasErrors ? 1 : 0)
