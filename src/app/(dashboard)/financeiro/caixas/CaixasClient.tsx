'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { 
  openCashRegister, 
  closeCashRegister, 
  addCashMovement 
} from '@/lib/financial/cash-register-service';
import { 
  Store, Wallet, ArrowDownCircle, ArrowUpCircle, 
  History, CheckCircle, AlertCircle, PlusCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (date: string | Date) => new Date(date).toLocaleString('pt-BR');

interface CaixasClientProps {
  initialCurrent: any;
  initialHistory: any[];
  bankAccounts: any[];
}

export default function CaixasClient({ initialCurrent, initialHistory, bankAccounts }: CaixasClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [current, setCurrent] = useState(initialCurrent);
  const [history, setHistory] = useState(initialHistory);

  // Modals state
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  // Form states
  const [openForm, setOpenForm] = useState({ bankAccountId: '', openingBalance: 0, notes: '' });
  const [movForm, setMovForm] = useState({ type: 'REFORCO', amount: 0, description: '' });
  const [closeForm, setCloseForm] = useState({ closingBalance: 0, notes: '' });

  const refreshData = () => {
    startTransition(() => {
      router.refresh();
      // Em um cenário ideal faríamos um fetch local aqui, mas router.refresh() 
      // já instrui o Next.js a rodar os loaders do RSC e enviar os novos dados.
      // E para atualização imediata otimista a gente pode dar reload.
      window.location.reload(); 
    });
  };

  const handleOpenRegister = async () => {
    const res = await openCashRegister({
      bankAccountId: openForm.bankAccountId,
      openingBalance: Number(openForm.openingBalance),
      notes: openForm.notes
    });
    if (res.success) {
      toast({ title: 'Caixa aberto com sucesso!' });
      setOpenModalOpen(false);
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  const handleMovement = async () => {
    const res = await addCashMovement({
      cashRegisterId: current.id,
      type: movForm.type,
      amount: Number(movForm.amount),
      description: movForm.description
    });
    if ('requireAuthorization' in res && res.requireAuthorization) {
      toast({ title: 'Autorização pendente', description: 'O movimento aguarda aprovação gerencial.' });
      setMovementModalOpen(false);
      setMovForm({ type: 'REFORCO', amount: 0, description: '' });
      refreshData();
    } else if ((res as any).success) {
      toast({ title: 'Movimento registrado com sucesso!' });
      setMovementModalOpen(false);
      setMovForm({ type: 'REFORCO', amount: 0, description: '' });
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: (res as any).error });
    }
  };

  const handleCloseRegister = async () => {
    const res = await closeCashRegister(current.id, {
      closingBalance: Number(closeForm.closingBalance),
      notes: closeForm.notes
    });
    if (res.success) {
      toast({ title: 'Caixa fechado com sucesso!' });
      setCloseModalOpen(false);
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  // Calcular expected balance
  let currentExpected = current ? Number(current.openingBalance) : 0;
  if (current && current.movements) {
    current.movements.forEach((m: any) => {
      if (m.type === 'REFORCO') currentExpected += Number(m.amount);
      if (m.type === 'SANGRIA') currentExpected -= Number(m.amount);
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <Store className="h-8 w-8 text-indigo-600" /> Gestão de Caixas
          </h1>
          <p className="text-muted-foreground text-sm">
            Abertura de turnos, suprimentos, sangrias e conferência cega.
          </p>
        </div>

        {!current && (
          <Dialog open={openModalOpen} onOpenChange={setOpenModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold">
                <PlusCircle className="w-5 h-5" /> Abrir Caixa Agora
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Abertura de Caixa</DialogTitle>
                <DialogDescription>Inicie um novo turno para registrar vendas e movimentos.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Conta Bancária vinculada (Física)</label>
                  <Select value={openForm.bankAccountId} onValueChange={(val) => setOpenForm({...openForm, bankAccountId: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta/gaveta" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Saldo Inicial (Fundo de Troco)</label>
                  <Input type="number" min="0" step="0.01" value={openForm.openingBalance} onChange={(e) => setOpenForm({...openForm, openingBalance: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações</label>
                  <Input value={openForm.notes} onChange={(e) => setOpenForm({...openForm, notes: e.target.value})} placeholder="Opcional" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleOpenRegister} className="bg-indigo-600 text-white">Confirmar Abertura</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {current && (
        <Card className="border-indigo-100 shadow-md bg-gradient-to-br from-indigo-50 to-white overflow-hidden">
          <div className="h-1 w-full bg-indigo-500"></div>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <CheckCircle className="w-5 h-5 text-green-500" /> Caixa Aberto: {current.bankAccount?.name}
                </CardTitle>
                <CardDescription className="text-indigo-700/70 mt-1">
                  Aberto por <span className="font-semibold">{current.openedBy?.name}</span> em {formatDate(current.openedAt)}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Dialog open={movementModalOpen} onOpenChange={setMovementModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">Movimentar Valor</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Movimento Manual</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Button 
                          type="button"
                          variant={movForm.type === 'REFORCO' ? 'default' : 'outline'}
                          className={movForm.type === 'REFORCO' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                          onClick={() => setMovForm({...movForm, type: 'REFORCO'})}
                        >
                          <ArrowUpCircle className="w-4 h-4 mr-2" /> Suprimento
                        </Button>
                        <Button 
                          type="button"
                          variant={movForm.type === 'SANGRIA' ? 'default' : 'outline'}
                          className={movForm.type === 'SANGRIA' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
                          onClick={() => setMovForm({...movForm, type: 'SANGRIA'})}
                        >
                          <ArrowDownCircle className="w-4 h-4 mr-2" /> Sangria
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Valor (R$)</label>
                        <Input type="number" min="0.01" step="0.01" value={movForm.amount} onChange={(e) => setMovForm({...movForm, amount: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Motivo / Descrição</label>
                        <Input value={movForm.description} onChange={(e) => setMovForm({...movForm, description: e.target.value})} placeholder="Ex: Retirada para cofre" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleMovement} className={movForm.type === 'REFORCO' ? 'bg-emerald-600' : 'bg-amber-500'}>
                        Confirmar {movForm.type === 'REFORCO' ? 'Suprimento' : 'Sangria'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm">Fechar Caixa</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Fechamento de Caixa (Conferência Cega)</DialogTitle>
                      <DialogDescription>Digite o valor total contado na gaveta. O sistema fará o cruzamento de divergências.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="bg-slate-50 p-4 rounded-lg border flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-700">
                          Atenção: conte com cuidado as moedas e cédulas. Qualquer divergência entre o valor declarado e as vendas gerará uma quebra/sobra na auditoria.
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium font-headline">Total em Dinheiro Contado (R$)</label>
                        <Input type="number" min="0" step="0.01" className="text-lg font-bold" value={closeForm.closingBalance} onChange={(e) => setCloseForm({...closeForm, closingBalance: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Observações do Fechamento</label>
                        <Input value={closeForm.notes} onChange={(e) => setCloseForm({...closeForm, notes: e.target.value})} placeholder="Opcional" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCloseModalOpen(false)}>Revisar Caixa</Button>
                      <Button onClick={handleCloseRegister} className="bg-rose-600 text-white">Encerrar Turno Definitivo</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Fundo de Troco Inicial</p>
                <p className="text-2xl font-bold font-headline text-slate-800">{formatMoney(Number(current.openingBalance))}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Saldo Atual Esperado (em Dinheiro)</p>
                <p className="text-2xl font-bold font-headline text-indigo-700">{formatMoney(currentExpected)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Status Operacional</p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  RECEBENDO VENDAS
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
            <History className="w-5 h-5 text-slate-500" /> Histórico de Turnos e Auditoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Gaveta Fica</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Divergência</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">Nenhum caixa encontrado no histórico.</TableCell>
                  </TableRow>
                ) : (
                  history.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium text-slate-700">
                        {formatDate(reg.openedAt)}
                      </TableCell>
                      <TableCell>{reg.openedBy?.name}</TableCell>
                      <TableCell>{reg.bankAccount?.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {reg.closedAt ? formatDate(reg.closedAt) : 'Em andamento'}
                      </TableCell>
                      <TableCell>
                        {reg.difference ? (
                          <span className={Number(reg.difference) === 0 ? 'text-slate-500' : Number(reg.difference) > 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                            {formatMoney(Number(reg.difference))}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          reg.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {reg.status === 'OPEN' ? 'ABERTO' : 'FECHADO'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
