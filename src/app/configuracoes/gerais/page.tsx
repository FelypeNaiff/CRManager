"use client"

import { useEffect, useState } from "react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore"
import { useProfile } from "@/lib/contexts/profile-context"
import { configuracoesGeraisSchema } from "@/types/configuracoes"
import { toast } from "@/hooks/use-toast"
import { Settings, Settings2 } from "lucide-react"

import { 
  ConfigPageHeader, 
  ConfigCardSection, 
  ConfigFormActions, 
  ConfigSelectField, 
  ConfigSwitchField,
  ConfigInputField,
  ConfigTextareaField,
  ConfigTabs,
  ConfigTabsList,
  ConfigTabsTrigger,
  ConfigTabsContent
} from "@/components/configuracoes/config-ui"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Printer, ShoppingCart, FileText } from "lucide-react"

const emptyForm = {
  casas_decimais_valor: 2,
  casas_decimais_quantidade: 2,
  registros_por_pagina: 50,
  estoque_produto_composicao: false,
  permitir_venda_sem_estoque: false,
  vender_sem_condicao_pagamento: false,
  atualizar_custo_compras: true,
  permitir_acesso_suporte: true,
  numeracoes: {
    clientes: 0, fornecedores: 0, transportadoras: 0, orcamentos: 0,
    vendas: 0, ordens_servicos: 0, contrato: 0, locacao: 0,
    financeiro: 0, nfe: 0, nfce: 0, rps_nfse: 0,
    cotacao: 0, compra: 0, ajuste_estoque: 0, atendimento: 0,
    produtos: 0, contas_pagar: 0, contas_receber: 0, pdv: 0,
  },
  movimentacoes: {
    formato_pedido_a4: "PDF",
    tamanho_fonte_a4: "Normal",
    tamanho_fonte_cupom: "Normal",
    introducao_orcamento: "",
    observacoes_orcamento: "",
    exibir_orcamento: {
      coluna_item: true, coluna_codigo: true, coluna_unidade: true,
      coluna_valor_unitario: true, coluna_subtotal: true, coluna_ncm: false,
      descricao_produto: true, imagem_produto: false, descricao_servico: true, imagem_servico: false
    },
    observacoes_venda: "",
    exibir_venda: {
      coluna_item: true, coluna_codigo: true, coluna_unidade: true,
      coluna_valor_unitario: true, coluna_subtotal: true, coluna_ncm: false,
      descricao_produto: true, imagem_produto: false, descricao_servico: true, imagem_servico: false
    },
    habilitar_cupom_presente: false,
  }
}

const numeracaoFields = [
  { id: "clientes", label: "Clientes" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "transportadoras", label: "Transportadoras" },
  { id: "orcamentos", label: "Orçamentos" },
  { id: "vendas", label: "Vendas" },
  { id: "ordens_servicos", label: "Ordens de serviços" },
  { id: "contrato", label: "Contrato" },
  { id: "locacao", label: "Locação" },
  { id: "financeiro", label: "Financeiro" },
  { id: "nfe", label: "NF-e" },
  { id: "nfce", label: "NFC-e" },
  { id: "rps_nfse", label: "RPS (NFS-e)" },
  { id: "cotacao", label: "Cotação" },
  { id: "compra", label: "Compra" },
  { id: "ajuste_estoque", label: "Ajuste de estoque" },
  { id: "atendimento", label: "Atendimento" },
  { id: "produtos", label: "Produtos" },
  { id: "contas_pagar", label: "Contas a pagar" },
  { id: "contas_receber", label: "Contas a receber" },
  { id: "pdv", label: "PDV" },
]

