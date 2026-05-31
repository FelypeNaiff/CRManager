"use client"

import * as React from "react"
import { useProfile } from "@/lib/contexts/profile-context"
import { useFirestore, useDoc, useMemoFirebase } from "@/lib/legacy-stubs"
import { doc } from "@/lib/legacy-firestore-stubs"
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
  Building2,
  Image,
  Key,
  Store,
  Wallet,
  ChevronRight,
  Tag,
  Boxes,
  MapPin,
  Link as LinkIcon,
  ShieldCheck,
  Filter,
  UserX,
  Gift
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

import { usePermissions } from "@/hooks/use-permissions"

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
      { title: "Dashboard", url: "/crm/dashboard", icon: LayoutDashboard },
      { title: "Clientes", url: "/crm/clientes", icon: Users },
      { title: "Filhos", url: "/crm/filhos", icon: Baby },
      { title: "Aniversariantes", url: "/crm/clientes?tab=aniversariantes", icon: Gift },
      { title: "Campanhas WhatsApp", url: "/crm/campanhas", icon: MessageSquare },
      { title: "Carteira / Saldos", url: "/crm/carteira", icon: Wallet },
      { title: "Trocas e Devoluções", url: "/crm/trocas", icon: Repeat },
      { title: "Clientes com Saldo", url: "/crm/carteira?filter=com-saldo", icon: Wallet },
      { title: "Configurações", url: "/crm/configuracoes", icon: Settings },
      {
        title: "Info Auxiliar",
        icon: FileText,
        items: [
          { title: "Histórico", url: "/crm/historico" },
          { title: "Carteira / Saldos", url: "/crm/carteira" },
          { title: "Clientes Inativos", url: "/crm/clientes?status=inativo" },
          { title: "Tags", url: "/crm/tags" },
          { title: "Segmentações", url: "/crm/segmentacoes" }
        ]
      }
    ],
  },
  {
    title: "Comercial",
    icon: ShoppingCart,
    items: [
      { title: "Vendas", url: "/comercial/vendas", icon: ShoppingCart },
      { title: "Metas", url: "/comercial/metas", icon: PieChart },
      { title: "Comissões", url: "/comercial/comissoes", icon: DollarSign },
      { title: "PDV", url: "/pdv", icon: Store },
      { 
        title: "Trocas e Devoluções", 
        icon: Repeat,
        items: [
          { title: "Nova Troca/Devolução", url: "/crm/trocas?tab=nova" },
          { title: "Em Aberto", url: "/crm/trocas?tab=aberto" },
          { title: "Finalizadas", url: "/crm/trocas?tab=finalizadas" },
          { title: "Créditos Gerados", url: "/crm/trocas?tab=creditos" },
          { title: "Histórico", url: "/crm/trocas?tab=historico" },
        ]
      },
      { title: "Vendedores", url: "/vendedores", icon: Briefcase },
    ],
  },
  {
    title: "Estoque",
    icon: Package,
    items: [
      { title: "Gerenciar Produtos", url: "/produtos", icon: Package },
      { title: "Movimentações", url: "/movimentacoes", icon: ArrowLeftRight },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck },
      { title: "Etiquetas", url: "/etiquetas", icon: Tag },
      { 
        title: "Opções Auxiliares",
        icon: Boxes,
        items: [
          { title: "Grupos de Produtos", url: "/grupos-produtos" },
          { title: "Unidades de Produtos", url: "/unidades-produtos" },
          { title: "Grades / Variações", url: "/grades-variacoes" }
        ]
      }
    ],
  },
  {
    title: "Financeiro",
    icon: DollarSign,
    items: [
      { title: "Dashboard", url: "/financeiro", icon: PieChart },
      { title: "Contas a Pagar", url: "/financeiro/contas-a-pagar", icon: Wallet },
      { title: "Contas a Receber", url: "/financeiro/contas-a-receber", icon: DollarSign },
      { title: "Calendário", url: "/financeiro/calendario", icon: CalendarDays },
      { title: "Fluxo de Caixa", url: "/financeiro/fluxo-caixa", icon: ArrowLeftRight },
      { title: "Caixas", url: "/financeiro/caixas", icon: Store },
      { title: "Contas Bancárias", url: "/financeiro/contas-bancarias", icon: Building2 },
      { title: "Transferências", url: "/financeiro/transferencias", icon: Repeat },
      { title: "Vales de Funcionários", url: "/financeiro/vales", icon: Users },
      { title: "Relatórios", url: "/financeiro/relatorios", icon: FileText },
      { title: "Opções Auxiliares", url: "/financeiro/opcoes-auxiliares", icon: Settings },
    ],
  },
  {
    title: "Marketing",
    icon: Megaphone,
    items: [
      { title: "Campanhas", url: "/crm/campanhas", icon: Megaphone },
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
    title: "Relatórios",
    url: "/relatorios",
    icon: FileText,
  },
  {
    title: "Configurações",
    icon: Settings,
    items: [
      {
        title: "Usuários",
        icon: Users,
        items: [
          { title: "Usuários", url: "/configuracoes/usuarios?tab=usuarios", icon: Users },
          { title: "Perfis de Acesso", url: "/configuracoes/usuarios?tab=perfis", icon: UserCog },
          { title: "Permissões por Módulo", url: "/configuracoes/usuarios?tab=permissoes", icon: ShieldCheck },
          { title: "Histórico de Acessos", url: "/configuracoes/usuarios?tab=historico", icon: History },
          { title: "Logs de Atividades", url: "/configuracoes/usuarios?tab=logs", icon: FileText },
        ],
      },
      {
        title: "Dados da Empresa",
        icon: Building2,
        items: [
          { title: "Dados Gerais", url: "/configuracoes/empresa?tab=dados-gerais", icon: Building2 },
          { title: "Endereços", url: "/configuracoes/empresa?tab=enderecos", icon: MapPin },
          { title: "Contatos", url: "/configuracoes/empresa?tab=contatos", icon: MessageSquare },
          { title: "Financeiro/Fiscal", url: "/configuracoes/empresa?tab=financeiro-fiscal", icon: DollarSign },
          { title: "Branding", url: "/configuracoes/empresa?tab=branding", icon: Image },
          { title: "Configurações Operacionais", url: "/configuracoes/empresa?tab=configuracoes-operacionais", icon: Settings },
          { title: "Integrações", url: "/configuracoes/empresa?tab=integracoes", icon: LinkIcon },
          { title: "Horários", url: "/configuracoes/empresa?tab=horarios", icon: CalendarDays },
          { title: "Filiais", url: "/configuracoes/empresa?tab=filiais", icon: Store },
        ],
      },
      { title: "Certificado Digital", url: "/configuracoes/certificado-digital", icon: Key },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { activeProfile, logoutProfile } = useProfile()
  const db = useFirestore()
  const configRef = useMemoFirebase(() => {
    return db && activeProfile?.empresaId ? doc(db, "configuracoes_empresa", activeProfile.empresaId) : null
  }, [db, activeProfile?.empresaId])
  const { data: empresaConfig } = useDoc(configRef)

  const logoUrl = empresaConfig?.logo_url || empresaConfig?.logo_reduzida
  const smallLogoUrl = empresaConfig?.logo_reduzida || empresaConfig?.logo_url
  const companyName = empresaConfig?.nome_fantasia || "NEEX"

  const { canAccessRoute, isLoading } = usePermissions()

  const filteredNavItems = React.useMemo(() => {
    if (isLoading) return navItems // Evita layout shift ou sumiço temporário

    return navItems.filter(item => {
      // Para itens com submenus, checa se tem acesso ao modulo principal
      // No caso de Financeiro, Configuracoes, CRM, etc, usamos a URL padrao ou titulo para checar
      let basePath = item.url
      if (!basePath && item.items && item.items.length > 0) {
        // Pega a URL do primeiro submenu para testar
        const firstUrl = item.items[0].url || ""
        basePath = firstUrl.split("?")[0]
      }
      return canAccessRoute(basePath || "/")
    })
  }, [canAccessRoute, isLoading])

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border py-6 bg-white flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-1 group-data-[collapsible=icon]:hidden">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da empresa" className="h-12 w-auto max-w-full object-contain" />
          ) : (
            <div className="h-12 w-12 text-primary font-bold text-2xl flex items-center justify-center">
              NX
            </div>
          )}
          <span className="font-headline font-bold text-lg text-primary">{companyName}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">NEEX</span>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex h-10 w-10 items-center justify-center">
          {smallLogoUrl ? (
            <img src={smallLogoUrl} alt="Logo reduzida" className="h-8 w-auto object-contain" />
          ) : (
            <div className="h-8 w-8 text-primary font-bold text-xl flex items-center justify-center">
              NX
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {filteredNavItems.map((item) => (
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
                        {item.items.map((subItem: any) => (
                          subItem.items ? (
                            <Collapsible key={subItem.title} asChild defaultOpen={subItem.items.some((ss: any) => pathname === ss.url)} className="group/sub-collapsible">
                              <SidebarMenuSubItem>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuSubButton className="flex w-full items-center justify-between hover:bg-transparent cursor-pointer font-medium text-sidebar-foreground whitespace-nowrap">
                                    <span className="group-data-[state=open]/sub-collapsible:text-primary whitespace-nowrap truncate">{subItem.title}</span>
                                    <ChevronRight className="ml-auto h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90 text-sidebar-foreground/50" />
                                  </SidebarMenuSubButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <SidebarMenuSub className="pl-2 border-l border-sidebar-border ml-2 mt-1 space-y-1">
                                    {subItem.items.map((nestedItem: any) => (
                                      <SidebarMenuSubItem key={nestedItem.title}>
                                        <SidebarMenuSubButton asChild isActive={pathname === nestedItem.url} className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary data-[active=true]:font-medium text-sidebar-foreground/80 hover:text-primary transition-colors text-xs whitespace-nowrap">
                                          <Link href={nestedItem.url}>
                                            <span className="whitespace-nowrap truncate">{nestedItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    ))}
                                  </SidebarMenuSub>
                                </CollapsibleContent>
                              </SidebarMenuSubItem>
                            </Collapsible>
                          ) : (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.url} className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary data-[active=true]:font-medium text-sidebar-foreground/80 hover:text-primary transition-colors whitespace-nowrap">
                                <Link href={subItem.url || "#"}>
                                  <span className="whitespace-nowrap truncate">{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
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
