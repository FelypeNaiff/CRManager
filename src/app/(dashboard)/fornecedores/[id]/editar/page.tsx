import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/fornecedores/supplier-form";
import { getSupplierById } from "@/lib/crm/supplier-actions";

export default async function EditarFornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const res = await getSupplierById(id);
  if (!res.success || !('data' in res) || !res.data) {
    notFound();
  }

  return (
    <div className="p-2 sm:p-6 bg-[#f0f2f5] min-h-[calc(100vh-4rem)] -m-4 sm:-m-6">
      <SupplierForm initialData={res.data} />
    </div>
  );
}
