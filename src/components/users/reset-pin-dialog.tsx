'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { resetUserAccessPinAction } from '@/lib/users/user-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ResetPinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

export default function ResetPinDialog({ isOpen, onClose, userId }: ResetPinDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleReset = async () => {
    if (!userId) return;
    if (!/^\d{4}$/.test(pin)) {
      return toast({ title: 'Atenção', description: 'O PIN de acesso deve conter exatamente 4 dígitos.', variant: 'destructive' });
    }
    if (pin !== confirmPin) {
      return toast({ title: 'Atenção', description: 'A confirmação do PIN não confere.', variant: 'destructive' });
    }
    setLoading(true);
    try {
      const res = await resetUserAccessPinAction(userId, pin);
      if (res.success) {
        toast({ title: 'Sucesso', description: 'PIN de acesso atualizado com sucesso.' });
        setPin('');
        setConfirmPin('');
        onClose();
      } else {
        toast({ title: 'Erro', description: res.error || 'Falha ao atualizar PIN de acesso', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPin('');
      setConfirmPin('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-orange-600" />
            Redefinir PIN de acesso
          </DialogTitle>
          <DialogDescription>
            Defina um novo PIN de 4 dígitos para entrar neste perfil pela conta operacional. O PIN atual nunca é exibido.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="access-pin" className="text-sm font-medium">Novo PIN de acesso</label>
            <Input id="access-pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} autoComplete="new-password" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="access-pin-confirmation" className="text-sm font-medium">Confirmar PIN de acesso</label>
            <Input id="access-pin-confirmation" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ''))} autoComplete="new-password" />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleReset} disabled={loading || pin.length !== 4 || confirmPin.length !== 4}>
            {loading ? 'Atualizando...' : 'Atualizar PIN de acesso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
