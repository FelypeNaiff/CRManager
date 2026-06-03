'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getPermissionCatalogAction, getRolePermissionsAction, updateRolePermissionsAction, applyTemplateAction } from '@/lib/permissions/permission-actions';
import { PermissionDefinition, PermissionModule, PermissionAction, PERMISSION_MODULES, PERMISSION_ACTIONS } from '@/lib/auth/permission-catalog';
import { ConfigPageHeader, ConfigFormActions } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Info, ShieldCheck, Search } from 'lucide-react';
import { isFormDirty } from '@/lib/utils/form-utils';
import { Input } from '@/components/ui/input';

export default function MatrizPermissoesPage(props: { params: Promise<{ grupoId: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const [role, setRole] = useState<any>(null);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>([]);
  
  // State for permissions: key is "MODULE:ACTION", value is boolean
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [initialPermissions, setInitialPermissions] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [catRes, roleRes] = await Promise.all([
        getPermissionCatalogAction(),
        getRolePermissionsAction(params.grupoId)
      ]);

      if (catRes.success && catRes.data) {
        setCatalog(catRes.data);
      } else {
        toast({ title: 'Erro', description: 'Falha ao carregar catálogo', variant: 'destructive' });
      }

      if (roleRes.success && roleRes.data) {
        setRole(roleRes.data.role);
        
        const permsMap: Record<string, boolean> = {};
        roleRes.data.permissions.forEach((p: any) => {
          if (p.allowed) permsMap[`${p.module}:${p.action}`] = true;
        });

        setPermissions(permsMap);
        setInitialPermissions(permsMap);
      } else {
        toast({ title: 'Erro', description: roleRes.error || 'Falha ao carregar grupo', variant: 'destructive' });
        router.push('/configuracoes/permissoes');
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.grupoId]);

  const handleToggle = (module: string, action: string) => {
    const key = `${module}:${action}`;
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleToggleAllModule = (module: string, turnOn: boolean) => {
    const modulePerms = catalog.filter(c => c.module === module);
    setPermissions(prev => {
      const next = { ...prev };
      modulePerms.forEach(p => {
        next[`${p.module}:${p.action}`] = turnOn;
      });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(permissions).map(([key, allowed]) => {
        const [module, action] = key.split(':');
        return { module, action, allowed };
      });

      const res = await updateRolePermissionsAction(params.grupoId, payload);
      
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Matriz de permissões salva com sucesso!' });
        setInitialPermissions(permissions);
      } else {
        toast({ title: 'Acesso Negado', description: res.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = async (template: string) => {
    if (!confirm(`Deseja substituir as permissões atuais pelo template ${template}?`)) return;
    
    setApplying(true);
    try {
      const res = await applyTemplateAction(params.grupoId, template);
      if (res.success) {
        toast({ title: 'Sucesso', description: `Template ${template} aplicado.` });
        loadData();
      } else {
        toast({ title: 'Erro', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro ao aplicar template.', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando matriz...</div>;
  }

  if (!role) return null;

  const isDirty = isFormDirty(permissions, initialPermissions);

  const groupedCatalog = catalog.reduce((acc, curr) => {
    if (!acc[curr.module]) acc[curr.module] = [];
    acc[curr.module].push(curr);
    return acc;
  }, {} as Record<string, PermissionDefinition[]>);

  // Filter modules by search
  const visibleModules = Object.keys(groupedCatalog).filter(mod => 
    mod.toLowerCase().includes(searchQuery.toLowerCase()) || 
    groupedCatalog[mod].some(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-[1400px] space-y-6 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <ConfigPageHeader
          title={`Permissões: ${role.name}`}
          description={role.isAdmin ? "Este grupo possui privilégios de ROOT Administrativo. A matriz serve apenas para documentação, pois o acesso é total." : "Selecione pontualmente o que este grupo pode acessar ou aplicar templates rápidos."}
          breadcrumb={[
            { label: 'Configurações', href: '/configuracoes' },
            { label: 'Permissões', href: '/configuracoes/permissoes' },
            { label: role.name }
          ]}
        />
        
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-sm font-medium text-slate-500 mb-1">Aplicar Template Rápido:</div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('VENDEDOR')} disabled={applying}>Vendedor</Button>
            <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CAIXA')} disabled={applying}>Caixa</Button>
            <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('GERENTE')} disabled={applying}>Gerente</Button>
            <Button variant="outline" size="sm" onClick={() => handleApplyTemplate('CONSULTA')} disabled={applying}>Só Consulta</Button>
            <Button variant="default" className="bg-rose-900 text-rose-50 hover:bg-rose-950" size="sm" onClick={() => handleApplyTemplate('ADMIN')} disabled={applying}>Admin Full</Button>
          </div>
        </div>
      </div>

      {role.isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900">
            <strong>Proteção Ativada:</strong> Este é um grupo administrador. O sistema impedirá que você remova permissões críticas (como gerenciar permissões e usuários) se este for o único grupo administrador ativo, garantindo que o sistema não fique sem ROOT.
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 max-w-sm w-full">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar módulo ou permissão..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 bg-white"
            />
          </div>
          <div className="text-xs text-muted-foreground font-medium hidden sm:block">
            {visibleModules.length} módulos visíveis
          </div>
        </div>

        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100/50 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-700 border-b w-[250px]">Módulo</th>
                <th className="px-6 py-3 font-semibold text-slate-700 border-b">Ações e Concessões</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleModules.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhuma permissão encontrada para a pesquisa.
                  </td>
                </tr>
              ) : (
                visibleModules.map(moduleName => {
                  const perms = groupedCatalog[moduleName];
                  const allChecked = perms.every(p => permissions[`${p.module}:${p.action}`]);
                  const someChecked = perms.some(p => permissions[`${p.module}:${p.action}`]);

                  return (
                    <tr key={moduleName} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5 align-top border-r bg-white group-hover:bg-slate-50/50">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-900 tracking-tight">{moduleName.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-muted-foreground">{perms[0]?.category}</span>
                          
                          <div className="mt-3 flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-slate-600 hover:text-slate-900">
                              <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                checked={allChecked}
                                ref={input => { if (input) input.indeterminate = !allChecked && someChecked; }}
                                onChange={(e) => handleToggleAllModule(moduleName, e.target.checked)}
                              />
                              Selecionar Módulo
                            </label>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-4">
                          {perms.map(p => {
                            const isChecked = !!permissions[`${p.module}:${p.action}`];
                            return (
                              <label 
                                key={p.action} 
                                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                  isChecked 
                                    ? 'bg-emerald-50/50 border-emerald-200' 
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                                style={{ width: 'calc(33.333% - 11px)', minWidth: '220px' }}
                              >
                                <input 
                                  type="checkbox" 
                                  className={`mt-0.5 rounded border-slate-300 focus:ring-primary ${p.critical ? 'text-rose-600 focus:ring-rose-600' : 'text-primary'}`}
                                  checked={isChecked}
                                  onChange={() => handleToggle(p.module, p.action)}
                                />
                                <div className="flex flex-col -mt-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-semibold text-[13px] ${isChecked ? 'text-emerald-900' : 'text-slate-700'}`}>
                                      {p.label}
                                    </span>
                                    {p.critical && (
                                      <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase tracking-wider" title="Ação de Alto Risco">Crit</span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{p.description}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)] z-40 md:pl-64">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-slate-500">
            {Object.values(permissions).filter(Boolean).length} permissões concedidas.
          </div>
          <ConfigFormActions
            isSaving={saving}
            isDirty={isDirty}
            onCancel={() => {
              setPermissions(initialPermissions);
            }}
            onSave={handleSave}
            saveLabel="Salvar Matriz"
          />
        </div>
      </div>
    </div>
  );
}
