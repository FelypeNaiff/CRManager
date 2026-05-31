-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "agencia_principal" TEXT,
ADD COLUMN     "banco_principal" TEXT,
ADD COLUMN     "conta_principal" TEXT,
ADD COLUMN     "natureza_despesa_padrao" TEXT,
ADD COLUMN     "natureza_receita_padrao" TEXT,
ADD COLUMN     "observacoes_fiscais" TEXT,
ADD COLUMN     "pix_chave" TEXT,
ADD COLUMN     "pix_tipo" TEXT,
ADD COLUMN     "regime_apuracao" TEXT;
