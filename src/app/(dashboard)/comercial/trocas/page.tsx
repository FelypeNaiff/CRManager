"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { getSaleAction } from "@/lib/sales/actions/get-sale-action";

export default function TrocasPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();
  
  const [saleId, setSaleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!saleId || !activeProfile?.empresaId) return;
    setLoading(true);
    setError("");
    
    const res = await getSaleAction(saleId);
    setLoading(false);
    
    if (res.success && res.sale) {
      if (res.sale.status === "CANCELLED") {
        setError("Esta venda está cancelada.");
      } else if (res.sale.status === "RETURNED") {
        setError("Esta venda já foi totalmente devolvida.");
      } else {
        router.push(`/comercial/trocas/${res.sale.id}`);
      }
    } else {
      setError("Venda não encontrada.");
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Trocas e Devoluções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Localize a venda original para iniciar o processo de troca ou devolução.</p>
          <div className="flex gap-2">
            <Input 
              placeholder="ID da Venda" 
              value={saleId} 
              onChange={e => setSaleId(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading || !saleId}>
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
          {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
