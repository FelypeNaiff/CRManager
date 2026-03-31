"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, ShoppingBag, TrendingUp, AlertCircle, MessageSquare } from "lucide-react"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"

const data = [
  { name: "Seg", total: 1200 },
  { name: "Ter", total: 2100 },
  { name: "Qua", total: 1500 },
  { name: "Qui", total: 2800 },
  { name: "Sex", total: 3200 },
  { name: "Sáb", total: 4500 },
  { name: "Dom", total: 3100 },
]

const recentSales = [
  { id: "1024", customer: "Maria Oliveira", total: "R$ 450,00", status: "Pago", payment: "PIX", date: "Hoje, 14:20" },
  { id: "1023", customer: "João Silva", total: "R$ 1.200,00", status: "Pendente", payment: "Cartão de Crédito", date: "Hoje, 13:45" },
  { id: "1022", customer: "Ana Costa", total: "R$ 230,50", status: "Pago", payment: "Dinheiro", date: "Hoje, 11:30" },
  { id: "1021", customer: "Roberto Santos", total: "R$ 89,90", status: "Pago", payment: "PIX", date: "Ontem, 18:10" },
  { id: "1020", customer: "Juliana Lima", total: "R$ 560,00", status: "Cancelado", payment: "Cartão de Débito", date: "Ontem, 16:50" },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo ao CRManager. Aqui está o resumo da sua loja hoje.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-none shadow-sm bg-violet-50 dark:bg-violet-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-400">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">1.284</div>
            <p className="text-xs text-violet-600/70">+12% desde o mês passado</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Vendas do Dia</CardTitle>
            <ShoppingBag className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">R$ 4.850</div>
            <p className="text-xs text-emerald-600/70">+5% em relação a ontem</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Total do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">R$ 54.200</div>
            <p className="text-xs text-blue-600/70">85% da meta mensal</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Contas Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">R$ 2.450</div>
            <p className="text-xs text-amber-600/70">4 contas vencem hoje</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-rose-50 dark:bg-rose-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">Atendimentos</CardTitle>
            <MessageSquare className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-900 dark:text-rose-100">12</div>
            <p className="text-xs text-rose-600/70">8 aguardando resposta</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Vendas nos últimos 7 dias</CardTitle>
            <CardDescription>Resumo de faturamento diário da semana atual.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              total: {
                label: "Vendas",
                color: "hsl(var(--primary))",
              },
            }} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
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
            <CardDescription>Movimentações recentes no PDV.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{sale.customer}</p>
                    <p className="text-xs text-muted-foreground">{sale.date} • {sale.payment}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-bold text-primary">{sale.total}</p>
                    <Badge variant={sale.status === "Pago" ? "default" : sale.status === "Pendente" ? "outline" : "destructive"} className="text-[10px] h-4 px-1">
                      {sale.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}