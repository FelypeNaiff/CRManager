const fs = require('fs');
const file = 'src/components/layout/app-sidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `  {
    title: "Financeiro",
    icon: DollarSign,
    items: [
      { title: "Dashboard", url: "/financeiro", icon: PieChart },
      { title: "Contas a Pagar", url: "/financeiro/contas-a-pagar", icon: Wallet },
      { title: "Contas a Receber", url: "/financeiro/contas-a-receber", icon: DollarSign },
      { title: "Calendário", url: "/financeiro/calendario", icon: CalendarDays },
      { title: "Fluxo de Caixa", url: "/financeiro/fluxo-caixa", icon: ArrowLeftRight },
      { title: "Caixas", url: "/financeiro/caixas", icon: Store },
      { title: "Contas Bancárias", url: "/financeiro/contas-bancarias", icon: Building2 },
      { title: "Transferências", url: "/financeiro/transferencias", icon: Repeat },
      { title: "Vales de Funcionários", url: "/financeiro/vales", icon: Users },
      { title: "Relatórios", url: "/financeiro/relatorios", icon: FileText },
      { title: "Opções Auxiliares", url: "/financeiro/opcoes-auxiliares", icon: Settings },
    ],
  },`;

const replacement = `  {
    title: "Financeiro",
    icon: DollarSign,
    items: [
      { title: "Contas a Pagar", url: "/financeiro/contas-a-pagar", icon: Wallet },
      { title: "Contas a Receber", url: "/financeiro/contas-a-receber", icon: DollarSign },
      { title: "DRE Gerencial", url: "/financeiro/dre", icon: PieChart },
      { title: "Calendário de Contas", url: "/financeiro/calendario", icon: CalendarDays },
      { title: "Caixas", url: "/financeiro/caixas", icon: Store },
      { title: "Vales de Funcionários", url: "/financeiro/vales", icon: Users },
      {
        title: "Opções Auxiliares",
        icon: Settings,
        items: [
          { title: "Formas de Pagamento", url: "/financeiro/opcoes/formas-pagamento" },
          { title: "Plano de Contas", url: "/financeiro/opcoes/plano-contas" },
          { title: "Transferência", url: "/financeiro/opcoes/transferencias" },
          { title: "Conciliação Bancária", url: "/financeiro/opcoes/conciliacao" },
        ],
      },
    ],
  },`;

const normalizedCode = code.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedCode.includes(normalizedTarget)) {
    code = normalizedCode.replace(normalizedTarget, replacement);
    fs.writeFileSync(file, code);
    console.log('Sidebar patched successfully!');
} else {
    console.log('Target block not found. First 100 chars of target:', normalizedTarget.substring(0, 100));
}
