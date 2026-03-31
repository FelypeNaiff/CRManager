"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Users,
  Baby,
  Headset,
  ShoppingCart,
  History,
  Repeat,
  Package,
  ArrowLeftRight,
  Truck,
  MessageSquare,
  Megaphone,
  FileText,
  DollarSign,
  Briefcase,
  PieChart,
  CalendarDays,
  Settings,
  UserCog,
  Store,
  Wallet
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "CRM",
    icon: Users,
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "Filhos", url: "/filhos", icon: Baby },
      { title: "Atendimentos", url: "/atendimentos", icon: Headset },
    ],
  },
  {
    title: "Vendas",
    icon: ShoppingCart,
    items: [
      { title: "PDV", url: "/pdv", icon: ShoppingCart },
      { title: "Vendas Realizadas", url: "/vendas", icon: History },
      { title: "Trocas e Devoluções", url: "/trocas", icon: Repeat },
      { title: "Vendedores", url: "/vendedores", icon: Briefcase },
      { title: "Metas", url: "/metas", icon: PieChart },
    ],
  },
  {
    title: "Estoque",
    icon: Package,
    items: [
      { title: "Produtos", url: "/produtos", icon: Package },
      { title: "Movimentações", url: "/movimentacoes", icon: ArrowLeftRight },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck },
    ],
  },
  {
    title: "Financeiro",
    icon: DollarSign,
    items: [
      { title: "Contas a Pagar", url: "/contas-pagar", icon: Wallet },
      { title: "Contas a Receber", url: "/contas-receber", icon: DollarSign },
      { title: "Contas Bancárias", url: "/contas-bancarias", icon: Store },
    ],
  },
  {
    title: "Marketing",
    icon: Megaphone,
    items: [
      { title: "Campanhas", url: "/campanhas", icon: Megaphone },
      { title: "Templates", url: "/templates", icon: FileText },
    ],
  },
  {
    title: "Comunicação",
    url: "/inbox",
    icon: MessageSquare,
  },
  {
    title: "Agenda",
    url: "/agenda",
    icon: CalendarDays,
  },
  {
    title: "Configurações",
    icon: Settings,
    items: [
      { title: "Usuários", url: "/usuarios", icon: UserCog },
      { title: "Minha Loja", url: "/configuracoes", icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate font-headline font-bold text-sidebar-primary-foreground">CRManager</span>
            <span className="truncate text-xs text-sidebar-foreground">Kids Fashion</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navItems.map((item) => (
          <SidebarGroup key={item.title}>
            {item.items ? (
              <>
                <SidebarGroupLabel className="font-headline text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                  {item.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {item.items.map((subItem) => (
                      <SidebarMenuItem key={subItem.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === subItem.url}
                          tooltip={subItem.title}
                        >
                          <Link href={subItem.url}>
                            <subItem.icon className="h-4 w-4" />
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </>
            ) : (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url || "#"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent overflow-hidden">
            <img src="https://picsum.photos/seed/user1/100/100" alt="Avatar" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-medium text-sidebar-primary-foreground">Admin</span>
            <span className="truncate text-xs text-sidebar-foreground">Sair do sistema</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}