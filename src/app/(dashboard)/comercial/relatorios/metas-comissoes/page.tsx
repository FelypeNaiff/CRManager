"use client";

import { useEffect, useState } from "react";
import { getGoalsAndCommissionsReportAction } from "@/lib/reports/actions/commercial-report-actions";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { exportToExcel } from "@/lib/reports/export-excel";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";

export default function GoalsCommissionsReportPage() {
  const { activeProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!activeProfile?.empresaId) return;
      setLoading(true);
      const res = await getGoalsAndCommissionsReportAction({ companyId: activeProfile.empresaId });
      if (res.success) {
        setData(res.data ?? []);
      }
      setLoading(false);
    }
    load();
  }, [activeProfile]);

  const handleExport = () => {
    exportToExcel(data, "Relatorio_Metas_Comissoes");
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
          <h1 className="text-3xl font-bold tracking-tight">Metas e Comissões</h1>
          <p className="text-muted-foreground">Ranking e progresso dos vendedores.</p>
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
                <TableHead>Ranking</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Meta Total</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead className="text-right">Com. Pendente</TableHead>
                <TableHead className="text-right">Com. Paga</TableHead>
                <TableHead className="text-right">Com. Cancelada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={row.sellerName + idx}>
                  <TableCell className="font-medium text-center">#{idx + 1}</TableCell>
                  <TableCell>{row.sellerName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.target)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.achieved)}</TableCell>
                  <TableCell className="w-[150px]">
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(row.percentAchieved, 100)} className="h-2" />
                      <span className="text-xs text-muted-foreground">{row.percentAchieved.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-yellow-600">{formatCurrency(row.pendingComm)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(row.paidComm)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(row.cancelledComm)}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum vendedor com meta encontrada
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
