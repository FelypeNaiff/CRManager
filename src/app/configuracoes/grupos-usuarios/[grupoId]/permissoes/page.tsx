"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useMemoFirebase } from "@/lib/legacy-stubs"
import { doc, setDoc, serverTimestamp, collection, addDoc } from "@/lib/legacy-firestore-stubs"
import { useProfile } from "@/lib/contexts/profile-context"
import { permissoesSchema } from "@/types/configuracoes"
import { toast } from "@/hooks/use-toast"
import { Shield, CheckCircle2, XCircle, Sparkles, SlidersHorizontal } from "lucide-react"

import { 
  ConfigPageHeader, 
  ConfigFormActions, 
} from "@/components/configuracoes/config-ui"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

const MODULOS = [
  "Cadastros", "Produtos", "Serviços", "Orçamentos", "Ordens de serviços",
  "Vendas", "Estoque", "Financeiro", "Notas fiscais", "CRM", "Marketing",
  "Relatórios", "Configurações"
]

const PERMISSOES_BASICAS = [
  { key: "acessar", label: "Fluxo do módulo" },
  { key: "listar", label: "Listar" },
  { key: "gerar_relatorios", label: "Gerar relatórios" },
  { key: "adicionar", label: "Adicionar" },
  { key: "editar", label: "Editar" },
  { key: "visualizar", label: "Visualizar" },
  { key: "deletar", label: "Deletar" }
]

const PERMISSOES_AVANCADAS = [
  { key: "exportar_pdf", label: "Exportar PDF" },
  { key: "exportar_excel", label: "Exportar Excel" },
  { key: "imprimir", label: "Imprimir" },
  { key: "cancelar", label: "Cancelar" },
  { key: "estornar", label: "Estornar" },
  { key: "aprovar", label: "Aprovar" },
  { key: "configurar", label: "Configurar" },
  { key: "ver_custos", label: "Ver custos" },
  { key: "ver_lucro", label: "Ver lucro" },
  { key: "ver_saldos_bancarios", label: "Ver saldos bancários" },
  { key: "alterar_precos", label: "Alterar preços" },
  { key: "confirmar_pagamento", label: "Confirmar pagamento" },
  { key: "confirmar_recebimento", label: "Confirmar recebimento" }
]

