export const dynamic = 'force-dynamic';
import { getActiveProfileSession } from "@/lib/auth/actions"
import { sellersService } from "@/lib/sellers/sellers-service"
import { VendedoresClient } from "./vendedores-client"

export const metadata = {
  title: "Vendedores | CRManager",
}

export default async function VendedoresPage() {
  const session = await getActiveProfileSession()
  
  if (!session?.companyId) {
    return <div>Não autenticado</div>
  }

  const sellers = await sellersService.getSellersByCompany(session.companyId)

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
      <VendedoresClient initialData={serializedSellers} />
    </div>
  )
}
