'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Store, Mail, Phone, Image as ImageIcon, Loader2, Info } from 'lucide-react';
import { ConfigPageHeader } from '@/components/configuracoes/config-ui';
import { getCompanyAction, updateCompanyAction } from '@/lib/configuracoes/company-actions';
import { useToast } from '@/hooks/use-toast';

export default function ConfiguracoesGeraisPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [company, setCompany] = useState<any>(null);

  const [form, setForm] = useState({
    nomeEmpresa: '',
    cnpj: '',
    emailSistema: '',
    whatsappEmpresa: '',
    telefoneEmpresa: '',
    cidadeUf: '',
    regimeTributario: '',
    status: '',
    timezone: 'America/Belem',
    tema: 'light',
    notificacaoEmail: true,
    notificacaoWhatsapp: true,
    auditoriaAtiva: true,
    backupAutomatico: true,
  });

  useEffect(() => {
    async function loadCompany() {
      try {
        const res = await getCompanyAction();
        if (res.success && res.data) {
          const comp = res.data;
          setCompany(comp);
          const localidade = comp.cidade && comp.uf ? `${comp.cidade} / ${comp.uf}` : comp.cidade || comp.uf || 'Não informado';
          setForm((prev) => ({
            ...prev,
            nomeEmpresa: comp.nomeFantasia || comp.razaoSocial || '',
            cnpj: comp.cnpjCpf || '',
            emailSistema: comp.email || '',
            whatsappEmpresa: comp.whatsapp || '',
            telefoneEmpresa: comp.telefone || '',
            cidadeUf: localidade,
            regimeTributario: comp.regimeTributario || 'Não informado',
            status: comp.status === 'ativo' ? 'Ativa' : 'Inativa',
          }));
        } else {
          toast({
            title: 'Erro',
            description: res.error || 'Não foi possível carregar os dados da empresa.',
            variant: 'destructive',
          });
        }
      } catch (err) {
        toast({
          title: 'Erro',
          description: 'Erro de comunicação ao obter dados da empresa.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadCompany();
  }, [toast]);

  const handleSave = async () => {
    if (!company) return;

    setIsSaving(true);
    try {
      // Merge updated fields into current company structure
      const payload = {
        ...company,
        nomeFantasia: form.nomeEmpresa,
        razaoSocial: form.nomeEmpresa,
        cnpjCpf: form.cnpj,
        email: form.emailSistema,
        whatsapp: form.whatsappEmpresa,
        telefone: form.telefoneEmpresa,
      };

      const res = await updateCompanyAction(payload, 'gerais');
      if (res.success) {
        toast({
          title: 'Sucesso',
          description: 'Configurações gerais atualizadas com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao Salvar',
          description: res.error || 'Ocorreu um erro ao salvar as alterações.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Erro de comunicação ao salvar as alterações.',
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
        <span className="text-sm text-muted-foreground">Carregando configurações gerais...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <ConfigPageHeader
          title="Configurações Gerais"
          description="Resumo corporativo da empresa, aparência, segurança e rotinas de sistema."
          breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Gerais' }]}
        />
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-white">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar alterações
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Resumo Consolidado da Empresa */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> Dados da Empresa
          </h2>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome / Razão Social</Label>
              <Input
                value={form.nomeEmpresa}
                onChange={(e) => setForm({ ...form, nomeEmpresa: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> E-mail
                </Label>
                <Input
                  value={form.emailSistema}
                  onChange={(e) => setForm({ ...form, emailSistema: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" /> WhatsApp
                </Label>
                <Input
                  value={form.whatsappEmpresa}
                  onChange={(e) => setForm({ ...form, whatsappEmpresa: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" /> Telefone Fixo
                </Label>
                <Input
                  value={form.telefoneEmpresa}
                  onChange={(e) => setForm({ ...form, telefoneEmpresa: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" /> Cidade / UF
                </Label>
                <Input
                  value={form.cidadeUf}
                  disabled
                  className="bg-slate-50 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Regime Tributário</Label>
                <Input
                  value={form.regimeTributario}
                  disabled
                  className="bg-slate-50 cursor-not-allowed"
                />
              </div>
              <div className="grid gap-2">
                <Label>Status da Empresa</Label>
                <Input
                  value={form.status}
                  disabled
                  className="bg-slate-50 cursor-not-allowed font-medium text-emerald-600"
                />
              </div>
            </div>
            
            <div className="flex gap-2 items-center bg-blue-50 text-blue-800 p-3 rounded-lg border text-xs">
              <Info className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                Cidade/UF, Regime e Status são atualizados através das abas de Endereço e Fiscal.
              </span>
            </div>
          </div>
        </section>

        {/* Sistema e Rotinas */}
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Sistema e Segurança</h2>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Timezone Padrão</Label>
                <Input
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-0.5">
                  <Label>Log de Auditoria</Label>
                  <div className="text-xs text-muted-foreground">Gravar todas as ações críticas no banco</div>
                </div>
                <Switch
                  checked={form.auditoriaAtiva}
                  onCheckedChange={(checked) => setForm({ ...form, auditoriaAtiva: checked })}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-0.5">
                  <Label>Backup Automático</Label>
                  <div className="text-xs text-muted-foreground">Sincronização redundante dos dados</div>
                </div>
                <Switch
                  checked={form.backupAutomatico}
                  onCheckedChange={(checked) => setForm({ ...form, backupAutomatico: checked })}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Notificações Inteligentes</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Avisos por E-mail</Label>
                <Switch
                  checked={form.notificacaoEmail}
                  onCheckedChange={(checked) => setForm({ ...form, notificacaoEmail: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Integração WhatsApp Bot</Label>
                <Switch
                  checked={form.notificacaoWhatsapp}
                  onCheckedChange={(checked) => setForm({ ...form, notificacaoWhatsapp: checked })}
                />
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" className="w-full">
                  Configurar API WhatsApp
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
