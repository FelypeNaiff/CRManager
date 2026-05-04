"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Users, ShoppingBag, TrendingUp, AlertCircle, ArrowRight, Wallet, CalendarDays, Banknote, Building } from "lucide-react"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import Link from "next/link"

export default function DashboardPage() {
  
  // Mock Data for Cash Flow
  const fluxoCaixaData = [
    { name: "Jan", entradas: 4000, saidas: 2400 },
    { name: "Fev", entradas: 3000, saidas: 1398 },
    { name: "Mar", entradas: 2000, saidas: 9800 },
    { name: "Abr", entradas: 2780, saidas: 3908 },
    { name: "Mai", entradas: 1890, saidas: 4800 },
    { name: "Jun", entradas: 2390, saidas: 3800 },
  ]

  // Mock Data for Sales
  const vendasData = [
    { name: "Seg", total: 1200 },
    { name: "Ter", total: 2100 },
    { name: "Qua", total: 800 },
    { name: "Qui", total: 1600 },
    { name: "Sex", total: 2400 },
    { name: "Sáb", total: 3200 },
  ]

  const contasBancarias = [
    { banco: "Itaú", saldo: "R$ 12.450,00", logo: "bg-orange-500" },
    { banco: "Bradesco", saldo: "R$ 5.320,00", logo: "bg-red-600" },
    { banco: "Nubank", saldo: "R$ 8.900,00", logo: "bg-purple-600" },
    { banco: "Caixa", saldo: "R$ 1.200,00", logo: "bg-blue-600" },
  ]

  const agenda = [
    { hora: "09:00", evento: "Reunião Fornecedor", tipo: "Reunião" },
    { hora: "14:30", evento: "Pagamento Aluguel", tipo: "Vencimento" },
    { hora: "16:00", evento: "Entrega de Mercadoria", tipo: "Logística" },
  ]

  const topCards = [
    { 
      title: "Receitas Hoje", 
      value: "R$ 1.250,00", 
      icon: TrendingUp, 
      borderColor: "border-t-[#0073b7]", 
      iconColor: "text-[#0073b7]",
      bgColor: "bg-[#0073b7]/10",
      link: "/pdv" 
    },
    { 
      title: "A Receber", 
      value: "R$ 4.500,00", 
      icon: Banknote, 
      borderColor: "border-t-[#00a65a]", 
      iconColor: "text-[#00a65a]",
      bgColor: "bg-[#00a65a]/10",
      link: "/contas-receber" 
    },
    { 
      title: "A Pagar", 
      value: "R$ 3.200,00", 
      icon: AlertCircle, 
      borderColor: "border-t-[#dd4b39]", 
      iconColor: "text-[#dd4b39]",
      bgColor: "bg-[#dd4b39]/10",
      link: "/contas-pagar" 
    },
    { 
      title: "Clientes Ativos", 
      value: "128", 
      icon: Users, 
      borderColor: "border-t-primary", 
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
      link: "/clientes" 
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-headline font-bold text-foreground">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">Acompanhe os principais indicadores do seu negócio.</p>
      </div>

      {/* Top Row - Cards ERP */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topCards.map((card, idx) => (
          <Card key={idx} className={`relative overflow-hidden border-0 shadow-sm border-t-4 ${card.borderColor} rounded-md bg-white`}>
            <div className="absolute right-[-20px] top-[-10px] opacity-10 pointer-events-none">
              <card.icon className="h-32 w-32" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{card.title}</CardTitle>
              <div className={`p-2 rounded-md ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pb-0">
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
            <CardFooter className="pt-4 pb-3 mt-4 bg-muted/20 border-t relative z-10">
              <Link href={card.link} className="flex items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors w-full justify-between">
                Ir para {card.title.split(' ')[0]} <ArrowRight className="h-3 w-3" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        
        {/* Fluxo de Caixa */}
        <Card className="lg:col-span-2 border-0 shadow-sm border-t-4 border-t-[#00a65a] rounded-md bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluxoCaixaData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
                  <RechartsTooltip cursor={{fill: 'transparent'}} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar name="Entradas" dataKey="entradas" fill="#00a65a" radius={[2, 2, 0, 0]} barSize={20} />
                  <Bar name="Saídas" dataKey="saidas" fill="#dd4b39" radius={[2, 2, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Vendas */}
        <Card className="lg:col-span-1 border-0 shadow-sm border-t-4 border-t-[#0073b7] rounded-md bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Vendas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendasData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                  <RechartsTooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="total" fill="#0073b7" radius={[2, 2, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Contas Bancárias */}
        <Card className="lg:col-span-2 border-0 shadow-sm border-t-4 border-t-gray-400 rounded-md bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building className="h-5 w-5 text-gray-500" /> Saldos em Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {contasBancarias.map((conta, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border rounded-md hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-xs ${conta.logo}`}>
                      {conta.banco.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{conta.banco}</span>
                  </div>
                  <span className="font-bold text-foreground">{conta.saldo}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Agenda */}
        <Card className="lg:col-span-1 border-0 shadow-sm border-t-4 border-t-[#f39c12] rounded-md bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#f39c12]" /> Agenda do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agenda.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 relative before:absolute before:left-[19px] before:top-6 before:bottom-[-16px] before:w-[2px] before:bg-border last:before:hidden">
                  <div className="w-10 text-xs font-bold text-muted-foreground pt-1 shrink-0 text-right">
                    {item.hora}
                  </div>
                  <div className="w-2 h-2 rounded-full bg-[#f39c12] mt-2 shrink-0 z-10 ring-4 ring-white" />
                  <div className="bg-muted/30 border rounded-md p-3 flex-1">
                    <p className="text-sm font-semibold">{item.evento}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.tipo}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Link href="/agenda" className="text-sm text-primary font-medium hover:underline w-full text-center">
              Ver agenda completa
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
