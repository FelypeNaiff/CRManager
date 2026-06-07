"use client"

import { Tag, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function EtiquetasPage() {
  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline">Início</span>
        <span className="mx-2">-</span>
        <span className="cursor-pointer hover:underline">Estoque</span>
        <span className="mx-2">-</span>
        <span className="font-semibold text-foreground">Etiquetas</span>
      </div>

      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <Tag className="h-5 w-5 text-sidebar-foreground" /> Etiquetas e Códigos de Barras
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 border shadow-sm rounded-sm">
        <div className="flex items-center gap-1">
          <Button className="btn-erp-green gap-1 h-8 rounded-sm px-3 text-[13px]">
            <Plus className="h-3.5 w-3.5" /> Nãova Etiqueta
          </Button>
        </div>
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Input 
            className="h-8 rounded-sm w-full sm:w-[300px] border-gray-300 focus-visible:ring-0 focus-visible:border-primary text-[13px]"
            placeholder="Pesquisar etiquetas..."
          />
          <Button className="btn-erp-dark h-8 w-8 p-0 rounded-sm shrink-0">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="text-center py-20 border rounded-sm bg-gray-50">
        <p className="text-muted-foreground">Módulo de impressão de etiquetas em desenvolvimento.</p>
      </div>
    </div>
  )
}
