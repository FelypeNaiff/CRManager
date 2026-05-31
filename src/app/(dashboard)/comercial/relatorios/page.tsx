"use client";

import { useEffect, useState } from "react";
import { getDashboardMetricsAction } from "@/lib/reports/actions/commercial-report-actions";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, TrendingUp, Package, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";

export default function ReportsDashboardPage() {
  const { activeProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    async function load() {
      if (!activeProfile?.empresaId) return;
      setLoading(true);
      const res = await getDashboardMetricsAction({ companyId: activeProfile.empresaId });
      if (res.success) {
        setMetrics(res.data);
      }
      setLoading(false);
    }
    load();
  }, [activeProfile]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const reports = [
    { title: "Vendas", desc: "Listagem detalhada das vendas", link: "/comercial/relatorios/vendas" },
    { title: "Produtos Mais Vendidos", desc: "Ranking de produtos e variantes", link: "/comercial/relatorios/produtos" },
    { title: "Margem de Lucro", desc: "Análise de custo vs faturamento", link: "/comercial/relatorios/margem" },
    { title: "Metas e Comissões", desc: "Desempenho da equipe comercial", link: "/comercial/relatorios/metas-comissoes" },
    { title: "Trocas e Devoluções", desc: "Histórico e motivos de retorno", link: "/comercial/relatorios/trocas" },
    { title: "Créditos de Clientes", desc: "Saldos disponíveis em carteira", link: "/comercial/relatorios/creditos-clientes" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios e BI</h1>
        <p className="text-muted-foreground">Visão geral do seu negócio e acesso rápido aos relatórios estratégicos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.netRevenue || 0)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Realizadas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSalesCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.ticketMedio || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trocas e Devoluções</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalReturns + metrics?.totalExchanges || 0}</div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-semibold mt-8">Todos os Relatórios</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.link} href={report.link}>
            <Card className="hover:bg-muted/50 transition-colors h-full cursor-pointer">
              <CardHeader>
                <CardTitle>{report.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
