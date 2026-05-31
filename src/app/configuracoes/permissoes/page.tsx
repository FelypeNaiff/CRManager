"use client"

import { useState, useEffect } from "react"
import { useProfile } from "@/lib/contexts/profile-context"
import { useFirestore, useCollection, useMemoFirebase } from "@/lib/legacy-stubs"
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where } from "@/lib/legacy-firestore-stubs"
import { Shield, Save, CheckSquare, Square, Unlock, Lock, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { ConfigPageHeader } from "@/components/configuracoes/config-ui"
import { useSearchParams } from "next/navigation"

const MODULES = [
  { category: "Visão Geral", items: ["Dashboard", "Agenda", "Metas"] },
  { category: "Cadastros", items: ["Clientes", "Filhos", "Fornecedores", "Usuários", "Grupos usuários"] },
  { category: "Produtos e Estoque", items: ["Produtos", "Categorias", "Marcas", "Estoque", "Compras"] },
  { category: "Comercial e PDV", items: ["Orçamentos", "Vendas", "PDV", "Caixa", "Trocas", "Devoluções"] },
  { category: "Financeiro e Fiscal", items: ["Financeiro", "Contas a pagar", "Contas a receber", "Comissões", "Fiscal", "Notas fiscais"] },
  { category: "Marketing e CRM", items: ["CRM", "WhatsApp", "Fidelidade", "Cashback", "Convênios"] },
  { category: "Sistema", items: ["Permissões", "Configurações gerais", "Configurações PDV", "Auditoria", "Logs"] }
]

const BASIC_ACTIONS = ["visualizar", "editar", "excluir"]
const ADVANCED_ACTIONS = ["visualizar", "listar", "adicionar", "editar", "excluir", "gerar_relatorio", "aprovar", "exportar", "importar", "cancelar", "liberar_desconto"]

export default function PermissoesConfigPage() {
  const searchParams = useSearchParams()
  const paramGrupoId = searchParams.get("grupo_id")

  const [selectedGroup, setSelectedGroup] = useState<string>(paramGrupoId || "")
  const [advancedMode, setAdvancedMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [matriz, setMatriz] = useState<Record<string, Record<string, boolean>>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingMatriz, setIsLoadingMatriz] = useState(false)

  const db = useFirestore()
  const { activeProfile } = useProfile()

  const gruposQuery = useMemoFirebase(() => {
    if (!db || !activeProfile?.empresaId) return null
    return query(collection(db, "grupos_usuarios"), where("empresa_id", "==", activeProfile.empresaId))
  }, [db, activeProfile?.empresaId])

  const { data: gruposData } = useCollection(gruposQuery)
  const grupos = gruposData ?? []

  useEffect(() => {
    async function fetchMatriz() {
      if (!db || !selectedGroup) {
        setMatriz({})
        return
      }
      setIsLoadingMatriz(true)
      try {
        const docSnap = await getDoc(doc(db, "permissoes_grupo", selectedGroup))
        if (docSnap.exists() && docSnap.data().matriz) {
          setMatriz(docSnap.data().matriz)
        } else {
          setMatriz({})
        }
      } catch (e) {
        console.error(e)
        toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar matriz." })
      } finally {
        setIsLoadingMatriz(false)
      }
    }
    fetchMatriz()
  }, [db, selectedGroup])

  const handleTogglePermission = (modulo: string, acao: string) => {
    setMatriz(prev => {
      const newMatriz = { ...prev }
      if (!newMatriz[modulo]) newMatriz[modulo] = {}
      newMatriz[modulo][acao] = !newMatriz[modulo][acao]
      return newMatriz
    })
  }

  const handleGrantAll = () => {
    const newMatriz: Record<string, Record<string, boolean>> = {}
    MODULES.forEach(cat => {
      cat.items.forEach(mod => {
        newMatriz[mod] = {}
        ADVANCED_ACTIONS.forEach(act => newMatriz[mod][act] = true)
      })
    })
    setMatriz(newMatriz)
  }

  const handleRevokeAll = () => {
    setMatriz({})
  }

  const handleSave = async () => {
    if (!db || !selectedGroup) return toast({ variant: "destructive", title: "Aviso", description: "Selecione um grupo." })
    setIsSaving(true)
    try {
      await setDoc(doc(db, "permissoes_grupo", selectedGroup), {
        grupo_id: selectedGroup,
        empresa_id: activeProfile?.empresaId,
        matriz: matriz,
        atualizado_em: serverTimestamp(),
        atualizado_por: activeProfile?.id
      }, { merge: true })

      toast({ title: "Permissões salvas com sucesso!" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao salvar permissões." })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredModules = MODULES.map(cat => ({
    ...cat,
    items: cat.items.filter(mod => mod.toLowerCase().includes(searchTerm.toLowerCase()))
  })).filter(cat => cat.items.length > 0)

  const actionsToRender = advancedMode ? ADVANCED_ACTIONS : BASIC_ACTIONS

  return (
    <div className="max-w-7xl space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <ConfigPageHeader 
          title="Matriz de Permissões" 
          description="Controle granular de acesso por módulos, telas e ações do sistema."
          breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Permissões" }]}
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleRevokeAll} className="text-rose-600 border-rose-200 hover:bg-rose-50"><Lock className="mr-2 h-4 w-4" /> Bloquear Todas</Button>
          <Button variant="outline" onClick={handleGrantAll} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"><Unlock className="mr-2 h-4 w-4" /> Liberar Todas</Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedGroup} className="bg-primary text-white"><Save className="mr-2 h-4 w-4" /> {isSaving ? "Salvando..." : "Salvar Permissões"}</Button>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex-1 w-full flex items-center gap-4">
          <div className="w-full md:max-w-md">
            <label className="text-sm font-semibold mb-1 block">Selecione o Grupo</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um grupo de acesso..." />
              </SelectTrigger>
              <SelectContent>
                {grupos.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.nome} {g.is_admin ? '(Admin)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 max-w-sm">
             <label className="text-sm font-semibold mb-1 block">Buscar módulo</label>
             <div className="relative">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input placeholder="Ex: Vendas..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l pl-6">
          <Switch checked={advancedMode} onCheckedChange={setAdvancedMode} />
          <div className="space-y-0.5">
            <label className="text-sm font-semibold block leading-none">Modo Avançado</label>
            <span className="text-xs text-muted-foreground">Exibir todas as ações detalhadas</span>
          </div>
        </div>
      </div>

      {selectedGroup ? (
        <div className="space-y-8">
          {isLoadingMatriz ? (
             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
               {Array.from({ length: 6 }).map((_, i) => (
                 <div key={i} className="border rounded-lg bg-white p-4 space-y-4 shadow-sm">
                   <div className="flex justify-between border-b pb-3 mb-3">
                     <div className="h-5 w-1/2 bg-slate-200 animate-pulse rounded"></div>
                     <div className="h-4 w-16 bg-slate-200 animate-pulse rounded"></div>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     {Array.from({ length: 6 }).map((_, j) => (
                       <div key={j} className="flex items-center gap-2">
                         <div className="h-4 w-4 bg-slate-200 animate-pulse rounded"></div>
                         <div className="h-4 w-full bg-slate-200 animate-pulse rounded"></div>
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
             </div>
          ) : filteredModules.map((category, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {category.category}
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {category.items.map(modulo => {
                  const isAllChecked = actionsToRender.every(a => matriz[modulo]?.[a])
                  return (
                    <div key={modulo} className="border rounded-lg bg-white p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between border-b pb-3 mb-3">
                        <span className="font-semibold text-slate-700">{modulo}</span>
                        <button 
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          onClick={() => {
                            actionsToRender.forEach(a => handleTogglePermission(modulo, a))
                          }}
                        >
                          {isAllChecked ? <Square className="h-3 w-3" /> : <CheckSquare className="h-3 w-3" />}
                          {isAllChecked ? 'Desmarcar' : 'Marcar'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                        {actionsToRender.map(acao => (
                          <label key={acao} className="flex items-center gap-2 text-sm cursor-pointer group">
                            <div className="relative flex items-center">
                              <input 
                                type="checkbox" 
                                className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-300 checked:border-primary checked:bg-primary transition-all"
                                checked={!!matriz[modulo]?.[acao]}
                                onChange={() => handleTogglePermission(modulo, acao)}
                              />
                              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              </div>
                            </div>
                            <span className="capitalize text-slate-600 group-hover:text-slate-900">{acao.replace('_', ' ')}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-slate-300 rounded-xl bg-slate-50 p-12 text-center text-slate-500">
          <Shield className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-lg">Nenhum grupo selecionado</p>
          <p className="text-sm mt-1">Selecione um grupo no painel acima para visualizar e editar suas permissões.</p>
        </div>
      )}
    </div>
  )
}
