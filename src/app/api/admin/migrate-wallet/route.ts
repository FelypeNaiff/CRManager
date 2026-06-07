import { NextResponse } from 'next/server';
import { MigrationService } from '@/lib/wallet/migration-service';
import { requireAdmin } from '@/lib/auth/permissions';

/**
 * POST /api/admin/migrate-wallet
 * 
 * Executes FASE 2 of the wallet migration:
 * - Migrates ExchangeReturn records → SaleExchange + SaleReturn
 * - Migrates CustomerWalletMovement records → WalletTransaction (ledger with balanceBefore/balanceAfter)
 *
 * This route is admin-only and idempotent (safe to run multiple times).
 */
export async function POST() {
  try {
    // Enforce admin access
    await requireAdmin();

    const result = await MigrationService.migrateHistoricalData();

    return NextResponse.json({
      success: true,
      message: 'Migração concluída com sucesso.',
      data: result,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/migrate-wallet] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao executar migração.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate-wallet
 * 
 * Returns the current count of legacy records awaiting migration.
 * Useful for dry-run validation before executing the actual migration.
 */
export async function GET() {
  try {
    await requireAdmin();

    const { prisma } = await import('@/lib/prisma');

    const [
      legacyExchangeReturnsCount,
      legacyMovementsCount,
      newExchangesCount,
      newReturnsCount,
      newTransactionsCount,
    ] = await Promise.all([
      prisma.exchangeReturn.count(),
      prisma.customerWalletMovement.count(),
      prisma.saleExchange.count(),
      prisma.saleReturn.count(),
      prisma.walletTransaction.count(),
    ]);

    return NextResponse.json({
      success: true,
      status: {
        legacy: {
          exchangeReturns: legacyExchangeReturnsCount,
          walletMovements: legacyMovementsCount,
        },
        migrated: {
          saleExchanges: newExchangesCount,
          saleReturns: newReturnsCount,
          walletTransactions: newTransactionsCount,
        },
        readyToMigrate: legacyExchangeReturnsCount > 0 || legacyMovementsCount > 0,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/admin/migrate-wallet] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao verificar status da migração.' },
      { status: 500 }
    );
  }
}
