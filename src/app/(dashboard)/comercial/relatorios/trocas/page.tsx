"use client";

import { useEffect, useState } from "react";
import { getReturnsReportAction } from "@/lib/reports/actions/commercial-report-actions";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { exportToExcel } from "@/lib/reports/export-excel";
import Link from "next/link";

export default function ReturnsReportPage() {
  const { activeProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      if (!activeProfile?.empresaId) return;
      setLoading(true);
      const res = await getReturnsReportAction({ companyId: activeProfile.empresaId });
      if (res.success) {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
  }, [activeProfile]);

  const handleExport = () => {
    if (data?.returnsList) exportToExcel(data.returnsList, "Relatorio_Trocas_Devolucoes");
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
          <h1 className="text-3xl font-bold tracking-tight">Trocas e Devoluções</h1>
          <p className="text-muted-foreground">Histórico de retornos e créditos gerados.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Exportar Excel</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Devolvido / Creditado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(data?.totalReturned || 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Motivos Mais Frequentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {data?.reasonsMap && Object.entries(data.reasonsMap).map(([reason, count]) => (
                <li key={reason} className="flex justify-between">
                  <span>{reason}</span>
                  <span className="font-bold">{count as number}x</span>
                </li>
              ))}
              {(!data?.reasonsMap || Object.keys(data.reasonsMap).length === 0) && (
                <li className="text-muted-foreground">Nenhum motivo registrado.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Crédito Gerado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.returnsList?.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(new Date(row.date))}</TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>{row.reason || "-"}</TableCell>
                  <TableCell className="text-right text-red-600 font-medium">{formatCurrency(row.creditGenerated)}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
              {(!data?.returnsList || data.returnsList.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum retorno encontrado
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
