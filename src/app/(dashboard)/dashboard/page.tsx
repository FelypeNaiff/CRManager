"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, ShoppingBag, TrendingUp, AlertCircle, MessageSquare, Loader2 } from "lucide-react"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"

export default function DashboardPage() {
  const db = useFirestore()

  // Queries para dados reais
  const clientesQuery = useMemoFirebase(() => db ? collection(db, "clientes") : null, [db])
  const vendasQuery = useMemoFirebase(() => db ? query(collection(db, "vendas"), orderBy("dataVenda", "desc"), limit(5)) : null, [db])
  const atendimentosQuery = useMemoFirebase(() => db ? collection(db, "atendimentos") : null, [db])

  const { data: clientes } = useCollection(clientesQuery)
  const { data: vendas, isLoading: isLoadingVendas } = useCollection(vendasQuery)
  const { data: atendimentos } = useCollection(atendimentosQuery)

  // Dados simplificados para o gráfico (vazios por padrão até ter dados reais)
  const chartData = [
    { name: "Seg", total: 0 },
    { name: "Ter", total: 0 },
    { name: "Qua", total: 0 },
    { name: "Qui", total: 0 },
    { name: "Sex", total: 0 },
    { name: "Sáb", total: 0 },
    { name: "Dom", total: 0 },
  ]

  const stats = [
    { label: "Total Clientes", value: clientes?.length || 0, icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Vendas do Mês", value: `R$ ${vendas?.reduce((acc, v) => acc + (v.total || 0), 0).toFixed(2) || "0,00"}`, icon: ShoppingBag, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Atendimentos", value: atendimentos?.length || 0, icon: MessageSquare, color: "text-rose-600", bg: "bg-rose-50" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo ao CRManager. Resumo das operações.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, idx) => (
          <Card key={idx} className={`border-none shadow-sm ${stat.bg}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
            <CardDescription>Resumo de faturamento por dia.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              total: {
                label: "Vendas",
                color: "hsl(var(--primary))",
              },
            }} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="total" 
                    fill="var(--color-total)" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Últimas Vendas</CardTitle>
            <CardDescription>Movimentações reais no PDV.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingVendas ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !vendas || vendas.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhuma venda registrada ainda.
              </div>
            ) : (
              <div className="space-y-4">
                {vendas.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">Pedido #{sale.numero || sale.id.slice(0, 5)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(sale.dataVenda).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-bold text-primary">R$ {sale.total?.toFixed(2)}</p>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {sale.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
