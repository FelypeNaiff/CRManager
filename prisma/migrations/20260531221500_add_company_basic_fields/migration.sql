-- AlterTable
ALTER TABLE "companies" ADD COLUMN "whatsapp" TEXT,
ADD COLUMN "site" TEXT,
ADD COLUMN "inscricao_estadual" TEXT,
ADD COLUMN "inscricao_municipal" TEXT,
ADD COLUMN "regime_tributario" TEXT,
ADD COLUMN "crt" TEXT,
ADD COLUMN "cnae" TEXT,
ADD COLUMN "cep" TEXT,
ADD COLUMN "logradouro" TEXT,
ADD COLUMN "numero" TEXT,
ADD COLUMN "complemento" TEXT,
ADD COLUMN "bairro" TEXT,
ADD COLUMN "cidade" TEXT,
ADD COLUMN "uf" TEXT,
ADD COLUMN "nome_exibido" TEXT,
ADD COLUMN "observacoes" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ativo';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
