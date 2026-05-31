"use client"

import { useEffect, useState } from "react"
import { useFirestore, useDoc, useMemoFirebase } from "@/supabase-mocks"
import { doc, setDoc, serverTimestamp, collection, addDoc } from "@/supabase-mocks/firestore"
import { useProfile } from "@/lib/contexts/profile-context"
import { minhaEmpresaSchema } from "@/types/configuracoes"
import { toast } from "@/hooks/use-toast"
import { 
  Building2, Search, MapPin, Contact, FileText, Plus, Trash2, 
  AlertCircle, Palette, Store, Info, UploadCloud
} from "lucide-react"

import { 
  ConfigPageHeader, 
  ConfigCardSection, 
  ConfigFormActions, 
  ConfigInputField, 
  ConfigSelectField, 
  ConfigDataTable,
  ConfigDataTableHeader,
  ConfigDataTableBody,
  ConfigDataTableRow,
  ConfigDataTableHead,
  ConfigDataTableCell,
  ConfigTabs,
  ConfigTabsList,
  ConfigTabsTrigger,
  ConfigTabsContent,
  ConfigTextareaField
} from "@/components/configuracoes/config-ui"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

const emptyForm = {
  tipo_pessoa: "PJ",
  cnpj_cpf: "",
  razao_social: "",
  nome_fantasia: "",
  inscricao_estadual: "",
  ie_isento: false,
  inscricao_municipal: "",
  cnae_principal: "",
  regime_tributario: "",
  regime_especial_tributacao: "",
  email: "",
  telefone: "",
  celular: "",
  site: "",
  instagram: "",
  whatsapp: "",
  endereco: {
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", pais: "Brasil"
  },
  ie_substitutos: [] as { uf: string, inscricao: string }[],
  
  // Branding
  logo_url: "",
  logo_reduzida: "",
  favicon: "",
  cor_primaria: "#3b82f6",
  cor_secundaria: "#1e40af",
  imagem_login: "",

  // Filiais
  filiais: [] as any[],

  // Complementares
  responsavel_legal: "",
  cpf_responsavel: "",
  email_financeiro: "",
  email_fiscal: "",
  observacoes_internas: "",
}

