'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, Clock, Info } from 'lucide-react';
import { getAuthorizationHistoryAction, getPendingAuthorizationsAction } from '@/lib/auth/authorization-actions';
import { AuthorizationStatus } from '@/lib/auth/authorization-types';

export default function CentralAutorizacoesPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [histRes, pendRes] = await Promise.all([
          getAuthorizationHistoryAction(),
          getPendingAuthorizationsAction(),
        ]);
        
        if (histRes.success) setHistory(histRes.data || []);
        if (pendRes.success) setPending(pendRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="p-6">Carregando central de autorizações...</div>;
  }

  const renderBadge = (status: string) => {
    switch (status) {
      case AuthorizationStatus.APPROVED:
        return <Badge className="bg-emerald-100 text-emerald-800"><ShieldCheck className="w-3 h-3 mr-1" /> Aprovada</Badge>;
      case AuthorizationStatus.REJECTED:
        return <Badge variant="destructive"><ShieldAlert className="w-3 h-3 mr-1" /> Rejeitada</Badge>;
      case AuthorizationStatus.PENDING:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de Autorizações</h1>
          <p className="text-muted-foreground mt-2">
            Histórico completo de aprovações e rejeições gerenciais.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-indigo-50/50 border-indigo-100">
          <CardHeader className="py-4">
            <CardTitle className="text-lg font-medium text-indigo-900 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Autorizações Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-700">{pending.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico Recente</CardTitle>
          <CardDescription>
            Mostrando as últimas 100 requisições processadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
              <Info className="w-12 h-12 mb-4 text-slate-300" />
              Nenhum histórico encontrado.
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tipo</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Solicitante</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Autorizador</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Data/Hora</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {history.map((auth) => (
                    <tr key={auth.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 font-medium">{auth.type}</td>
                      <td className="p-4">
                        <div className="text-xs text-muted-foreground">ID: {auth.requestedByUserId.substring(0, 8)}...</div>
                      </td>
                      <td className="p-4">
                        {auth.authorizedByUserId ? (
                          <>
                            <div className="text-xs text-muted-foreground">ID: {auth.authorizedByUserId.substring(0, 8)}...</div>
                            {auth.authorizerRoleName && <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">{auth.authorizerRoleName}</span>}
                          </>
                        ) : auth.rejectedByUserId ? (
                          <span className="text-rose-600 text-xs">ID: {auth.rejectedByUserId.substring(0, 8)}...</span>
                        ) : '-'}
                      </td>
                      <td className="p-4">{renderBadge(auth.status)}</td>
                      <td className="p-4">
                        {new Date(auth.updatedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4 max-w-[200px] truncate text-xs text-muted-foreground" title={auth.reason || auth.rejectionReason}>
                        {auth.status === 'REJECTED' ? auth.rejectionReason : (
                          auth.percentage ? `Perc: ${auth.percentage}%` : 
                          auth.amount ? `Valor: R$ ${Number(auth.amount).toFixed(2)}` : auth.reason
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
