# Relatório de Modelagem Arquitetural Avançada: FASE 4 (Produtos e Estoque)

Este relatório descreve as melhorias arquiteturais aplicadas ao design do banco de dados relacional e serviços da **FASE 4** da migração do CRM TRUPE/NEEX. As mudanças preparam o sistema para suportar nativamente o futuro PDV, múltiplos estoques, omnichannel, auditoria estrita e sincronização de performance.

---

## 1. Melhorias Aplicadas

1. **Estoque Consolidado na Variante (`ProductVariant`)**:
   - Transição do cálculo on-the-fly (somatório de ledger) para **campos de estoque consolidados** na variante: `currentStock` (atual), `reservedStock` (reservado), `minimumStock` (mínimo) e `availableStock` (disponível, calculado via gatilho de transação como `currentStock - reservedStock`).
   - A tabela `InventoryMovement` passa a ser um ledger de auditoria física e transações históricas.

2. **Tipagem por Enum (`InventoryMovementType`)**:
   - Criação de um enum forte contendo os fluxos operacionais mapeados do sistema (`INITIAL`, `PURCHASE`, `SALE`, `RETURN`, `EXCHANGE`, `LOSS`, `DAMAGE`, `MANUAL_ADJUSTMENT`, `TRANSFER`, `RESERVATION`, `CANCELLATION`), extinguindo strings livres.

3. **Soft Delete Padronizado**:
   - Inclusão dos campos `isActive` (`Boolean`) e `archivedAt` (`DateTime?`) nas tabelas `Product`, `ProductVariant`, `Supplier` e `ProductCategory`. Impede perda física de dados históricos (ex: BI e vendas passadas).

4. **Autonomia Financeira e de Estoque por Variante**:
   - Os campos `costPrice` (preço de custo), `salePrice` (preço de venda) e `sku` tornam-se **obrigatórios e individuais por `ProductVariant`**. Cada variação de cor/tamanho possui seu próprio custo, preço e estoque.

5. **Suporte a Código de Barras (PDV-Ready)**:
   - Adicionados `barcode` (código de barras) e `barcodeType` (tipo, e.g., EAN13, UPC) na `ProductVariant` para busca instantânea por leitor de código de barras no PDV.

6. **Índices de Performance**:
   - Definição de índices secundários nas tabelas PostgreSQL para campos muito buscados: `product.name`, `product.internalCode`, `variant.sku`, `variant.barcode` e `supplier.name`.

7. **Histórico de Preços Expandido (`ProductPriceHistory`)**:
   - Registro automático e estrito de variação de preços (`oldCostPrice`, `newCostPrice`, `oldSalePrice`, `newSalePrice`, `changedByUserId`, `changeReason`, `changedAt`).

8. **Suporte a Imagens e Galerias**:
   - Campos `imageUrl`, `thumbnailUrl` e `galleryUrls` adicionados ao `Product` para alimentar catálogos digitais, IA generativa de mockups e integrações de e-commerce.

9. **Prontidão para Multi-Estoque (Warehouse/Location)**:
   - Adicionada a coluna `warehouseId` (ou `locationId`) em `InventoryMovement` (padrão `'LOJA_PRINCIPAL'`), permitindo futuras divisões físicas ou virtuais do estoque.

10. **Controle Fino de Estoque Negativo**:
    - Substituição do antigo boolean simples por dois controles segregados na empresa: `allowNegativeStockOnPDV` (bloqueio para operadores de caixa) e `allowNegativeStockOnManualAdjustment` (permissão para administradores realizarem ajustes manuais).

11. **Auditoria Transacional Estrita**:
    - Integração de logs detalhados na tabela `ActivityLog` que registram valores anteriores e posteriores de todas as alterações críticas.

---

## 2. Mudanças Planejadas no Schema Prisma

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

// Atualização no modelo Company existente
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

## 3. Análise de Impacto

### A. Impacto no ETL
- O script de ETL agora deve realizar a criação de uma `ProductVariant` padrão obrigatória com `costPrice` e `salePrice` correspondentes para cada produto legado.
- Deve povoar o estoque inicial (`currentStock` e `availableStock`) na variante de acordo com a leitura de estoque atual ou reconstrução de movimentações históricas, garantindo que os consolidados batam exatamente com a soma dos históricos.

### B. Impacto Futuro no PDV (Vendas rápidas)
- **Latência zero**: O PDV lerá `availableStock` e `salePrice` diretamente da variante pelo `sku` ou `barcode` com uso de índice PostgreSQL, sem necessidade de calcular sumatórios de ledger ou tabelas de produtos em runtime.
- **Reserva automática**: O fluxo de vendas a prazo ou reservas apenas incrementará o `reservedStock`, reduzindo dinamicamente o `availableStock` de forma segura.

### C. Impacto em Performance
- **Leitura instantânea**: Consultas por código de barras ou SKU no PDV rodarão em sub-milissegundos devido aos índices em B-Tree (`variant.sku` e `variant.barcode`).
- **Segurança Transacional**: Atualizações de saldo consolidado serão feitas via Prisma `$transaction` e triggers a nível de aplicação, evitando race conditions durante compras concorrentes.

### D. Impacto em Relatórios e BI
- Relatórios de estoque baixo (crítico) ou avaliação de inventário (Custo Total e Preço Total) tornam-se queries lineares e simples na tabela `ProductVariant`, sem necessitar de agregações complexas.
- O histórico de preços permite o cálculo de margem de lucro retroativa precisa no BI com base na data da venda.

### E. Impacto em Escalabilidade
- Suporte a múltiplos depósitos/lojas físicas está nativamente estruturado via `warehouseId` nas movimentações.
- O Soft Delete preserva integridade referencial nas vendas históricas mesmo após inativação de produtos no catálogo.
