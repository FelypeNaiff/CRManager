export const dynamic = 'force-dynamic';
import { requirePermission } from "@/lib/auth/permissions"
import { SELLER_PERMISSIONS } from "@/lib/sellers/seller-security"
import { sellersService } from "@/lib/sellers/sellers-service"
import { VendedoresClient } from "./vendedores-client"

export const metadata = {
  title: "Vendedores | CRManager",
}

export default async function VendedoresPage() {
  const session = await requirePermission(SELLER_PERMISSIONS.view.module, SELLER_PERMISSIONS.view.action)

  const [sellers, users] = await Promise.all([
    sellersService.getSellersByCompany(session.companyId),
    sellersService.getLinkableUsers(session.companyId),
  ])

  // Convert Decimal to number for the client
  const serializedSellers = sellers.map(s => ({
    ...s,
    commissionRate: s.commissionRate.toNumber(),
    goal: s.goal ? s.goal.toNumber() : undefined,
  }))

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Vendedores</h2>
      </div>
      <VendedoresClient
        initialData={serializedSellers}
        users={users.map(user => ({ id: user.id, name: user.name, email: user.email, linkedSellerId: user.seller?.id ?? null }))}
      />
    </div>
  )
}