export default function PermissoesGrupoPage() {
  const params = useParams()
  const router = useRouter()
  const grupoId = params.grupoId as string

  const [matriz, setMatriz] = useState<Record<string, Record<string, boolean>>>({})
  const [modoAvancado, setModoAvancado] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()
  const { activeProfile } = useProfile()

  // Buscar Nome do Grupo
  const grupoRef = useMemoFirebase(() => {
    return db && activeProfile?.empresaId && grupoId ? doc(db, "grupos_usuarios", grupoId) : null
  }, [db, activeProfile?.empresaId, grupoId])
  const { data: grupoData } = useDoc(grupoRef)

  // Buscar Permissões atuais
  const permRef = useMemoFirebase(() => {
    return db && activeProfile?.empresaId && grupoId ? doc(db, "permissoes_grupo", grupoId) : null
  }, [db, activeProfile?.empresaId, grupoId])
  const { data: permData } = useDoc(permRef)

  useEffect(() => {
    if (permData?.matriz) {
      setMatriz(permData.matriz)
    }
  }, [permData])

  const handleTogglePermissao = (modulo: string, acao: string, value: boolean) => {
    setMatriz(prev => ({
      ...prev,
      [modulo]: {
        ...(prev[modulo] || {}),
        [acao]: value
      }
    }))
  }

  const handleToggleModuloInteiro = (modulo: string, value: boolean) => {
    const modPerms: Record<string, boolean> = {}
    PERMISSOES_BASICAS.forEach(p => modPerms[p.key] = value)
    if (modoAvancado) {
      PERMISSOES_AVANCADAS.forEach(p => modPerms[p.key] = value)
    }

    setMatriz(prev => ({
      ...prev,
      [modulo]: {
        ...(prev[modulo] || {}),
        ...modPerms
      }
    }))
  }

  const handleLiberarTodas = () => {
    if (!confirm("Atenção: Você está prestes a LIBERAR acesso total a todos os módulos para este grupo. Deseja continuar?")) return
    
    const novaMatriz: Record<string, Record<string, boolean>> = {}
    MODULOS.forEach(modulo => {
      novaMatriz[modulo] = {}
      PERMISSOES_BASICAS.forEach(p => novaMatriz[modulo][p.key] = true)
      PERMISSOES_AVANCADAS.forEach(p => novaMatriz[modulo][p.key] = true)
    })
    setMatriz(novaMatriz)
    toast({ title: "Todas as permissões foram liberadas localmente." })
  }

  const handleBloquearTodas = () => {
    if (!confirm("Atenção: Você está prestes a BLOQUEAR acesso total a todos os módulos. Deseja continuar?")) return
    setMatriz({})
    toast({ title: "Todas as permissões foram bloqueadas localmente." })
  }

  const handleSave = async () => {
    if (!activeProfile?.empresaId || !db || !grupoId) return toast({ variant: "destructive", title: "Sessão inválida" })

    const dataToValidate = {
      empresa_id: activeProfile.empresaId,
      grupo_id: grupoId,
      matriz: matriz
    }

    const validation = permissoesSchema.safeParse(dataToValidate)
    
    if (!validation.success) {
      return toast({ variant: "destructive", title: "Erro de Validação", description: validation.error.errors[0].message })
    }

    setIsSaving(true)
    try {
      const docRef = doc(db, "permissoes_grupo", grupoId)
      const dataToSave = {
        ...validation.data,
        atualizado_em: serverTimestamp(),
        atualizado_por: activeProfile.id,
        criado_em: permData ? undefined : serverTimestamp()
      }

      await setDoc(docRef, dataToSave, { merge: true })

      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "UPDATE",
        modulo: "Permissões de Grupo",
        registro_id: grupoId,
        detalhes: `Permissões alteradas para o grupo ${grupoData?.nome || grupoId}`,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Permissões atualizadas com sucesso!" })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique sua conexão." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <ConfigPageHeader 
        title={`Permissões: ${grupoData?.nome || "Carregando..."}`} 
        description="Controle de forma granular o que os usuários deste grupo podem ver, criar, editar ou excluir no sistema."
        breadcrumb={[
          { label: "Configurações", href: "/configuracoes" }, 
          { label: "Grupos", href: "/configuracoes/grupos-usuarios" }, 
          { label: "Permissões" }
        ]}
      />

      {/* PAINEL DE CONTROLE RÁPIDO */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleLiberarTodas}>
            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Liberar todas
          </Button>
          <Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={handleBloquearTodas}>
            <XCircle className="h-4 w-4 mr-2 text-rose-600" /> Bloquear todas
          </Button>
          <Button variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-not-allowed opacity-70" disabled>
            <Sparkles className="h-4 w-4 mr-2" /> Permissões com IA
          </Button>
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border rounded-lg">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Label className="cursor-pointer" htmlFor="modo_avancado">Modo Avançado</Label>
          <Switch 
            id="modo_avancado" 
            checked={modoAvancado} 
            onCheckedChange={setModoAvancado} 
          />
        </div>
      </div>

      {grupoData?.is_admin && (
        <div className="bg-amber-50 text-amber-900 border border-amber-200 p-4 rounded-lg flex gap-3">
          <Shield className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm">
            <strong>Atenção:</strong> Este grupo possui a flag de <strong>ROOT Admin</strong>. A matriz de permissões abaixo será <strong>ignorada</strong> pelo sistema, e os usuários deste grupo terão acesso irrestrito a todos os recursos.
          </p>
        </div>
      )}

      {/* GRID DE MÓDULOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MODULOS.map(modulo => {
          const modState = matriz[modulo] || {}
          
          // Verifica se todas as permissoes visiveis estao marcadas
          const permissoesVisiveis = [...PERMISSOES_BASICAS, ...(modoAvancado ? PERMISSOES_AVANCADAS : [])]
          const isAllChecked = permissoesVisiveis.length > 0 && permissoesVisiveis.every(p => modState[p.key] === true)
          const isSomeChecked = permissoesVisiveis.some(p => modState[p.key] === true)

          return (
            <div key={modulo} className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
              {/* HEADER DO CARD DO MÓDULO */}
              <div className="bg-slate-50 border-b px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">{modulo}</h3>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground cursor-pointer">Tudo</Label>
                  <Checkbox 
                    checked={isAllChecked ? true : isSomeChecked ? "indeterminate" : false}
                    onCheckedChange={(v) => handleToggleModuloInteiro(modulo, v === true)}
                  />
                </div>
              </div>

              {/* LISTA DE PERMISSÕES BÁSICAS */}
              <div className="p-4 space-y-3 flex-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Básicas</h4>
                {PERMISSOES_BASICAS.map(perm => (
                  <Label key={perm.key} className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded">
                    <span className="text-sm font-medium text-slate-700">{perm.label}</span>
                    <Checkbox 
                      checked={!!modState[perm.key]} 
                      onCheckedChange={(v) => handleTogglePermissao(modulo, perm.key, !!v)} 
                    />
                  </Label>
                ))}

                {/* LISTA DE PERMISSÕES AVANÇADAS */}
                {modoAvancado && (
                  <div className="pt-4 mt-4 border-t border-dashed">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Avançadas</h4>
                    {PERMISSOES_AVANCADAS.map(perm => (
                      <Label key={perm.key} className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded">
                        <span className="text-sm font-normal text-slate-600">{perm.label}</span>
                        <Checkbox 
                          checked={!!modState[perm.key]} 
                          onCheckedChange={(v) => handleTogglePermissao(modulo, perm.key, !!v)} 
                        />
                      </Label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ACTIONS FOOTER */}
      <div className="sticky bottom-4 bg-white/80 backdrop-blur border p-4 rounded-xl shadow-lg mt-8 z-10 flex justify-end">
        <ConfigFormActions 
          isSaving={isSaving} 
          onSave={handleSave} 
          onCancel={() => {
            if(confirm("Descartar alterações?")) {
              router.push("/configuracoes/grupos-usuarios")
            }
          }} 
        />
      </div>

    </div>
  )
}
