'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { resetUserPinAction } from '@/lib/users/user-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, KeyRound, CheckCircle2, Copy } from 'lucide-react';

interface ResetPinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

export default function ResetPinDialog({ isOpen, onClose, userId }: ResetPinDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);

  const handleReset = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await resetUserPinAction(userId);
      if (res.success && res.tempPin) {
        setGeneratedPin(res.tempPin);
        toast({ title: "Sucesso", description: "Operação realizada com sucesso." });
      } else {
        toast({ title: 'Erro', description: res.error || 'Falha ao resetar PIN', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro de comunicação.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedPin) {
      navigator.clipboard.writeText(generatedPin);
      toast({ title: 'Copiado', description: 'PIN copiado para a área de transferência.' });
    }
  };

  const handleClose = () => {
    if (!loading) {
      setGeneratedPin(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-orange-600" />
            Reset de PIN de Autorização
          </DialogTitle>
          <DialogDescription>
            {generatedPin 
              ? 'PIN temporário gerado com sucesso.'
              : 'Tem certeza que deseja resetar o PIN de autorização deste usuário? Isso invalidará o PIN atual e gerará um temporário.'
            }
          </DialogDescription>
        </DialogHeader>

        {generatedPin ? (
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm text-center text-muted-foreground">
              Forneça este PIN ao usuário. Ele será obrigado a alterá-lo no próximo acesso.
            </p>
            <div className="flex items-center gap-3 p-4 bg-slate-100 rounded-lg w-full justify-center text-3xl font-mono font-bold tracking-[0.25em]">
              {generatedPin}
            </div>
            <Button variant="outline" className="w-full" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" /> Copiar PIN Temporário
            </Button>
          </div>
        ) : (
          <div className="bg-orange-50 p-4 rounded-lg flex gap-3 text-orange-800 border border-orange-100 mt-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">
              Esta ação gravará no log de auditoria e exigirá que o usuário cadastre uma nova senha (PIN) ao autorizar sua próxima operação no PDV ou sistema.
            </p>
          </div>
        )}

        <DialogFooter className="mt-6">
          {generatedPin ? (
            <Button onClick={handleClose}>Concluir</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
              <Button variant="destructive" onClick={handleReset} disabled={loading}>
                {loading ? 'Resetando...' : 'Sim, Resetar PIN'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
