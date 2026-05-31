# Plano de Implementação: FASE 4 - Produtos e Estoque (Arquitetura Avançada)

Este plano descreve o design e as etapas de migração para os módulos de Produtos, Categorias/Grupos, Fornecedores e Estoque da base do Firebase/Firestore para o Supabase PostgreSQL + Prisma. As definições foram aprimoradas para garantir suporte nativo a variações futuras, múltiplas localizações de estoque, auditoria transacional estrita e consultas de baixa latência voltadas ao PDV.

---

## User Review Required

> [!IMPORTANT]
> **Adições ao Schema do Prisma**:
> - Adição das colunas de configuração granular de estoque negativo na tabela `Company`: `allowNegativeStockOnPDV` (padrão `false`) e `allowNegativeStockOnManualAdjustment` (padrão `true`).
> - Inclusão das colunas de estoque consolidado na `ProductVariant`: `currentStock`, `reservedStock`, `minimumStock` e `availableStock`.
> - Definição do enum de banco de dados `InventoryMovementType` para tipagem estrita de lançamentos.
> - Definição dos campos de soft delete (`isActive`, `archivedAt`) para tabelas principais.

---

## Open Questions

> [!NOTE]
> Não há pendências em aberto. A modelagem está pronta para ser executada assim que aprovada.

---

## Proposed Changes

As alterações propostas estão detalhadas a seguir:

### 1. Banco de Dados & Schema (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Users/Felipe/Documents/GOOGLE%20DRIVES/FELYPE/CRManager/prisma/schema.prisma)
Implementação dos novos modelos, índices e relações no schema:

```prisma
enum InventoryMovementType {
  INITIAL
  PURCHASE
  SALE
  RETURN
  EXCHANGE
  LOSS
  DAMAGE
  MANUAL_ADJUSTMENT
  TRANSFER
  RESERVATION
  CANCELLATION
}

// Atualização no Company existente
model Company {
  // ... campos existentes
  allowNegativeStockOnPDV              Boolean   @default(false) @map("allow_negative_stock_on_pdv")
  allowNegativeStockOnManualAdjustment Boolean   @default(true) @map("allow_negative_stock_on_manual_adjustment")
}

model ProductCategory {
  id                 String           @id @default(uuid())
  companyId          String           @map("company_id")
  name               String
  description        String?          @db.Text
  isActive           Boolean          @default(true) @map("is_active")
  archivedAt         DateTime?        @map("archived_at")
  legacyFirebaseId   String?          @map("legacy_firebase_id")
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")

  company            Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  products           Product[]

  @@unique([companyId, name])
  @@index([name])
  @@map("product_categories")
}

model Supplier {
  id                 String           @id @default(uuid())
  companyId          String           @map("company_id")
  name               String
  cnpjCpf            String?          @map("cnpj_cpf")
  email              String?
  phone              String?
  isActive           Boolean          @default(true) @map("is_active")
  archivedAt         DateTime?        @map("archived_at")
  legacyFirebaseId   String?          @map("legacy_firebase_id")
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")

  company            Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  products           Product[]

  @@index([name])
  @@map("suppliers")
}

model Product {
  id                 String           @id @default(uuid())
  companyId          String           @map("company_id")
  categoryId         String?          @map("category_id")
  supplierId         String?          @map("supplier_id")
  name               String
  internalCode       String           @map("internal_code")
  description        String?          @db.Text
  imageUrl           String?          @map("image_url")
  thumbnailUrl       String?          @map("thumbnail_url")
  galleryUrls        String[]         @map("gallery_urls")
  isActive           Boolean          @default(true) @map("is_active")
  archivedAt         DateTime?        @map("archived_at")
  legacyFirebaseId   String?          @map("legacy_firebase_id")
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")

  company            Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  category           ProductCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  supplier           Supplier?        @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  variants           ProductVariant[]
  priceHistories     ProductPriceHistory[]

  @@unique([companyId, internalCode])
  @@index([name])
  @@index([internalCode])
  @@map("products")
}

model ProductVariant {
  id                 String              @id @default(uuid())
  productId          String              @map("product_id")
  sku                String              @unique
  barcode            String?
  barcodeType        String?             @map("barcode_type")
  name               String              // Ex: "Único", "M", "Vermelho / P"
  costPrice          Decimal             @map("cost_price") @db.Decimal(10, 2)
  salePrice          Decimal             @map("sale_price") @db.Decimal(10, 2)
  
  // Estoque consolidado
  currentStock       Decimal             @default(0.00) @map("current_stock") @db.Decimal(10, 2)
  reservedStock      Decimal             @default(0.00) @map("reserved_stock") @db.Decimal(10, 2)
  minimumStock       Decimal             @default(0.00) @map("minimum_stock") @db.Decimal(10, 2)
  availableStock     Decimal             @default(0.00) @map("available_stock") @db.Decimal(10, 2)

  isActive           Boolean             @default(true) @map("is_active")
  archivedAt         DateTime?           @map("archived_at")
  legacyFirebaseId   String?             @map("legacy_firebase_id")
  createdAt          DateTime            @default(now()) @map("created_at")
  updatedAt          DateTime            @updatedAt @map("updated_at")

  product            Product             @relation(fields: [productId], references: [id], onDelete: Cascade)
  inventoryMovements InventoryMovement[]

  @@index([sku])
  @@index([barcode])
  @@map("product_variants")
}

model ProductPriceHistory {
  id                 String           @id @default(uuid())
  productId          String           @map("product_id")
  oldCostPrice       Decimal          @map("old_cost_price") @db.Decimal(10, 2)
  newCostPrice       Decimal          @map("new_cost_price") @db.Decimal(10, 2)
  oldSalePrice       Decimal          @map("old_sale_price") @db.Decimal(10, 2)
  newSalePrice       Decimal          @map("new_sale_price") @db.Decimal(10, 2)
  changedByUserId    String?          @map("changed_by_user_id")
  changeReason       String?          @map("change_reason") @db.Text
  changedAt          DateTime         @default(now()) @map("changed_at")

  product            Product          @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("product_price_histories")
}

model InventoryMovement {
  id                 String                @id @default(uuid())
  variantId          String                @map("variant_id")
  quantity           Decimal               @db.Decimal(10, 2)
  type               InventoryMovementType
  reason             String?               @db.Text
  warehouseId        String                @default("LOJA_PRINCIPAL") @map("warehouse_id")
  legacyFirebaseId   String?               @map("legacy_firebase_id")
  userId             String?               @map("user_id")
  createdAt          DateTime              @default(now()) @map("created_at")
  updatedAt          DateTime              @updatedAt @map("updated_at")

  variant            ProductVariant        @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@map("inventory_movements")
}
```

