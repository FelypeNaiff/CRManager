'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getCompanyAction, updateCompanyAction } from '@/lib/configuracoes/company-actions';
import { isFormDirty } from '@/lib/utils/form-utils';
import {
  ConfigPageHeader,
  ConfigCardSection,
  ConfigInputField,
  ConfigSelectField,
  ConfigFormActions,
  ConfigConfirmDialog,
} from './config-ui';
import { FileBox, Loader2 } from 'lucide-react';

export default function FiscalForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(null);

  const [form, setForm] = useState({
    cnpjCpf: '',
    razaoSocial: '',
    nomeFantasia: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    regimeTributario: 'Simples Nacional',
    crt: '1',
    cnae: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // CNPJ Lookup Dialog State
  const [showConfirmLookup, setShowConfirmLookup] = useState(false);
  const [lookupData, setLookupData] = useState<any>(null);

  useEffect(() => {
    async function loadCompanyData() {
      try {
        const response = await getCompanyAction();
        if (response.success && response.data) {
          const comp = response.data;
          setCompany(comp);
          const initialFormState = {
            cnpjCpf: comp.cnpjCpf || '',
            razaoSocial: comp.razaoSocial || '',
            nomeFantasia: comp.nomeFantasia || '',
            inscricaoEstadual: comp.inscricaoEstadual || '',
            inscricaoMunicipal: comp.inscricaoMunicipal || '',
            regimeTributario: comp.regimeTributario || 'Simples Nacional',
            crt: comp.crt || '1',
            cnae: comp.cnae || '',
          };
          setInitialData(initialFormState);
          setForm(initialFormState);
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
          description: 'Erro ao carregar dados fiscais da empresa.',
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBuscarCnpj = async () => {
    const cleanCnpj = form.cnpjCpf.replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      toast({
        title: 'Aviso',
        description: 'Informe um CNPJ válido com 14 dígitos para consultar.',
        variant: 'destructive',
      });
      return;
    }

    setCnpjLoading(true);
    try {
      const response = await fetch(`/api/brasilapi/cnpj/${cleanCnpj}`);
      const result = await response.json();

      if (response.ok && result.success && result.data) {
        setLookupData(result.data);
        setShowConfirmLookup(true);
      } else {
        toast({
          title: 'Erro ao Buscar',
          description: result.error || 'CNPJ não encontrado.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro de Conexão',
        description: 'Erro ao conectar-se com o serviço de CNPJ.',
        variant: 'destructive',
      });
    } finally {
      setCnpjLoading(false);
    }
  };

  const applyLookupData = () => {
    if (!lookupData) return;

    setForm((prev) => ({
      ...prev,
      // Only prefill if the field is empty, keeping manually written fields intact
      razaoSocial: prev.razaoSocial || lookupData.razaoSocial,
      nomeFantasia: prev.nomeFantasia || lookupData.nomeFantasia,
      cnae: prev.cnae || lookupData.cnae,
    }));

    // If address fields exist in the fetched company metadata, we can merge them into company state as well
    if (company) {
      setCompany((prev: any) => ({
        ...prev,
        logradouro: prev.logradouro || lookupData.logradouro,
        numero: prev.numero || lookupData.numero,
        complemento: prev.complemento || lookupData.complemento,
        bairro: prev.bairro || lookupData.bairro,
        cidade: prev.cidade || lookupData.cidade,
        uf: prev.uf || lookupData.uf,
        cep: prev.cep || lookupData.cep,
        telefone: prev.telefone || lookupData.telefone,
        email: prev.email || lookupData.email,
      }));
    }

    toast({
      title: 'Sucesso',
      description: 'Dados cadastrais do CNPJ preenchidos nos campos disponíveis. Salve para persistir as alterações.',
    });
    setShowConfirmLookup(false);
  };

  const handleCancel = () => {
    if (initialData) {
      setForm(initialData);
      setErrors({});
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      const payload = {
        ...company,
        ...form,
      };

      const res = await updateCompanyAction(payload, 'fiscal');
      if (res.success) {
        setInitialData(form);
        if (res.data) setCompany(res.data);
        toast({
          title: 'Sucesso',
          description: 'Dados fiscais atualizados com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao Salvar',
          description: res.error || 'Erro ao salvar dados fiscais.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro de comunicação ao salvar dados fiscais.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = isFormDirty(form, initialData);

  if (isLoading) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando dados fiscais da empresa...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <ConfigPageHeader
        title="Dados Fiscais"
        description="Gerencie as informações fiscais oficiais da empresa para identificação e tributação."
        breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Fiscal' }]}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <ConfigCardSection
          title="Identificação Jurídica"
          description="Informações cadastrais e tributárias."
          icon={FileBox}
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
              label="CRT (Código de Regime Tributário)"
              id="crt"
              value={form.crt}
              onValueChange={(val) => setForm({ ...form, crt: val })}
              options={[
                { label: '1 - Simples Nacional', value: '1' },
                { label: '2 - Simples Nacional - excesso de sublimite', value: '2' },
                { label: '3 - Regime Normal', value: '3' },
              ]}
            />
          </div>
        </ConfigCardSection>

        {/* BOTOES DE AÇÃO - FIXOS NO RODAPÉ */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 p-4 mt-6 bg-slate-50/90 backdrop-blur border-t rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <ConfigFormActions 
            isSaving={isSaving} 
            isDirty={isDirty} 
            onCancel={handleCancel} 
            onSave={handleSave} 
            saveLabel="Salvar Dados Fiscais" 
            updatedAt={company?.updatedAt}
            updatedBy={company?.updatedBy}
          />
        </div>
      </form>

      {/* Confirmation Dialog for prefilling CNPJ data */}
      <ConfigConfirmDialog
        open={showConfirmLookup}
        onOpenChange={setShowConfirmLookup}
        title="Confirmar Auto-preenchimento"
        description="Deseja preencher o formulário com os dados cadastrais encontrados na BrasilAPI? Campos já preenchidos manualmente não serão sobrescritos."
        onConfirm={applyLookupData}
      />
    </div>
  );
}
