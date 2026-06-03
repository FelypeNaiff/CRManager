'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getCompanyAction, updateCompanyAction } from '@/lib/configuracoes/company-actions';
import { isFormDirty } from '@/lib/utils/form-utils';
import {
  ConfigPageHeader,
  ConfigCardSection,
  ConfigInputField,
  ConfigFormActions,
} from './config-ui';
import { Mail, Phone, Globe, MessageCircle, Loader2 } from 'lucide-react';

export default function ContactForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(null);

  const [form, setForm] = useState({
    telefone: '',
    whatsapp: '',
    email: '',
    site: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadCompanyData() {
      try {
        const response = await getCompanyAction();
        if (response.success && response.data) {
          const comp = response.data;
          setCompany(comp);
          const initialFormState = {
            telefone: comp.telefone || '',
            whatsapp: comp.whatsapp || '',
            email: comp.email || '',
            site: comp.site || '',
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
          description: 'Erro ao carregar contatos da empresa.',
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
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'E-mail inválido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        description: 'Verifique os campos obrigatórios e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Merge values into the original company object to avoid missing required fields like razaoSocial
      const payload = {
        ...company,
        ...form,
      };

      const res = await updateCompanyAction(payload, 'contatos');
      if (res.success) {
        setInitialData(form);
        if (res.data) setCompany(res.data);
        toast({
          title: 'Sucesso',
          description: 'Canais de contato atualizados com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao Salvar',
          description: res.error || 'Ocorreu um erro ao salvar.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro de comunicação ao salvar contatos.',
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
        <span className="text-sm text-muted-foreground">Carregando contatos da empresa...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <ConfigPageHeader
        title="Contatos"
        description="Configure os canais oficiais de comunicação, e-mails comerciais e corporativos."
        breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Contatos' }]}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <ConfigCardSection
          title="Canais de Comunicação"
          description="Informações de atendimento e canais digitais."
          icon={Phone}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <ConfigInputField
                label="Telefone Principal"
                id="telefone"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(11) 4004-0000"
              />
            </div>

            <div className="space-y-1">
              <ConfigInputField
                label="WhatsApp Oficial"
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-1">
              <ConfigInputField
                label="E-mail Principal"
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

            <div className="space-y-1">
              <ConfigInputField
                label="Site da Empresa"
                id="site"
                value={form.site}
                onChange={(e) => setForm({ ...form, site: e.target.value })}
                placeholder="https://www.empresa.com.br"
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
            saveLabel="Salvar Contatos" 
            updatedAt={company?.updatedAt}
            updatedBy={company?.updatedBy}
          />
        </div>
      </form>
    </div>
  );
}
