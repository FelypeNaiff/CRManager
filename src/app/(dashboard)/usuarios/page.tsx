"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserCog, Plus, Shield, Loader2, AlertCircle, Trash2, ShieldCheck, Pencil } from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

export default function UsuariosPage() {
  const db = useFirestore()
  const [isAdding, setIsAdding] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  
  const [form, setForm] = useState({ uid: "", email: "", nome: "", role: "vendedor" })
  const [editingUid, setEditingUid] = useState<string | null>(null)

  const adminQuery = useMemoFirebase(() => db ? collection(db, "roles_admin") : null, [db])
  const vendQuery = useMemoFirebase(() => db ? collection(db, "vendedores") : null, [db])

  const { data: admins, isLoading: isLoadAdmin, error: errorAdmin } = useCollection(adminQuery)
  const { data: vendedores, isLoading: isLoadVend, error: errorVend } = useCollection(vendQuery)

  const isLoading = isLoadAdmin || isLoadVend
  const hasError = errorAdmin || errorVend

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.uid.trim() || !form.email.trim()) {
      toast({ variant: "destructive", title: "Preencha UID e E-mail" })
      return
    }

    setLoadingAction("add")
    try {
      // Cria perfil de vendedor (necessário para todos)
      await setDoc(doc(db, "vendedores", form.uid), {
        nome: form.nome || form.email.split("@")[0],
        email: form.email,
        role: form.role,
        ativo: true,
        createdAt: serverTimestamp()
      }, { merge: true })

      // Se for admin, adiciona em roles_admin
      if (form.role === "admin") {
        await setDoc(doc(db, "roles_admin", form.uid), {
          email: form.email,
          grantedAt: serverTimestamp()
        }, { merge: true })
      } else {
        // Remove de roles_admin caso esteja sendo rebaixado
        await deleteDoc(doc(db, "roles_admin", form.uid)).catch(() => {})
      }

      toast({ title: "Usuário atualizado com sucesso!" })
      setForm({ uid: "", email: "", nome: "", role: "vendedor" })
      setEditingUid(null)
      setIsAdding(false)
    } catch (err: any) {
      console.error(err)
      toast({ 
        variant: "destructive", 
        title: "Erro ao salvar", 
        description: err.message || "Apenas Administradores podem realizar esta ação." 
      })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleRemoveAdmin = async (uid: string) => {
    setLoadingAction(uid)
    try {
      await deleteDoc(doc(db, "roles_admin", uid))
      // Atualiza o role no vendedor
      await setDoc(doc(db, "vendedores", uid), { role: "vendedor" }, { merge: true })
      toast({ title: "Privilégios de administrador removidos." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao remover admin", description: err.message })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleEditClick = (vend: any) => {
    setForm({
      uid: vend.id,
      email: vend.email || "",
      nome: vend.nome || "",
      role: vend.role || "vendedor"
    })
    setEditingUid(vend.id)
    setIsAdding(true)
  }

  const handleCancelClick = () => {
    setForm({ uid: "", email: "", nome: "", role: "vendedor" })
    setEditingUid(null)
    setIsAdding(false)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center gap-2">
            <UserCog className="h-8 w-8 text-primary" /> Usuários e Permissões
          </h1>
          <p className="text-muted-foreground">Gerencie o acesso da sua equipe ao sistema.</p>
        </div>
        <Button onClick={handleCancelClick} variant={isAdding ? "outline" : "default"}>
          {isAdding ? "Cancelar" : <><Plus className="mr-2 h-4 w-4" /> Adicionar Usuário</>}
        </Button>
      </div>

      {hasError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm flex-1">
            <h3 className="font-semibold text-base">Acesso Negado</h3>
            <p>Você precisa ser um Administrador para visualizar e editar os usuários. Se você acabou de criar o banco, siga o passo a passo de liberação inicial do primeiro admin via Console do Firebase.</p>
          </div>
        </div>
      )}

      {isAdding && !hasError && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>{editingUid ? "Editar Permissões" : "Conceder Acesso"}</CardTitle>
            <CardDescription>
              {editingUid ? "Atualize os dados e o nível de acesso do membro da equipe." : "Para adicionar um membro da equipe, você precisa do UID gerado quando ele criar a conta na tela de Login."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>UID do Usuário (Firebase Auth) *</Label>
                <Input value={form.uid} onChange={e => setForm(p => ({...p, uid: e.target.value}))} placeholder="ex: aX1b...29C" required disabled={!!editingUid} />
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} type="email" placeholder="email@equipe.com" required />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={e => setForm(p => ({...p, nome: e.target.value}))} placeholder="Nome do membro" />
              </div>
              <div className="space-y-2">
                <Label>Nível de Acesso</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={form.role}
                  onChange={e => setForm(p => ({...p, role: e.target.value}))}
                >
                  <option value="vendedor">Equipe Base (Vendedor)</option>
                  <option value="admin">Administrador Total</option>
                </select>
              </div>
              <div className="sm:col-span-2 mt-2">
                <Button type="submit" disabled={loadingAction === "add"} className="w-full sm:w-auto">
                  {loadingAction === "add" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Permissões
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        </div>
      ) : !hasError && (
        <div className="grid gap-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Administradores do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid gap-4">
              {!admins?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum administrador encontrado.</p>
              ) : admins.map(admin => (
                <div key={admin.id} className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
                  <div>
                    <p className="font-semibold">{admin.email}</p>
                    <p className="text-xs text-muted-foreground font-mono">UID: {admin.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Admin</Badge>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive h-8 w-8"
                      onClick={() => handleRemoveAdmin(admin.id)}
                      disabled={loadingAction === admin.id}
                      title="Remover privilégios de Admin"
                    >
                      {loadingAction === admin.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" /> Equipe e Vendedores
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid gap-4">
              {!vendedores?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum vendedor encontrado.</p>
              ) : vendedores.map(vend => (
                <div key={vend.id} className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
                  <div>
                    <p className="font-semibold">{vend.nome} <span className="text-sm font-normal text-muted-foreground">({vend.email})</span></p>
                    <p className="text-xs text-muted-foreground font-mono">UID: {vend.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{vend.role || "Vendedor"}</Badge>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-primary h-8 w-8 hover:bg-primary/10"
                      onClick={() => handleEditClick(vend)}
                      title="Editar Permissões"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
