# Plano de Backup, Recuperação e Contingência — NEEX

Este documento descreve a política de salvaguarda de dados, os procedimentos de restauração, os checklists de deploy e os planos de contingência do banco de dados PostgreSQL hospedado no Supabase para a plataforma NEEX.

---

## 📅 1. Políticas de Backup

### 1.1 Backup Automatizado (Supabase Daily Backups)
* **Frequência:** Diária (executada automaticamente pelo Supabase na AWS).
* **Retenção:** 7 dias (plano gratuito/pro básico) ou até 30 dias (de acordo com addons contratados).
* **Escopo:** Todo o banco de dados PostgreSQL (esquema, tabelas, dados, triggers e índices).
* **Monitoramento:** Validar semanalmente no console do Supabase se os backups diários foram concluídos com sucesso.

### 1.2 Point-in-Time Recovery (PITR)
* **Status:** Disponível a partir do plano **Pro** com o addon correspondente ativado.
* **Granularidade:** Permite restaurar o estado exato do banco de dados até o segundo (precisão física) para qualquer momento nos últimos 7 dias.
* **Uso Recomendado:** Em caso de incidentes graves de integridade lógica (ex: exclusão acidental de registros em massa por erro de aplicação ou intervenção humana direta).

### 1.3 Backup Manual Preventivo (Antes de Deploy/Migrations)
* **Regra de Ouro:** É **obrigatório** gerar um backup lógico físico (schema + dados) antes de rodar qualquer comando que altere a estrutura do banco (ex: `npx prisma migrate dev`, SQL script direto no console) ou antes de deploys de grande porte.
* **Como Gerar:** Utilizar o script automatizado [backup-db.ps1](file:///C:/Users/Felipe/Documents/GOOGLE%20DRIVES/FELYPE/CRManager/scripts/backup-db.ps1) fornecido no repositório.

---

## 🛠️ 2. Procedimentos Operacionais

### 2.1 Como Gerar Backup Manual
Para gerar um backup local completo e criptografado de forma rápida e segura:
1. Abra um terminal do PowerShell na raiz do projeto.
2. Certifique-se de que a variável de ambiente `DATABASE_URL` está configurada no seu terminal ou no arquivo `.env`.
3. Execute o script:
   ```powershell
   powershell -File scripts/backup-db.ps1
   ```
4. O backup será salvo no diretório `/backups/` com a nomenclatura `neex_backup_YYYYMMDD_HHMMSS.sql`.

### 2.2 Como Restaurar um Backup
> [!CAUTION]
> **NUNCA execute um restore diretamente em produção sem validação prévia!**
> Todo arquivo de backup deve ser restaurado e validado primeiro em ambiente local ou staging/homologação.

#### Passos para Restauração (Local ou Staging):
1. Crie uma base de dados vazia para o teste de restauração.
2. Defina a string de conexão para este banco de testes.
3. Se o arquivo estiver em formato `.sql` (plain text), execute via ferramenta `psql`:
   ```bash
   psql -d "postgresql://[user]:[password]@[host]:[port]/[database]" -f backups/neex_backup_YYYYMMDD_HHMMSS.sql
   ```
4. Se o backup foi gerado no formato `.dump` (custom binário), execute via `pg_restore`:
   ```bash
   pg_restore -d "postgresql://[user]:[password]@[host]:[port]/[database]" --no-owner --clean backups/neex_backup_YYYYMMDD_HHMMSS.dump
   ```

### 2.3 Como Validar o Backup Restaurado
Após a restauração terminar sem erros:
1. Altere a variável `DATABASE_URL` do seu ambiente de teste para apontar para a base recém-restaurada.
2. Execute o comando do Prisma para validar o esquema:
   ```bash
   npx prisma db pull
   ```
3. Execute o script de testes financeiros do projeto para garantir a consistência das tabelas:
   ```bash
   npx tsx scripts/test-pdv-flow.ts
   ```
4. Faça uma consulta simples de integridade de registros:
   ```bash
   npx tsx -e "import { prisma } from './src/lib/prisma'; prisma.company.count().then(console.log)"
   ```

---

## 🚀 3. Checklist de Deploy e Prevenção

Antes de cada deploy ou aplicação de migrations no banco de dados de produção:
1. `[ ]` Confirmar se a suíte de testes local e o build compilaram sem erros (`npm run build`).
2. `[ ]` Checar o status das migrations locais e de produção: `npx prisma migrate status`.
3. `[ ]` Rodar `powershell -File scripts/backup-db.ps1` para gerar um snapshot físico antes de subir alterações.
4. `[ ]` Validar a migration localmente ou em base de staging aplicando os comandos SQL da pasta `prisma/migrations`.
5. `[ ]` Aplicar as migrations na produção utilizando `npx prisma migrate deploy` (nunca use `migrate dev` em produção).
6. `[ ]` Monitorar a telemetria e logs estruturados de erros nas Server Actions críticas pós-deploy.

---

## 🚨 4. Checklist em Caso de Desastre (Disaster Recovery)

Se o banco de dados de produção apresentar corrupção, indisponibilidade ou perda acidental de integridade:
1. **Identificação e Contenção:**
   * Derrubar ou colocar as instâncias do Next.js (Vercel) em modo de manutenção imediatamente para impedir novas escritas e agravamento do estado dos dados.
2. **Definição de Estratégia de Recuperação:**
   * **Se o erro foi lógico e recente (últimos 7 dias):** Usar a console do Supabase para fazer o Point-in-Time Recovery (PITR) até o minuto/segundo imediatamente anterior ao desastre.
   * **Se o banco sofreu falha física total:** Restaurar a partir do último backup diário automatizado do Supabase ou do snapshot preventivo mais recente.
3. **Execução da Recuperação em Staging:**
   * Restaurar o snapshot em uma base de homologação temporária.
   * Executar a validação completa descrita no item 2.3.
4. **Virada de Tráfego:**
   * Caso o restauro tenha sido feito em uma nova instância/banco no Supabase, atualizar as variáveis `DATABASE_URL` e `DIRECT_URL` nas configurações do projeto na Vercel (Production Environment Variables) apontando para o novo banco de dados seguro.
   * Fazer o redeploy da Vercel para propagar a nova string de conexão.
5. **Reabertura Operacional:**
   * Retirar a aplicação do modo de manutenção.
   * Validar o checkout do PDV e a listagem de carteiras localmente antes de liberar o acesso geral.

---

## ⏱️ 5. Métricas de Resiliência (SLA)

* **RTO (Recovery Time Objective):** Tempo máximo estimado para colocar o sistema de volta ao ar após um desastre.
  * **Meta:** ~15 minutos (tempo de restore lógico via console Supabase ou pg_restore + atualização de env na Vercel).
* **RPO (Recovery Point Objective):** Perda máxima tolerável de dados transacionais.
  * **Sem PITR (Plano Free):** Máximo de 24 horas (limite da execução do backup diário automático).
  * **Com PITR (Plano Pro+):** Máximo de 5 minutos (perda insignificante de logs transacionais ativos).

---

## 👥 6. Contatos Operacionais e Responsáveis

* **DBA / Engenheiro de Confiabilidade (SRE):** Felipe (felipe@...)
* **Suporte Técnico Supabase:** Painel oficial do Supabase (SLA Pro: < 2 horas).
* **Suporte Vercel:** Console de status da Vercel.
