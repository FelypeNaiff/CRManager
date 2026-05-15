"use client"

import { useEffect, useState } from "react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore"
import { useProfile } from "@/lib/contexts/profile-context"
import { configuracoesPDVSchema } from "@/types/configuracoes"
import { toast } from "@/hooks/use-toast"
import { Store, CreditCard, ShoppingCart, Printer, ShieldCheck } from "lucide-react"

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
  observacoes_faturas: "",
  emitir_nfce: "DESABILITADO",
  sempre_indicar_vendedor: false,
  sempre_indicar_cliente: false,
  adicionar_produto_automaticamente: true,
  exibir_fotos_carrinho: true,
  usar_balanca: "NAO_UTILIZAR",
  habilitar_pix: true,
  texto_final_impressao: "",
  politica_troca: "",
  permitir_venda_sem_estoque: false,
  exigir_caixa_aberto: true,
  permitir_desconto: true,
  limite_maximo_desconto: 10,
  permitir_venda_cliente_nao_identificado: true,
  impressora_padrao: "NAO_DEFINIDA",
  tamanho_cupom: "80mm",
  exibir_logo_cupom: true,
  exibir_endereco_cupom: true,
  exibir_telefone_cupom: true,
  exibir_vendedor_cupom: true,
  exibir_cliente_cupom: true,
}

