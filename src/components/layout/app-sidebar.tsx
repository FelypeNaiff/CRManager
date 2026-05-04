"use client"

import * as React from "react"
import { useProfile } from "@/lib/contexts/profile-context"
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
  Wallet,
  ChevronRight
} from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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
  const { activeProfile, logoutProfile } = useProfile()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate font-headline font-bold text-sidebar-foreground">CRManager</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              item.items ? (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={item.items.some(sub => pathname === sub.url)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.title} className="hover:bg-sidebar-accent/50 text-sidebar-foreground">
                        {item.icon && <item.icon className="text-sidebar-foreground/70 group-data-[state=open]/collapsible:text-primary" />}
                        <span className="group-data-[state=open]/collapsible:font-medium">{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-sidebar-foreground/50" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={pathname === subItem.url} className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary data-[active=true]:font-medium text-sidebar-foreground/80 hover:text-primary transition-colors">
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-primary transition-colors"
                  >
                    <Link href={item.url || "#"}>
                      {item.icon && <item.icon className={pathname === item.url ? "text-primary" : "text-sidebar-foreground/70"} />}
                      <span className={pathname === item.url ? "font-medium" : ""}>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-primary-foreground text-sm">
            {activeProfile?.nome?.charAt(0) || "?"}
          </div>
          <div className="flex flex-col overflow-hidden flex-1">
            <span className="truncate text-sm font-medium text-sidebar-primary-foreground capitalize">{activeProfile?.nome || "Usuário"}</span>
            <span className="truncate text-xs text-sidebar-foreground capitalize">{activeProfile?.role || ""}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}