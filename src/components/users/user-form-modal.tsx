'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getUserByIdAction, createUserAction, updateUserAction } from '@/lib/users/user-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ConfigInputField, ConfigSelectField, ConfigTextareaField, ConfigFormActions } from '@/components/configuracoes/config-ui';
import { Loader2 } from 'lucide-react';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onSuccess: () => void;
}

export default function UserFormModal({ isOpen, onClose, userId, onSuccess }: UserFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!userId;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaultForm = {
    name: '',
    email: '',
    cargo: '',
    status: 'ACTIVE',
    commissionRate: 0,
    maxDiscountPercentage: '',
    pin: '',
    confirmPin: '',
    observacoes: ''
  };

  const [form, setForm] = useState(defaultForm);
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        loadUser();
      } else {
        setForm(defaultForm);
        setInitialData(defaultForm);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  const loadUser = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await getUserByIdAction(userId);
      if (res.success && res.data) {
        const u = res.data;
        const mappedData = {
          name: u.name,
          email: u.email, // email is usually readonly on edit, but let's just populate
          cargo: u.cargo || '',
          status: u.status,
          commissionRate: Number(u.commissionRate || 0),
          maxDiscountPercentage: u.maxDiscountPercentage !== null ? String(u.maxDiscountPercentage) : '',
          pin: '', // Never populate pin on edit
          confirmPin: '',
          observacoes: ''
        };
        setForm(mappedData);
        setInitialData(mappedData);
      } else {
        toast({ title: 'Erro', description: res.error || 'Erro ao buscar usuário', variant: 'destructive' });
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
    if (!isEditing) {
      if (!form.email || !form.email.includes('@')) {
        return toast({ title: 'Atenção', description: 'E-mail inválido', variant: 'destructive' });
      }
      if (!form.pin || form.pin.length < 4 || form.pin.length > 8) {
        return toast({ title: 'Atenção', description: 'O PIN deve ter entre 4 e 8 dígitos', variant: 'destructive' });
      }
      if (form.pin !== form.confirmPin) {
        return toast({ title: 'Atenção', description: 'A confirmação do PIN não confere', variant: 'destructive' });
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        cargo: form.cargo,
        status: form.status,
        commissionRate: Number(form.commissionRate),
        maxDiscountPercentage: form.maxDiscountPercentage !== '' ? Number(form.maxDiscountPercentage) : null,
        observacoes: form.observacoes,
        ...( !isEditing && { pin: form.pin } )
      };

      const res = isEditing 
        ? await updateUserAction(userId, payload)
        : await createUserAction(payload);
        
      if (res.success) {
        toast({ title: 'Sucesso', description: `Usuário ${isEditing ? 'atualizado' : 'criado'} com sucesso!` });
        onSuccess();
        onClose();
      } else {
        toast({ title: 'Erro', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao salvar usuário.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialData);

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifique os dados do usuário abaixo.' : 'Preencha os dados para criar um novo usuário e definir seu PIN operacional.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Carregando dados...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <ConfigInputField
                label="Nome *"
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <ConfigInputField
                label="E-mail *"
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={isEditing}
                required={!isEditing}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ConfigInputField
                label="Cargo / Função"
                id="cargo"
                value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ConfigInputField
                label="Comissão Individual (%)"
                id="commissionRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.commissionRate}
                onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })}
                description="Deixe 0 para usar do grupo"
              />
              <ConfigInputField
                label="Limite de Desconto (%)"
                id="maxDiscountPercentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.maxDiscountPercentage}
                onChange={(e) => setForm({ ...form, maxDiscountPercentage: e.target.value })}
                description="Vazio p/ usar do grupo"
              />
            </div>

            {!isEditing && (
              <div className="grid grid-cols-2 gap-4 bg-orange-50 p-4 rounded-md border border-orange-100">
                <ConfigInputField
                  label="PIN de Autorização *"
                  id="pin"
                  type="password"
                  maxLength={8}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                  description="Apenas números (4 a 8)"
                />
                <ConfigInputField
                  label="Confirmar PIN *"
                  id="confirmPin"
                  type="password"
                  maxLength={8}
                  value={form.confirmPin}
                  onChange={(e) => setForm({ ...form, confirmPin: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            )}

            <ConfigTextareaField
              label="Observações Internas"
              id="observacoes"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />

            <div className="pt-4 flex justify-end gap-2">
              <ConfigFormActions
                isSaving={saving}
                isDirty={isFormDirty}
                onCancel={onClose}
                onSave={handleSave}
                saveLabel={isEditing ? 'Salvar Alterações' : 'Criar Usuário'}
              />
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
