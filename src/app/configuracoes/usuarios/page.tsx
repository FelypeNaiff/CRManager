'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getUsersAction } from '@/lib/users/user-actions';
import { ConfigPageHeader, ConfigStatusBadge, ConfigDataTable, ConfigDataTableHeader, ConfigDataTableBody, ConfigDataTableRow, ConfigDataTableHead, ConfigDataTableCell } from '@/components/configuracoes/config-ui';
import { Button } from '@/components/ui/button';
import { Plus, Search, Edit2, KeyRound, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import UserFormModal from '@/components/users/user-form-modal';
import ResetPinDialog from '@/components/users/reset-pin-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/hooks/use-permissions';

export default function UsuariosPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  const [isResetPinOpen, setIsResetPinOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

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

  const handleOpenDelete = (id: string) => {
    setDeleteUserId(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try {
      // We will need to import deleteUserAction
      const { deleteUserAction } = await import('@/lib/users/user-actions');
      const res = await deleteUserAction(deleteUserId);
      if (res.success) {
        toast({ title: 'Usuário excluído com sucesso.' });
        loadUsers();
      } else {
        toast({ title: 'Erro ao excluir', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro inesperado.', variant: 'destructive' });
    } finally {
      setIsDeleteOpen(false);
      setDeleteUserId(null);
    }
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
          description="Gerencie os acessos, permissões, limites e PINs de acesso da sua equipe."
          breadcrumb={[{ label: 'Configurações', href: '/configuracoes' }, { label: 'Usuários' }]}
        />
        {can('USUARIOS', 'CREATE') && <Button onClick={handleOpenCreate} className="self-start sm:self-auto">
          <Plus className="mr-2 h-4 w-4" /> Novo Usuário
        </Button>}
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
                <ConfigDataTableHead>Nome & E-mail</ConfigDataTableHead>
                <ConfigDataTableHead>Cargo / Grupo</ConfigDataTableHead>
                <ConfigDataTableHead>Limite Desc.</ConfigDataTableHead>
                <ConfigDataTableHead>Status</ConfigDataTableHead>
                <ConfigDataTableHead>Última Att.</ConfigDataTableHead>
                <ConfigDataTableHead className="text-right">Ações</ConfigDataTableHead>
              </ConfigDataTableRow>
            </ConfigDataTableHeader>
            <ConfigDataTableBody>
              {loading ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando usuários...
                  </ConfigDataTableCell>
                </ConfigDataTableRow>
              ) : filteredUsers.length === 0 ? (
                <ConfigDataTableRow>
                  <ConfigDataTableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                        {can('USUARIOS', 'RESET_PIN') && <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenResetPin(user.id)} title="Redefinir PIN de acesso">
                          <KeyRound className="h-4 w-4 text-orange-600" />
                        </Button>}
                        {can('USUARIOS', 'UPDATE') && <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(user.id)} title="Editar Usuário">
                          <Edit2 className="h-4 w-4" />
                        </Button>}
                        {can('USUARIOS', 'DELETE') && <Button variant="outline" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleOpenDelete(user.id)} title="Excluir Usuário">
                          <Trash2 className="h-4 w-4" />
                        </Button>}
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
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-rose-700 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Excluir Usuário
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário? O histórico de ações dele será mantido, mas o acesso ao sistema será revogado imediatamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-600" onClick={handleDelete}>
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
