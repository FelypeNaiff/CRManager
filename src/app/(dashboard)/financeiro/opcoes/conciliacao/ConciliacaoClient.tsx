'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, CircleDashed, FileSearch, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTransactionsForReconciliationAction, toggleReconciliationStatusAction } from '@/lib/financial/reconciliation-actions';
import { Badge } from '@/components/ui/badge';

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function ConciliacaoClient({ bankAccounts }: { bankAccounts: any[] }) {
  const { toast } = useToast();
  const [selectedBank, setSelectedBank] = useState<string>('');
  
  const now = new Date();
  const [monthYear, setMonthYear] = useState(`${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!selectedBank) {
      return toast({ variant: 'destructive', title: 'Selecione uma conta bancária.' });
    }
    if (!monthYear.match(/^\d{2}\/\d{4}$/)) {
      return toast({ variant: 'destructive', title: 'Mês/Ano inválido. Use MM/YYYY' });
    }

    setLoading(true);
    const res = await getTransactionsForReconciliationAction(selectedBank, monthYear);
    if (res.success) {
      setTransactions(res.data || []);
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
    setLoading(false);
  };

  const handleToggleReconcile = async (tx: any) => {
    const res = await toggleReconciliationStatusAction(tx.id, tx.status);
    if (res.success) {
      // Update local state
      setTransactions(prev => prev.map(t => {
        if (t.id === tx.id) {
          const isReconciled = t.description.startsWith('[CONCILIADO]');
          return {
            ...t,
            description: isReconciled ? t.description.replace('[CONCILIADO] ', '') : `[CONCILIADO] ${t.description}`
          };
        }
        return t;
      }));
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  const saldoSistema = transactions.reduce((acc, t) => {
    if (t.direction === 'IN') return acc + Number(t.amount);
    if (t.direction === 'OUT') return acc - Number(t.amount);
    return acc;
  }, 0);

  const saldoConciliado = transactions.filter(t => t.description.startsWith('[CONCILIADO]')).reduce((acc, t) => {
    if (t.direction === 'IN') return acc + Number(t.amount);
    if (t.direction === 'OUT') return acc - Number(t.amount);
    return acc;
  }, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <FileSearch className="h-8 w-8 text-indigo-600" /> Conciliação Bancária
          </h1>
          <p className="text-muted-foreground text-sm">
            Confronte os lançamentos do sistema com o seu extrato bancário.
          </p>
        </div>
      </div>

      <Card className="border-indigo-100 bg-indigo-50/30">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-2 flex-1">
            <label className="text-sm font-medium">Conta Bancária</label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-32">
            <label className="text-sm font-medium">Competência</label>
            <Input className="bg-white" placeholder="MM/YYYY" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
          </div>
          <Button onClick={handleSearch} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Buscar Extrato
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Saldo do Período (Sistema)</p>
              <p className={`text-2xl font-bold mt-1 ${saldoSistema >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatMoney(saldoSistema)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{transactions.length} lançamentos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Saldo Conciliado (Validado)
              </p>
              <p className={`text-2xl font-bold mt-1 ${saldoConciliado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatMoney(saldoConciliado)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-600">{transactions.filter(t => t.description.startsWith('[CONCILIADO]')).length} conciliados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lançamentos para Conciliação</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Data de Baixa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      Nenhuma transação encontrada no período. Clique em "Buscar Extrato".
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map(t => {
                    const isReconciled = t.description.startsWith('[CONCILIADO]');
                    const cleanDesc = t.description.replace('[CONCILIADO] ', '');

                    return (
                      <TableRow key={t.id} className={isReconciled ? 'bg-emerald-50/30' : ''}>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`p-0 h-auto hover:bg-transparent ${isReconciled ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-500'}`}
                            onClick={() => handleToggleReconcile(t)}
                            title={isReconciled ? 'Remover Conciliação' : 'Marcar como Conciliado'}
                          >
                            {isReconciled ? <CheckCircle2 className="w-6 h-6" /> : <CircleDashed className="w-6 h-6" />}
                          </Button>
                        </TableCell>
                        <TableCell>{t.paidAt ? new Date(t.paidAt).toLocaleDateString('pt-BR') : '-'}</TableCell>
                        <TableCell className={isReconciled ? 'text-slate-700 font-medium' : 'text-slate-500'}>{cleanDesc}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={t.direction === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${t.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.direction === 'IN' ? '+' : '-'}{formatMoney(Number(t.amount))}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
