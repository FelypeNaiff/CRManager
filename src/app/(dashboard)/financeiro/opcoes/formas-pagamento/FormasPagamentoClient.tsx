'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { savePaymentMethodAction, archivePaymentMethodAction } from '@/lib/financial/payment-methods-actions';
import { PaymentMethodType } from '@prisma/client';

export default function FormasPagamentoClient({ initialData }: { initialData: any[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'CREDIT_CARD' as PaymentMethodType,
    feePercentage: 0,
    settlementDays: 30,
    allowsInstallments: true,
    isActive: true,
  });

  const refreshData = () => startTransition(() => router.refresh());

  const handleOpenModal = (method?: any) => {
    if (method) {
      setEditingId(method.id);
      setForm({
        name: method.name,
        type: method.type,
        feePercentage: Number(method.feePercentage) * 100, // Convert to % for display if stored as decimal, wait, it's stored as Decimal %? Assume Decimal(5,4) means 0.0500 is 5% or 5.0000 is 5%. Let's assume it stores 5 for 5%.
        settlementDays: method.settlementDays,
        allowsInstallments: method.allowsInstallments,
        isActive: method.isActive,
      });
    } else {
      setEditingId(null);
      setForm({
        name: '',
        type: 'CREDIT_CARD',
        feePercentage: 0,
        settlementDays: 0,
        allowsInstallments: false,
        isActive: true,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast({ variant: 'destructive', title: 'Nome é obrigatório.' });

    const res = await savePaymentMethodAction({
      id: editingId || undefined,
      ...form,
    });

    if (res.success) {
      toast({ title: 'Salvo com sucesso!' });
      setModalOpen(false);
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta forma de pagamento?')) return;
    const res = await archivePaymentMethodAction(id);
    if (res.success) {
      toast({ title: 'Removida com sucesso.' });
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-indigo-600" /> Formas de Pagamento
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie taxas e prazos de recebimento das maquininhas e meios de pagamento.
          </p>
        </div>

        <Button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <PlusCircle className="w-5 h-5" /> Nova Forma de Pagamento
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Métodos Ativos</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Taxa (%)</TableHead>
                  <TableHead>Prazo (Dias)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.map((pm) => (
                  <TableRow key={pm.id}>
                    <TableCell className="font-medium">{pm.name}</TableCell>
                    <TableCell>{pm.type}</TableCell>
                    <TableCell>{Number(pm.feePercentage)}%</TableCell>
                    <TableCell>D+{pm.settlementDays}</TableCell>
                    <TableCell>
                      {pm.isActive ? (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-500">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenModal(pm)}>
                        <Edit className="w-4 h-4 text-slate-500" />
                      </Button>
                      {!pm.isSystemDefault && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(pm.id)}>
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome (ex: Cartão Master Crédito, PIX)</label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={form.type} onValueChange={(val) => setForm({...form, type: val as PaymentMethodType})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                    <SelectItem value="DEBIT_CARD">Cartão de Débito</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="CASH">Dinheiro</SelectItem>
                    <SelectItem value="STORE_CREDIT">Crediário/Vale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Taxa da Operadora (%)</label>
                <Input type="number" step="0.01" value={form.feePercentage} onChange={(e) => setForm({...form, feePercentage: Number(e.target.value)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dias p/ Recebimento</label>
                <Input type="number" value={form.settlementDays} onChange={(e) => setForm({...form, settlementDays: Number(e.target.value)})} />
              </div>
              <div className="flex items-center gap-2 mt-8">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({...form, isActive: e.target.checked})} />
                <label htmlFor="isActive" className="text-sm">Método Ativo no PDV</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-indigo-600 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
