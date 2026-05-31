'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getCompanyAction, updateCompanyAction } from '@/lib/configuracoes/company-actions';
import {
  ConfigPageHeader,
  ConfigCardSection,
  ConfigInputField,
  ConfigFormActions,
} from './config-ui';
import { MapPin, Loader2 } from 'lucide-react';

export default function AddressForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);

  const [form, setForm] = useState({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  });

  useEffect(() => {
    async function loadCompanyData() {
      try {
        const response = await getCompanyAction();
        if (response.success && response.data) {
          const comp = response.data;
          setCompany(comp);
          setForm({
            cep: comp.cep || '',
            logradouro: comp.logradouro || '',
            numero: comp.numero || '',
            complemento: comp.complemento || '',
            bairro: comp.bairro || '',
            cidade: comp.cidade || '',
            uf: comp.uf || '',
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
          description: 'Erro ao carregar endereço da empresa.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadCompanyData();
  }, [toast]);

  const handleBuscarCep = async () => {
    const cleanCep = form.cep.replace(/\D/g, '');
    if (!cleanCep || cleanCep.length !== 8) {
      toast({
        title: 'Aviso',
        description: 'Informe um CEP válido com 8 dígitos para consultar.',
        variant: 'destructive',
      });
      return;
    }

    setCepLoading(true);
    try {
      const response = await fetch(`/api/brasilapi/cep/${cleanCep}`);
      const result = await response.json();

      if (response.ok && result.success && result.data) {
        setForm((prev) => ({
          ...prev,
          logradouro: result.data.logradouro || prev.logradouro,
          bairro: result.data.bairro || prev.bairro,
          cidade: result.data.cidade || prev.cidade,
          uf: result.data.uf || prev.uf,
        }));
        toast({
          title: 'Sucesso',
          description: 'Endereço encontrado e preenchido.',
        });
      } else {
        toast({
          title: 'Erro ao Buscar',
          description: result.error || 'CEP não encontrado ou inválido.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro de Conexão',
        description: 'Erro ao conectar-se com o serviço de CEP.',
        variant: 'destructive',
      });
    } finally {
      setCepLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...company,
        ...form,
      };

      const res = await updateCompanyAction(payload, 'enderecos');
      if (res.success) {
        toast({
          title: 'Sucesso',
          description: 'Endereço atualizado com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao Salvar',
          description: res.error || 'Erro ao persistir endereço no banco.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro de comunicação ao salvar endereço.',
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
        <span className="text-sm text-muted-foreground">Carregando endereço da empresa...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <ConfigPageHeader
        title="Endereço"
        description="Configure o endereço comercial principal da sede ou filial."
        breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Endereços' }]}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <ConfigCardSection
          title="Endereço Comercial"
          description="Localização física da empresa."
          icon={MapPin}
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
                    'Consultar'
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
              placeholder="123"
            />

            <ConfigInputField
              label="Complemento"
              id="complemento"
              value={form.complemento}
              onChange={(e) => setForm({ ...form, complemento: e.target.value })}
              placeholder="Sala 45"
            />

            <ConfigInputField
              label="Bairro"
              id="bairro"
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              placeholder="Bela Vista"
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

        <div className="flex justify-end p-4 rounded-xl border bg-white shadow-sm">
          <ConfigFormActions isSaving={isSaving} saveLabel="Salvar Endereço" />
        </div>
      </form>
    </div>
  );
}
