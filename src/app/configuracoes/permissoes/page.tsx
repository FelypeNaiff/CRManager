'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getRolesAction } from '@/lib/roles/role-actions';
import { ConfigPageHeader, ConfigStatusBadge, ConfigDataTable, ConfigDataTableHeader, ConfigDataTableBody, ConfigDataTableRow, ConfigDataTableHead, ConfigDataTableCell } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { Search, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function PermissoesPage() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await getRolesAction();
      if (res.success && res.data) {
        setRoles(res.data);
      } else {
        toast({ title: 'Erro', description: res.error || 'Erro ao carregar', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <ConfigPageHeader
        title="Matriz de Permissões (RBAC)"
        description="Gerencie detalhadamente o que cada Grupo de Usuário pode visualizar, criar, editar, ou excluir."
        breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Permissões' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border p-4 rounded-xl shadow-sm">
          <div className="text-sm text-muted-foreground font-medium">Grupos Ativos</div>
          <div className="text-2xl font-bold mt-1">{roles.filter(r => r.status === 'ACTIVE').length}</div>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-sm">
          <div className="text-sm text-muted-foreground font-medium">Total de Módulos (Sistema)</div>
          <div className="text-2xl font-bold mt-1">21</div>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-sm">
          <div className="text-sm text-muted-foreground font-medium">Total de Ações Possíveis</div>
          <div className="text-2xl font-bold mt-1">54</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar grupo por nome..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="rounded-md border overflow-hidden">
          <ConfigDataTable>
            <ConfigDataTableHeader className="bg-slate-50">
              <ConfigDataTableRow>
                <ConfigDataTableHead>Grupo</ConfigDataTableHead>
                <ConfigDataTableHead className="text-center">Permissões Específicas</ConfigDataTableHead>
                <ConfigDataTableHead>Status</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {loading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Carregando matrizes...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredRoles.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum grupo encontrado.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredRoles.map(role => {
                  const permissionCount = role.permissions?.length || 0;
                  return (
                    <ConfigDataTableRow key={role.id}>
                      <ConfigDataTableCell>
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          {role.name}
                          {role.isAdmin && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">ROOT</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{role.description || 'Sem descrição'}</div>
                      </ConfigDataTableCell>
                      <ConfigDataTableCell className="text-center">
                        {role.isAdmin ? (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Acesso Ilimitado</span>
                        ) : (
                          <div className="inline-flex items-center justify-center bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold">
                            {permissionCount} concessões
                          </div>
                        )}
                      </ConfigDataTableCell>
                      <ConfigDataTableCell>
                        <ConfigStatusBadge status={role.status === 'ACTIVE' ? 'ativo' : 'inativo'} />
                      </ConfigDataTableCell>
                      <ConfigDataTableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="h-8 gap-2 border-purple-200 text-purple-700 hover:bg-purple-50">
                          <Link href={`/configuracoes/grupos-usuarios/${role.id}/permissoes`}>
                            <ShieldCheck className="h-4 w-4" />
                            Editar Matriz
                          </Link>
                        </Button>
                      </ConfigDataTableCell>
                    </ConfigDataTableRow>
                  )
                })
              )}
            </ConfigDataTableBody>
          </ConfigDataTable>
        </div>
      </div>
    </div>
  );
}