export default function PdvConfigPage() {
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()
  const { activeProfile } = useProfile()

  const configRef = useMemoFirebase(() => {
    return db && activeProfile?.empresaId ? doc(db, "configuracoes_pdv", activeProfile.empresaId) : null
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

    const validation = configuracoesPDVSchema.safeParse(dataToValidate)
    
    if (!validation.success) {
      const firstError = validation.error.errors[0]
      toast({ variant: "destructive", title: "Erro de Validação", description: firstError.message })
      return
    }

    setIsSaving(true)
    try {
      const docRef = doc(db, "configuracoes_pdv", activeProfile.empresaId)
      const dataToSave = {
        ...validation.data,
        atualizado_em: serverTimestamp(),
        criado_em: configData ? undefined : serverTimestamp()
      }

      await setDoc(docRef, dataToSave, { merge: true })

      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "UPDATE",
        modulo: "Configurações de PDV",
        registro_id: activeProfile.empresaId,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Configurações do PDV atualizadas!" })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique sua conexão." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <ConfigPageHeader 
        title="PDV / Vendas de Balcão" 
        description="Configure o comportamento da sua frente de caixa, impressões térmicas e regras operacionais de venda."
        breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "PDV" }]}
      />

      {/* 1. FINANCEIRO */}
      <ConfigCardSection title="Financeiro" icon={CreditCard}>
        <ConfigTextareaField 
          label="Observações nas faturas (Contas a receber do PDV)"
          id="obs_faturas"
          placeholder="Texto padrão para as faturas geradas nas vendas a prazo pelo PDV..."
          value={form.observacoes_faturas}
          onChange={e => handleUpdateField("observacoes_faturas", e.target.value)}
        />
      </ConfigCardSection>

      {/* 2. VENDAS BALCÃO */}
      <ConfigCardSection title="Comportamento da Venda" icon={ShoppingCart}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ConfigSelectField 
            label="Emitir NFC-e" 
            value={form.emitir_nfce} 
            onValueChange={v => handleUpdateField("emitir_nfce", v)}
            options={[
              { label: "Desabilitado", value: "DESABILITADO" },
              { label: "Habilitado: Confirmar antes de emitir", value: "CONFIRMAR" },
              { label: "Habilitado: Emitir automaticamente", value: "AUTOMATICO" }
            ]} 
          />
          
          <ConfigSelectField 
            label="Balança do PDV" 
            value={form.usar_balanca} 
            onValueChange={v => handleUpdateField("usar_balanca", v)}
            options={[
              { label: "Não utilizar balança", value: "NAO_UTILIZAR" },
              { label: "Utilizar balança conectada", value: "UTILIZAR" }
            ]} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <ConfigSwitchField 
            label="Sempre indicar vendedor"
            description={form.sempre_indicar_vendedor ? "Obrigatório" : "Opcional"}
            checked={form.sempre_indicar_vendedor}
            onCheckedChange={v => handleUpdateField("sempre_indicar_vendedor", v)}
          />
          <ConfigSwitchField 
            label="Sempre indicar cliente"
            description={form.sempre_indicar_cliente ? "Obrigatório" : "Opcional"}
            checked={form.sempre_indicar_cliente}
            onCheckedChange={v => handleUpdateField("sempre_indicar_cliente", v)}
          />
          <ConfigSwitchField 
            label="Adicionar produto automaticamente"
            description={form.adicionar_produto_automaticamente ? "Ao bipar ou selecionar, vai direto pro carrinho" : "Requer confirmação"}
            checked={form.adicionar_produto_automaticamente}
            onCheckedChange={v => handleUpdateField("adicionar_produto_automaticamente", v)}
          />
          <ConfigSwitchField 
            label="Exibir fotos no carrinho"
            description={form.exibir_fotos_carrinho ? "Mostrar" : "Ocultar para mais performance"}
            checked={form.exibir_fotos_carrinho}
            onCheckedChange={v => handleUpdateField("exibir_fotos_carrinho", v)}
          />
          <ConfigSwitchField 
            label="Habilitar Pix no PDV"
            description={form.habilitar_pix ? "Mostrar opção de pagamento em PIX" : "Ocultar PIX"}
            checked={form.habilitar_pix}
            onCheckedChange={v => handleUpdateField("habilitar_pix", v)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConfigTextareaField 
            label="Texto no final da impressão (Rodapé do Cupom)"
            id="texto_cupom"
            placeholder="Agradecemos a preferência! Volte sempre."
            value={form.texto_final_impressao}
            onChange={e => handleUpdateField("texto_final_impressao", e.target.value)}
          />
          <ConfigTextareaField 
            label="Política de troca"
            id="politica_troca"
            placeholder="Trocas apenas com etiqueta num prazo de 30 dias..."
            value={form.politica_troca}
            onChange={e => handleUpdateField("politica_troca", e.target.value)}
          />
        </div>
      </ConfigCardSection>

      {/* 3. REGRAS OPERACIONAIS */}
      <ConfigCardSection title="Regras Operacionais" icon={ShieldCheck}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ConfigSwitchField 
            label="Permitir venda sem estoque"
            description={form.permitir_venda_sem_estoque ? "Caixa pode gerar estoque negativo" : "Bloqueia venda se não houver saldo"}
            checked={form.permitir_venda_sem_estoque}
            onCheckedChange={v => handleUpdateField("permitir_venda_sem_estoque", v)}
          />
          <ConfigSwitchField 
            label="Exigir caixa aberto para vender"
            description={form.exigir_caixa_aberto ? "Obrigatório ter turno aberto" : "Permite vender avulso"}
            checked={form.exigir_caixa_aberto}
            onCheckedChange={v => handleUpdateField("exigir_caixa_aberto", v)}
          />
          <ConfigSwitchField 
            label="Permitir venda cliente não identificado"
            description={form.permitir_venda_cliente_nao_identificado ? "Venda para 'Consumidor Final'" : "Obriga cadastro do cliente"}
            checked={form.permitir_venda_cliente_nao_identificado}
            onCheckedChange={v => handleUpdateField("permitir_venda_cliente_nao_identificado", v)}
          />
          <ConfigSwitchField 
            label="Permitir desconto no PDV"
            description={form.permitir_desconto ? "Caixa pode dar desconto" : "Bloqueado"}
            checked={form.permitir_desconto}
            onCheckedChange={v => handleUpdateField("permitir_desconto", v)}
          />
        </div>

        {form.permitir_desconto && (
          <div className="w-full md:w-1/2">
            <ConfigInputField 
              label="Limite máximo de desconto (%)" 
              id="limite_desc" 
              type="number"
              min={0}
              max={100}
              value={form.limite_maximo_desconto}
              onChange={e => handleUpdateField("limite_maximo_desconto", parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
      </ConfigCardSection>

      {/* 4. IMPRESSÃO */}
      <ConfigCardSection title="Impressão Térmica" icon={Printer}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ConfigSelectField 
            label="Impressora padrão do navegador" 
            value={form.impressora_padrao} 
            onValueChange={v => handleUpdateField("impressora_padrao", v)}
            options={[
              { label: "Sempre perguntar (Janela do sistema)", value: "NAO_DEFINIDA" },
              { label: "Impressão Direta / Silenciosa (Requer utilitário)", value: "DIRETA" }
            ]} 
          />
          <ConfigSelectField 
            label="Tamanho do cupom" 
            value={form.tamanho_cupom} 
            onValueChange={v => handleUpdateField("tamanho_cupom", v)}
            options={[
              { label: "80mm (Padrão)", value: "80mm" },
              { label: "58mm (Pequena)", value: "58mm" }
            ]} 
          />
        </div>

        <h4 className="text-sm font-semibold text-slate-800 mb-4 border-b pb-2">O que exibir no cupom não fiscal?</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConfigSwitchField 
            label="Exibir logo da empresa"
            checked={form.exibir_logo_cupom}
            onCheckedChange={v => handleUpdateField("exibir_logo_cupom", v)}
          />
          <ConfigSwitchField 
            label="Exibir endereço"
            checked={form.exibir_endereco_cupom}
            onCheckedChange={v => handleUpdateField("exibir_endereco_cupom", v)}
          />
          <ConfigSwitchField 
            label="Exibir telefone"
            checked={form.exibir_telefone_cupom}
            onCheckedChange={v => handleUpdateField("exibir_telefone_cupom", v)}
          />
          <ConfigSwitchField 
            label="Exibir vendedor"
            checked={form.exibir_vendedor_cupom}
            onCheckedChange={v => handleUpdateField("exibir_vendedor_cupom", v)}
          />
          <ConfigSwitchField 
            label="Exibir cliente"
            checked={form.exibir_cliente_cupom}
            onCheckedChange={v => handleUpdateField("exibir_cliente_cupom", v)}
          />
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
