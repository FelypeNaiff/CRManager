"use client";

import React, { useEffect, useState } from "react";
import { useProfile } from "@/lib/contexts/profile-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAccountsReceivableAction, settleReceivableAction } from "@/lib/financial/receivables-actions";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Search, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RecebimentosPage() {
  const { activeProfile } = useProfile();
  const { toast } = useToast();
  
  const [receivables, setReceivables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!activeProfile?.empresaId) return;
    setIsLoading(true);
    const res = await getAccountsReceivableAction(activeProfile.empresaId, {
      status: filterStatus
    });
    
    if (res.success && res.receivables) {
      setReceivables(res.receivables);
    } else {
      toast({ title: "Erro ao carregar recebíveis", description: res.error, variant: "destructive" });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeProfile?.empresaId, filterStatus]);

  const handleSettle = async (id: string) => {
    if (!confirm("Confirmar a baixa manual deste título? O valor líquido será creditado conforme as taxas cadastradas.")) return;
    
    setSettlingId(id);
    const res = await settleReceivableAction(id);
    if (res.success) {
      toast({ title: "Título baixado com sucesso!" });
      loadData();
    } else {
      toast({ title: "Erro na baixa", description: res.error, variant: "destructive" });
    }
    setSettlingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "PENDING": return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200"><Clock className="w-3 h-3 mr-1"/> Pendente</Badge>;
      case "PAID": return <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1"/> Liquidado</Badge>;
      case "CANCELLED": return <Badge variant="destructive"><ShieldAlert className="w-3 h-3 mr-1"/> Cancelado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Contas a Receber</h1>
          <p className="text-muted-foreground mt-1">Gerencie os títulos gerados pelo PDV e faturas de clientes.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-1 w-full sm:w-[200px]">
              <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="PAID">Liquidados (Pagos)</SelectItem>
                  <SelectItem value="CANCELLED">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1" />
            
            <Button variant="outline" onClick={() => loadData()}>
              <Search className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Valor Original</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando títulos...</TableCell>
                  </TableRow>
                ) : receivables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum título encontrado.</TableCell>
                  </TableRow>
                ) : (
                  receivables.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(new Date(rec.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                        {rec.paidAt && <div className="text-xs text-emerald-600 mt-1">Pago: {format(new Date(rec.paidAt), "dd/MM")}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{rec.customer?.name || "Cliente Avulso"}</div>
                        {rec.customer?.phone && <div className="text-xs text-muted-foreground">{rec.customer.phone}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">Venda {rec.financialTransaction?.referenceId?.slice(0,8)}</div>
                        <div className="text-xs text-muted-foreground">Parc. {rec.installmentNumber}/{rec.totalInstallments}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rec.financialTransaction?.paymentMethod?.name || "Desconhecido"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(rec.originalAmount))}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(rec.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        {rec.status === "PENDING" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200"
                            onClick={() => handleSettle(rec.id)}
                            disabled={settlingId === rec.id}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {settlingId === rec.id ? "Processando..." : "Baixar"}
                          </Button>
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
