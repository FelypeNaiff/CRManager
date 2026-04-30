"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  UserPlus, 
  Filter, 
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Tag,
  Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const db = useFirestore()

  const clientesQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "clientes")
  }, [db])

  const { data: customers, isLoading } = useCollection(clientesQuery)

  const filteredCustomers = (customers || []).filter(c => 
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone?.includes(searchTerm)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes e histórico de contatos.</p>
        </div>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-background p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, CPF ou telefone..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" /> Filtros
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Carregando clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/10">
          <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="overflow-hidden group hover:border-primary/50 transition-colors shadow-sm">
              <CardHeader className="p-4 pb-0 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {customer.nome?.charAt(0) || "C"}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{customer.nome}</h3>
                    <Badge variant={customer.ativo ? "default" : "secondary"} className="text-[10px] h-4 mt-1">
                      {customer.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Editar</DropdownMenuItem>
                    <DropdownMenuItem>Ver Filhos</DropdownMenuItem>
                    <DropdownMenuItem>Histórico de Vendas</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {customer.telefone}
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> {customer.email}
                    </div>
                  )}
                  {(customer.cidade || customer.estado) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {customer.cidade}, {customer.estado}
                    </div>
                  )}
                </div>
                {customer.tags && customer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {customer.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="bg-secondary/30 text-[10px] h-5 flex items-center gap-1">
                        <Tag className="h-3 w-3" /> {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
