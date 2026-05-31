"use client";

import { useEffect, useState } from "react";
import { getTopProductsReportAction } from "@/lib/reports/actions/commercial-report-actions";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { exportToExcel } from "@/lib/reports/export-excel";
import Link from "next/link";

export default function TopProductsReportPage() {
  const { activeProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!activeProfile?.empresaId) return;
      setLoading(true);
      const res = await getTopProductsReportAction({ companyId: activeProfile.empresaId });
      if (res.success) {
        setData(res.data ?? []);
      }
      setLoading(false);
    }
    load();
  }, [activeProfile]);

  const handleExport = () => {
    exportToExcel(data, "Relatorio_TopProdutos");
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/comercial/relatorios"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos Mais Vendidos</h1>
          <p className="text-muted-foreground">Ranking de produtos e variantes por volume de vendas.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Exportar Excel</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produto / Variante</TableHead>
                <TableHead className="text-right">Qtd Vendida</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Margem Bruta</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
                <TableHead className="text-right">Estoque Atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.productId + row.variantName}>
                  <TableCell>{row.sku}</TableCell>
                  <TableCell>{row.productName} - {row.variantName}</TableCell>
                  <TableCell className="text-right">{row.quantitySold}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.margin)}</TableCell>
                  <TableCell className="text-right">{row.marginPercent.toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{row.currentStock}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum produto vendido
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
