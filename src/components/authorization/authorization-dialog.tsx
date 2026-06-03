'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import {
  validateAuthorizationPinAction,
  approveAuthorizationAction,
  rejectAuthorizationAction,
} from '@/lib/auth/authorization-actions';
import { AuthorizationType } from '@/lib/auth/authorization-types';

interface AuthorizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorizationId: string;
  authorizationType: AuthorizationType;
  title?: string;
  description?: string;
  amount?: number;
  percentage?: number;
  onAuthorized: (authorization: any) => void;
  onRejected?: () => void;
}

export function AuthorizationDialog({
  open,
  onOpenChange,
  authorizationId,
  authorizationType,
  title = 'Autorização Necessária',
  description = 'Esta operação requer aprovação gerencial. Informe seu PIN de autorização.',
  amount,
  percentage,
  onAuthorized,
  onRejected,
}: AuthorizationDialogProps) {
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const [rejectionMode, setRejectionMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleAuthorize = async () => {
    if (!pin) {
      toast({ title: 'Atenção', description: 'Informe o PIN.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // 1. Validate PIN & RBAC
      const valRes = await validateAuthorizationPinAction({
        pin,
        authorizationType,
        amount,
        percentage,
      });

      if (!valRes.success || !valRes.authorizerId) {
        toast({ title: 'Acesso Negado', description: valRes.error, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // 2. Approve Request
      const appRes = await approveAuthorizationAction({
        authorizationId,
        authorizerId: valRes.authorizerId,
      });

      if (appRes.success) {
        toast({ title: 'Sucesso', description: 'Operação autorizada com sucesso!' });
        onAuthorized(appRes.authorization);
        onOpenChange(false);
      } else {
        toast({ title: 'Erro', description: appRes.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação', variant: 'destructive' });
    } finally {
      setLoading(false);
      setPin('');
    }
  };

  const handleReject = async () => {
    if (!pin) {
      toast({ title: 'Atenção', description: 'Informe o PIN para registrar a rejeição.', variant: 'destructive' });
      return;
    }

    if (!rejectionReason.trim()) {
      toast({ title: 'Atenção', description: 'Informe o motivo da rejeição.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const valRes = await validateAuthorizationPinAction({
        pin,
        authorizationType,
        amount,
        percentage,
      });

      if (!valRes.success || !valRes.authorizerId) {
        toast({ title: 'Acesso Negado', description: valRes.error, variant: 'destructive' });
        setLoading(false);
        return;
      }

      const rejRes = await rejectAuthorizationAction({
        authorizationId,
        rejecterId: valRes.authorizerId,
        rejectionReason,
      });

      if (rejRes.success) {
        toast({ title: 'Rejeitado', description: 'A solicitação foi rejeitada.', variant: 'default' });
        if (onRejected) onRejected();
        onOpenChange(false);
      } else {
        toast({ title: 'Erro', description: rejRes.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação', variant: 'destructive' });
    } finally {
      setLoading(false);
      setPin('');
      setRejectionMode(false);
    }
  };

  // Reset state on close
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setPin('');
      setRejectionMode(false);
      setRejectionReason('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!rejectionMode && (
            <div className="space-y-2">
              <label className="text-sm font-medium">PIN de Autorização</label>
              <Input
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                className="text-center text-xl tracking-widest h-12"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAuthorize();
                }}
                disabled={loading}
              />
            </div>
          )}

          {rejectionMode && (
            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 flex gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-sm text-rose-900">
                  Para registrar a rejeição, o gerente deve validar com seu PIN e informar o motivo.
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">PIN do Gerente</label>
                <Input
                  type="password"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={6}
                  className="text-center text-xl tracking-widest"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo da Rejeição</label>
                <Input
                  placeholder="Ex: Valor muito alto, fora da política..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {!rejectionMode ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => setRejectionMode(true)} disabled={loading} className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700">
                Rejeitar Ação
              </Button>
              <Button onClick={handleAuthorize} disabled={loading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Autorizar'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setRejectionMode(false)} disabled={loading} className="w-full sm:w-auto">
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={loading} className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Rejeição'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
