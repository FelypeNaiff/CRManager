const fs = require('fs');
const file = 'src/components/layout/app-sidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /\{\s*title: "Financeiro",\s*icon: DollarSign,\s*items: \[[\s\S]*?\]\s*\},/m;
const replacement = `{
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
          { title: "Transferências", url: "/financeiro/opcoes/transferencias" },
          { title: "Conciliação Bancária", url: "/financeiro/opcoes/conciliacao" },
        ],
      },
    ],
  },`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync(file, code);
    console.log('Patched sidebar successfully');
} else {
    console.log('Regex not found');
}