export default function MinhaEmpresaPage() {
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false)
  
  // States
  const [newUf, setNewUf] = useState("")
  const [newInscricao, setNewInscricao] = useState("")
  const [isAddingFilial, setIsAddingFilial] = useState(false)
  const [novaFilial, setNovaFilial] = useState({
    nome_filial: "", cnpj: "", codigo_interno: "", responsavel: "", telefone: "", endereco: "",
    estoque_separado: false, financeiro_separado: false, pdv_separado: false
  })

  const db = useFirestore()
  const { activeProfile } = useProfile()

  const configRef = useMemoFirebase(() => {
    return db && activeProfile?.empresaId ? doc(db, "configuracoes_empresa", activeProfile.empresaId) : null
  }, [db, activeProfile?.empresaId])
  
  const { data: configData } = useDoc(configRef)

  useEffect(() => {
    if (configData) {
      setForm(prev => ({
        ...prev,
        ...configData,
        endereco: { ...prev.endereco, ...(configData.endereco || {}) },
        ie_substitutos: configData.ie_substitutos || [],
        filiais: configData.filiais || []
      }))
    }
  }, [configData])

  const handleUpdateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleUpdateEndereco = (field: string, value: string) => {
    setForm(prev => ({ ...prev, endereco: { ...prev.endereco, [field]: value } }))
  }

  const handleSearchCnpj = () => {
    if (!form.cnpj_cpf) return
    setIsSearchingCnpj(true)
    setTimeout(() => {
      setIsSearchingCnpj(false)
      toast({ title: "Aviso", description: "Integração de CNPJ será habilitada na próxima fase." })
    }, 1000)
  }

  const handleAddIeSubstituto = () => {
    if (!newUf || !newInscricao) return
    setForm(prev => ({
      ...prev,
      ie_substitutos: [...prev.ie_substitutos, { uf: newUf.toUpperCase(), inscricao: newInscricao }]
    }))
    setNewUf("")
    setNewInscricao("")
  }

  const handleRemoveIeSubstituto = (index: number) => {
    setForm(prev => ({
      ...prev,
      ie_substitutos: prev.ie_substitutos.filter((_, i) => i !== index)
    }))
  }

  const handleAddFilial = () => {
    if (!novaFilial.nome_filial) return toast({ variant: "destructive", title: "Nome da filial é obrigatório" })
    setForm(prev => ({
      ...prev,
      filiais: [...prev.filiais, { ...novaFilial, id: Date.now().toString() }]
    }))
    setNovaFilial({
      nome_filial: "", cnpj: "", codigo_interno: "", responsavel: "", telefone: "", endereco: "",
      estoque_separado: false, financeiro_separado: false, pdv_separado: false
    })
    setIsAddingFilial(false)
  }

  const handleRemoveFilial = (id: string) => {
    setForm(prev => ({
      ...prev,
      filiais: prev.filiais.filter((f) => f.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!activeProfile?.empresaId || !db) return toast({ variant: "destructive", title: "Sessão inválida" })

    const dataToValidate = {
      ...form,
      empresa_id: activeProfile.empresaId,
      atualizado_por: activeProfile.id
    }

    const validation = minhaEmpresaSchema.safeParse(dataToValidate)
    
    if (!validation.success) {
      const firstError = validation.error.errors[0]
      toast({ variant: "destructive", title: "Erro de Validação", description: firstError.message })
      return
    }

    setIsSaving(true)
    try {
      const configRef = doc(db, "configuracoes_empresa", activeProfile.empresaId)
      const dataToSave = {
        ...validation.data,
        atualizado_em: serverTimestamp(),
        criado_em: form.cnpj_cpf ? serverTimestamp() : undefined
      }

      await setDoc(configRef, dataToSave, { merge: true })

      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: activeProfile.empresaId,
        usuario_id: activeProfile.id,
        usuario_nome: activeProfile.nome,
        acao: "UPDATE",
        modulo: "Minha Empresa",
        registro_id: activeProfile.empresaId,
        data_hora: serverTimestamp(),
      })

      toast({ title: "Configurações atualizadas com sucesso!" })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique sua conexão e tente novamente." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <ConfigPageHeader 
        title="Minha Empresa" 
        description="Configure os dados cadastrais da sua empresa, informações de contato, endereços e branding."
        breadcrumb={[{ label: "Configurações", href: "/configuracoes" }, { label: "Minha Empresa" }]}
      />

      <ConfigTabs defaultValue="dados-gerais" className="w-full">
        <ConfigTabsList className="mb-4 flex flex-wrap h-auto bg-slate-100 p-1">
          <ConfigTabsTrigger value="dados-gerais">Dados Gerais</ConfigTabsTrigger>
          <ConfigTabsTrigger value="contato">Contato e Endereço</ConfigTabsTrigger>
          <ConfigTabsTrigger value="branding">Branding</ConfigTabsTrigger>
          <ConfigTabsTrigger value="filiais">Filiais</ConfigTabsTrigger>
          <ConfigTabsTrigger value="complementares">Dados Complementares</ConfigTabsTrigger>
        </ConfigTabsList>

        {/* =========================================================================
            ABA: DADOS GERAIS
            ========================================================================= */}
        <ConfigTabsContent value="dados-gerais" className="space-y-6 mt-0">
          <ConfigCardSection title="Dados gerais" icon={Building2}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2">
                <div className="flex gap-4">
                  <Label className="flex items-center gap-2">
                    <input type="radio" name="tipo_pessoa" checked={form.tipo_pessoa === "PJ"} onChange={() => handleUpdateField("tipo_pessoa", "PJ")} /> Pessoa jurídica
                  </Label>
                  <Label className="flex items-center gap-2">
                    <input type="radio" name="tipo_pessoa" checked={form.tipo_pessoa === "PF"} onChange={() => handleUpdateField("tipo_pessoa", "PF")} /> Pessoa física
                  </Label>
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Label>{form.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} *</Label>
                <div className="flex gap-2">
                  <Input value={form.cnpj_cpf} onChange={e => handleUpdateField("cnpj_cpf", e.target.value)} placeholder={form.tipo_pessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} className="flex-1" />
                  {form.tipo_pessoa === "PJ" && (
                    <Button variant="secondary" onClick={handleSearchCnpj} disabled={isSearchingCnpj}>
                      <Search className="h-4 w-4 mr-2" /> Buscar CNPJ
                    </Button>
                  )}
                </div>
              </div>

              <ConfigInputField label="Nome fantasia *" id="nome_fantasia" value={form.nome_fantasia} onChange={e => handleUpdateField("nome_fantasia", e.target.value)} />
              <ConfigInputField label="Razão social *" id="razao_social" value={form.razao_social} onChange={e => handleUpdateField("razao_social", e.target.value)} />
              
              <div className="space-y-1.5">
                <Label>Inscrição estadual</Label>
                <div className="flex items-center gap-2">
                  <Input value={form.inscricao_estadual} onChange={e => handleUpdateField("inscricao_estadual", e.target.value)} disabled={form.ie_isento} className="flex-1" />
                  <div className="flex items-center gap-2 whitespace-nowrap px-2">
                    <Checkbox id="ie_isento" checked={form.ie_isento} onCheckedChange={(v) => handleUpdateField("ie_isento", v)} />
                    <Label htmlFor="ie_isento" className="cursor-pointer">ISENTA</Label>
                  </div>
                </div>
              </div>

              <ConfigInputField label="Inscrição municipal" id="inscricao_municipal" value={form.inscricao_municipal} onChange={e => handleUpdateField("inscricao_municipal", e.target.value)} />
              <ConfigInputField label="CNAE principal" id="cnae_principal" value={form.cnae_principal} onChange={e => handleUpdateField("cnae_principal", e.target.value)} />

              <ConfigSelectField 
                label="Regime tributário" 
                value={form.regime_tributario} 
                onValueChange={v => handleUpdateField("regime_tributario", v)}
                options={[
                  { label: "Selecione", value: "" },
                  { label: "Simples Nacional", value: "SIMPLES_NACIONAL" },
                  { label: "Lucro Presumido", value: "LUCRO_PRESUMIDO" },
                  { label: "Lucro Real", value: "LUCRO_REAL" }
                ]} 
              />

              <ConfigSelectField 
                label="Regime especial de tributação" 
                value={form.regime_especial_tributacao} 
                onValueChange={v => handleUpdateField("regime_especial_tributacao", v)}
                options={[
                  { label: "Nenhum", value: "" },
                  { label: "Microempresa Municipal", value: "ME_MUNICIPAL" },
                  { label: "Estimativa", value: "ESTIMATIVA" }
                ]} 
              />
            </div>
          </ConfigCardSection>

          <ConfigCardSection title="I.E. substitutos tributários" icon={FileText}>
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200 text-sm flex items-start gap-3 mb-6">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-yellow-600" />
              <p>O preenchimento desta área é necessário apenas se sua empresa possui Inscrição Estadual de Substituto Tributário em outros estados.</p>
            </div>

            <div className="flex items-end gap-3 mb-4">
              <div className="space-y-1.5 w-24">
                <Label>UF</Label>
                <Input maxLength={2} placeholder="SP" value={newUf} onChange={e => setNewUf(e.target.value)} />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Inscrição Estadual</Label>
                <Input placeholder="000.000.000.000" value={newInscricao} onChange={e => setNewInscricao(e.target.value)} />
              </div>
              <Button variant="secondary" onClick={handleAddIeSubstituto} disabled={!newUf || !newInscricao}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>

            {form.ie_substitutos.length > 0 && (
              <ConfigDataTable>
                <ConfigDataTableHeader>
                  <ConfigDataTableRow>
                    <ConfigDataTableHead className="w-[100px]">UF</ConfigDataTableHead>
                    <ConfigDataTableHead>Inscrição Estadual Substituto</ConfigDataTableHead>
                    <ConfigDataTableHead className="text-right w-[100px]">Ações</ConfigDataTableHead>
                  </ConfigDataTableRow>
                </ConfigDataTableHeader>
                <ConfigDataTableBody>
                  {form.ie_substitutos.map((ie, idx) => (
                    <ConfigDataTableRow key={idx}>
                      <ConfigDataTableCell className="font-medium">{ie.uf}</ConfigDataTableCell>
                      <ConfigDataTableCell>{ie.inscricao}</ConfigDataTableCell>
                      <ConfigDataTableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveIeSubstituto(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </ConfigDataTableCell>
                    </ConfigDataTableRow>
                  ))}
                </ConfigDataTableBody>
              </ConfigDataTable>
            )}
          </ConfigCardSection>
        </ConfigTabsContent>

        {/* =========================================================================
            ABA: CONTATO E ENDEREÇO
            ========================================================================= */}
        <ConfigTabsContent value="contato" className="space-y-6 mt-0">
          <ConfigCardSection title="Contato" icon={Contact}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ConfigInputField label="E-mail" type="email" id="email" value={form.email} onChange={e => handleUpdateField("email", e.target.value)} />
              <ConfigInputField label="Telefone" id="telefone" value={form.telefone} onChange={e => handleUpdateField("telefone", e.target.value)} />
              <ConfigInputField label="Celular" id="celular" value={form.celular} onChange={e => handleUpdateField("celular", e.target.value)} />
              <ConfigInputField label="WhatsApp" id="whatsapp" value={form.whatsapp} onChange={e => handleUpdateField("whatsapp", e.target.value)} />
              <ConfigInputField label="Site" id="site" placeholder="https://" value={form.site} onChange={e => handleUpdateField("site", e.target.value)} />
              <ConfigInputField label="Instagram" id="instagram" placeholder="@" value={form.instagram} onChange={e => handleUpdateField("instagram", e.target.value)} />
            </div>
          </ConfigCardSection>

          <ConfigCardSection title="Endereço principal" icon={MapPin}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ConfigInputField label="CEP" id="cep" value={form.endereco.cep} onChange={e => handleUpdateEndereco("cep", e.target.value)} className="col-span-1" />
              <ConfigInputField label="Logradouro" id="logradouro" value={form.endereco.logradouro} onChange={e => handleUpdateEndereco("logradouro", e.target.value)} className="col-span-1 md:col-span-2" />
              
              <ConfigInputField label="Número" id="numero" value={form.endereco.numero} onChange={e => handleUpdateEndereco("numero", e.target.value)} className="col-span-1" />
              <ConfigInputField label="Complemento" id="complemento" value={form.endereco.complemento} onChange={e => handleUpdateEndereco("complemento", e.target.value)} className="col-span-1 md:col-span-2" />
              
              <ConfigInputField label="Bairro" id="bairro" value={form.endereco.bairro} onChange={e => handleUpdateEndereco("bairro", e.target.value)} className="col-span-1" />
              <ConfigInputField label="Cidade" id="cidade" value={form.endereco.cidade} onChange={e => handleUpdateEndereco("cidade", e.target.value)} className="col-span-1" />
              <ConfigInputField label="Estado" id="estado" value={form.endereco.estado} onChange={e => handleUpdateEndereco("estado", e.target.value)} className="col-span-1" />
              
              <ConfigInputField label="País" id="pais" value={form.endereco.pais} onChange={e => handleUpdateEndereco("pais", e.target.value)} className="col-span-1 md:col-span-3" />
            </div>
          </ConfigCardSection>
        </ConfigTabsContent>

        {/* =========================================================================
            ABA: BRANDING
            ========================================================================= */}
        <ConfigTabsContent value="branding" className="space-y-6 mt-0">
          <ConfigCardSection title="Identidade Visual (Branding)" icon={Palette}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo Principal (Cabecalho do sistema e PDV)</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition cursor-pointer">
                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium">Clique para enviar a Logo</span>
                    <span className="text-xs text-muted-foreground">PNG ou JPG até 2MB</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1 cursor-pointer" value={form.cor_primaria} onChange={e => handleUpdateField("cor_primaria", e.target.value)} />
                      <Input value={form.cor_primaria} onChange={e => handleUpdateField("cor_primaria", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1 cursor-pointer" value={form.cor_secundaria} onChange={e => handleUpdateField("cor_secundaria", e.target.value)} />
                      <Input value={form.cor_secundaria} onChange={e => handleUpdateField("cor_secundaria", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Preview de Relatório / Proposta</Label>
                <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
                  <div className="h-16 flex items-center justify-between px-4" style={{ backgroundColor: form.cor_primaria, color: '#fff' }}>
                    <div className="font-bold text-lg">{form.nome_fantasia || "SUA EMPRESA"}</div>
                    <div className="text-sm opacity-80">Documento #001</div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                    <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                  </div>
                  <div className="p-3 border-t bg-slate-50 text-xs text-center text-muted-foreground">
                    <span style={{ color: form.cor_secundaria }}>www.seusite.com.br</span>
                  </div>
                </div>
              </div>
            </div>
          </ConfigCardSection>
        </ConfigTabsContent>

        {/* =========================================================================
            ABA: FILIAIS
            ========================================================================= */}
        <ConfigTabsContent value="filiais" className="space-y-6 mt-0">
          <ConfigCardSection title="Gestão de Filiais" icon={Store}>
            <div className="mb-4">
              <Button onClick={() => setIsAddingFilial(!isAddingFilial)} variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Adicionar Filial
              </Button>
            </div>

            {isAddingFilial && (
              <div className="bg-slate-50 border rounded-lg p-4 mb-6 space-y-4">
                <h4 className="font-semibold text-sm">Nova Filial</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ConfigInputField label="Nome da filial *" id="f_nome" value={novaFilial.nome_filial} onChange={e => setNovaFilial({...novaFilial, nome_filial: e.target.value})} />
                  <ConfigInputField label="CNPJ" id="f_cnpj" value={novaFilial.cnpj} onChange={e => setNovaFilial({...novaFilial, cnpj: e.target.value})} />
                  <ConfigInputField label="Código interno" id="f_cod" value={novaFilial.codigo_interno} onChange={e => setNovaFilial({...novaFilial, codigo_interno: e.target.value})} />
                  <ConfigInputField label="Responsável" id="f_resp" value={novaFilial.responsavel} onChange={e => setNovaFilial({...novaFilial, responsavel: e.target.value})} />
                  <ConfigInputField label="Telefone" id="f_tel" value={novaFilial.telefone} onChange={e => setNovaFilial({...novaFilial, telefone: e.target.value})} />
                  <ConfigInputField label="Endereço resumido" id="f_end" value={novaFilial.endereco} onChange={e => setNovaFilial({...novaFilial, endereco: e.target.value})} />
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={novaFilial.estoque_separado} onCheckedChange={v => setNovaFilial({...novaFilial, estoque_separado: !!v})} /> Estoque separado
                  </Label>
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={novaFilial.financeiro_separado} onCheckedChange={v => setNovaFilial({...novaFilial, financeiro_separado: !!v})} /> Financeiro separado
                  </Label>
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={novaFilial.pdv_separado} onCheckedChange={v => setNovaFilial({...novaFilial, pdv_separado: !!v})} /> PDV separado
                  </Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setIsAddingFilial(false)}>Cancelar</Button>
                  <Button onClick={handleAddFilial}>Salvar Filial</Button>
                </div>
              </div>
            )}

            {form.filiais.length > 0 ? (
              <ConfigDataTable>
                <ConfigDataTableHeader>
                  <ConfigDataTableRow>
                    <ConfigDataTableHead>Nome da Filial</ConfigDataTableHead>
                    <ConfigDataTableHead>CNPJ</ConfigDataTableHead>
                    <ConfigDataTableHead>Responsável</ConfigDataTableHead>
                    <ConfigDataTableHead>Configuração</ConfigDataTableHead>
                    <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
                  </ConfigDataTableRow>
                </ConfigDataTableHeader>
                <ConfigDataTableBody>
                  {form.filiais.map((f) => (
                    <ConfigDataTableRow key={f.id}>
                      <ConfigDataTableCell className="font-medium">{f.nome_filial}</ConfigDataTableCell>
                      <ConfigDataTableCell>{f.cnpj || "-"}</ConfigDataTableCell>
                      <ConfigDataTableCell>{f.responsavel || "-"}</ConfigDataTableCell>
                      <ConfigDataTableCell className="text-xs text-muted-foreground">
                        {f.estoque_separado ? "Estoque independente" : "Estoque unificado"}
                      </ConfigDataTableCell>
                      <ConfigDataTableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveFilial(f.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </ConfigDataTableCell>
                    </ConfigDataTableRow>
                  ))}
                </ConfigDataTableBody>
              </ConfigDataTable>
            ) : (
              <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                Nenhuma filial cadastrada. A empresa opera com estrutura única.
              </div>
            )}
          </ConfigCardSection>
        </ConfigTabsContent>

        {/* =========================================================================
            ABA: DADOS COMPLEMENTARES
            ========================================================================= */}
        <ConfigTabsContent value="complementares" className="space-y-6 mt-0">
          <ConfigCardSection title="Responsabilidade e Comunicação" icon={Info}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ConfigInputField label="Responsável Legal" id="resp_legal" value={form.responsavel_legal} onChange={e => handleUpdateField("responsavel_legal", e.target.value)} />
              <ConfigInputField label="CPF do Responsável" id="cpf_resp" value={form.cpf_responsavel} onChange={e => handleUpdateField("cpf_responsavel", e.target.value)} />
              <ConfigInputField label="E-mail Financeiro (Faturamento/Cobrança)" type="email" id="email_fin" value={form.email_financeiro} onChange={e => handleUpdateField("email_financeiro", e.target.value)} />
              <ConfigInputField label="E-mail Fiscal (Notas/Contabilidade)" type="email" id="email_fisc" value={form.email_fiscal} onChange={e => handleUpdateField("email_fiscal", e.target.value)} />
              
              <div className="col-span-1 md:col-span-2">
                <ConfigTextareaField 
                  label="Observações Internas (Somente admin)" 
                  id="obs_int" 
                  placeholder="Anotações confidenciais sobre a estrutura corporativa..." 
                  value={form.observacoes_internas} 
                  onChange={e => handleUpdateField("observacoes_internas", e.target.value)} 
                />
              </div>
            </div>
          </ConfigCardSection>
        </ConfigTabsContent>

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
