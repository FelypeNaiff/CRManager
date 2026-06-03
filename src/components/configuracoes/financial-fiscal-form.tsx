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
  ConfigTextareaField,
  ConfigFormActions,
} from './config-ui';
import { Landmark, FileText, Loader2, Key } from 'lucide-react';

export default function FinancialFiscalForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(null);

  const [form, setForm] = useState({
    regimeApuracao: 'Competência',
    naturezaReceitaPadrao: '',
    naturezaDespesaPadrao: '',
    observacoesFiscais: '',
    pixChave: '',
    pixTipo: 'CNPJ',
    bancoPrincipal: '',
    agenciaPrincipal: '',
    contaPrincipal: '',
  });

  useEffect(() => {
    async function loadCompanyData() {
      try {
        const response = await getCompanyAction();
        if (response.success && response.data) {
          const comp = response.data;
          setCompany(comp);
          const initialFormState = {
            regimeApuracao: comp.regimeApuracao || 'Competência',
            naturezaReceitaPadrao: comp.naturezaReceitaPadrao || '',
            naturezaDespesaPadrao: comp.naturezaDespesaPadrao || '',
            observacoesFiscais: comp.observacoesFiscais || '',
            pixChave: comp.pixChave || '',
            pixTipo: comp.pixTipo || 'CNPJ',
            bancoPrincipal: comp.bancoPrincipal || '',
            agenciaPrincipal: comp.agenciaPrincipal || '',
            contaPrincipal: comp.contaPrincipal || '',
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
          description: 'Erro ao carregar configurações financeiro-fiscais.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadCompanyData();
  }, [toast]);

  const handleCancel = () => {
    if (initialData) {
      setForm(initialData);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...company,
        ...form,
      };

      const res = await updateCompanyAction(payload, 'financeiro-fiscal');
      if (res.success) {
        setInitialData(form);
        if (res.data) setCompany(res.data);
        toast({
          title: 'Sucesso',
          description: 'Parâmetros financeiro-fiscais atualizados com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao Salvar',
          description: res.error || 'Erro ao salvar parâmetros no banco.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro de comunicação ao salvar alterações.',
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
        <span className="text-sm text-muted-foreground">Carregando configurações financeiro-fiscais...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <ConfigPageHeader
        title="Financeiro / Fiscal"
        description="Configure regimes de apuração, naturezas padrão e dados de pagamento da empresa."
        breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Financeiro / Fiscal' }]}
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Parâmetros Fiscais */}
        <ConfigCardSection
          title="Parâmetros Fiscais de Apuração"
          description="Configurações tributárias complementares."
          icon={FileText}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ConfigSelectField
              label="Regime de Apuração"
              id="regimeApuracao"
              value={form.regimeApuracao}
              onValueChange={(val) => setForm({ ...form, regimeApuracao: val })}
              options={[
                { label: 'Competência', value: 'Competência' },
                { label: 'Caixa', value: 'Caixa' },
              ]}
            />

            <ConfigInputField
              label="Natureza de Receita Padrão"
              id="naturezaReceitaPadrao"
              value={form.naturezaReceitaPadrao}
              onChange={(e) => setForm({ ...form, naturezaReceitaPadrao: e.target.value })}
              placeholder="Ex: Venda de Mercadorias"
            />

            <ConfigInputField
              label="Natureza de Despesa Padrão"
              id="naturezaDespesaPadrao"
              value={form.naturezaDespesaPadrao}
              onChange={(e) => setForm({ ...form, naturezaDespesaPadrao: e.target.value })}
              placeholder="Ex: Pagamento de Fornecedores"
            />

            <div className="md:col-span-2">
              <ConfigTextareaField
                label="Observações Fiscais Internas"
                id="observacoesFiscais"
                value={form.observacoesFiscais}
                onChange={(e) => setForm({ ...form, observacoesFiscais: e.target.value })}
                placeholder="Anotações internas sobre apuração, impostos ou observações adicionais..."
              />
            </div>
          </div>
        </ConfigCardSection>

        {/* Informações Bancárias */}
        <ConfigCardSection
          title="Dados Bancários Principais"
          description="Contas e chaves para transferências e faturamento."
          icon={Landmark}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <ConfigInputField
                label="Banco"
                id="bancoPrincipal"
                value={form.bancoPrincipal}
                onChange={(e) => setForm({ ...form, bancoPrincipal: e.target.value })}
                placeholder="Ex: Itaú, Bradesco..."
              />
            </div>

            <ConfigInputField
              label="Agência"
              id="agenciaPrincipal"
              value={form.agenciaPrincipal}
              onChange={(e) => setForm({ ...form, agenciaPrincipal: e.target.value })}
              placeholder="Ex: 0123"
            />

            <ConfigInputField
              label="Conta Corrente"
              id="contaPrincipal"
              value={form.contaPrincipal}
              onChange={(e) => setForm({ ...form, contaPrincipal: e.target.value })}
              placeholder="Ex: 12345-6"
            />
          </div>
        </ConfigCardSection>

        {/* Informações PIX */}
        <ConfigCardSection
          title="Chave PIX Principal"
          description="Chave de recebimento corporativo."
          icon={Key}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <ConfigSelectField
                label="Tipo de Chave"
                id="pixTipo"
                value={form.pixTipo}
                onValueChange={(val) => setForm({ ...form, pixTipo: val })}
                options={[
                  { label: 'CNPJ', value: 'CNPJ' },
                  { label: 'CPF', value: 'CPF' },
                  { label: 'E-mail', value: 'E-mail' },
                  { label: 'Telefone', value: 'Telefone' },
                  { label: 'Chave Aleatória', value: 'Aleatória' },
                ]}
              />
            </div>

            <div className="md:col-span-2">
              <ConfigInputField
                label="Chave PIX"
                id="pixChave"
                value={form.pixChave}
                onChange={(e) => setForm({ ...form, pixChave: e.target.value })}
                placeholder="Insira a chave PIX..."
              />
            </div>
          </div>
        </ConfigCardSection>

        {/* BOTOES DE AÇÃO - FIXOS NO RODAPÉ */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 p-4 mt-6 bg-slate-50/90 backdrop-blur border-t rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <ConfigFormActions 
            isSaving={isSaving} 
            isDirty={isDirty} 
            onCancel={handleCancel} 
            onSave={handleSave} 
            saveLabel="Salvar Configurações Financeiras" 
            updatedAt={company?.updatedAt}
            updatedBy={company?.updatedBy}
          />
        </div>
      </form>
    </div>
  );
}
