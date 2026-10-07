import { notFound } from "next/navigation";
import { FactoryOrderForm } from "@/components/fornecedores/factory-order-form";
import { getFactoryOrderById } from "@/lib/crm/factory-orders-actions";

export default async function EditarPedidoFabricaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const res = await getFactoryOrderById(id);
  if (!res.success || !('data' in res) || !res.data) {
    notFound();
  }

  return (
    <div className="p-2 sm:p-6 bg-[#f0f2f5] min-h-[calc(100vh-4rem)] -m-4 sm:-m-6">
      <FactoryOrderForm initialData={res.data} />
    </div>
  );
}
