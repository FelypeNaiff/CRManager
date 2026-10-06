"use client";

import { FactoryOrderForm } from "@/components/fornecedores/factory-order-form";

export default function NovoPedidoFabricaPage() {
  return (
    <div className="p-2 sm:p-6 bg-[#f0f2f5] min-h-[calc(100vh-4rem)] -m-4 sm:-m-6">
      <FactoryOrderForm />
    </div>
  );
}
