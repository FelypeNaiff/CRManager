"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchCnpjData, fetchViaCep } from "@/lib/lookup"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, MapPin, MessageSquare, DollarSign, Image, Settings, Link as LinkIcon, CalendarDays, Store, Plus } from "lucide-react"

const tabs = [
  { value: "dados-gerais", label: "Dados Gerais", icon: Building2 },
  { value: "enderecos", label: "Endereços", icon: MapPin },
  { value: "contatos", label: "Contatos", icon: MessageSquare },
  { value: "financeiro-fiscal", label: "Financeiro/Fiscal", icon: DollarSign },
  { value: "branding", label: "Branding", icon: Image },
  { value: "configuracoes-operacionais", label: "Configurações Operacionais", icon: Settings },
  { value: "integracoes", label: "Integrações", icon: LinkIcon },
  { value: "horarios", label: "Horários", icon: CalendarDays },
  { value: "filiais", label: "Filiais", icon: Store },
]

const filialList = [
  { id: 1, nome: "Matriz", cnpj: "12.345.678/0001-90", codigo: "MTZ-001", responsavel: "Lucas Silva", telefone: "(11) 98765-4321", endereco: "Av. Principal, 123", estoqueSeparado: true, financeiroSeparado: false, pdvSeparado: true },
  { id: 2, nome: "Filial São Paulo", cnpj: "23.456.789/0001-81", codigo: "SP-002", responsavel: "Mariana Costa", telefone: "(11) 97654-3210", endereco: "Rua Secundária, 55", estoqueSeparado: false, financeiroSeparado: false, pdvSeparado: false },
]

const horarioPadrao = [
  { dia: "Segunda-feira", abertura: "08:00", fechamento: "18:00", almoco: "12:00 - 13:00" },
  { dia: "Terça-feira", abertura: "08:00", fechamento: "18:00", almoco: "12:00 - 13:00" },
  { dia: "Quarta-feira", abertura: "08:00", fechamento: "18:00", almoco: "12:00 - 13:00" },
  { dia: "Quinta-feira", abertura: "08:00", fechamento: "18:00", almoco: "12:00 - 13:00" },
  { dia: "Sexta-feira", abertura: "08:00", fechamento: "17:00", almoco: "12:00 - 13:00" },
]

export default function ConfiguracoesEmpresaPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryTab = searchParams.get("tab") ?? "dados-gerais"
  const [activeTab, setActiveTab] = useState(queryTab)
  const [form, setForm] = useState({
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    regime: "Simples",
    dataAbertura: "",
    responsavel: "",
    cpfResponsavel: "",
    site: "",
    email: "",
    whatsapp: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    pais: "",
    referencia: "",
    whatsappVendas: "",
    whatsappSuporte: "",
    telefoneComercial: "",
    emailFinanceiro: "",
    emailFiscal: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    youtube: "",
    cnaePrincipal: "",
    cnaesSecundarios: "",
    banco: "",
    agencia: "",
    conta: "",
    pix: "",
    favorecido: "",
    cnpjFavorecido: "",
    logoPrincipal: "",
    logoReduzida: "",
    favicon: "",
    corPrimaria: "#2563eb",
    corSecundaria: "#f97316",
    imagemLogin: "",
    ativoPDV: true,
    vendaSemEstoque: false,
    vendaNegativa: false,
    descontoMaximo: "10",
    estoqueMinimo: "0",
    cadastroFilhos: true,
    fluxoAutomatico: true,
    gerarContas: false,
    whatsappApi: "",
    smtpEmail: "",
    googleCalendar: false,
    mercadoPago: false,
    assas: false,
    apiExterna: "",
    diasFuncionamento: "Segunda a Sexta",
    horaAbertura: "08:00",
    horaFechamento: "18:00",
    intervaloAlmoco: "12:00 - 13:00",
    horariosEspeciais: "",
    feriados: "",
  })

  const [cnpjStatus, setCnpjStatus] = useState({ loading: false, source: "", error: "" })
  const [cepStatus, setCepStatus] = useState({ loading: false, source: "", error: "" })

  useEffect(() => {
    setActiveTab(queryTab)
  }, [queryTab])

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/configuracoes/empresa?${params.toString()}`)
    setActiveTab(value)
  }

  const handleBuscarCnpj = async () => {
    setCnpjStatus({ loading: true, source: "", error: "" })
    try {
      const result = await fetchCnpjData(form.cnpj)
      setForm((prev) => ({
        ...prev,
        razaoSocial: result.data.razaoSocial ?? prev.razaoSocial,
        nomeFantasia: result.data.nomeFantasia ?? prev.nomeFantasia,
        inscricaoEstadual: result.data.inscricaoEstadual ?? prev.inscricaoEstadual,
        inscricaoMunicipal: result.data.inscricaoMunicipal ?? prev.inscricaoMunicipal,
        dataAbertura: result.data.dataAbertura ?? prev.dataAbertura,
        site: result.data.site ?? prev.site,
        email: result.data.email ?? prev.email,
        whatsapp: result.data.whatsapp ?? prev.whatsapp,
        responsavel: result.data.responsavel ?? prev.responsavel,
        cep: result.data.cep ?? prev.cep,
        rua: result.data.rua ?? prev.rua,
        complemento: result.data.complemento ?? prev.complemento,
        bairro: result.data.bairro ?? prev.bairro,
        cidade: result.data.cidade ?? prev.cidade,
        estado: result.data.estado ?? prev.estado,
      }))
      setCnpjStatus({ loading: false, source: result.source, error: "" })
    } catch (error) {
      setCnpjStatus({ loading: false, source: "", error: error instanceof Error ? error.message : "Erro ao consultar CNPJ" })
    }
  }

  const handleBuscarCep = async () => {
    setCepStatus({ loading: true, source: "", error: "" })
    try {
      const result = await fetchViaCep(form.cep)
      setForm((prev) => ({
        ...prev,
        rua: result.rua ?? prev.rua,
        complemento: result.complemento ?? prev.complemento,
        bairro: result.bairro ?? prev.bairro,
        cidade: result.cidade ?? prev.cidade,
        estado: result.estado ?? prev.estado,
        pais: result.pais ?? prev.pais,
        cep: result.cep ?? prev.cep,
      }))
      setCepStatus({ loading: false, source: "ViaCEP", error: "" })
    } catch (error) {
      setCepStatus({ loading: false, source: "", error: error instanceof Error ? error.message : "Erro ao consultar CEP" })
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary">Configurações</p>
            <h1 className="mt-2 text-3xl font-bold">Dados da Empresa</h1>
            <p className="mt-2 text-muted-foreground">Administre informações gerais, contatos, fiscais, integração e filiais.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Link href="/configuracoes" className="text-primary hover:underline">Configurações</Link>
            <span>/</span>
            <span>Dados da Empresa</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card text-slate-700"
                >
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </div>
                </TabsTrigger>
              )
            })}
          </TabsList>

          <div className="mt-6 space-y-6">
            <TabsContent value="dados-gerais">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="razaoSocial">Razão social</Label>
                  <Input id="razaoSocial" value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia">Nome fantasia</Label>
                  <Input id="nomeFantasia" value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <div className="flex gap-2 items-center">
                    <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                    <Button size="sm" onClick={handleBuscarCnpj} disabled={cnpjStatus.loading || !form.cnpj}>
                      {cnpjStatus.loading ? "Buscando..." : "Buscar CNPJ"}
                    </Button>
                  </div>
                  {cnpjStatus.source && !cnpjStatus.error ? (
                    <p className="text-sm text-green-600">Dados carregados via {cnpjStatus.source}.</p>
                  ) : null}
                  {cnpjStatus.error ? (
                    <p className="text-sm text-red-600">Erro: {cnpjStatus.error}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inscricaoEstadual">Inscrição estadual</Label>
                  <Input id="inscricaoEstadual" value={form.inscricaoEstadual} onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inscricaoMunicipal">Inscrição municipal</Label>
                  <Input id="inscricaoMunicipal" value={form.inscricaoMunicipal} onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regime">Regime tributário</Label>
                  <Select value={form.regime} onValueChange={(value) => setForm({ ...form, regime: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Simples" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Simples">Simples</SelectItem>
                      <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataAbertura">Data de abertura</Label>
                  <Input id="dataAbertura" type="date" value={form.dataAbertura} onChange={(e) => setForm({ ...form, dataAbertura: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsavel">Responsável legal</Label>
                  <Input id="responsavel" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpfResponsavel">CPF do responsável</Label>
                  <Input id="cpfResponsavel" value={form.cpfResponsavel} onChange={(e) => setForm({ ...form, cpfResponsavel: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site">Site</Label>
                  <Input id="site" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail principal</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp principal</Label>
                  <Input id="whatsapp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button className="bg-primary text-white">Salvar Dados Gerais</Button>
              </div>
            </TabsContent>

            <TabsContent value="enderecos">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <div className="flex gap-2 items-center">
                    <Input id="cep" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
                    <Button size="sm" onClick={handleBuscarCep} disabled={cepStatus.loading || !form.cep}>
                      {cepStatus.loading ? "Buscando..." : "Buscar CEP"}
                    </Button>
                  </div>
                  {cepStatus.source && !cepStatus.error ? (
                    <p className="text-sm text-green-600">Endereço carregado via {cepStatus.source}.</p>
                  ) : null}
                  {cepStatus.error ? (
                    <p className="text-sm text-red-600">Erro: {cepStatus.error}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rua">Rua</Label>
                  <Input id="rua" value={form.rua} onChange={(e) => setForm({ ...form, rua: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input id="complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input id="estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pais">País</Label>
                  <Input id="pais" value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="referencia">Referência</Label>
                  <Input id="referencia" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button className="bg-primary text-white">Salvar Endereços</Button>
              </div>
            </TabsContent>

            <TabsContent value="contatos">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="whatsappVendas">WhatsApp vendas</Label>
                  <Input id="whatsappVendas" value={form.whatsappVendas} onChange={(e) => setForm({ ...form, whatsappVendas: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsappSuporte">WhatsApp suporte</Label>
                  <Input id="whatsappSuporte" value={form.whatsappSuporte} onChange={(e) => setForm({ ...form, whatsappSuporte: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefoneComercial">Telefone comercial</Label>
                  <Input id="telefoneComercial" value={form.telefoneComercial} onChange={(e) => setForm({ ...form, telefoneComercial: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailFinanceiro">E-mail financeiro</Label>
                  <Input id="emailFinanceiro" type="email" value={form.emailFinanceiro} onChange={(e) => setForm({ ...form, emailFinanceiro: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailFiscal">E-mail fiscal</Label>
                  <Input id="emailFiscal" type="email" value={form.emailFiscal} onChange={(e) => setForm({ ...form, emailFiscal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input id="instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input id="facebook" value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok">TikTok</Label>
                  <Input id="tiktok" value={form.tiktok} onChange={(e) => setForm({ ...form, tiktok: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input id="youtube" value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button className="bg-primary text-white">Salvar Contatos</Button>
              </div>
            </TabsContent>

            <TabsContent value="financeiro-fiscal">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cnaePrincipal">CNAE principal</Label>
                  <Input id="cnaePrincipal" value={form.cnaePrincipal} onChange={(e) => setForm({ ...form, cnaePrincipal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnaesSecundarios">CNAEs secundários</Label>
                  <Input id="cnaesSecundarios" value={form.cnaesSecundarios} onChange={(e) => setForm({ ...form, cnaesSecundarios: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banco">Banco</Label>
                  <Input id="banco" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agencia">Agência</Label>
                  <Input id="agencia" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conta">Conta</Label>
                  <Input id="conta" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pix">Chave PIX</Label>
                  <Input id="pix" value={form.pix} onChange={(e) => setForm({ ...form, pix: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="favorecido">Favorecido</Label>
                  <Input id="favorecido" value={form.favorecido} onChange={(e) => setForm({ ...form, favorecido: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpjFavorecido">CNPJ favorecido</Label>
                  <Input id="cnpjFavorecido" value={form.cnpjFavorecido} onChange={(e) => setForm({ ...form, cnpjFavorecido: e.target.value })} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button className="bg-primary text-white">Salvar Financeiro</Button>
              </div>
            </TabsContent>

            <TabsContent value="branding">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="logoPrincipal">Logo principal</Label>
                  <Input id="logoPrincipal" placeholder="URL" value={form.logoPrincipal} onChange={(e) => setForm({ ...form, logoPrincipal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoReduzida">Logo reduzida</Label>
                  <Input id="logoReduzida" placeholder="URL" value={form.logoReduzida} onChange={(e) => setForm({ ...form, logoReduzida: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="favicon">Favicon</Label>
                  <Input id="favicon" placeholder="URL" value={form.favicon} onChange={(e) => setForm({ ...form, favicon: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="corPrimaria">Cor primária</Label>
                  <Input id="corPrimaria" placeholder="#2563eb" value={form.corPrimaria} onChange={(e) => setForm({ ...form, corPrimaria: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="corSecundaria">Cor secundária</Label>
                  <Input id="corSecundaria" placeholder="#f97316" value={form.corSecundaria} onChange={(e) => setForm({ ...form, corSecundaria: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imagemLogin">Imagem de login</Label>
                  <Input id="imagemLogin" placeholder="URL" value={form.imagemLogin} onChange={(e) => setForm({ ...form, imagemLogin: e.target.value })} />
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-semibold">Preview</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
                    <p className="font-medium">Barra de navegação</p>
                    <p>Cor primária: {form.corPrimaria}</p>
                  </div>
                  <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
                    <p className="font-medium">Login</p>
                    <p>Imagem definida: {form.imagemLogin ? "Sim" : "Não"}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button className="bg-primary text-white">Salvar Branding</Button>
              </div>
            </TabsContent>

            <TabsContent value="configuracoes-operacionais">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Switch checked={form.ativoPDV} onCheckedChange={(checked) => setForm({ ...form, ativoPDV: checked })} />
                  <span>Ativar PDV</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.vendaSemEstoque} onCheckedChange={(checked) => setForm({ ...form, vendaSemEstoque: checked })} />
                  <span>Permitir venda sem estoque</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.vendaNegativa} onCheckedChange={(checked) => setForm({ ...form, vendaNegativa: checked })} />
                  <span>Permitir venda negativa</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descontoMaximo">Desconto máximo padrão (%)</Label>
                  <Input id="descontoMaximo" type="number" value={form.descontoMaximo} onChange={(e) => setForm({ ...form, descontoMaximo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estoqueMinimo">Estoque mínimo padrão</Label>
                  <Input id="estoqueMinimo" type="number" value={form.estoqueMinimo} onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.cadastroFilhos} onCheckedChange={(checked) => setForm({ ...form, cadastroFilhos: checked })} />
                  <span>Ativar cadastro de filhos</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.fluxoAutomatico} onCheckedChange={(checked) => setForm({ ...form, fluxoAutomatico: checked })} />
                  <span>Ativar fluxo de caixa automático</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.gerarContas} onCheckedChange={(checked) => setForm({ ...form, gerarContas: checked })} />
                  <span>Gerar contas automaticamente</span>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button className="bg-primary text-white">Salvar Operações</Button>
              </div>
            </TabsContent>

            <TabsContent value="integracoes">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="whatsappApi">WhatsApp API</Label>
                  <Input id="whatsappApi" value={form.whatsappApi} onChange={(e) => setForm({ ...form, whatsappApi: e.target.value })} placeholder="URL / token" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpEmail">SMTP E-mail</Label>
                  <Input id="smtpEmail" value={form.smtpEmail} onChange={(e) => setForm({ ...form, smtpEmail: e.target.value })} placeholder="Servidor SMTP" />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.googleCalendar} onCheckedChange={(checked) => setForm({ ...form, googleCalendar: checked })} />
                  <span>Google Calendar</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.mercadoPago} onCheckedChange={(checked) => setForm({ ...form, mercadoPago: checked })} />
                  <span>Mercado Pago</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.assas} onCheckedChange={(checked) => setForm({ ...form, assas: checked })} />
                  <span>Asaas</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiExterna">APIs externas</Label>
                  <Input id="apiExterna" value={form.apiExterna} onChange={(e) => setForm({ ...form, apiExterna: e.target.value })} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button className="bg-primary text-white">Salvar Integrações</Button>
              </div>
            </TabsContent>

            <TabsContent value="horarios">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Horários</h2>
                  <p className="mt-1 text-sm text-slate-600">Defina dias e horários de funcionamento, intervalos e feriados.</p>
                </div>
                <div className="overflow-x-auto rounded-2xl border bg-slate-50 p-4">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-white text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Dia</th>
                        <th className="px-4 py-3">Abertura</th>
                        <th className="px-4 py-3">Fechamento</th>
                        <th className="px-4 py-3">Intervalo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {horarioPadrao.map((item) => (
                        <tr key={item.dia} className="border-t">
                          <td className="px-4 py-3">{item.dia}</td>
                          <td className="px-4 py-3">{item.abertura}</td>
                          <td className="px-4 py-3">{item.fechamento}</td>
                          <td className="px-4 py-3">{item.almoco}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="diasFuncionamento">Dias de funcionamento</Label>
                    <Input id="diasFuncionamento" value={form.diasFuncionamento} onChange={(e) => setForm({ ...form, diasFuncionamento: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="horaAbertura">Hora de abertura</Label>
                    <Input id="horaAbertura" type="time" value={form.horaAbertura} onChange={(e) => setForm({ ...form, horaAbertura: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="horaFechamento">Hora de fechamento</Label>
                    <Input id="horaFechamento" type="time" value={form.horaFechamento} onChange={(e) => setForm({ ...form, horaFechamento: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="intervaloAlmoco">Intervalo de almoço</Label>
                    <Input id="intervaloAlmoco" value={form.intervaloAlmoco} onChange={(e) => setForm({ ...form, intervaloAlmoco: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="horariosEspeciais">Horários especiais</Label>
                    <Input id="horariosEspeciais" value={form.horariosEspeciais} onChange={(e) => setForm({ ...form, horariosEspeciais: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="feriados">Feriados</Label>
                    <Input id="feriados" value={form.feriados} onChange={(e) => setForm({ ...form, feriados: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button className="bg-primary text-white">Salvar Horários</Button>
              </div>
            </TabsContent>

            <TabsContent value="filiais">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Filiais</h2>
                  <p className="mt-1 text-sm text-slate-600">Gerencie filiais com controle de estoque, financeiro e PDV.</p>
                </div>
                <Button className="bg-primary text-white">
                  <Plus className="h-4 w-4" />
                  Nova Filial
                </Button>
              </div>
              <div className="mt-6 overflow-x-auto rounded-2xl border bg-slate-50 p-4">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-white text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Filial</th>
                      <th className="px-4 py-3">CNPJ</th>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3">Telefone</th>
                      <th className="px-4 py-3">Endereço</th>
                      <th className="px-4 py-3">Estoque</th>
                      <th className="px-4 py-3">Financeiro</th>
                      <th className="px-4 py-3">PDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filialList.map((filial) => (
                      <tr key={filial.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{filial.nome}</td>
                        <td className="px-4 py-3">{filial.cnpj}</td>
                        <td className="px-4 py-3">{filial.codigo}</td>
                        <td className="px-4 py-3">{filial.responsavel}</td>
                        <td className="px-4 py-3">{filial.telefone}</td>
                        <td className="px-4 py-3">{filial.endereco}</td>
                        <td className="px-4 py-3">{filial.estoqueSeparado ? "Sim" : "Não"}</td>
                        <td className="px-4 py-3">{filial.financeiroSeparado ? "Sim" : "Não"}</td>
                        <td className="px-4 py-3">{filial.pdvSeparado ? "Sim" : "Não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
