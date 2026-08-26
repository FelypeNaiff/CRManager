import { NextResponse } from 'next/server';
import type { ServerAuthContext } from './server-auth-context';
import { authErrorResponse } from './http-auth';

export function createSessionHandler(resolveContext: () => Promise<ServerAuthContext>) {
  return async function GET() {
    try {
      const context = await resolveContext();
      return NextResponse.json({
        authenticated: true,
        session: {
          userId: context.userId,
          name: context.name,
          email: context.email,
          role: context.roleName,
          isAdmin: context.isAdmin,
          companyId: context.companyId,
          permissions: context.permissions,
        },
      });
    } catch (error) {
      return authErrorResponse(error);
    }
  };
}

interface AdminRouteDependencies {
  authorize(): Promise<unknown>;
  migrate(): Promise<unknown>;
  counts(): Promise<[number, number, number, number, number]>;
}

export function createAdminMigrationHandlers(dependencies: AdminRouteDependencies) {
  return {
    async POST() {
      try {
        await dependencies.authorize();
        const result = await dependencies.migrate();
        return NextResponse.json({ success: true, message: 'Migração concluída com sucesso.', data: result });
      } catch (error) {
        return authErrorResponse(error);
      }
    },
    async GET() {
      try {
        await dependencies.authorize();
        const [exchangeReturns, walletMovements, saleExchanges, saleReturns, walletTransactions] =
          await dependencies.counts();
        return NextResponse.json({
          success: true,
          status: {
            legacy: { exchangeReturns, walletMovements },
            migrated: { saleExchanges, saleReturns, walletTransactions },
            readyToMigrate: exchangeReturns > 0 || walletMovements > 0,
          },
        });
      } catch (error) {
        return authErrorResponse(error);
      }
    },
  };
}
