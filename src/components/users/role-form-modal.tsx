'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getRoleByIdAction, createRoleAction, updateRoleAction } from '@/lib/roles/role-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ConfigInputField, ConfigSelectField, ConfigTextareaField, ConfigFormActions } from '@/components/configuracoes/config-ui';
import { Loader2 } from 'lucide-react';
import { isFormDirty } from '@/lib/utils/form-utils';

interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleId: string | null;
  onSuccess: () => void;
}

export default function RoleFormModal({ isOpen, onClose, roleId, onSuccess }: RoleFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!roleId;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaultForm = {
    name: '',
    description: '',
    status: 'ACTIVE',
    isAdmin: false,
    defaultCommissionRate: '',
    defaultMaxDiscountPercentage: ''
  };

  const [form, setForm] = useState(defaultForm);
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        loadRole();
      } else {
        setForm(defaultForm);
        setInitialData(defaultForm);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, roleId]);

  const loadRole = async () => {
    if (!roleId) return;
    setLoading(true);
    try {
      const res = await getRoleByIdAction(roleId);
      if (res.success && res.data) {
        const r = res.data;
        const mappedData = {
          name: r.name || '',
          description: r.description || '',
          status: r.status || 'ACTIVE',
          isAdmin: r.isAdmin || false,
          defaultCommissionRate: r.defaultCommissionRate !== null ? String(r.defaultCommissionRate) : '',
          defaultMaxDiscountPercentage: r.defaultMaxDiscountPercentage !== null ? String(r.defaultMaxDiscountPercentage) : ''
        };
        setForm(mappedData);
        setInitialData(mappedData);
      } else {
        toast({ title: 'Erro', description: res.error || 'Erro ao buscar grupo', variant: 'destructive' });
        onClose();
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha de comunicação.', variant: 'destructive' });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validations
    if (!form.name || form.name.length < 2) {
      return toast({ title: 'Atenção', description: 'Nome inválido', variant: 'destructive' });
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        status: form.status,
        isAdmin: form.isAdmin,
        defaultCommissionRate: form.defaultCommissionRate !== '' ? Number(form.defaultCommissionRate) : null,
        defaultMaxDiscountPercentage: form.defaultMaxDiscountPercentage !== '' ? Number(form.defaultMaxDiscountPercentage) : null,
      };

      const res = isEditing 
        ? await updateRoleAction(roleId, payload)
        : await createRoleAction(payload);
        
      if (res.success) {
        toast({ title: 'Sucesso', description: `Grupo ${isEditing ? 'atualizado' : 'criado'} com sucesso!` });
        onSuccess();
        onClose();
      } else {
        toast({ title: 'Erro', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao salvar grupo.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const dirty = isFormDirty(form, initialData);

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Edite as definições e comissões padrão deste grupo.' : 'Crie um novo perfil operacional.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Carregando dados...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <ConfigInputField
              label="Nome do Grupo *"
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            
            <ConfigTextareaField
              label="Descrição / Detalhes"
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            <ConfigSelectField
              label="Status *"
              id="status"
              value={form.status}
              onValueChange={(val) => setForm({ ...form, status: val })}
              options={[
                { label: 'Ativo', value: 'ACTIVE' },
                { label: 'Inativo', value: 'INACTIVE' },
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <ConfigInputField
                label="Comissão Padrão (%)"
                id="defaultCommissionRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.defaultCommissionRate}
                onChange={(e) => setForm({ ...form, defaultCommissionRate: e.target.value })}
              />
              <ConfigInputField
                label="Limite Desc. Padrão (%)"
                id="defaultMaxDiscountPercentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.defaultMaxDiscountPercentage}
                onChange={(e) => setForm({ ...form, defaultMaxDiscountPercentage: e.target.value })}
              />
            </div>

            <div className="pt-4 border-t mt-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.isAdmin} 
                  onChange={e => setForm({ ...form, isAdmin: e.target.checked })} 
                />
                <span className="font-semibold text-rose-700">Forçar privilégio de ROOT Admin</span>
              </label>
              <p className="text-xs text-muted-foreground mt-1 ml-5">Concede acesso ilimitado ao sistema e protege o grupo contra exclusão acidental.</p>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <ConfigFormActions
                isSaving={saving}
                isDirty={dirty}
                onCancel={onClose}
                onSave={handleSave}
                saveLabel={isEditing ? 'Salvar Alterações' : 'Criar Grupo'}
              />
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
