"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Phone, MoreVertical, Eye, Pencil, Trash2, Wallet, Baby, User, Loader2, AlertCircle } from "lucide-react"
import { formatPhone } from "./utils"

interface CustomerTableProps {
  customers: any[]
  isLoading: boolean
  error: string | null
  walletsMap: Record<string, number>
  canUpdate: boolean
  canDelete: boolean
  onOpenEdit: (customer: any) => void
  onOpenDetails: (customer: any) => void
  onOpenDelete: (id: string) => void
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  totalPages: number
  totalCount: number
  isBirthdayView: boolean
  birthdayChildren: any[]
  isLoadingBirthdays: boolean
}

export function CustomerTable({
  customers,
  isLoading,
  error,
  walletsMap,
  canUpdate,
  canDelete,
  onOpenEdit,
  onOpenDetails,
  onOpenDelete,
  page,
  setPage,
  totalPages,
  totalCount,
  isBirthdayView,
  birthdayChildren,
  isLoadingBirthdays
}: CustomerTableProps) {

  if (isBirthdayView) {
    if (isLoadingBirthdays) return <div className="py-20 text-center text-muted-foreground">Carregando aniversariantes...</div>
    if (birthdayChildren.length === 0) return (
      <div className="rounded-2xl border-2 border-dashed py-20 text-center">
        <Baby className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30"/>
        <p className="font-semibold">Nenhum filho aniversariante no período.</p>
      </div>
    )
    return (
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-4 text-left">Dia</th>
              <th className="p-4 text-left">Filho / Dependente</th>
              <th className="p-4 text-left">Nascimento</th>
              <th className="p-4 text-left">Idade</th>
              <th className="p-4 text-left">Responsável</th>
              <th className="p-4 text-left">Contato</th>
            </tr>
          </thead>
          <tbody>
            {birthdayChildren.map(child => { 
              const birthDate = new Date(child.birthDate); 
              const today = new Date(); 
              const age = today.getFullYear() - birthDate.getUTCFullYear(); 
              return (
                <tr key={child.id} className="border-t">
                  <td className="p-4 font-bold">{child.day}</td>
                  <td className="p-4">{child.name}</td>
                  <td className="p-4">{birthDate.toLocaleDateString('pt-BR',{timeZone:'UTC'})}</td>
                  <td className="p-4">{age} anos</td>
                  <td className="p-4">{child.customerName}</td>
                  <td className="p-4">{formatPhone(child.phone)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-rose-600" />
        <div>
          <h3 className="font-semibold text-base">Aviso no Carregamento</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-2" />
        <p className="text-muted-foreground text-sm">Carregando carteira de clientes...</p>
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-slate-50/50">
        <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-slate-600 font-semibold text-base">Nenhum cliente encontrado</p>
        <p className="text-muted-foreground text-sm mt-1">Refine a busca ou cadastre um novo cliente/responsável.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {customers.map((customer) => (
          <Card key={customer.id} className="overflow-hidden border border-slate-100 shadow-sm hover:border-indigo-500/30 group hover:shadow-md transition-all duration-300 bg-white">
            <div className="p-4 pb-2 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">{customer.nome}</h3>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3 shrink-0" />
                  {formatPhone(customer.whatsapp_principal)}
                </p>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenDetails(customer)}>
                    <Eye className="mr-2 h-4 w-4 text-indigo-500" /> Ficha Completa
                  </DropdownMenuItem>
                  {canUpdate && (
                    <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenEdit(customer)}>
                      <Pencil className="mr-2 h-4 w-4 text-blue-500" /> Editar Ficha
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600 cursor-pointer" onClick={() => onOpenDelete(customer.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Arquivar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <CardContent className="p-4 pt-1 space-y-3 text-xs">
              {/* Balance display */}
              <div className="bg-slate-50 p-2.5 rounded-lg flex items-center justify-between border">
                <span className="text-slate-400 font-semibold uppercase text-[9px] flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-indigo-500" /> Crédito
                </span>
                <strong className="text-indigo-600 text-sm">
                  R$ {(walletsMap[customer.id] || 0).toFixed(2)}
                </strong>
              </div>

              {/* Children names list */}
              {customer.children && customer.children.length > 0 ? (
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 font-semibold block uppercase">Filhos</span>
                  <div className="flex flex-wrap gap-1">
                    {customer.children.map((kid: any) => (
                      <Badge key={kid.id} variant="secondary" className="text-[9px] font-normal py-0 px-2 flex items-center gap-0.5 bg-slate-100 text-slate-700">
                        <Baby className="h-2.5 w-2.5" />
                        {kid.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 italic block">Sem filhos vinculados</span>
              )}

              {/* Display active tags */}
              {customer.tags && customer.tags.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-50">
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.map((t: string) => (
                      <Badge key={t} className="text-[8px] bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 font-bold px-1.5 py-0">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border rounded-xl shadow-sm mt-4">
          <div className="text-xs text-muted-foreground">
            Página <span className="font-semibold text-slate-700">{page}</span> de{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span> ({totalCount} cliente(s))
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs font-semibold"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-xs font-semibold"
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