---

### 2. Services, Repositories & Server Actions

#### [NEW] [products-actions.ts](file:///c:/Users/Felipe/Documents/GOOGLE%20DRIVES/FELYPE/CRManager/src/lib/crm/products-actions.ts)
Ações de servidor executadas em escopo RBAC (`requirePermission('Estoque', ...)` ou `'Produtos'`) com logs de auditoria detalhados registrando `oldValues` e `newValues` em `ActivityLog`:
- **`getProductCategories()` / `createProductCategory()`**: Gerenciamento de categorias.
- **`getSuppliers()` / `createSupplier()`**: Gerenciamento de fornecedores.
- **`getProducts()` / `createProduct()` / `updateProduct()` / `deleteProduct()`**: CRUD de produtos com geração de variante padrão e histórico de preços.
- **`createInventoryMovement(variantId, quantity, type, reason, warehouseId)`**:
  - Executado dentro de uma **transação relacional (`prisma.$transaction`)**.
  - Valida as regras de estoque negativo com base nas configurações da empresa (`allowNegativeStockOnPDV` e `allowNegativeStockOnManualAdjustment`) e cargo do usuário.
  - Atualiza de forma atômica `currentStock` e `availableStock` (`currentStock - reservedStock`) na tabela `ProductVariant`.

#### [NEW] [products-schemas.ts](file:///c:/Users/Felipe/Documents/GOOGLE%20DRIVES/FELYPE/CRManager/src/lib/crm/products-schemas.ts)
Validações de tipos Zod para segurança do backend.

---

### 3. Pipeline de Migração (ETL)

#### [NEW] [products-etl.ts](file:///c:/Users/Felipe/Documents/GOOGLE%20DRIVES/FELYPE%20/CRManager/src/lib/crm/products-etl.ts)
- Sincroniza dados históricos mapeando as coleções de origem para seus destinos PostgreSQL:
  - `gruposProdutos` ➔ `ProductCategory`
  - `fornecedores` ➔ `Supplier`
  - `produtos` ➔ `Product` & `ProductVariant` (criando variante padrão com os preços legados)
  - `movimentacoes_estoque` ➔ `InventoryMovement` e recalcula os estoques consolidados finais da variante.

---

## Verification Plan

### Testes Automatizados
O script de testes [test-products-flow.ts](file:///c:/Users/Felipe/Documents/GOOGLE%20DRIVES/FELYPE/CRManager/scripts/test-products-flow.ts) validará os 12 casos descritos:
1. **Criar produto**: Criação de produto com variante padrão e preço de custo/venda.
2. **Editar produto**: Edição de dados e confirmação do gatilho automático em `ProductPriceHistory`.
3. **Inativar produto**: Arquivamento lógico (soft delete) ativando `isActive = false` e preenchendo `archivedAt`.
4. **Criar categoria**: Cadastro e vinculação.
5. **Criar fornecedor**: Cadastro e vinculação.
6. **Entrada de estoque**: Lançamento de movimentação `PURCHASE`, incrementando o estoque consolidado da variante.
7. **Saída de estoque**: Lançamento de movimentação `SALE`, decrementando o estoque consolidado.
8. **Bloqueio de estoque negativo**: Configuração da empresa para bloquear estoque negativo no PDV e simulação de venda excedente ao saldo, checando se a transação é revertida.
9. **Histórico de preço**: Verificação automática de alteração de preço gravando a data, usuário e motivo do ajuste.
10. **Auditoria/logs**: Confirmação de que todas as operações registraram logs ricos em `ActivityLog` detalhando valores antigos/novos.
11. **Permissões**: Validação de controle RBAC para ações de estoque.
12. **Consulta de estoque final**: Comparação direta entre o somatório de `InventoryMovement` e o saldo consolidado `availableStock` na variante.
