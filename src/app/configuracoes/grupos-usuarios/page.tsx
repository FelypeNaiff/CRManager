'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getRolesAction } from '@/lib/roles/role-actions';
import { ConfigPageHeader, ConfigStatusBadge, ConfigDataTable, ConfigDataTableHeader, ConfigDataTableBody, ConfigDataTableRow, ConfigDataTableHead, ConfigDataTableCell } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { Plus, Search, Edit3, KeyRound, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import RoleFormModal from '@/components/users/role-form-modal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

export default function GruposUsuariosPage() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await getRolesAction();
      if (res.success && res.data) {
        setRoles(res.data);
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Erro ao carregar grupos',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro de comunicação',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleOpenCreate = () => {
    setSelectedRoleId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    setSelectedRoleId(id);
    setIsFormOpen(true);
  };

  const handleNotImplemented = () => {
    toast({ title: 'Aviso', description: 'Visualizar Permissões em breve.' });
  };

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ConfigPageHeader
          title="Grupos de Usuários"
          description="Crie perfis e defina os níveis de acesso (Permissões) para os funcionários."
          breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Grupos' }]}
        />
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button variant="secondary" asChild className="bg-rose-900 text-rose-50 hover:bg-rose-950">
            <Link href="/configuracoes/usuarios">
              <Users className="h-4 w-4 mr-2" /> Usuários
            </Link>
          </Button>
          <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Novo Grupo
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome do grupo..." 
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
                <ConfigDataTableHead className="text-center">Usuários</ConfigDataTableHead>
                <ConfigDataTableHead>Comissão Padrão</ConfigDataTableHead>
                <ConfigDataTableHead>Limite Desconto</ConfigDataTableHead>
                <ConfigDataTableHead>Status</ConfigDataTableHead>
                <ConfigDataTableHead>Última Att.</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {loading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando grupos...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredRoles.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum grupo encontrado.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredRoles.map(role => (
                  <ConfigDataTableRow key={role.id}>
                    <ConfigDataTableCell>
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {role.name}
                        {role.isAdmin && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">ROOT</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{role.description || 'Sem descrição'}</div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-center">
                      <div className="inline-flex items-center justify-center bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold">
                        {role._count?.users || 0}
                      </div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      {role.defaultCommissionRate !== null ? `${Number(role.defaultCommissionRate)}%` : '-'}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      {role.defaultMaxDiscountPercentage !== null ? `${Number(role.defaultMaxDiscountPercentage)}%` : '-'}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      <ConfigStatusBadge status={role.status === 'ACTIVE' ? 'ativo' : 'inativo'} />
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-xs text-muted-foreground">
                      {role.updatedAt ? format(new Date(role.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={handleNotImplemented} title="Permissões">
                          <KeyRound className="h-4 w-4 text-purple-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(role.id)} title="Editar Grupo">
                          <Edit3 className="h-4 w-4 text-amber-600" />
                        </Button>
                      </div>
                    </ConfigDataTableCell>
                  </ConfigDataTableRow>
                ))
              )}
            </ConfigDataTableBody>
          </ConfigDataTable>
        </div>
      </div>

      <RoleFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        roleId={selectedRoleId} 
        onSuccess={loadRoles} 
      />
      
    </div>
  );
}
