'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getCompanyAction, updateCompanyAction } from '@/lib/configuracoes/company-actions';
import { fetchCnpjData, fetchViaCep } from '@/lib/lookup';
import {
  ConfigPageHeader,
  ConfigCardSection,
  ConfigInputField,
  ConfigTextareaField,
  ConfigSelectField,
  ConfigFormActions,
} from './config-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, MapPin, Phone, Settings, Loader2 } from 'lucide-react';

export default function CompanyForm() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dados-principais');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [form, setForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpjCpf: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    regimeTributario: 'Simples Nacional',
    crt: '1',
    cnae: '',
    telefone: '',
    whatsapp: '',
    email: '',
    site: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    nomeExibido: '',
    observacoes: '',
    status: 'ativo',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadCompanyData() {
      try {
        const response = await getCompanyAction();
        if (response.success && response.data) {
          const comp = response.data;
          setForm({
            razaoSocial: comp.razaoSocial || '',
            nomeFantasia: comp.nomeFantasia || '',
            cnpjCpf: comp.cnpjCpf || '',
            inscricaoEstadual: comp.inscricaoEstadual || '',
            inscricaoMunicipal: comp.inscricaoMunicipal || '',
            regimeTributario: comp.regimeTributario || 'Simples Nacional',
            crt: comp.crt || '1',
            cnae: comp.cnae || '',
            telefone: comp.telefone || '',
            whatsapp: comp.whatsapp || '',
            email: comp.email || '',
            site: comp.site || '',
            cep: comp.cep || '',
            logradouro: comp.logradouro || '',
            numero: comp.numero || '',
            complemento: comp.complemento || '',
            bairro: comp.bairro || '',
            cidade: comp.cidade || '',
            uf: comp.uf || '',
            nomeExibido: comp.nomeExibido || '',
            observacoes: comp.observacoes || '',
            status: comp.status || 'ativo',
          });
        } else {
          toast({
            title: 'Aviso',
            description: response.error || 'Nenhum dado cadastrado para a empresa.',
            variant: 'destructive',
          });
        }
      } catch (err: any) {
        toast({
          title: 'Erro',
          description: 'Erro ao carregar dados da empresa.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadCompanyData();
  }, [toast]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.razaoSocial.trim()) {
      newErrors.razaoSocial = 'Razão Social é obrigatória';
    }
    if (!form.nomeFantasia.trim()) {
      newErrors.nomeFantasia = 'Nome Fantasia é obrigatório';
    }
    if (!form.cnpjCpf.trim()) {
      newErrors.cnpjCpf = 'CNPJ/CPF é obrigatório';
    } else if (form.cnpjCpf.replace(/\D/g, '').length < 11) {
      newErrors.cnpjCpf = 'Documento deve ter pelo menos 11 dígitos';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'E-mail inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBuscarCnpj = async () => {
    const cleanCnpj = form.cnpjCpf.replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      toast({
        title: 'Aviso',
        description: 'Forneça um CNPJ válido com 14 dígitos para pesquisar.',
        variant: 'destructive',
      });
      return;
    }

    setCnpjLoading(true);
    try {
      const result = await fetchCnpjData(form.cnpjCpf);
      if (result.data) {
        setForm((prev) => ({
          ...prev,
          razaoSocial: result.data.razaoSocial || prev.razaoSocial,
          nomeFantasia: result.data.nomeFantasia || prev.nomeFantasia,
          inscricaoEstadual: result.data.inscricaoEstadual || prev.inscricaoEstadual,
          inscricaoMunicipal: result.data.inscricaoMunicipal || prev.inscricaoMunicipal,
          site: result.data.site || prev.site,
          email: result.data.email || prev.email,
          whatsapp: result.data.whatsapp || prev.whatsapp,
          cep: result.data.cep || prev.cep,
          logradouro: result.data.rua || prev.logradouro,
          complemento: result.data.complemento || prev.complemento,
          bairro: result.data.bairro || prev.bairro,
          cidade: result.data.cidade || prev.cidade,
          uf: result.data.estado || prev.uf,
        }));
        toast({
          title: 'Sucesso',
          description: `Dados carregados com sucesso via ${result.source}.`,
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro de Busca',
        description: err.message || 'Erro ao consultar o CNPJ.',
        variant: 'destructive',
      });
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleBuscarCep = async () => {
    const cleanCep = form.cep.replace(/\D/g, '');
    if (!cleanCep || cleanCep.length !== 8) {
      toast({
        title: 'Aviso',
        description: 'Forneça um CEP válido com 8 dígitos para pesquisar.',
        variant: 'destructive',
      });
      return;
    }

    setCepLoading(true);
    try {
      const result = await fetchViaCep(form.cep);
      if (result) {
        setForm((prev) => ({
          ...prev,
          logradouro: result.rua || prev.logradouro,
          complemento: result.complemento || prev.complemento,
          bairro: result.bairro || prev.bairro,
          cidade: result.cidade || prev.cidade,
          uf: result.estado || prev.uf,
        }));
        toast({
          title: 'Sucesso',
          description: 'Endereço auto-preenchido via ViaCEP.',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro de Busca',
        description: err.message || 'Erro ao consultar o CEP.',
        variant: 'destructive',
      });
    } finally {
      setCepLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast({
        title: 'Erro de Validação',
        description: 'Preencha todos os campos obrigatórios corretamente.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateCompanyAction(form);
      if (res.success) {
        toast({
          title: 'Sucesso',
          description: 'Dados da empresa atualizados com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao Salvar',
          description: res.error || 'Erro ao atualizar dados no banco.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Erro de comunicação ao salvar os dados.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando dados cadastrais...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <ConfigPageHeader
        title="Dados da Empresa"
        description="Gerencie as informações corporativas, contatos, dados de endereço e tributários."
        breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Minha Empresa' }]}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-xl border">
            <TabsTrigger
              value="dados-principais"
              className="flex items-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
            >
              <Building2 className="h-4 w-4" />
              <span>Dados Principais</span>
            </TabsTrigger>
            <TabsTrigger
              value="endereco"
              className="flex items-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
            >
              <MapPin className="h-4 w-4" />
              <span>Endereço</span>
            </TabsTrigger>
            <TabsTrigger
              value="contato"
              className="flex items-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
            >
              <Phone className="h-4 w-4" />
              <span>Contatos</span>
            </TabsTrigger>
            <TabsTrigger
              value="dados-operacionais"
              className="flex items-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
            >
              <Settings className="h-4 w-4" />
              <span>Operacional</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            {/* TABA: DADOS PRINCIPAIS */}
            <TabsContent value="dados-principais" className="outline-none">
              <ConfigCardSection
                title="Dados Cadastrais e Fiscais"
                description="Dados oficiais da empresa para emissão fiscal, faturamento e identificação jurídica."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <ConfigInputField
                      label="Razão Social *"
                      id="razaoSocial"
                      value={form.razaoSocial}
                      onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                      required
                    />
                    {errors.razaoSocial && (
                      <p className="text-xs text-red-500 font-medium">{errors.razaoSocial}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <ConfigInputField
                      label="Nome Fantasia *"
                      id="nomeFantasia"
                      value={form.nomeFantasia}
                      onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                      required
                    />
                    {errors.nomeFantasia && (
                      <p className="text-xs text-red-500 font-medium">{errors.nomeFantasia}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <ConfigInputField
                          label="CNPJ/CPF *"
                          id="cnpjCpf"
                          value={form.cnpjCpf}
                          onChange={(e) => setForm({ ...form, cnpjCpf: e.target.value })}
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleBuscarCnpj}
                        disabled={cnpjLoading || !form.cnpjCpf}
                        className="inline-flex items-center justify-center rounded-lg text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {cnpjLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Consultando...
                          </>
                        ) : (
                          'Buscar CNPJ'
                        )}
                      </button>
                    </div>
                    {errors.cnpjCpf && (
                      <p className="text-xs text-red-500 font-medium mt-1">{errors.cnpjCpf}</p>
                    )}
                  </div>

                  <ConfigInputField
                    label="CNAE Principal"
                    id="cnae"
                    value={form.cnae}
                    onChange={(e) => setForm({ ...form, cnae: e.target.value })}
                    placeholder="Ex: 4781-4/00"
                  />

                  <ConfigInputField
                    label="Inscrição Estadual"
                    id="inscricaoEstadual"
                    value={form.inscricaoEstadual}
                    onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })}
                  />

                  <ConfigInputField
                    label="Inscrição Municipal"
                    id="inscricaoMunicipal"
                    value={form.inscricaoMunicipal}
                    onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })}
                  />

                  <ConfigSelectField
                    label="Regime Tributário"
                    id="regimeTributario"
                    value={form.regimeTributario}
                    onValueChange={(val) => setForm({ ...form, regimeTributario: val })}
                    options={[
                      { label: 'Simples Nacional', value: 'Simples Nacional' },
                      { label: 'Lucro Presumido', value: 'Lucro Presumido' },
                      { label: 'Lucro Real', value: 'Lucro Real' },
                    ]}
                  />

                  <ConfigSelectField
                    label="Código de Regime Tributário (CRT)"
                    id="crt"
                    value={form.crt}
                    onValueChange={(val) => setForm({ ...form, crt: val })}
                    options={[
                      { label: '1 - Simples Nacional', value: '1' },
                      { label: '2 - Simples Nacional - excesso de sublimite de receita bruta', value: '2' },
                      { label: '3 - Regime Normal (Lucro Presumido ou Real)', value: '3' },
                    ]}
                  />

                  <ConfigSelectField
                    label="Status da Empresa"
                    id="status"
                    value={form.status}
                    onValueChange={(val) => setForm({ ...form, status: val })}
                    options={[
                      { label: 'Ativa', value: 'ativo' },
                      { label: 'Inativa', value: 'inativo' },
                    ]}
                  />
                </div>
              </ConfigCardSection>
            </TabsContent>

            {/* TABA: ENDEREÇO */}
            <TabsContent value="endereco" className="outline-none">
              <ConfigCardSection
                title="Endereço Comercial"
                description="Localização oficial da sede ou estabelecimento da empresa."
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <ConfigInputField
                          label="CEP"
                          id="cep"
                          value={form.cep}
                          onChange={(e) => setForm({ ...form, cep: e.target.value })}
                          placeholder="00000-000"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleBuscarCep}
                        disabled={cepLoading || !form.cep}
                        className="inline-flex items-center justify-center rounded-lg text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {cepLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Preencher'
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <ConfigInputField
                      label="Logradouro"
                      id="logradouro"
                      value={form.logradouro}
                      onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
                      placeholder="Av. Paulista"
                    />
                  </div>

                  <ConfigInputField
                    label="Número"
                    id="numero"
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    placeholder="100"
                  />

                  <ConfigInputField
                    label="Complemento"
                    id="complemento"
                    value={form.complemento}
                    onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                    placeholder="Sala 22"
                  />

                  <ConfigInputField
                    label="Bairro"
                    id="bairro"
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                    placeholder="Centro"
                  />

                  <div className="md:col-span-2">
                    <ConfigInputField
                      label="Cidade"
                      id="cidade"
                      value={form.cidade}
                      onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                      placeholder="São Paulo"
                    />
                  </div>

                  <ConfigInputField
                    label="UF"
                    id="uf"
                    value={form.uf}
                    onChange={(e) => setForm({ ...form, uf: e.target.value })}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </ConfigCardSection>
            </TabsContent>

            {/* TABA: CONTATO */}
            <TabsContent value="contato" className="outline-none">
              <ConfigCardSection
                title="Canais de Contato"
                description="Informações para atendimento ao cliente e canais corporativos."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <ConfigInputField
                    label="Telefone Principal"
                    id="telefone"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    placeholder="(11) 4004-0000"
                  />

                  <ConfigInputField
                    label="WhatsApp Oficial"
                    id="whatsapp"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />

                  <div className="space-y-1">
                    <ConfigInputField
                      label="E-mail"
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="contato@empresa.com.br"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 font-medium">{errors.email}</p>
                    )}
                  </div>

                  <ConfigInputField
                    label="Site da Empresa"
                    id="site"
                    value={form.site}
                    onChange={(e) => setForm({ ...form, site: e.target.value })}
                    placeholder="https://www.empresa.com.br"
                  />
                </div>
              </ConfigCardSection>
            </TabsContent>

            {/* TABA: DADOS OPERACIONAIS */}
            <TabsContent value="dados-operacionais" className="outline-none">
              <ConfigCardSection
                title="Parâmetros de Exibição e Internos"
                description="Dados utilizados na interface administrativa e notas internas da empresa."
              >
                <div className="space-y-4">
                  <ConfigInputField
                    label="Nome Exibido no Sistema"
                    id="nomeExibido"
                    value={form.nomeExibido}
                    onChange={(e) => setForm({ ...form, nomeExibido: e.target.value })}
                    placeholder="NEEX ERP Matriz"
                    description="Como a empresa será mostrada no menu, relatórios e cabeçalhos do sistema."
                  />

                  <ConfigTextareaField
                    label="Observações Internas"
                    id="observacoes"
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    placeholder="Informações administrativas adicionais, observações fiscais particulares..."
                  />
                </div>
              </ConfigCardSection>
            </TabsContent>
          </div>
        </Tabs>

        {/* BOTOES DE AÇÃO */}
        <div className="flex justify-end p-4 rounded-xl border bg-white shadow-sm">
          <ConfigFormActions isSaving={isSaving} saveLabel="Salvar Dados da Empresa" />
        </div>
      </form>
    </div>
  );
}
