'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Network, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveChartOfAccountAction, archiveChartOfAccountAction } from '@/lib/financial/chart-of-accounts-actions';

export default function PlanoContasClient({ initialData }: { initialData: any[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'DESPESA',
    parentId: 'none',
    acceptsEntries: true,
  });

  const refreshData = () => startTransition(() => router.refresh());

  const handleOpenModal = (account?: any) => {
    if (account) {
      setEditingId(account.id);
      setForm({
        code: account.code,
        name: account.name,
        type: account.type,
        parentId: account.parentId || 'none',
        acceptsEntries: account.acceptsEntries,
      });
    } else {
      setEditingId(null);
      setForm({
        code: '',
        name: '',
        type: 'DESPESA',
        parentId: 'none',
        acceptsEntries: true,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) return toast({ variant: 'destructive', title: 'Código e Nome são obrigatórios.' });

    const res = await saveChartOfAccountAction({
      id: editingId || undefined,
      ...form,
      parentId: form.parentId === 'none' ? undefined : form.parentId,
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
    if (!confirm('Deseja realmente remover esta conta?')) return;
    const res = await archiveChartOfAccountAction(id);
    if (res.success) {
      toast({ title: 'Removida com sucesso.' });
      refreshData();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: res.error });
    }
  };

  // Sort by code to simulate hierarchy
  const sortedData = [...initialData].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <Network className="h-8 w-8 text-indigo-600" /> Plano de Contas
          </h1>
          <p className="text-muted-foreground text-sm">
            Estruture suas categorias de receitas, custos e despesas para a DRE.
          </p>
        </div>

        <Button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <PlusCircle className="w-5 h-5" /> Nova Conta
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Estrutura de Contas</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome da Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Recebe Lançamentos?</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((acc) => {
                  const level = acc.code.split('.').length - 1;
                  const isSintetica = !acc.acceptsEntries;
                  return (
                    <TableRow key={acc.id} className={isSintetica ? 'bg-slate-50' : ''}>
                      <TableCell className={isSintetica ? 'font-bold text-slate-800' : 'text-slate-600'}>
                        {acc.code}
                      </TableCell>
                      <TableCell>
                        <div style={{ paddingLeft: `${level * 1.5}rem` }} className={isSintetica ? 'font-bold text-slate-800' : 'text-slate-600'}>
                          {acc.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={acc.type === 'RECEITA' ? 'text-emerald-700' : 'text-rose-700'}>
                          {acc.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {acc.acceptsEntries ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800">Sim (Analítica)</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-500">Não (Sintética)</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(acc)}>
                          <Edit className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Código (Ex: 1.01.01)</label>
                <Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={form.type} onValueChange={(val) => setForm({...form, type: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEITA">Receita</SelectItem>
                    <SelectItem value="CUSTO">Custo (CMV)</SelectItem>
                    <SelectItem value="DESPESA">Despesa</SelectItem>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="PASSIVO">Passivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Conta Pai (Opcional)</label>
                <Select value={form.parentId} onValueChange={(val) => setForm({...form, parentId: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (Conta Raiz)</SelectItem>
                    {sortedData.filter(a => !a.acceptsEntries && a.id !== editingId).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 p-3 border rounded-lg bg-slate-50">
              <input type="checkbox" id="acceptsEntries" checked={form.acceptsEntries} onChange={(e) => setForm({...form, acceptsEntries: e.target.checked})} className="w-4 h-4" />
              <label htmlFor="acceptsEntries" className="text-sm">Conta Analítica (Recebe Lançamentos)</label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Desmarque para criar uma Conta Sintética (Grupo Agregador).</p>
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
