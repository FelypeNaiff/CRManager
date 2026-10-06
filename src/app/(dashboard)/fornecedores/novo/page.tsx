"use client";

import { SupplierForm } from "@/components/fornecedores/supplier-form";

export default function NovoFornecedorPage() {
  return (
    <div className="p-2 sm:p-6 bg-[#f0f2f5] min-h-[calc(100vh-4rem)] -m-4 sm:-m-6">
      <SupplierForm />
    </div>
  );
}
