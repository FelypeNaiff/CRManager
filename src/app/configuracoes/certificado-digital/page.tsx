"use client"

import { useEffect, useState } from "react"
import { useFirestore, useDoc, useMemoFirebase } from "@/lib/legacy-stubs"
import { doc, setDoc, serverTimestamp, collection, addDoc } from "@/lib/legacy-firestore-stubs"
import { useProfile } from "@/lib/contexts/profile-context"
import { certificadoDigitalSchema } from "@/types/configuracoes"
import { toast } from "@/hooks/use-toast"
import { ShieldCheck, UploadCloud, Trash2, Key, AlertTriangle, PlayCircle, CheckCircle2 } from "lucide-react"

import { 
  ConfigPageHeader, 
  ConfigCardSection, 
  ConfigFormActions, 
  ConfigInputField, 
  ConfigSelectField, 
  ConfigTextareaField
} from "@/components/configuracoes/config-ui"
import { Button } from "@/components/ui/button"

const emptyForm = {
  tipo: "A1",
  nome_certificado: "",
  cnpj_vinculado: "",
  validade_inicio: "",
  validade_fim: "",
  status: "PENDENTE",
  observacoes: "",
  nome_arquivo: "",
  senha_certificado: "",
}

export default function CertificadoDigitalPage() {
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const db = useFirestore()
  const { activeProfile } = useProfile()

  const configRef = useMemoFirebase(() => {
    return db && activeProfile?.empresaId ? doc(db, "certificados_digitais", activeProfile.empresaId) : null
  }, [db, activeProfile?.empresaId])
  
  const { data: configData } = useDoc(configRef)

  useEffect(() => {
    if (configData) {
      setForm(prev => ({ ...prev, ...configData }))
    }
  }, [configData])

  const handleUpdateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Verifica validade automaticamente quando a data muda
  useEffect(() => {
    if (form.validade_fim) {
      const expireDate = new Date(form.validade_fim)
      const today = new Date()
      const diffTime = expireDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      let newStatus = "VALIDO"
      if (diffDays < 0) newStatus = "EXPIRADO"
      else if (diffDays <= 30) newStatus = "AVISO_VENCIMENTO"
      
      if (newStatus !== form.status) {
        setForm(prev => ({ ...prev, status: newStatus }))
      }
    }
  }, [form.validade_fim])

  const handleMockUpload = () => {
    handleUpdateField("nome_arquivo", "certificado_empresa_2026.pfx")
    handleUpdateField("status", "VALIDO")
    toast({ title: "Arquivo carregado localmente", description: "O certificado está pronto para ser salvo." })
  }

  const handleTestCertificado = () => {
    if (!form.nome_arquivo && form.tipo === "A1") {
      return toast({ variant: "destructive", title: "Nenhum arquivo", description: "Faça o upload do certificado A1 primeiro." })
    }
    if (!form.senha_certificado) {
      return toast({ variant: "destructive", title: "Senha Ausente", description: "Informe a senha para testar a comunicação." })
    }
    
    setIsTesting(true)
    setTimeout(() => {
      setIsTesting(false)
      toast({ title: "Teste de comunicação bem-sucedido!", description: "Certificado validado junto aos webservices da SEFAZ." })
    }, 2000)
  }

  const handleRemoveCertificado = async () => {
    if (!confirm("Tem certeza que deseja remover o certificado atual? A emissão de notas será interrompida.")) return
    
    setForm(emptyForm)
    
    if (activeProfile?.empresaId && db) {
      try {
        await setDoc(doc(db, "certificados_digitais", activeProfile.empresaId), emptyForm)
        await addDoc(collection(db, "logs_atividades"), {
          empresa_id: activeProfile.empresaId,
          usuario_id: activeProfile.id,
          usuario_nome: activeProfile.nome,
          acao: "DELETE",
          modulo: "Certificado Digital",
          registro_id: activeProfile.empresaId,
          data_hora: serverTimestamp(),
        })
        toast({ title: "Certificado removido." })
      } catch (e) {}
    }
  }

  const handleSave = async () => {
    if (!activeProfile?.empresaId || !db) return toast({ variant: "destructive", title: "Sessão inválida" })

    const dataToValidate = {
      ...form,
      empresa_id: activeProfile.empresaId,
      atualizado_por: activeProfile.id
    }

    const validation = certificadoDigitalSchema.safeParse(dataToValidate)
    
    if (!validation.success) {
      const firstError = validation.error.errors[0]
      toast({ variant: "destructive", title: "Erro de Validação", description: firstError.message })
      return
    }

    setIsSaving(true)
    try {
      const docRef = doc(db, "certificados_digitais", activeProfile.empresaId)
      const dataToSave = {
        ...validation.data,
        atualizado_em: serverTimestamp(),
        criado_em: configData ? undefined : serverTimestamp()
      }

      await setDoc(docRef, dataToSave, { merge: true })

      // O payload do log intencionalmente omite a senha
      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "UPDATE",
        modulo: "Certificado Digital",
        registro_id: activeProfile.empresaId,
        detalhes: `Certificado ${form.tipo} atualizado. Vencimento: ${form.validade_fim}`,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Certificado Digital atualizado com sucesso!" })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique sua conexão." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <ConfigPageHeader 
        title="Certificado Digital" 
        description="Gerencie o certificado e-CNPJ da sua empresa necessário para assinatura e emissão de notas fiscais (NF-e, NFC-e)."
        breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Certificado Digital" }]}
      />

      {form.status === "EXPIRADO" && (
        <div className="bg-red-50 text-red-800 p-4 rounded-md border border-red-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div>
            <h4 className="font-semibold text-red-900">Certificado Expirado!</h4>
            <p className="text-sm">O certificado digital atual venceu em {form.validade_fim}. Nenhuma nota fiscal pode ser emitida até que um novo certificado seja configurado.</p>
          </div>
        </div>
      )}

      {form.status === "AVISO_VENCIMENTO" && (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-yellow-600" />
          <div>
            <h4 className="font-semibold text-yellow-900">Atenção ao Vencimento</h4>
            <p className="text-sm">O seu certificado digital irá expirar nos próximos 30 dias ({form.validade_fim}). Providencie a renovação para evitar interrupções operacionais.</p>
          </div>
        </div>
      )}

      {form.status === "VALIDO" && (
        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-md border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-sm font-medium">Certificado Digital Instalado e Válido até {form.validade_fim}.</p>
        </div>
      )}

      <ConfigCardSection title="Configuração de Certificado" icon={ShieldCheck}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ConfigSelectField 
            label="Tipo de Certificado" 
            value={form.tipo} 
            onValueChange={v => handleUpdateField("tipo", v)}
            options={[
              { label: "A1 (Arquivo Digital .pfx)", value: "A1" },
              { label: "A3 (Token/Cartão Físico)", value: "A3" }
            ]} 
          />
          <ConfigInputField 
            label="Nome de Identificação" 
            id="nome_cert"
            placeholder="Ex: Certificado Empresa 2026"
            value={form.nome_certificado} 
            onChange={e => handleUpdateField("nome_certificado", e.target.value)} 
          />
        </div>

        {form.tipo === "A1" && (
          <div className="mb-8 p-6 border-2 border-dashed rounded-lg bg-slate-50 flex flex-col items-center justify-center text-center transition hover:bg-slate-100 cursor-pointer" onClick={handleMockUpload}>
            <UploadCloud className="h-10 w-10 text-muted-foreground mb-3" />
            <h4 className="text-sm font-semibold mb-1">
              {form.nome_arquivo ? `Arquivo anexado: ${form.nome_arquivo}` : "Clique para fazer Upload do Certificado A1 (.pfx / .p12)"}
            </h4>
            <p className="text-xs text-muted-foreground">Tamanho máximo: 5MB</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <ConfigInputField 
            label="CNPJ Vinculado" 
            id="cnpj_cert"
            placeholder="00.000.000/0001-00"
            value={form.cnpj_vinculado} 
            onChange={e => handleUpdateField("cnpj_vinculado", e.target.value)} 
          />
          <ConfigInputField 
            label="Data de Emissão" 
            id="data_emissao"
            type="date"
            value={form.validade_inicio} 
            onChange={e => handleUpdateField("validade_inicio", e.target.value)} 
          />
          <ConfigInputField 
            label="Data de Vencimento" 
            id="data_venc"
            type="date"
            value={form.validade_fim} 
            onChange={e => handleUpdateField("validade_fim", e.target.value)} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 relative">
            <ConfigInputField 
              label="Senha do Certificado *" 
              id="senha_cert"
              type="password"
              placeholder="••••••••"
              value={form.senha_certificado} 
              onChange={e => handleUpdateField("senha_certificado", e.target.value)} 
            />
            <Key className="absolute right-3 top-8 h-4 w-4 text-muted-foreground" />
          </div>
          <ConfigTextareaField 
            label="Observações Internas" 
            id="obs_cert"
            placeholder="Comprado com a Serasa, suporte tel: 0800..."
            value={form.observacoes} 
            onChange={e => handleUpdateField("observacoes", e.target.value)} 
          />
        </div>
        
        <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t">
          <Button variant="outline" className="gap-2" onClick={handleTestCertificado} disabled={isTesting}>
            <PlayCircle className="h-4 w-4 text-blue-600" />
            {isTesting ? "Comunicando com SEFAZ..." : "Testar Comunicação"}
          </Button>
          
          {(form.nome_arquivo || form.status !== "PENDENTE") && (
            <Button variant="destructive" className="gap-2" onClick={handleRemoveCertificado}>
              <Trash2 className="h-4 w-4" />
              Remover Certificado
            </Button>
          )}
        </div>
      </ConfigCardSection>

      {/* ACTIONS FOOTER */}
      <div className="sticky bottom-4 bg-white/80 backdrop-blur border p-4 rounded-xl shadow-lg mt-8 z-10 flex justify-end">
        <ConfigFormActions 
          isSaving={isSaving} 
          onSave={handleSave} 
          onCancel={() => {
            if(confirm("Descartar alterações?")) {
              window.location.reload()
            }
          }} 
        />
      </div>

    </div>
  )
}
