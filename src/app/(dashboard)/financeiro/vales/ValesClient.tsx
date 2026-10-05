'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, PlusCircle, CheckCircle, Clock, XCircle, 
  Download, ArrowRightLeft, DollarSign, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { createEmployeeAdvanceAction, settleEmployeeAdvanceAction, cancelEmployeeAdvanceAction } from '@/lib/financial/employee-advances-actions';

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('pt-BR');

interface ValesClientProps {
  initialData: any[];
  users: any[];
  currentMonth: string;
  openRegister: any;
}

export default function ValesClient({ initialData, users, currentMonth, openRegister }: ValesClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    employeeId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    competenceMonth: currentMonth,
    type: 'CASH_ADVANCE',
    observation: '',
    deductFromCashRegister: false,
  });

  const refreshData = () => {
    startTransition(() => {
      router.push(`/financeiro/vales?month=${monthFilter}`);
      router.refresh();
    });
  };

  const handleFilterChange = (newMonth: string) => {
    setMonthFilter(newMonth);
    startTransition(() => {
      router.push(`/financeiro/vales?month=${newMonth}`);
    });
  };

  const handleCreate = async () => {
    if (!form.employeeId || form.amount <= 0) {
      toast({ variant: 'destructive', title: 'Preencha os campos obrigatórios.' });
      return;
    }

    const res = await createEmployeeAdvanceAction({
      employeeId: form.employeeId,
      amount: form.amount,
      date: form.date,
      competenceMonth: form.competenceMonth,
      type: form.type,
      observation: form.observation,
      deductFromCashRegisterId: form.deductFromCashRegister && openRegister ? openRegister.id : undefined,
    });

    if (res.success) {
      toast({ title: 'Vale registrado com sucesso!' });
      setModalOpen(false);
      setForm({ ...form, amount: 0, observation: '', deductFromCashRegister: false });
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  const handleSettle = async (id: string) => {
    if (!confirm('Deseja marcar este vale como descontado em folha?')) return;
    const res = await settleEmployeeAdvanceAction(id);
    if (res.success) {
      toast({ title: 'Vale liquidado!' });
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Deseja cancelar este lançamento? O valor estornado não será devolvido automaticamente ao caixa se foi sacado lá.')) return;
    const res = await cancelEmployeeAdvanceAction(id);
    if (res.success) {
      toast({ title: 'Vale cancelado.' });
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  // KPIs
  const totalGeral = initialData.filter(v => v.status !== 'CANCELLED').reduce((acc, v) => acc + Number(v.amount), 0);
  const totalPendente = initialData.filter(v => v.status === 'PENDING').reduce((acc, v) => acc + Number(v.amount), 0);
  const totalDescontado = initialData.filter(v => v.status === 'DEDUCTED_PAYROLL').reduce((acc, v) => acc + Number(v.amount), 0);
  const uniqueEmployees = new Set(initialData.filter(v => v.status !== 'CANCELLED').map(v => v.employeeId)).size;

  const typeLabels: any = {
    CASH_ADVANCE: 'Adiantamento Dinheiro',
    PIX_ADVANCE: 'Adiantamento PIX',
    STORE_PRODUCT_WITHDRAWAL: 'Retirada Mercadoria'
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-8 w-8 text-indigo-600" /> Vales de Funcionários
          </h1>
          <p className="text-muted-foreground text-sm">
            Controle de adiantamentos e retiradas para folha de pagamento.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Input 
            className="w-32" 
            placeholder="MM/YYYY" 
            value={monthFilter} 
            onChange={(e) => handleFilterChange(e.target.value)} 
          />
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Exportar Folha
          </Button>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <PlusCircle className="w-5 h-5" /> Novo Vale
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lançar Adiantamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Colaboradora</label>
                  <Select value={form.employeeId} onValueChange={(val) => setForm({...form, employeeId: val})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {users.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.name} {u.cargo ? `(${u.cargo})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data do Vale</label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Competência (MM/YYYY)</label>
                    <Input value={form.competenceMonth} onChange={(e) => setForm({...form, competenceMonth: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Saída</label>
                  <Select value={form.type} onValueChange={(val) => setForm({...form, type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH_ADVANCE"><span className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-600"/> Dinheiro em Espécie</span></SelectItem>
                      <SelectItem value="PIX_ADVANCE"><span className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-indigo-600"/> Transferência / PIX</span></SelectItem>
                      <SelectItem value="STORE_PRODUCT_WITHDRAWAL"><span className="flex items-center gap-2"><Package className="w-4 h-4 text-rose-600"/> Retirada de Mercadoria</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: Number(e.target.value)})} />
                </div>

                {form.type === 'CASH_ADVANCE' && openRegister && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <input 
                      type="checkbox" 
                      id="deduct-cash" 
                      className="w-4 h-4"
                      checked={form.deductFromCashRegister}
                      onChange={(e) => setForm({...form, deductFromCashRegister: e.target.checked})}
                    />
                    <label htmlFor="deduct-cash" className="text-sm text-amber-900 cursor-pointer">
                      Lançar como Sangria no Caixa Atual ({openRegister.bankAccount?.name})
                    </label>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações / Peças</label>
                  <Input value={form.observation} onChange={(e) => setForm({...form, observation: e.target.value})} placeholder="Referência ou justificativa" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} className="bg-indigo-600 text-white">Salvar Lançamento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-500">Total do Mês (Competência)</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{formatMoney(totalGeral)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-800 flex items-center gap-1"><Clock className="w-4 h-4"/> Pendente de Desconto</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{formatMoney(totalPendente)}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-emerald-800 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Já Descontado</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatMoney(totalDescontado)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-500">Colaboradoras com Vales</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{uniqueEmployees} funcionárias</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-800">Detalhamento Analítico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Colaboradora</TableHead>
                  <TableHead>Tipo / Obs</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">Nenhum vale lançado na competência {monthFilter}.</TableCell>
                  </TableRow>
                ) : (
                  initialData.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{formatDate(v.date)}</TableCell>
                      <TableCell className="font-medium text-slate-700">{v.employee?.name}</TableCell>
                      <TableCell>
                        <span className="block text-sm">{typeLabels[v.type] || v.type}</span>
                        {v.observation && <span className="text-xs text-muted-foreground">{v.observation}</span>}
                      </TableCell>
                      <TableCell className="font-bold text-slate-800">{formatMoney(Number(v.amount))}</TableCell>
                      <TableCell>
                        {v.status === 'PENDING' && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">Pendente</Badge>}
                        {v.status === 'DEDUCTED_PAYROLL' && <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Descontado</Badge>}
                        {v.status === 'CANCELLED' && <Badge variant="outline" className="bg-slate-100 text-slate-500">Cancelado</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => handleSettle(v.id)}>
                              Descontar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50" onClick={() => handleCancel(v.id)}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
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
