const fs = require('fs');

const path = 'src/app/(dashboard)/crm/clientes/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// The file might have corrupt strings like: "Respons├íveis" or "Ôêò" or ""
// We will replace using regex to catch the variations
content = content.replace(/Respons├íveis|Responsveis|Responsáveis/g, 'Responsáveis');
content = content.replace(/respons├ível|responsvel|responsável/g, 'responsável');
content = content.replace(/v├¡nculo|vnculo|vínculo/g, 'vínculo');
content = content.replace(/Observa├º├Áes|Observaes|Observações/g, 'Observações');
content = content.replace(/Hist├│rico|Histrico|Histórico/g, 'Histórico');
content = content.replace(/restri├º├Áes|restries|restrições/g, 'restrições');
content = content.replace(/altera├º├Áes|alteraes|alterações/g, 'alterações');
content = content.replace(/Cal├ºado|Calado|Calçado/g, 'Calçado');
content = content.replace(/R├ípido|Rpido|Rápido/g, 'Rápido');
content = content.replace(/obrigat├│ria|obrigatria|obrigatória/g, 'obrigatória');
content = content.replace(/obrigat├│rio|obrigatrio|obrigatório/g, 'obrigatório');
content = content.replace(/crian├ºa|criana|criança/g, 'criança');
content = content.replace(/m├¬s|ms|mês/g, 'mês');
content = content.replace(/Cr├®dito|Crdito|Crédito/g, 'Crédito');

// Text exact fixes requested:
content = content.replace(/Clientes & Responsáveis/g, 'Clientes e Responsáveis');
content = content.replace(/Controle completo de compradores, vínculo de filhos, tags e extrato de saldo./g, 'Controle completo de clientes, responsáveis, filhos, tags e extrato de saldo.');
content = content.replace(/Ocorreu um erro ao gravar as alterações./g, 'Não foi possível salvar o cadastro. Verifique os campos obrigatórios e tente novamente.');
content = content.replace(/Erro na base/g, 'Aviso no Carregamento');
content = content.replace(/Falha ao carregar dados do Supabase./g, 'Não foi possível carregar a lista completa de clientes. O sistema está exibindo os dados já recebidos.');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed encoding in page.tsx');