export default function ConfiguracoesGeraisPage() {
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const db = useFirestore()
  const { activeProfile } = useProfile()

  const configRef = useMemoFirebase(() => {
    return db && activeProfile?.empresaId ? doc(db, "configuracoes_gerais", activeProfile.empresaId) : null
  }, [db, activeProfile?.empresaId])
  
  const { data: configData } = useDoc(configRef)

  useEffect(() => {
    if (configData) {
      setForm(prev => ({
        ...prev,
        ...configData,
        numeracoes: { ...prev.numeracoes, ...(configData.numeracoes || {}) },
        movimentacoes: {
          ...prev.movimentacoes,
          ...(configData.movimentacoes || {}),
          exibir_orcamento: { ...prev.movimentacoes?.exibir_orcamento, ...(configData.movimentacoes?.exibir_orcamento || {}) },
          exibir_venda: { ...prev.movimentacoes?.exibir_venda, ...(configData.movimentacoes?.exibir_venda || {}) }
        }
      }))
    }
  }, [configData])

  const handleUpdateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleUpdateNumeracao = (field: string, value: string) => {
    const val = Math.max(0, parseInt(value) || 0)
    setForm(prev => ({
      ...prev,
      numeracoes: { ...prev.numeracoes, [field]: val }
    }))
  }

  const handleUpdateMov = (field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      movimentacoes: { ...prev.movimentacoes, [field]: value }
    }))
  }

  const handleUpdateExibir = (tipo: "exibir_orcamento" | "exibir_venda", field: string, value: boolean) => {
    setForm(prev => ({
      ...prev,
      movimentacoes: {
        ...prev.movimentacoes,
        [tipo]: { ...prev.movimentacoes[tipo], [field]: value }
      }
    }))
  }

  const handleSave = async () => {
    if (!activeProfile?.empresaId || !db) return toast({ variant: "destructive", title: "Sessão inválida" })

    const dataToValidate = {
      ...form,
      empresa_id: activeProfile.empresaId,
      atualizado_por: activeProfile.id
    }

    const validation = configuracoesGeraisSchema.safeParse(dataToValidate)
    
    if (!validation.success) {
      const firstError = validation.error.errors[0]
      toast({ variant: "destructive", title: "Erro de Validação", description: firstError.message })
      return
    }

    setIsSaving(true)
    try {
      const docRef = doc(db, "configuracoes_gerais", activeProfile.empresaId)
      const dataToSave = {
        ...validation.data,
        atualizado_em: serverTimestamp(),
        // mock de criado em se nao houver dados
        criado_em: configData ? undefined : serverTimestamp()
      }

      await setDoc(docRef, dataToSave, { merge: true })

      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "UPDATE",
        modulo: "Configurações Gerais",
        registro_id: activeProfile.empresaId,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Configurações gerais atualizadas!" })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique sua conexão e tente novamente." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <ConfigPageHeader 
        title="Configurações Gerais" 
        description="Defina parâmetros globais de funcionamento para todo o sistema."
        breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Configurações Gerais" }]}
      />

      <ConfigTabs defaultValue="dados-gerais" className="w-full">
        <ConfigTabsList className="mb-4 flex flex-wrap h-auto bg-slate-100 p-1">
          <ConfigTabsTrigger value="dados-gerais">Dados Gerais</ConfigTabsTrigger>
          <ConfigTabsTrigger value="numeracoes">Numerações</ConfigTabsTrigger>
          <ConfigTabsTrigger value="movimentacoes">Movimentações</ConfigTabsTrigger>
          <ConfigTabsTrigger value="fiscal">Fiscal</ConfigTabsTrigger>
          <ConfigTabsTrigger value="notificacoes">Notificações</ConfigTabsTrigger>
          <ConfigTabsTrigger value="smtp">SMTP</ConfigTabsTrigger>
          <ConfigTabsTrigger value="dominio">Domínio Próprio</ConfigTabsTrigger>
        </ConfigTabsList>

        {/* ABA: DADOS GERAIS */}
        <ConfigTabsContent value="dados-gerais" className="space-y-6 mt-0">
          <ConfigCardSection title="Parâmetros Gerais do Sistema" icon={Settings2}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <ConfigSelectField 
                label="Casas decimais em valor" 
                value={form.casas_decimais_valor.toString()} 
                onValueChange={v => handleUpdateField("casas_decimais_valor", parseInt(v))}
                options={[
                  { label: "2 (Ex: R$ 0,00)", value: "2" },
                  { label: "3 (Ex: R$ 0,000)", value: "3" },
                  { label: "4 (Ex: R$ 0,0000)", value: "4" }
                ]} 
              />
              <ConfigSelectField 
                label="Casas decimais em quantidade" 
                value={form.casas_decimais_quantidade.toString()} 
                onValueChange={v => handleUpdateField("casas_decimais_quantidade", parseInt(v))}
                options={[
                  { label: "0 (Sem decimais)", value: "0" },
                  { label: "1 casa", value: "1" },
                  { label: "2 casas", value: "2" },
                  { label: "3 casas", value: "3" },
                  { label: "4 casas", value: "4" }
                ]} 
              />
              <ConfigSelectField 
                label="Limite de registros por página" 
                value={form.registros_por_pagina.toString()} 
                onValueChange={v => handleUpdateField("registros_por_pagina", parseInt(v))}
                options={[
                  { label: "10 itens", value: "10" },
                  { label: "20 itens", value: "20" },
                  { label: "50 itens", value: "50" },
                  { label: "100 itens", value: "100" }
                ]} 
              />
            </div>

            <h4 className="text-sm font-semibold text-slate-800 mb-4 border-b pb-2">Regras de Negócio</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConfigSwitchField 
                label="Estoque de Produto Composição"
                description={form.estoque_produto_composicao ? "Controlar estoque" : "Não controlar estoque"}
                checked={form.estoque_produto_composicao}
                onCheckedChange={v => handleUpdateField("estoque_produto_composicao", v)}
              />
              <ConfigSwitchField 
                label="Produto Sem Estoque"
                description={form.permitir_venda_sem_estoque ? "Permitir vender (Estoque negativo)" : "Não permitir vender"}
                checked={form.permitir_venda_sem_estoque}
                onCheckedChange={v => handleUpdateField("permitir_venda_sem_estoque", v)}
              />
              <ConfigSwitchField 
                label="Vender sem condição de pagamento"
                description={form.vender_sem_condicao_pagamento ? "Permitir" : "Bloquear e exigir"}
                checked={form.vender_sem_condicao_pagamento}
                onCheckedChange={v => handleUpdateField("vender_sem_condicao_pagamento", v)}
              />
              <ConfigSwitchField 
                label="Valor de custo do produto"
                description={form.atualizar_custo_compras ? "Atualizar automaticamente com compras" : "Manter fixo (Não atualizar)"}
                checked={form.atualizar_custo_compras}
                onCheckedChange={v => handleUpdateField("atualizar_custo_compras", v)}
              />
            </div>

            <h4 className="text-sm font-semibold text-slate-800 mb-4 border-b pb-2 mt-8">Suporte</h4>
            
            <ConfigSwitchField 
              label="Permitir acesso do suporte técnico"
              description={form.permitir_acesso_suporte ? "Sim, o suporte pode acessar a base para auxiliar" : "Não permitir acesso do suporte"}
              checked={form.permitir_acesso_suporte}
              onCheckedChange={v => handleUpdateField("permitir_acesso_suporte", v)}
            />

          </ConfigCardSection>
        </ConfigTabsContent>

        {/* ABA: NUMERAÇÕES */}
        <ConfigTabsContent value="numeracoes" className="space-y-6 mt-0">
          <ConfigCardSection title="Configuração de Numerações" icon={Settings2}>
            
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200 text-sm flex items-start gap-3 mb-6">
              <svg className="h-5 w-5 shrink-0 mt-0.5 text-yellow-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p>As numerações definem qual é o código atual de cada módulo do sistema. O próximo código utilizará o número seguinte.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {numeracaoFields.map(field => (
                <ConfigInputField 
                  key={field.id}
                  label={field.label} 
                  id={`num_${field.id}`}
                  type="number"
                  min={0}
                  value={form.numeracoes[field.id as keyof typeof form.numeracoes]} 
                  onChange={e => handleUpdateNumeracao(field.id, e.target.value)} 
                />
              ))}
            </div>

          </ConfigCardSection>
        </ConfigTabsContent>

        {/* ABA: MOVIMENTAÇÕES */}
        <ConfigTabsContent value="movimentacoes" className="space-y-6 mt-0">
          <ConfigCardSection title="Impressão de Pedidos" icon={Printer}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ConfigSelectField 
                label="Formato do pedido A4" 
                value={form.movimentacoes.formato_pedido_a4} 
                onValueChange={v => handleUpdateMov("formato_pedido_a4", v)}
                options={[
                  { label: "PDF", value: "PDF" },
                  { label: "HTML", value: "HTML" }
                ]} 
              />
              <ConfigSelectField 
                label="Tamanho da fonte A4" 
                value={form.movimentacoes.tamanho_fonte_a4} 
                onValueChange={v => handleUpdateMov("tamanho_fonte_a4", v)}
                options={[
                  { label: "Pequena", value: "Pequena" },
                  { label: "Normal", value: "Normal" },
                  { label: "Grande", value: "Grande" }
                ]} 
              />
              <ConfigSelectField 
                label="Tamanho da fonte do cupom" 
                value={form.movimentacoes.tamanho_fonte_cupom} 
                onValueChange={v => handleUpdateMov("tamanho_fonte_cupom", v)}
                options={[
                  { label: "Pequena", value: "Pequena" },
                  { label: "Normal", value: "Normal" },
                  { label: "Grande", value: "Grande" }
                ]} 
              />
            </div>
            
            <div className="mt-6 pt-6 border-t">
              <ConfigSwitchField 
                label="Habilitar cupom para presentes"
                description={form.movimentacoes.habilitar_cupom_presente ? "Oculta preços na impressão de presente" : "Opção desativada"}
                checked={form.movimentacoes.habilitar_cupom_presente}
                onCheckedChange={v => handleUpdateMov("habilitar_cupom_presente", v)}
              />
            </div>
          </ConfigCardSection>

          <ConfigCardSection title="Orçamentos" icon={FileText}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <ConfigTextareaField 
                label="Introdução de orçamentos" 
                id="intro_orcamento"
                placeholder="Texto que aparecerá no cabeçalho do orçamento..."
                value={form.movimentacoes.introducao_orcamento} 
                onChange={e => handleUpdateMov("introducao_orcamento", e.target.value)} 
              />
              <ConfigTextareaField 
                label="Observações de orçamentos" 
                id="obs_orcamento"
                placeholder="Termos de validade, condições bancárias..."
                value={form.movimentacoes.observacoes_orcamento} 
                onChange={e => handleUpdateMov("observacoes_orcamento", e.target.value)} 
              />
            </div>

            <h4 className="text-sm font-semibold text-slate-800 mb-4 border-b pb-2">Exibir na impressão</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.keys(form.movimentacoes.exibir_orcamento).map((key) => {
                const label = key.replace("coluna_", "").replace("_", " ")
                return (
                  <Label key={key} className="flex items-center gap-2 cursor-pointer border p-3 rounded-md hover:bg-slate-50 transition">
                    <Checkbox 
                      checked={form.movimentacoes.exibir_orcamento[key as keyof typeof form.movimentacoes.exibir_orcamento]} 
                      onCheckedChange={v => handleUpdateExibir("exibir_orcamento", key, !!v)} 
                    />
                    <span className="capitalize text-sm font-medium">{label}</span>
                  </Label>
                )
              })}
            </div>
          </ConfigCardSection>

          <ConfigCardSection title="Vendas" icon={ShoppingCart}>
            <div className="mb-6">
              <ConfigTextareaField 
                label="Observações externas (Garantias, políticas de troca)" 
                id="obs_venda"
                placeholder="Texto padrão que sairá no final dos pedidos de venda..."
                value={form.movimentacoes.observacoes_venda} 
                onChange={e => handleUpdateMov("observacoes_venda", e.target.value)} 
              />
            </div>

            <h4 className="text-sm font-semibold text-slate-800 mb-4 border-b pb-2">Exibir na impressão</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.keys(form.movimentacoes.exibir_venda).map((key) => {
                const label = key.replace("coluna_", "").replace("_", " ")
                return (
                  <Label key={key} className="flex items-center gap-2 cursor-pointer border p-3 rounded-md hover:bg-slate-50 transition">
                    <Checkbox 
                      checked={form.movimentacoes.exibir_venda[key as keyof typeof form.movimentacoes.exibir_venda]} 
                      onCheckedChange={v => handleUpdateExibir("exibir_venda", key, !!v)} 
                    />
                    <span className="capitalize text-sm font-medium">{label}</span>
                  </Label>
                )
              })}
            </div>
          </ConfigCardSection>
        </ConfigTabsContent>

        {/* OUTRAS ABAS (EM CONSTRUÇÃO) */}
        {["fiscal", "notificacoes", "smtp", "dominio"].map(tab => (
          <ConfigTabsContent key={tab} value={tab} className="mt-0">
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
              <Settings className="mx-auto h-8 w-8 opacity-20 mb-3" />
              <p>O conteúdo da aba <strong>{tab}</strong> será implementado nas próximas fases.</p>
            </div>
          </ConfigTabsContent>
        ))}

      </ConfigTabs>

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
