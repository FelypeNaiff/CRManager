"use client"

import { useEffect, useState } from "react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore"
import { useProfile } from "@/lib/contexts/profile-context"
import { configuracoesFiscalSchema } from "@/types/configuracoes"
import { toast } from "@/hooks/use-toast"
import { FileBox, Receipt, Calculator, AlertTriangle } from "lucide-react"

import { 
  ConfigPageHeader, 
  ConfigCardSection, 
  ConfigFormActions, 
  ConfigInputField, 
  ConfigSelectField, 
  ConfigSwitchField,
  ConfigTextareaField
} from "@/components/configuracoes/config-ui"

const emptyForm = {
  ultima_nfe: 0,
  serie_nfe: 1,
  ambiente_nfe: "HOMOLOGACAO",
  versao_nfe: "4.00",
  info_complementar_nfe: "",
  exibir_danfe_simplificado: false,
  
  ultima_nfce: 0,
  serie_nfce: 1,
  ambiente_nfce: "HOMOLOGACAO",
  versao_nfce: "4.00",
  info_complementar_nfce: "",
  token_nfce: "",
  csc_nfce: "",

  subtrair_icms_pis_cofins: false,
}

export default function FiscalConfigPage() {
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()
  const { activeProfile } = useProfile()

  const configRef = useMemoFirebase(() => {
    return db && activeProfile?.empresaId ? doc(db, "configuracoes_fiscal", activeProfile.empresaId) : null
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

  const handleSave = async () => {
    if (!activeProfile?.empresaId || !db) return toast({ variant: "destructive", title: "Sessão inválida" })

    const dataToValidate = {
      ...form,
      empresa_id: activeProfile.empresaId,
      atualizado_por: activeProfile.id
    }

    const validation = configuracoesFiscalSchema.safeParse(dataToValidate)
    
    if (!validation.success) {
      const firstError = validation.error.errors[0]
      toast({ variant: "destructive", title: "Erro de Validação", description: firstError.message })
      return
    }

    setIsSaving(true)
    try {
      const docRef = doc(db, "configuracoes_fiscal", activeProfile.empresaId)
      const dataToSave = {
        ...validation.data,
        atualizado_em: serverTimestamp(),
        criado_em: configData ? undefined : serverTimestamp()
      }

      await setDoc(docRef, dataToSave, { merge: true })

      // O payload do log intencionalmente omite dados sensíveis (token e csc) não fazendo dump do form.
      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "UPDATE",
        modulo: "Configurações Fiscais",
        registro_id: activeProfile.empresaId,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Configurações fiscais atualizadas!" })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique sua conexão." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <ConfigPageHeader 
        title="Configurações Fiscais" 
        description="Parâmetros de emissão de notas (NF-e, NFC-e) e regras de bases de cálculo."
        breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Fiscal" }]}
      />

      {/* 1. NF-e */}
      <ConfigCardSection title="Nota Fiscal Eletrônica (NF-e)" icon={FileBox}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <ConfigInputField 
            label="Última NF-e" 
            id="ult_nfe" 
            type="number" 
            min={0}
            value={form.ultima_nfe} 
            onChange={e => handleUpdateField("ultima_nfe", parseInt(e.target.value) || 0)} 
          />
          <ConfigInputField 
            label="Série NF-e" 
            id="serie_nfe" 
            type="number" 
            min={1}
            value={form.serie_nfe} 
            onChange={e => handleUpdateField("serie_nfe", parseInt(e.target.value) || 1)} 
          />
          <ConfigSelectField 
            label="Ambiente" 
            value={form.ambiente_nfe} 
            onValueChange={v => handleUpdateField("ambiente_nfe", v)}
            options={[
              { label: "Homologação (Testes)", value: "HOMOLOGACAO" },
              { label: "Produção (Oficial)", value: "PRODUCAO" }
            ]} 
          />
          <ConfigSelectField 
            label="Versão da NF-e" 
            value={form.versao_nfe} 
            onValueChange={v => handleUpdateField("versao_nfe", v)}
            options={[
              { label: "4.00", value: "4.00" }
            ]} 
          />
        </div>
        
        <div className="space-y-6">
          <ConfigTextareaField 
            label="Informações complementares padrão"
            id="info_nfe"
            placeholder="Texto automático no rodapé da NF-e (ex: Documento emitido por ME ou EPP...)"
            value={form.info_complementar_nfe}
            onChange={e => handleUpdateField("info_complementar_nfe", e.target.value)}
          />

          <ConfigSwitchField 
            label="Exibir DANFE simplificado na listagem"
            description={form.exibir_danfe_simplificado ? "Abre etiqueta/DANFE simplificado ao invés da versão A4" : "Abre a DANFE completa tamanho A4"}
            checked={form.exibir_danfe_simplificado}
            onCheckedChange={v => handleUpdateField("exibir_danfe_simplificado", v)}
          />
        </div>
      </ConfigCardSection>

      {/* 2. NFC-e */}
      <ConfigCardSection title="Nota Fiscal de Consumidor (NFC-e)" icon={Receipt}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <ConfigInputField 
            label="Última NFC-e" 
            id="ult_nfce" 
            type="number" 
            min={0}
            value={form.ultima_nfce} 
            onChange={e => handleUpdateField("ultima_nfce", parseInt(e.target.value) || 0)} 
          />
          <ConfigInputField 
            label="Série NFC-e" 
            id="serie_nfce" 
            type="number" 
            min={1}
            value={form.serie_nfce} 
            onChange={e => handleUpdateField("serie_nfce", parseInt(e.target.value) || 1)} 
          />
          <ConfigSelectField 
            label="Ambiente" 
            value={form.ambiente_nfce} 
            onValueChange={v => handleUpdateField("ambiente_nfce", v)}
            options={[
              { label: "Homologação (Testes)", value: "HOMOLOGACAO" },
              { label: "Produção (Oficial)", value: "PRODUCAO" }
            ]} 
          />
          <ConfigSelectField 
            label="Versão da NFC-e" 
            value={form.versao_nfce} 
            onValueChange={v => handleUpdateField("versao_nfce", v)}
            options={[
              { label: "4.00", value: "4.00" }
            ]} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ConfigInputField 
            label="ID Token (CSC)" 
            id="token_nfce" 
            type="password"
            placeholder="Ex: 000001"
            value={form.token_nfce} 
            onChange={e => handleUpdateField("token_nfce", e.target.value)} 
          />
          <ConfigInputField 
            label="Código CSC" 
            id="csc_nfce" 
            type="password"
            placeholder="Código de Segurança do Contribuinte..."
            value={form.csc_nfce} 
            onChange={e => handleUpdateField("csc_nfce", e.target.value)} 
          />
        </div>

        <ConfigTextareaField 
          label="Informações complementares padrão"
          id="info_nfce"
          placeholder="Texto automático no rodapé do cupom fiscal..."
          value={form.info_complementar_nfce}
          onChange={e => handleUpdateField("info_complementar_nfce", e.target.value)}
        />
      </ConfigCardSection>

      {/* 3. BASE DE CÁLCULO PIS/COFINS */}
      <ConfigCardSection title="Base de Cálculo PIS/COFINS" icon={Calculator}>
        <div className="bg-blue-50 text-blue-800 p-4 rounded-md border border-blue-200 text-sm flex items-start gap-3 mb-6">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
          <p>
            Decisão do STF (Tema 69): O ICMS não compõe a base de cálculo para a incidência do PIS e da COFINS. 
            Habilite a chave abaixo para realizar a exclusão automática nas suas emissões.
          </p>
        </div>

        <ConfigSwitchField 
          label="Subtrair valor do ICMS da base de cálculo do PIS e COFINS"
          description={form.subtrair_icms_pis_cofins ? "Sim, realizar a subtração do ICMS." : "Não realizar a subtração."}
          checked={form.subtrair_icms_pis_cofins}
          onCheckedChange={v => handleUpdateField("subtrair_icms_pis_cofins", v)}
        />
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
