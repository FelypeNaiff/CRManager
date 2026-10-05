'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ArrowRightLeft, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createTransferAction } from '@/lib/financial/transfers-actions';

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function TransferenciasClient({ initialData, bankAccounts }: { initialData: any[], bankAccounts: any[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    amount: 0,
    originAccountId: '',
    destinationAccountId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const refreshData = () => startTransition(() => router.refresh());

  const handleSave = async () => {
    if (form.amount <= 0 || !form.originAccountId || !form.destinationAccountId) {
      return toast({ variant: 'destructive', title: 'Preencha os campos corretamente.' });
    }

    const res = await createTransferAction(form);

    if (res.success) {
      toast({ title: 'Transferência realizada com sucesso!' });
      setModalOpen(false);
      setForm({
        amount: 0,
        originAccountId: '',
        destinationAccountId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
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
            <ArrowRightLeft className="h-8 w-8 text-indigo-600" /> Transferências
          </h1>
          <p className="text-muted-foreground text-sm">
            Movimente saldos entre o caixa físico, cofre e contas bancárias.
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <PlusCircle className="w-5 h-5" /> Nova Transferência
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico Recente</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta Bancária</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">Nenhuma transferência encontrada.</TableCell></TableRow>
                )}
                {initialData.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{t.bankAccount?.name || 'Desconhecida'}</TableCell>
                    <TableCell>
                      {t.direction === 'IN' ? (
                        <span className="text-emerald-600 font-semibold">Entrada</span>
                      ) : (
                        <span className="text-rose-600 font-semibold">Saída</span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold">{formatMoney(Number(t.amount))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.description}</TableCell>
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
            <DialogTitle>Nova Transferência Interna</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Conta de Origem (Sai dinheiro)</label>
                <Select value={form.originAccountId} onValueChange={(val) => setForm({...form, originAccountId: val})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} (Saldo: {formatMoney(Number(b.currentBalance))})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Conta de Destino (Entra dinheiro)</label>
                <Select value={form.destinationAccountId} onValueChange={(val) => setForm({...form, destinationAccountId: val})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} (Saldo: {formatMoney(Number(b.currentBalance))})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor (R$)</label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: Number(e.target.value)})} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição / Motivo</label>
              <Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Ex: Transferência de troco do caixa para cofre" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-indigo-600 text-white">Transferir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
