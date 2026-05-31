"use client";

import { useEffect, useState } from "react";
import { getSalesReportAction } from "@/lib/reports/actions/commercial-report-actions";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { exportToExcel } from "@/lib/reports/export-excel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SalesReportPage() {
  const { activeProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!activeProfile?.empresaId) return;
      setLoading(true);
      const res = await getSalesReportAction({ companyId: activeProfile.empresaId });
      if (res.success) {
        setData(res.data ?? []);
      }
      setLoading(false);
    }
    load();
  }, [activeProfile]);

  const handleExport = () => {
    exportToExcel(data, "Relatorio_Vendas");
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
          <h1 className="text-3xl font-bold tracking-tight">Relatório de Vendas</h1>
          <p className="text-muted-foreground">Listagem detalhada das vendas efetuadas.</p>
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
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(new Date(row.date))}</TableCell>
                  <TableCell>{row.customerName}</TableCell>
                  <TableCell>{row.sellerName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.subtotal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.discount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda encontrada
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
