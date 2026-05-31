import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase/config';
import { prisma } from '../prisma';
import { Prisma, InventoryMovementType } from '@prisma/client';

export interface ProductsEtlReport {
  categories: { read: number; migrated: number; errors: number };
  suppliers: { read: number; migrated: number; errors: number };
  products: { read: number; migrated: number; errors: number };
  movements: { created: number; errors: number };
  logs: string[];
}

export async function runProductsEtl(targetCompanyId: string = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9'): Promise<ProductsEtlReport> {
  const report: ProductsEtlReport = {
    categories: { read: 0, migrated: 0, errors: 0 },
    suppliers: { read: 0, migrated: 0, errors: 0 },
    products: { read: 0, migrated: 0, errors: 0 },
    movements: { created: 0, errors: 0 },
    logs: [],
  };

  const addLog = (msg: string) => {
    console.log(`[ETL Products] ${msg}`);
    report.logs.push(`${new Date().toISOString().substring(11, 19)}: ${msg}`);
  };

  addLog('Starting Products & Inventory ETL Pipeline...');

  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app, 'crmanager');
    addLog('Firebase SDK connected to database: crmanager');

    const companyExists = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!companyExists) {
      throw new Error(`Target Company ID ${targetCompanyId} not found in database.`);
    }
    addLog(`Target company: ${companyExists.nomeFantasia}`);

    const categoryMap: Record<string, string> = {};
    const supplierMap: Record<string, string> = {};

    // ==========================================
    // 1. MIGRATE CATEGORIES
    // ==========================================
    addLog('Migrating product categories...');
    const catSnap = await getDocs(collection(db, 'gruposProdutos'));
    report.categories.read = catSnap.size;

    for (const catDoc of catSnap.docs) {
      const data = catDoc.data();
      const name = data.nome || data.name || catDoc.id;
      const description = data.descricao || null;

      try {
        const cat = await prisma.productCategory.upsert({
          where: {
            companyId_name: {
              companyId: targetCompanyId,
              name,
            },
          },
          update: {
            description,
            legacyFirebaseId: catDoc.id,
            isActive: true,
          },
          create: {
            companyId: targetCompanyId,
            name,
            description,
            legacyFirebaseId: catDoc.id,
          },
        });
        categoryMap[catDoc.id] = cat.id;
        report.categories.migrated++;
      } catch (err: any) {
        report.categories.errors++;
        addLog(`Error migrating category "${name}": ${err.message}`);
      }
    }
    addLog(`Categories migrated: ${report.categories.migrated}/${report.categories.read}`);

    // ==========================================
    // 2. MIGRATE SUPPLIERS
    // ==========================================
    addLog('Migrating suppliers...');
    const supSnap = await getDocs(collection(db, 'fornecedores'));
    report.suppliers.read = supSnap.size;

    for (const supDoc of supSnap.docs) {
      const data = supDoc.data();
      const name = data.nomeFornecedor || data.nomeFantasia || data.razaoSocial || data.nome || supDoc.id;
      const cnpjCpf = data.cnpjFornecedor || data.cnpjCpf || null;
      const email = data.emailFornecedor || data.email || null;
      const phone = data.telefoneFornecedor || data.phone || data.telefone || null;

      try {
        // Since there is no unique constraint on supplier, we find by legacyFirebaseId or companyId+name
        let supplier = await prisma.supplier.findFirst({
          where: {
            companyId: targetCompanyId,
            OR: [
              { legacyFirebaseId: supDoc.id },
              { name },
            ],
          },
        });

        if (supplier) {
          supplier = await prisma.supplier.update({
            where: { id: supplier.id },
            data: {
              cnpjCpf,
              email,
              phone,
              legacyFirebaseId: supDoc.id,
              isActive: true,
            },
          });
        } else {
          supplier = await prisma.supplier.create({
            data: {
              companyId: targetCompanyId,
              name,
              cnpjCpf,
              email,
              phone,
              legacyFirebaseId: supDoc.id,
            },
          });
        }

        supplierMap[supDoc.id] = supplier.id;
        report.suppliers.migrated++;
      } catch (err: any) {
        report.suppliers.errors++;
        addLog(`Error migrating supplier "${name}": ${err.message}`);
      }
    }
    addLog(`Suppliers migrated: ${report.suppliers.migrated}/${report.suppliers.read}`);

    // ==========================================
    // 3. MIGRATE PRODUCTS
    // ==========================================
    addLog('Migrating products...');
    const prodSnap = await getDocs(collection(db, 'produtos'));
    report.products.read = prodSnap.size;

    for (const prodDoc of prodSnap.docs) {
      const data = prodDoc.data();
      const name = data.nome || prodDoc.id;
      const internalCode = data.codigoInterno || `COD-${prodDoc.id.substring(0, 8)}`;
      const barcode = data.codigoBarras || null;
      const salePrice = Number(data.valorVenda || 0);
      const costPrice = Number(data.valorCusto || 0);
      const currentStock = Number(data.estoqueAtual || 0);
      
      const categoryId = data.grupo ? (categoryMap[data.grupo] || null) : null;
      const supplierId = data.fornecedorId ? (supplierMap[data.fornecedorId] || null) : null;

      const imageUrl = data.imageUrl || null;
      const thumbnailUrl = data.thumbnailUrl || null;
      const galleryUrls = data.galleryUrls || [];

      try {
        await prisma.$transaction(async (tx) => {
          // Check if product exists by companyId + internalCode or legacyFirebaseId
          let product = await tx.product.findFirst({
            where: {
              companyId: targetCompanyId,
              OR: [
                { legacyFirebaseId: prodDoc.id },
                { internalCode },
              ],
            },
          });

          if (product) {
            product = await tx.product.update({
              where: { id: product.id },
              data: {
                categoryId,
                supplierId,
                name,
                internalCode,
                imageUrl,
                thumbnailUrl,
                galleryUrls,
                legacyFirebaseId: prodDoc.id,
                isActive: true,
              },
            });
          } else {
            product = await tx.product.create({
              data: {
                companyId: targetCompanyId,
                categoryId,
                supplierId,
                name,
                internalCode,
                imageUrl,
                thumbnailUrl,
                galleryUrls,
                legacyFirebaseId: prodDoc.id,
              },
            });
          }

          // Upsert the single default variant "Único"
          const skuVal = `SKU-${internalCode}`;
          let variant = await tx.productVariant.findFirst({
            where: { productId: product.id, name: 'Único' },
          });

          const isNewVariant = !variant;

          if (variant) {
            variant = await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                sku: skuVal,
                barcode,
                costPrice: new Prisma.Decimal(costPrice),
                salePrice: new Prisma.Decimal(salePrice),
                legacyFirebaseId: prodDoc.id,
                isActive: true,
              },
            });
          } else {
            variant = await tx.productVariant.create({
              data: {
                productId: product.id,
                name: 'Único',
                sku: skuVal,
                barcode,
                costPrice: new Prisma.Decimal(costPrice),
                salePrice: new Prisma.Decimal(salePrice),
                currentStock: new Prisma.Decimal(currentStock),
                availableStock: new Prisma.Decimal(currentStock),
                legacyFirebaseId: prodDoc.id,
              },
            });
          }

          // If prices are set or modified, create price history
          await tx.productPriceHistory.create({
            data: {
              productId: product.id,
              oldCostPrice: new Prisma.Decimal(0),
              newCostPrice: new Prisma.Decimal(costPrice),
              oldSalePrice: new Prisma.Decimal(0),
              newSalePrice: new Prisma.Decimal(salePrice),
              changeReason: 'Migração ETL inicial',
            },
          });

          // If currentStock is positive and this is a new variant (or has no movements yet), create INITIAL movement
          if (currentStock > 0 && isNewVariant) {
            try {
              await tx.inventoryMovement.create({
                data: {
                  variantId: variant.id,
                  quantity: new Prisma.Decimal(currentStock),
                  type: 'INITIAL' as InventoryMovementType,
                  reason: 'Saldo migrado via ETL',
                  warehouseId: 'LOJA_PRINCIPAL',
                  legacyFirebaseId: prodDoc.id,
                },
              });
              report.movements.created++;
            } catch (movErr) {
              report.movements.errors++;
              console.error('Failed to create initial stock movement:', movErr);
            }
          }
        });

        report.products.migrated++;
      } catch (err: any) {
        report.products.errors++;
        addLog(`Error migrating product "${name}": ${err.message}`);
      }
    }
    addLog(`Products migrated: ${report.products.migrated}/${report.products.read}`);
    addLog('ETL Pipeline completed successfully.');
  } catch (error: any) {
    addLog(`ETL failed: ${error.message}`);
    throw error;
  }

  return report;
}
