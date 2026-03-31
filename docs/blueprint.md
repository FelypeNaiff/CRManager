# **App Name**: CRManager

## Core Features:

- Gerenciamento de Clientes (CRM): Visualize, adicione, edite e remova clientes com campos detalhados como nome, contato, endereço, e histórico de compras. Inclui auto-preenchimento de endereço via CEP.
- Gestão de Produtos e Estoque: CRUD completo de produtos com informações de preço, estoque atual, mínimo, e imagens. Indicadores visuais para níveis de estoque e categorias.
- Ponto de Venda (PDV): Interface de vendas de duas colunas para buscar produtos, adicionar ao carrinho, aplicar descontos e finalizar pagamentos. Gera recibo em PDF e atualiza o estoque e finanças automaticamente. Suporta múltiplas formas de pagamento e envia nota via WhatsApp.
- Visão Geral Financeira Simplificada: Exiba os principais KPIs de faturamento e despesas mensais, fornecendo um resumo rápido da saúde financeira do negócio. Crie contas a pagar e receber.
- Geração de Mensagens de Marketing com IA: Um tool para ajudar a criar conteúdo de marketing, como mensagens para campanhas de aniversário ou reativação, utilizando inteligência artificial para personalizar o texto e gerar ideias criativas com base no público e no objetivo.
- Autenticação e Gestão de Usuários: Sistema de login/cadastro seguro com gerenciamento de usuários e definição de papéis (admin/usuário) para controlar o acesso às funcionalidades do sistema.

## Style Guidelines:

- Esquema de cores predominante claro para áreas de conteúdo, contrastando com uma sidebar escura. O violeta transmite uma estética elegante e moderna para moda infantil, enquanto os tons de cinza claro mantêm o foco na legibilidade e organização.
- Cor primária: Um violeta vibrante e convidativo (#7C3AED) é utilizado para elementos interativos, destaques e para reforçar a identidade visual da marca. HSL(262, 77%, 58%).
- Cor de fundo do conteúdo principal: Um violeta extremamente claro e sutil (#F7F5FA) oferece uma base limpa e confortável para a visualização de dados. HSL(262, 15%, 95%).
- Cor de destaque: Um índigo profundo (#0F17AE) serve para CTAs críticos e como um ponto de contraste forte e sofisticado, sendo análogo à cor primária. HSL(232, 90%, 40%).
- Sidebar: Fundo em um cinza ardósia escuro (`#0F172A`) para a barra lateral, com texto em tons claros de `slate-300`/`slate-400` para boa legibilidade e distinção.
- Cores de feedback do sistema: `green-500` (#22C55E) para sucesso, `yellow-500` (#EAB308) para alertas, `red-500` (#EF4444) para erros e `blue-500` (#3B82F6) para informações gerais, garantindo feedback consistente ao usuário.
- Tipografia global: 'Inter' (sans-serif) será usada para todos os textos, desde títulos a corpo de texto, escolhida pela sua clareza, modernidade e excelente legibilidade em grandes volumes de dados e em diferentes tamanhos de tela.
- Ícones: Ícones intuitivos e reconhecíveis (como os de Lucide ou Feather Icons) para navegação, KPIs do dashboard e ações, com badges coloridos para indicar status, prioridades e estados (ex: verde para ativo, vermelho para vencido).
- Disposição da interface: Uma sidebar fixa no lado esquerdo em desktops que se transforma em uma gaveta deslizante em dispositivos móveis. Layouts de duas colunas (ex: no PDV) e estruturas em grid/cards responsivas serão usadas para uma visualização clara e organizada das informações.
- Animações e transições: Animações suaves em modais, expansões de menus e carregamento de dados. Um efeito de 'confete' (`canvas-confetti`) será exibido após a finalização bem-sucedida de uma venda no PDV para criar uma experiência gratificante.