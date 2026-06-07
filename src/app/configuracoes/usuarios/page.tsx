'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getUsersAction } from '@/lib/users/user-actions';
import { ConfigPageHeader, ConfigStatusBadge, ConfigDataTable, ConfigDataTableHeader, ConfigDataTableBody, ConfigDataTableRow, ConfigDataTableHead, ConfigDataTableCell } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { Plus, Search, Edit2, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import UserFormModal from '@/components/users/user-form-modal';
import ResetPinDialog from '@/components/users/reset-pin-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function UsuariosPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  const [isResetPinOpen, setIsResetPinOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await getUsersAction();
      if (res.success && res.data) {
        setUsers(res.data);
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Erro ao carregar usuários',
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
    loadUsers();
  }, []);

  const handleOpenCreate = () => {
    setSelectedUserId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    setSelectedUserId(id);
    setIsFormOpen(true);
  };

  const handleOpenResetPin = (id: string) => {
    setResetUserId(id);
    setIsResetPinOpen(true);
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ConfigPageHeader
          title="Gestão de Usuários"
          description="Gerencie os acessos, permissões, limites e PINs de autorização da sua equipe."
          breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Usuários' }]}
        />
        <Button onClick={handleOpenCreate} className="self-start sm:self-auto">
          <Plus className="mr-2 h-4 w-4" /> Nãovo Usuário
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="rounded-md border overflow-hidden">
          <ConfigDataTable>
            <ConfigDataTableHeader className="bg-slate-50">
              <ConfigDataTableRow>
                <ConfigDataTableHead>Nãome & E-mail</ConfigDataTableHead>
                <ConfigDataTableHead>Cargo / Grupo</ConfigDataTableHead>
                <ConfigDataTableHead>Comissão</ConfigDataTableHead>
                <ConfigDataTableHead>Limite Desc.</ConfigDataTableHead>
                <ConfigDataTableHead>Status</ConfigDataTableHead>
                <ConfigDataTableHead>Última Att.</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {loading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando usuários...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredUsers.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado.
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : (
                filteredUsers.map(user => (
                  <ConfigDataTableRow key={user.id}>
                    <ConfigDataTableCell>
                      <div className="font-medium text-slate-900">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      <div className="text-sm">{user.cargo || '-'}</div>
                      <div className="text-xs text-muted-foreground">{user.role?.name || 'Sem grupo'}</div>
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      {user.commissionRate ? `${Number(user.commissionRate)}%` : '-'}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      {user.maxDiscountPercentage !== null ? `${Number(user.maxDiscountPercentage)}%` : '-'}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell>
                      <ConfigStatusBadge status={user.status === 'ACTIVE' ? 'ativo' : 'inativo'} />
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-xs text-muted-foreground">
                      {user.updatedAt ? format(new Date(user.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                    </ConfigDataTableCell>
                    <ConfigDataTableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenResetPin(user.id)} title="Resetar PIN de Autorização">
                          <KeyRound className="h-4 w-4 text-orange-600" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(user.id)} title="Editar Usuário">
                          <Edit2 className="h-4 w-4" />
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

      <UserFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        userId={selectedUserId} 
        onSuccess={loadUsers} 
      />
      
      <ResetPinDialog 
        isOpen={isResetPinOpen}
        onClose={() => setIsResetPinOpen(false)}
        userId={resetUserId}
      />
    </div>
  );
}
