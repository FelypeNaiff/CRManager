const fs = require('fs');

const path = 'src/components/layout/app-sidebar.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCRM = `    items: [
      { title: "Dashboard", url: "/crm/dashboard", icon: LayoutDashboard },
      { title: "Clientes", url: "/crm/clientes", icon: Users },
      { title: "Filhos", url: "/crm/filhos", icon: Baby },
      { title: "Aniversariantes", url: "/crm/clientes?tab=aniversariantes", icon: Gift },
      { title: "Campanhas WhatsApp", url: "/crm/campanhas", icon: MessageSquare },
      { title: "Carteira / Saldos", url: "/crm/carteira", icon: Wallet },
      { title: "Trocas e Devoluções", url: "/crm/trocas", icon: Repeat },
      { title: "Clientes com Saldo", url: "/crm/carteira?filter=com-saldo", icon: Wallet },
      { title: "Configurações", url: "/crm/configuracoes", icon: Settings },
      {
        title: "Info Auxiliar",
        icon: FileText,
        items: [
          { title: "Histórico", url: "/crm/historico" },
          { title: "Carteira / Saldos", url: "/crm/carteira" },
          { title: "Clientes Inativos", url: "/crm/clientes?status=inativo" },
          { title: "Tags", url: "/crm/tags" },
          { title: "Segmentações", url: "/crm/segmentacoes" }
        ]
      }
    ],`;

const newCRM = `    items: [
      { title: "Clientes", url: "/crm/clientes", icon: Users },
      { title: "Filhos", url: "/crm/filhos", icon: Baby },
      { title: "Aniversariantes", url: "/crm/aniversariantes", icon: Gift },
      { title: "Campanhas WhatsApp", url: "/crm/campanhas-whatsapp", icon: MessageSquare },
      { title: "Carteira / Saldo", url: "/crm/carteira", icon: Wallet },
      {
        title: "Opções Auxiliares",
        icon: Settings,
        items: [
          { title: "Segmentações", url: "/crm/opcoes/segmentacoes" },
          { title: "Tags", url: "/crm/opcoes/tags" },
          { title: "Histórico", url: "/crm/opcoes/historico" }
        ]
      }
    ],`;

// Try CRLF
let replaced = content.replace(oldCRM.replace(/\n/g, '\r\n'), newCRM);
// Try LF
if (replaced === content) {
  replaced = content.replace(oldCRM, newCRM);
}

fs.writeFileSync(path, replaced);
console.log(replaced === content ? "Failed to replace" : "Replaced successfully");
