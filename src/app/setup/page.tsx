"use client"

import { useState, useEffect } from "react"
import { useAuth, useFirestore } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Database, CheckCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SetupPage() {
  const auth = useAuth()
  const db = useFirestore()
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [logs, setLogs] = useState<string[]>([])
  const [userUid, setUserUid] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserUid(user?.uid || null)
    })
    return () => unsubscribe()
  }, [auth])

  const addLog = (msg: string) => setLogs(prev => [...prev, msg])

  const handleSetup = async () => {
    if (!userUid) {
      addLog("Erro: Nenhum usuário logado. Por favor, faça login primeiro.")
      return
    }

    setStatus("loading")
    setLogs([])
    addLog(`Iniciando configuração para o UID: ${userUid}...`)

    try {
      // 1. Criar perfil em /vendedores/ (Permitido pelas regras: isOwner)
      addLog("Criando perfil base de vendedor...")
      const vendedorRef = doc(db, "vendedores", userUid)
      await setDoc(vendedorRef, {
        nome: auth.currentUser?.email || "Admin Master",
        email: auth.currentUser?.email,
        role: "admin",
        ativo: true,
        createdAt: serverTimestamp()
      }, { merge: true })
      addLog("✅ Perfil de vendedor criado com sucesso!")

      // 2. Tentar criar perfil em /roles_admin/
      addLog("Tentando criar permissão de administrador...")
      try {
        const adminRef = doc(db, "roles_admin", userUid)
        await setDoc(adminRef, {
          email: auth.currentUser?.email,
          grantedAt: serverTimestamp()
        }, { merge: true })
        addLog("✅ Permissão de Administrador concedida!")
      } catch (err: any) {
        if (err.code === "permission-denied") {
          addLog("⚠️ Aviso: As regras do Firestore bloquearam a criação automática do cargo de Administrador.")
          addLog("Dica: Você já tem permissão base de equipe (vendedor), o que já libera a maior parte do sistema.")
        } else {
          throw err
        }
      }

      // 3. Criar documento base de empresa
      addLog("Criando configurações da empresa...")
      try {
        const empresaRef = doc(db, "empresa", "config_padrao")
        await setDoc(empresaRef, {
          nome: "CRManager",
          setupConcluido: true,
          createdAt: serverTimestamp()
        }, { merge: true })
        addLog("✅ Empresa inicializada com sucesso!")
      } catch (err: any) {
        if (err.code === "permission-denied") {
          addLog("⚠️ Aviso: Criação de empresa bloqueada (necessita permissão de Admin).")
        } else {
          throw err
        }
      }

      setStatus("success")
      addLog("🎉 Setup finalizado! Agora você pode acessar o sistema.")
    } catch (error: any) {
      console.error(error)
      setStatus("error")
      addLog(`❌ Erro crítico: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Database className="h-6 w-6" />
            </div>
          </div>
          <CardTitle>Inicialização do Banco de Dados</CardTitle>
          <CardDescription>
            Cria os documentos necessários para você ter acesso ao sistema usando suas credenciais atuais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!userUid ? (
            <div className="bg-amber-50 text-amber-600 p-4 rounded-md flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              Você precisa estar logado na tela de login normal primeiro.
            </div>
          ) : (
            <div className="bg-blue-50 text-blue-600 p-4 rounded-md text-sm">
              <p>Usuário Logado: <strong>{auth.currentUser?.email}</strong></p>
              <p className="text-xs mt-1">UID: {userUid}</p>
            </div>
          )}

          <div className="bg-slate-900 text-slate-300 p-4 rounded-md min-h-[150px] text-xs font-mono whitespace-pre-wrap">
            {logs.length === 0 ? "Pronto para iniciar..." : logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>

          {status === "success" && (
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-md flex items-center justify-between text-sm font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Processo finalizado.
              </div>
              <Button size="sm" onClick={() => router.push("/selecionar-perfil")}>
                Prosseguir
              </Button>
            </div>
          )}

          <Button 
            className="w-full" 
            onClick={handleSetup} 
            disabled={!userUid || status === "loading"}
          >
            {status === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status === "loading" ? "Configurando..." : "Iniciar Setup do Banco"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
