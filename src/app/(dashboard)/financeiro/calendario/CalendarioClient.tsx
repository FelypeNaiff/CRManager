'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowUpCircle, ArrowDownCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface CalendarioClientProps {
  initialMonth: number;
  initialYear: number;
  data: {
    payables: any[];
    receivables: any[];
    directIncomes: any[];
  };
}

export default function CalendarioClient({ initialMonth, initialYear, data }: CalendarioClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handlePrevMonth = () => {
    let m = initialMonth - 1;
    let y = initialYear;
    if (m < 1) { m = 12; y--; }
    router.push(`/financeiro/calendario?month=${m}&year=${y}`);
  };

  const handleNextMonth = () => {
    let m = initialMonth + 1;
    let y = initialYear;
    if (m > 12) { m = 1; y++; }
    router.push(`/financeiro/calendario?month=${m}&year=${y}`);
  };

  const handleToday = () => {
    const now = new Date();
    router.push(`/financeiro/calendario?month=${now.getMonth() + 1}&year=${now.getFullYear()}`);
  };

  // Build calendar days
  const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(initialYear, initialMonth - 1, 1).getDay();
  const daysInMonth = getDaysInMonth(initialMonth, initialYear);
  
  const days = [];
  // Padding para o primeiro dia (Dom = 0)
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(initialYear, initialMonth - 1, i));
  }

  // Aggregate data
  let totalReceber = 0;
  let totalPagar = 0;
  let atrasados = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDayData = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    const dayPayables = data.payables.filter(p => p.dueDate && new Date(p.dueDate).toISOString().split('T')[0] === dateStr);
    const dayReceivables = data.receivables.filter(r => r.dueDate && new Date(r.dueDate).toISOString().split('T')[0] === dateStr);
    const dayDirect = data.directIncomes.filter(d => d.dueDate && new Date(d.dueDate).toISOString().split('T')[0] === dateStr);

    let sumPay = 0;
    dayPayables.forEach(p => sumPay += Number(p.amount));
    
    let sumRec = 0;
    dayReceivables.forEach(r => sumRec += Number(r.originalAmount)); // Assumindo originalAmount ou remainingAmount
    dayDirect.forEach(d => sumRec += Number(d.amount));

    // Stats gerais do mês
    totalPagar += sumPay;
    totalReceber += sumRec;

    let hasOverdue = false;
    dayPayables.forEach(p => {
      if (p.status !== 'PAID' && new Date(p.dueDate) < today) {
        atrasados++;
        hasOverdue = true;
      }
    });

    return { dayPayables, dayReceivables, dayDirect, sumPay, sumRec, saldo: sumRec - sumPay, hasOverdue };
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Pre-calculate to fill headers
  const dayStats = days.map(d => d ? { date: d, ...getDayData(d) } : null);

  const selectedStats = selectedDate ? dayStats.find(d => d?.date.getTime() === selectedDate.getTime()) : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-indigo-600" /> Calendário Financeiro
          </h1>
          <p className="text-muted-foreground text-sm">
            Visão gerencial de Contas a Pagar e Receber
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border shadow-sm">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="w-5 h-5" /></Button>
          <div className="font-semibold px-4 text-slate-700 min-w-[140px] text-center">
            {monthNames[initialMonth - 1]} {initialYear}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="w-5 h-5" /></Button>
          <Button variant="outline" className="ml-2 text-xs h-8" onClick={handleToday}>Hoje</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-emerald-800 flex items-center gap-1"><ArrowUpCircle className="w-4 h-4" /> Previsão de Entradas</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatMoney(totalReceber)}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-rose-800 flex items-center gap-1"><ArrowDownCircle className="w-4 h-4" /> Previsão de Saídas</p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{formatMoney(totalPagar)}</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-indigo-800">Saldo Previsto do Mês</p>
            <p className={`text-2xl font-bold mt-1 ${totalReceber - totalPagar >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatMoney(totalReceber - totalPagar)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-800 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Atrasados</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{atrasados} contas</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b bg-slate-50 text-slate-500 font-semibold text-sm">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="p-3 text-center border-r last:border-r-0">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-slate-100 gap-[1px]">
          {dayStats.map((stat, idx) => {
            if (!stat) return <div key={`empty-${idx}`} className="bg-white min-h-[120px]" />;
            
            const isToday = stat.date.toDateString() === new Date().toDateString();

            return (
              <div 
                key={stat.date.toISOString()} 
                onClick={() => setSelectedDate(stat.date)}
                className={`bg-white min-h-[120px] p-2 flex flex-col gap-1 cursor-pointer hover:bg-indigo-50 transition-colors ${isToday ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                    {stat.date.getDate()}
                  </span>
                  {stat.hasOverdue && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                </div>

                {stat.sumRec > 0 && (
                  <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5 truncate">
                    ↑ {formatMoney(stat.sumRec)}
                  </div>
                )}
                {stat.sumPay > 0 && (
                  <div className="text-[11px] font-semibold text-rose-700 bg-rose-100 rounded px-1.5 py-0.5 truncate">
                    ↓ {formatMoney(stat.sumPay)}
                  </div>
                )}
                {(stat.sumRec > 0 || stat.sumPay > 0) && (
                  <div className={`mt-auto text-[11px] font-bold text-right pt-1 ${stat.saldo >= 0 ? 'text-slate-600' : 'text-rose-600'}`}>
                    {stat.saldo >= 0 ? '+' : ''}{formatMoney(stat.saldo)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer/Modal para o dia */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Resumo do Dia {selectedDate && selectedDate.toLocaleDateString('pt-BR')}
            </DialogTitle>
            <DialogDescription>
              Detalhamento de contas a pagar e receber previstas para esta data.
            </DialogDescription>
          </DialogHeader>

          {selectedStats && (
            <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
              {/* Receitas */}
              <div>
                <h3 className="font-semibold text-emerald-700 flex items-center gap-2 mb-3">
                  <ArrowUpCircle className="w-5 h-5" /> Entradas ({formatMoney(selectedStats.sumRec)})
                </h3>
                {selectedStats.dayReceivables.length === 0 && selectedStats.dayDirect.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Nenhuma entrada prevista.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedStats.dayReceivables.map((r: any) => (
                      <div key={r.id} className="flex justify-between items-center p-3 border rounded-lg text-sm bg-white shadow-sm">
                        <div>
                          <p className="font-medium text-slate-800">Conta a Receber #{r.id.split('-')[0]}</p>
                          <Badge variant="outline" className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                            {r.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{formatMoney(Number(r.originalAmount))}</p>
                        </div>
                      </div>
                    ))}
                    {selectedStats.dayDirect.map((d: any) => (
                      <div key={d.id} className="flex justify-between items-center p-3 border rounded-lg text-sm bg-white shadow-sm">
                        <div>
                          <p className="font-medium text-slate-800">{d.description || 'Receita Direta'}</p>
                          <Badge variant="outline" className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                            {d.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{formatMoney(Number(d.amount))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Despesas */}
              <div>
                <h3 className="font-semibold text-rose-700 flex items-center gap-2 mb-3">
                  <ArrowDownCircle className="w-5 h-5" /> Saídas ({formatMoney(selectedStats.sumPay)})
                </h3>
                {selectedStats.dayPayables.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Nenhuma saída prevista.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedStats.dayPayables.map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg text-sm bg-white shadow-sm">
                        <div>
                          <p className="font-medium text-slate-800">{p.description || 'Conta a Pagar'}</p>
                          <p className="text-xs text-slate-500">{p.costCenter?.name || 'Sem centro de custo'}</p>
                          <Badge variant="outline" className={`mt-1 ${p.status === 'PAID' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {p.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-rose-600">{formatMoney(Number(p.amount))}</p>
                          {p.status !== 'PAID' && (
                            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                              Baixar Conta
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
