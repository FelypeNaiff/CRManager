"use client";

import { useEffect, useState } from "react";
import { getCustomerCreditsReportAction } from "@/lib/reports/actions/commercial-report-actions";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { exportToExcel } from "@/lib/reports/export-excel";
import Link from "next/link";

export default function CustomerCreditsReportPage() {
  const { activeProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      if (!activeProfile?.empresaId) return;
      setLoading(true);
      const res = await getCustomerCreditsReportAction({ companyId: activeProfile.empresaId });
      if (res.success) {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
  }, [activeProfile]);

  const handleExport = () => {
    if (data?.customersWithBalance) exportToExcel(data.customersWithBalance, "Relatorio_Credito_Clientes");
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
          <h1 className="text-3xl font-bold tracking-tight">Créditos de Clientes</h1>
          <p className="text-muted-foreground">Saldos atuais em carteira para abatimento de compras.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Exportar Excel</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Saldo Total em Circulação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(data?.totalBalance || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Última Movimentação</TableHead>
                <TableHead className="text-right">Saldo Atual (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.customersWithBalance?.map((row: any) => (
                <TableRow key={row.customerId}>
                  <TableCell className="font-medium">{row.customerName}</TableCell>
                  <TableCell>{row.customerEmail || "-"}</TableCell>
                  <TableCell>{formatDate(new Date(row.updatedAt))}</TableCell>
                  <TableCell className="text-right font-bold text-blue-600">{formatCurrency(row.balance)}</TableCell>
                </TableRow>
              ))}
              {(!data?.customersWithBalance || data.customersWithBalance.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente com saldo ativo
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
